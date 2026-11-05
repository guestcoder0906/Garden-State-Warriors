import React, { useEffect, useRef, useState } from 'react';

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

// Uses VITE_RECAPTCHA_SITE_KEY when configured, falling back to Google's official reCAPTCHA v2 API key
const DEFAULT_RECAPTCHA_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

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

export interface RecaptchaWidgetProps {
  onVerify: (token: string) => void;
  resetSignal?: number;
}

export const RecaptchaWidget: React.FC<RecaptchaWidgetProps> = ({ onVerify, resetSignal = 0 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const onVerifyRef = useRef(onVerify);
  onVerifyRef.current = onVerify;

  const [loadError, setLoadError] = useState(false);

  const siteKey =
    (import.meta.env.VITE_RECAPTCHA_SITE_KEY || '').trim() || DEFAULT_RECAPTCHA_SITE_KEY;

  useEffect(() => {
    let cancelled = false;

    loadGoogleRecaptchaScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.grecaptcha) return;
        window.grecaptcha.ready(() => {
          if (cancelled || !containerRef.current || !window.grecaptcha) return;
          if (widgetIdRef.current !== null) return;
          try {
            widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
              sitekey: siteKey,
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
            setLoadError(true);
          }
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current !== null && window.grecaptcha) {
      try {
        window.grecaptcha.reset(widgetIdRef.current);
        onVerifyRef.current('');
      } catch {
        // Ignore reset errors
      }
    }
  }, [resetSignal]);

  return (
    <div className="space-y-1.5">
      <div ref={containerRef} className="min-h-[78px]" />
      {loadError && (
        <p className="text-xs text-red-300">
          Unable to load Google reCAPTCHA widget. Please check your connection or ad-blocker settings.
        </p>
      )}
    </div>
  );
};
