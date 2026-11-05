import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, ShieldCheck, RefreshCw } from 'lucide-react';

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      render: (
        container: HTMLElement,
        parameters: {
          sitekey: string;
          theme?: 'dark' | 'light';
          size?: 'normal' | 'compact';
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        }
      ) => number;
      reset: (optWidgetId?: number) => void;
    };
    __onRecaptchaApiLoaded?: () => void;
  }
}

const GOOGLE_TEST_SITE_KEY_PREFIX = '6LeIxAcT';

function getConfiguredProductionRecaptchaSiteKey(): string {
  const raw = String(import.meta.env.VITE_RECAPTCHA_SITE_KEY || '').trim();
  if (
    !raw ||
    raw.startsWith('YOUR_') ||
    raw.startsWith(GOOGLE_TEST_SITE_KEY_PREFIX)
  ) {
    return '';
  }
  return raw;
}

let recaptchaScriptPromise: Promise<void> | null = null;

function loadGoogleRecaptchaScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.grecaptcha && typeof window.grecaptcha.render === 'function') {
    return Promise.resolve();
  }
  if (recaptchaScriptPromise) return recaptchaScriptPromise;

  recaptchaScriptPromise = new Promise<void>((resolve, reject) => {
    window.__onRecaptchaApiLoaded = () => {
      resolve();
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="google.com/recaptcha/api.js"]'
    );
    if (existing) {
      const checkInterval = window.setInterval(() => {
        if (window.grecaptcha && typeof window.grecaptcha.render === 'function') {
          window.clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.src =
      'https://www.google.com/recaptcha/api.js?onload=__onRecaptchaApiLoaded&render=explicit';
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      recaptchaScriptPromise = null;
      reject(new Error('Failed to load Google reCAPTCHA API'));
    };
    document.head.appendChild(script);
  });

  return recaptchaScriptPromise;
}

async function sha256HexBrowser(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Solves a SHA-256 Proof-of-Work challenge in non-blocking batches using WebCrypto.
 */
async function solveSha256ProofOfWork(
  salt: string,
  targetChallenge: string,
  maxIterations: number
): Promise<number> {
  const batchSize = 250;
  for (let start = 0; start <= maxIterations; start += batchSize) {
    const end = Math.min(start + batchSize, maxIterations);
    const promises: Promise<string>[] = [];
    for (let n = start; n < end; n++) {
      promises.push(sha256HexBrowser(`${salt}:${n}`));
    }
    const hashes = await Promise.all(promises);
    const matchOffset = hashes.indexOf(targetChallenge);
    if (matchOffset !== -1) {
      return start + matchOffset;
    }
    // Yield briefly to keep UI responsive
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error('Could not solve cryptographic CAPTCHA challenge');
}

export interface RecaptchaWidgetProps {
  onVerify: (token: string) => void;
  resetSignal?: number;
}

export const RecaptchaWidget: React.FC<RecaptchaWidgetProps> = ({ onVerify, resetSignal = 0 }) => {
  const productionRecaptchaKey = getConfiguredProductionRecaptchaSiteKey();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const onVerifyRef = useRef(onVerify);
  onVerifyRef.current = onVerify;

  // Cryptographic Proof-of-Work CAPTCHA API state (used when no custom domain-locked reCAPTCHA key is set)
  const [status, setStatus] = useState<'idle' | 'verifying' | 'verified' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Mode A: Custom production Google reCAPTCHA v2 site key (if configured in env vars)
  useEffect(() => {
    if (!productionRecaptchaKey) return;
    let cancelled = false;

    loadGoogleRecaptchaScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.grecaptcha) return;
        window.grecaptcha.ready(() => {
          if (cancelled || !containerRef.current || !window.grecaptcha) return;
          if (widgetIdRef.current !== null) return;
          try {
            widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
              sitekey: productionRecaptchaKey,
              theme: 'dark',
              callback: (token: string) => {
                onVerifyRef.current(token);
              },
              'expired-callback': () => {
                onVerifyRef.current('');
              },
              'error-callback': () => {
                onVerifyRef.current('');
              },
            });
          } catch {
            setStatus('error');
          }
        });
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [productionRecaptchaKey]);

  // Reset handler for both modes
  useEffect(() => {
    if (resetSignal > 0) {
      if (productionRecaptchaKey && widgetIdRef.current !== null && window.grecaptcha) {
        try {
          window.grecaptcha.reset(widgetIdRef.current);
        } catch {
          // Ignore reset errors
        }
      }
      setStatus('idle');
      setErrorMsg('');
      onVerifyRef.current('');
    }
  }, [resetSignal, productionRecaptchaKey]);

  const handleCryptographicVerify = async () => {
    if (status === 'verifying' || status === 'verified') return;
    setStatus('verifying');
    setErrorMsg('');

    try {
      // 1. Request a fresh cryptographic SHA-256 Proof-of-Work challenge from /api/captcha
      let challengeData: {
        challenge: string;
        salt: string;
        signature?: string;
        maxnumber: number;
        serverIssued: boolean;
      } | null = null;

      try {
        const res = await fetch(`/api/captcha?_t=${Date.now()}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const json = await res.json();
          if (json && json.challenge && json.salt) {
            challengeData = {
              challenge: json.challenge,
              salt: json.salt,
              signature: json.signature,
              maxnumber: Number(json.maxnumber) || 50000,
              serverIssued: true,
            };
          }
        }
      } catch {
        // Fallback to client WebCrypto challenge in local Vite preview
      }

      if (!challengeData) {
        const randBytes = new Uint8Array(12);
        window.crypto.getRandomValues(randBytes);
        const nonce = Array.from(randBytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        const salt = `${Date.now()}.${nonce}`;
        const targetNum = Math.floor(Math.random() * 6000) + 1500;
        const challenge = await sha256HexBrowser(`${salt}:${targetNum}`);
        challengeData = {
          challenge,
          salt,
          maxnumber: 10000,
          serverIssued: false,
        };
      }

      // 2. Solve the SHA-256 Proof-of-Work challenge via WebCrypto
      const solvedNumber = await solveSha256ProofOfWork(
        challengeData.salt,
        challengeData.challenge,
        challengeData.maxnumber
      );

      // 3. Verify the solution with POST /api/captcha when issued by the serverless endpoint
      if (challengeData.serverIssued && challengeData.signature) {
        const verifyRes = await fetch('/api/captcha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challenge: challengeData.challenge,
            salt: challengeData.salt,
            signature: challengeData.signature,
            number: solvedNumber,
          }),
        });
        const verifyJson = await verifyRes.json();
        if (!verifyRes.ok || !verifyJson?.ok || !verifyJson?.token) {
          throw new Error(verifyJson?.error || 'CAPTCHA verification failed');
        }
        setStatus('verified');
        onVerifyRef.current(verifyJson.token);
        return;
      }

      // WebCrypto PoW token format verified by /api/sync
      const powToken = `pow.${challengeData.salt}.${solvedNumber}.${challengeData.challenge}`;
      setStatus('verified');
      onVerifyRef.current(powToken);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message || 'Verification failed. Please try again.');
      onVerifyRef.current('');
    }
  };

  if (productionRecaptchaKey) {
    return (
      <div className="space-y-1.5">
        <div ref={containerRef} className="min-h-[78px]" />
        {status === 'error' && (
          <p className="text-xs text-red-300">
            Unable to load reCAPTCHA widget. Please check your domain key configuration.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="w-full sm:w-[304px] rounded-xl bg-[#0D1611] border border-white/15 px-4 py-3 flex items-center justify-between gap-3 select-none">
        <button
          type="button"
          onClick={handleCryptographicVerify}
          disabled={status === 'verifying' || status === 'verified'}
          className="flex items-center gap-3 text-left focus:outline-none group flex-1"
        >
          <span
            className={`w-6 h-6 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
              status === 'verified'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400'
                : status === 'verifying'
                ? 'bg-[#EAB308]/10 border-[#EAB308] text-[#EAB308]'
                : 'bg-[#070C09] border-white/30 group-hover:border-[#EAB308]'
            }`}
          >
            {status === 'verifying' && <Loader2 className="w-4 h-4 animate-spin" />}
            {status === 'verified' && <Check className="w-4 h-4 stroke-[3]" />}
          </span>
          <span className="text-sm font-medium text-white">
            {status === 'verifying'
              ? 'Verifying browser...'
              : status === 'verified'
              ? 'Verified human'
              : "I'm not a robot"}
          </span>
        </button>

        <div className="flex items-center gap-2 shrink-0 border-l border-white/10 pl-3">
          {status === 'error' && (
            <button
              type="button"
              onClick={handleCryptographicVerify}
              aria-label="Retry verification"
              className="p-1 rounded hover:bg-white/10 text-neutral-300 hover:text-white"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1 text-[#EAB308]">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono-tabular">
                ALTCHA
              </span>
            </div>
            <span className="text-[9px] text-neutral-400 font-mono-tabular">
              SHA-256 PoW
            </span>
          </div>
        </div>
      </div>

      {status === 'error' && errorMsg && (
        <p className="text-xs text-red-300">{errorMsg}</p>
      )}
    </div>
  );
};
