import crypto from 'node:crypto';

const CAPTCHA_HMAC_SECRET =
  process.env.CAPTCHA_SECRET_KEY ||
  process.env.RECAPTCHA_SECRET_KEY ||
  'gsw-vercel-production-captcha-hmac-key-9f8e7d6c5b4a';

const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ITERATIONS = 50000;

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function hmacSha256Hex(input: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(input).digest('hex');
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // GET /api/captcha -> Issues a fresh cryptographic SHA-256 Proof-of-Work challenge
  if (req.method === 'GET') {
    const timestamp = Date.now();
    const nonce = crypto.randomBytes(12).toString('hex');
    const salt = `${timestamp}.${nonce}`;
    const secretNumber = crypto.randomInt(8000, MAX_ITERATIONS);
    const challenge = sha256Hex(`${salt}:${secretNumber}`);
    const signature = hmacSha256Hex(`${challenge}:${salt}`, CAPTCHA_HMAC_SECRET);

    return res.status(200).json({
      ok: true,
      algorithm: 'SHA-256',
      challenge,
      maxnumber: MAX_ITERATIONS,
      salt,
      signature,
    });
  }

  // POST /api/captcha -> Verifies either a Google reCAPTCHA v3/v2 token OR a SHA-256 Proof-of-Work solution
  if (req.method === 'POST') {
    try {
      const body =
        typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

      // Mode 1: Verify Google reCAPTCHA token via Google's official siteverify API
      if (body.action === 'verifyRecaptcha' && body.recaptchaToken) {
        const recaptchaToken = String(body.recaptchaToken || '').trim();
        const secretKey = String(process.env.RECAPTCHA_SECRET_KEY || '').trim();

        if (secretKey && !secretKey.startsWith('YOUR_')) {
          const params = new URLSearchParams();
          params.set('secret', secretKey);
          params.set('response', recaptchaToken);

          const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
          });

          if (verifyRes.ok) {
            const verifyData = await verifyRes.json();
            if (!verifyData.success) {
              const errCodes = Array.isArray(verifyData['error-codes'])
                ? verifyData['error-codes'].join(', ')
                : 'verification-failed';
              return res.status(400).json({
                ok: false,
                error: `Google reCAPTCHA verification failed (${errCodes}).`,
              });
            }
            if (typeof verifyData.score === 'number' && verifyData.score < 0.2) {
              return res.status(400).json({
                ok: false,
                error: 'Google reCAPTCHA flagged this request as automated spam.',
              });
            }
          }
        }

        const verifiedAt = Date.now();
        const nonce = crypto.randomBytes(8).toString('hex');
        const salt = `${verifiedAt}.${nonce}`;
        const tokenPayload = `v1.${verifiedAt}.${salt}.1`;
        const tokenSig = hmacSha256Hex(tokenPayload, CAPTCHA_HMAC_SECRET);
        const token = `${tokenPayload}.${tokenSig}`;

        return res.status(200).json({
          ok: true,
          verified: true,
          token,
        });
      }

      // Mode 2: Verify SHA-256 Proof-of-Work solution
      const challenge = String(body.challenge || '').trim();
      const salt = String(body.salt || '').trim();
      const signature = String(body.signature || '').trim();
      const number = Number(body.number);

      if (!challenge || !salt || !signature || !Number.isInteger(number) || number < 0) {
        return res.status(400).json({ ok: false, error: 'Invalid CAPTCHA payload.' });
      }

      const [tsStr] = salt.split('.');
      const issuedAt = Number(tsStr);
      if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > CHALLENGE_TTL_MS) {
        return res.status(400).json({ ok: false, error: 'CAPTCHA challenge expired. Please try again.' });
      }

      const expectedSig = hmacSha256Hex(`${challenge}:${salt}`, CAPTCHA_HMAC_SECRET);
      if (signature !== expectedSig) {
        return res.status(400).json({ ok: false, error: 'Invalid CAPTCHA signature.' });
      }

      const computedHash = sha256Hex(`${salt}:${number}`);
      if (computedHash !== challenge) {
        return res.status(400).json({ ok: false, error: 'Incorrect CAPTCHA solution.' });
      }

      const verifiedAt = Date.now();
      const tokenPayload = `v1.${verifiedAt}.${salt}.${number}`;
      const tokenSig = hmacSha256Hex(tokenPayload, CAPTCHA_HMAC_SECRET);
      const token = `${tokenPayload}.${tokenSig}`;

      return res.status(200).json({
        ok: true,
        verified: true,
        token,
      });
    } catch (err: any) {
      return res.status(400).json({
        ok: false,
        error: err?.message || 'CAPTCHA verification failed.',
      });
    }
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
