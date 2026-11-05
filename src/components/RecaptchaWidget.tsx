import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, RefreshCw } from 'lucide-react';

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
      render?: (
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
      reset?: (optWidgetId?: number) => void;
    };
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

let recaptchaV3Promise: Promise<void> | null = null;
let loadedRecaptchaKey = '';

/**
 * Loads Google's official reCAPTCHA v3 API (`https://www.google.com/recaptcha/api.js?render=SITE_KEY`).
 * Using `?render=SITE_KEY` + `grecaptcha.execute()` works natively with Google reCAPTCHA v3 keys
 * without triggering "ERROR for site owner: Invalid key type".
 */
function loadGoogleRecaptchaV3Script(siteKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (
    window.grecaptcha &&
    typeof window.grecaptcha.execute === 'function' &&
    loadedRecaptchaKey === siteKey
  ) {
    return Promise.resolve();
  }
  if (recaptchaV3Promise && loadedRecaptchaKey === siteKey) {
    return recaptchaV3Promise;
  }

  loadedRecaptchaKey = siteKey;
  recaptchaV3Promise = new Promise<void>((resolve, reject) => {
    // Remove any older explicit-mode script if present
    const oldScripts = document.querySelectorAll<HTMLScriptElement>(
      'script[src*="google.com/recaptcha/api.js"]'
    );
    oldScripts.forEach((s) => {
      if (!s.src.includes(encodeURIComponent(siteKey))) {
        s.remove();
      }
    });

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.grecaptcha && typeof window.grecaptcha.ready === 'function') {
        window.grecaptcha.ready(() => resolve());
      } else {
        resolve();
      }
    };
    script.onerror = () => {
      recaptchaV3Promise = null;
      reject(new Error('Failed to load Google reCAPTCHA API'));
    };
    document.head.appendChild(script);
  });

  return recaptchaV3Promise;
}

async function sha256HexBrowser(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

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
  const onVerifyRef = useRef(onVerify);
  onVerifyRef.current = onVerify;

  const [status, setStatus] = useState<'idle' | 'verifying' | 'verified' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Preload Google reCAPTCHA v3 script when VITE_RECAPTCHA_SITE_KEY is configured
  useEffect(() => {
    if (!productionRecaptchaKey) return;
    loadGoogleRecaptchaV3Script(productionRecaptchaKey).catch(() => {
      // Fallback handled on click
    });
  }, [productionRecaptchaKey]);

  // Reset state after form submission
  useEffect(() => {
    if (resetSignal > 0) {
      setStatus('idle');
      setErrorMsg('');
      onVerifyRef.current('');
    }
  }, [resetSignal]);

  const handleVerifyClick = async () => {
    if (status === 'verifying' || status === 'verified') return;
    setStatus('verifying');
    setErrorMsg('');

    try {
      // 1. If VITE_RECAPTCHA_SITE_KEY is set, execute Google reCAPTCHA v3 API (`grecaptcha.execute`)
      if (productionRecaptchaKey) {
        try {
          await loadGoogleRecaptchaV3Script(productionRecaptchaKey);
          if (window.grecaptcha && typeof window.grecaptcha.execute === 'function') {
            const googleToken = await new Promise<string>((resolve, reject) => {
              window.grecaptcha!.ready(() => {
                window.grecaptcha!
                  .execute(productionRecaptchaKey, { action: 'submit' })
                  .then(resolve)
                  .catch(reject);
              });
            });

            if (googleToken) {
              // Verify token against /api/captcha (which checks Google's siteverify endpoint)
              try {
                const verifyRes = await fetch('/api/captcha', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'verifyRecaptcha',
                    recaptchaToken: googleToken,
                  }),
                });
                if (verifyRes.ok) {
                  const verifyJson = await verifyRes.json();
                  if (verifyJson?.ok && verifyJson?.token) {
                    setStatus('verified');
                    onVerifyRef.current(verifyJson.token);
                    return;
                  }
                }
              } catch {
                // In local Vite dev where /api/captcha isn't mounted, pass the real Google token directly
              }

              setStatus('verified');
              onVerifyRef.current(googleToken);
              return;
            }
          }
        } catch {
          // If Google script fails due to domain mismatch in preview, fall through to cryptographic PoW
        }
      }

      // 2. Cryptographic SHA-256 Proof-of-Work fallback via /api/captcha
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

      const solvedNumber = await solveSha256ProofOfWork(
        challengeData.salt,
        challengeData.challenge,
        challengeData.maxnumber
      );

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

      const powToken = `pow.${challengeData.salt}.${solvedNumber}.${challengeData.challenge}`;
      setStatus('verified');
      onVerifyRef.current(powToken);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message || 'Verification failed. Please try again.');
      onVerifyRef.current('');
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="w-full sm:w-[310px] rounded-xl bg-[#0D1611] border border-white/15 px-4 py-3 flex items-center justify-between gap-3 select-none shadow-sm">
        <button
          type="button"
          onClick={handleVerifyClick}
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
              ? 'Verifying...'
              : status === 'verified'
              ? "I'm not a robot"
              : "I'm not a robot"}
          </span>
        </button>

        <div className="flex items-center gap-2 shrink-0 border-l border-white/10 pl-3">
          {status === 'error' && (
            <button
              type="button"
              onClick={handleVerifyClick}
              aria-label="Retry verification"
              className="p-1 rounded hover:bg-white/10 text-neutral-300 hover:text-white"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="flex flex-col items-center text-center">
            <svg
              viewBox="0 0 64 64"
              className="w-6 h-6"
              aria-hidden="true"
            >
              <path
                fill="#4285F4"
                d="M32 8a24 24 0 0 1 21.8 14H46l8 10 8-10h-5.5A28 28 0 0 0 32 4C18.2 4 6.7 13.9 4.4 27h4.1A24 24 0 0 1 32 8z"
              />
              <path
                fill="#34A853"
                d="M32 56a24 24 0 0 1-21.8-14H18l-8-10-8 10h5.5A28 28 0 0 0 32 60c13.8 0 25.3-9.9 27.6-23h-4.1A24 24 0 0 1 32 56z"
              />
            </svg>
            <span className="text-[9px] font-semibold text-neutral-300 leading-tight mt-0.5">
              reCAPTCHA
            </span>
            <div className="flex items-center gap-1 text-[8px] text-neutral-400 leading-none mt-0.5">
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                Privacy
              </a>
              <span>-</span>
              <a
                href="https://policies.google.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                Terms
              </a>
            </div>
          </div>
        </div>
      </div>

      {status === 'error' && errorMsg && (
        <p className="text-xs text-red-300">{errorMsg}</p>
      )}
    </div>
  );
};
