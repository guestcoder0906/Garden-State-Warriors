const MIN_HUMAN_FILL_TIME_MS = 2200;
const SUBMISSION_COOLDOWN_MS = 30000;
const MAX_SUBMISSIONS_PER_HOUR = 6;
const RATE_LIMIT_STORAGE_KEY = 'gsw_form_security_log_v1';

/**
 * Strips dangerous HTML/script tags and control characters from user form text.
 */
export function sanitizeFormText(input: string, maxLength = 2000): string {
  return String(input || '')
    .replace(/<\s*\/?\s*(script|iframe|object|embed|style|link|meta)[^>]*>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Checks if a text field contains typical bot/spam patterns (e.g. HTML script injection,
 * link stuffing in non-URL fields, or excessive URLs).
 */
export function containsSpamPatterns(text: string, allowSingleUrl = false): boolean {
  const s = String(text || '').trim();
  if (!s) return false;

  if (/<\s*script|javascript:|data:text\/html|\[url=|\[link=/i.test(s)) {
    return true;
  }

  const urlMatches = s.match(/https?:\/\/[^\s]+|www\.[^\s]+/gi) || [];
  if (!allowSingleUrl && urlMatches.length > 0) {
    return true;
  }
  if (allowSingleUrl && urlMatches.length > 2) {
    return true;
  }

  if (/\b(viagra|casino|crypto\s*airdrop|telegram\s*pump|seo\s*backlinks|loan\s*shark)\b/i.test(s)) {
    return true;
  }

  return false;
}

export function isValidEmailAddress(email: string): boolean {
  const trimmed = String(email || '').trim();
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

export function isValidPhoneNumber(phone: string): boolean {
  const trimmed = String(phone || '').trim();
  if (!trimmed) return false;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Verifies anti-bot security checks:
 * 1. Honeypot trap field must be empty
 * 2. Form must not be submitted faster than humanly possible (< 2.2s)
 * 3. Google reCAPTCHA v2 API token must be present
 * 4. Rate limit & duplicate submission guard in localStorage
 */
export function verifyAntiSpamSubmission(params: {
  formKey: 'sponsor' | 'warrior';
  honeypotValue: string;
  formLoadedAt: number;
  captchaToken: string;
  payloadFingerprint: string;
  nowMs?: number;
}): { ok: boolean; error?: string } {
  const now = params.nowMs ?? Date.now();

  // 1. Honeypot check
  if (String(params.honeypotValue || '').trim() !== '') {
    return {
      ok: false,
      error: 'Spam submission blocked by security filter.',
    };
  }

  // 2. Minimum human interaction time check
  if (params.formLoadedAt > 0 && now - params.formLoadedAt < MIN_HUMAN_FILL_TIME_MS) {
    return {
      ok: false,
      error: 'Please take a moment to review the form before submitting.',
    };
  }

  // 3. Real Google reCAPTCHA API token check
  if (!String(params.captchaToken || '').trim()) {
    return {
      ok: false,
      error: 'Please complete the Google reCAPTCHA verification ("I\'m not a robot") before submitting.',
    };
  }

  // 4. Browser rate-limiting and duplicate payload check
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
      const history: { formKey: string; ts: number; fp: string }[] = raw ? JSON.parse(raw) : [];
      const oneHourAgo = now - 3600_000;
      const recent = history.filter((item) => item && typeof item.ts === 'number' && item.ts > oneHourAgo);

      const lastSameForm = recent
        .filter((item) => item.formKey === params.formKey)
        .sort((a, b) => b.ts - a.ts)[0];

      if (lastSameForm && now - lastSameForm.ts < SUBMISSION_COOLDOWN_MS) {
        const waitSec = Math.ceil((SUBMISSION_COOLDOWN_MS - (now - lastSameForm.ts)) / 1000);
        return {
          ok: false,
          error: `Please wait ${waitSec} seconds before submitting another ${params.formKey} form.`,
        };
      }

      if (recent.length >= MAX_SUBMISSIONS_PER_HOUR) {
        return {
          ok: false,
          error: 'Too many submissions from this browser recently. Please try again later.',
        };
      }

      const duplicateRecent = recent.find(
        (item) => item.fp === params.payloadFingerprint && now - item.ts < 600_000
      );
      if (duplicateRecent) {
        return {
          ok: false,
          error: 'This exact application was already submitted recently.',
        };
      }
    } catch {
      // Ignore storage access errors
    }
  }

  return { ok: true };
}

export function recordSuccessfulFormSubmission(
  formKey: 'sponsor' | 'warrior',
  payloadFingerprint: string,
  nowMs?: number
): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const now = nowMs ?? Date.now();
  try {
    const raw = window.localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    const history: { formKey: string; ts: number; fp: string }[] = raw ? JSON.parse(raw) : [];
    const oneHourAgo = now - 3600_000;
    const recent = history.filter((item) => item && typeof item.ts === 'number' && item.ts > oneHourAgo);
    recent.push({ formKey, ts: now, fp: payloadFingerprint });
    window.localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(recent));
  } catch {
    // Ignore quota errors
  }
}

/**
 * Validates the "Become a Warrior" form so empty or spammy applications are never accepted.
 * Fields: First Name, Last Name, Branch, Phone, Email, Preferred Method of Contact, Hockey Experience, Additional Questions/Info.
 */
export function validateWarriorApplicationInput(input: {
  firstName: string;
  lastName: string;
  branch: string;
  phone: string;
  email: string;
  preferredContact: string[] | string;
  experience: string;
  questionsInfo: string;
}): { ok: boolean; error?: string } {
  const firstName = sanitizeFormText(input.firstName, 80);
  const lastName = sanitizeFormText(input.lastName, 80);
  const branch = sanitizeFormText(input.branch, 80);
  const phone = sanitizeFormText(input.phone, 40);
  const email = sanitizeFormText(input.email, 120);
  const preferredContactStr = Array.isArray(input.preferredContact)
    ? sanitizeFormText(input.preferredContact.join(', '), 80)
    : sanitizeFormText(input.preferredContact, 80);
  const experience = sanitizeFormText(input.experience, 2000);
  const questionsInfo = sanitizeFormText(input.questionsInfo, 2000);

  if (!firstName || !lastName) {
    return {
      ok: false,
      error: 'Please enter both your First Name and Last Name.',
    };
  }

  if (!branch) {
    return {
      ok: false,
      error: 'Please select your Military Branch.',
    };
  }

  if (!phone || !isValidPhoneNumber(phone)) {
    return {
      ok: false,
      error: 'Please enter a valid Phone number.',
    };
  }

  if (!email || !isValidEmailAddress(email)) {
    return {
      ok: false,
      error: 'Please enter a valid Email address.',
    };
  }

  if (!preferredContactStr) {
    return {
      ok: false,
      error: 'Please select at least one Preferred Method of Contact.',
    };
  }

  if (!experience) {
    return {
      ok: false,
      error: 'Please share your Hockey Experience.',
    };
  }

  if (
    containsSpamPatterns(firstName) ||
    containsSpamPatterns(lastName) ||
    containsSpamPatterns(branch) ||
    containsSpamPatterns(preferredContactStr) ||
    containsSpamPatterns(experience) ||
    containsSpamPatterns(questionsInfo)
  ) {
    return {
      ok: false,
      error: 'Links or invalid HTML/spam content are not allowed in application text fields.',
    };
  }

  return { ok: true };
}
