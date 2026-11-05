import {
  PlayerProfile,
  StaffMember,
  ClubEvent,
  FanItem,
  SponsorItem,
  parseAppsScriptPayload,
} from '../utils/rosterLogic';
import { uploadSponsorImageToFirebase } from './firebaseStorage';

export interface DynamicSyncResult {
  players: PlayerProfile[];
  staff: StaffMember[];
  events: ClubEvent[];
  fans: FanItem[];
  sponsors: SponsorItem[];
  detectedTabs: string[];
}

export interface SponsorSubmissionInput {
  name: string;
  phone: string;
  email: string;
  preferredContact: string[];
  website: string;
  message: string;
  logoUrl: string;
  logoFile?: File | null;
  logoBase64?: string;
  logoMimeType?: string;
  logoFileName?: string;
}

/**
 * Compresses an uploaded Sponsor Logo / Flyer image file on a canvas so its data URL
 * stays well under the Google Sheets 50,000-character cell limit (< 22,000 chars)
 * and can also be decoded by Google Apps Script DriveApp to create a hosted Google image URL.
 */
export async function compressSponsorImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const maxDim = 320;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        let dataUrl = canvas.toDataURL('image/webp', 0.72);
        if (dataUrl.length > 24000 || !dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.68);
        }
        if (dataUrl.length > 24000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.52);
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Submits the direct website "Become a Sponsor" form to the Google Sheet (`Sponsors` tab)
 * via Google Apps Script (`doPost`).
 * 1. If a logo/flyer file is attached, uploads it to Firebase Storage first to obtain a
 *    clean `https://firebasestorage.googleapis.com/...` URL.
 * 2. Also passes the compressed image data (`logoBase64`) to Apps Script `doPost` so if
 *    Firebase Storage rules block unauthenticated uploads, Apps Script automatically saves
 *    the image to Google Drive (`DriveApp`) or stores the compact image URL directly in the
 *    `LogoUrl` column so it is never empty and renders on the Home page once Verified is checked.
 */
export async function submitSponsorToGoogleSheet(
  input: SponsorSubmissionInput
): Promise<{ ok: boolean; message: string; uploadedLogoUrl?: string }> {
  const appsScriptUrl =
    import.meta.env.VITE_GOOGLE_APPS_SCRIPT_WEBHOOK_URL ||
    import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL ||
    '';

  let finalLogoUrl = (input.logoUrl || '').trim();
  let logoBase64 = input.logoBase64 || '';
  let logoMimeType = input.logoMimeType || 'image/jpeg';
  let logoFileName = input.logoFileName || 'sponsor-logo.jpg';

  // Step 1: If a File object was provided, upload to Firebase Storage for a public Firebase URL
  if (input.logoFile) {
    logoFileName = input.logoFile.name || logoFileName;
    const firebaseUrl = await uploadSponsorImageToFirebase(input.logoFile);
    if (firebaseUrl) {
      finalLogoUrl = firebaseUrl;
    }
  }

  // Extract raw base64 payload if we also have a data:image/... URL
  if (input.logoUrl && input.logoUrl.startsWith('data:image/')) {
    const commaIdx = input.logoUrl.indexOf(',');
    if (commaIdx > 0) {
      const headerPart = input.logoUrl.slice(0, commaIdx);
      const mimeMatch = headerPart.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64$/i);
      if (mimeMatch && mimeMatch[1]) {
        logoMimeType = mimeMatch[1];
      }
      logoBase64 = input.logoUrl.slice(commaIdx + 1);
    }
  }

  const bodyPayload = {
    action: 'submitSponsor',
    verified: false,
    timestampSubmitted: new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
    }),
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    preferredContact: input.preferredContact.join(', '),
    website: input.website.trim(),
    message: input.message.trim(),
    description: input.message.trim(),
    logoUrl: finalLogoUrl,
    logoBase64,
    logoMimeType,
    logoFileName,
  };

  // 1. Direct POST to Google Apps Script Web App (`text/plain` avoids CORS preflight)
  if (
    appsScriptUrl &&
    appsScriptUrl.startsWith('https://script.google.com/') &&
    !appsScriptUrl.includes('YOUR_')
  ) {
    try {
      const res = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(bodyPayload),
      });
      if (res.ok) {
        const resData = await res.json().catch(() => null);
        return {
          ok: true,
          uploadedLogoUrl: resData?.logoUrl || finalLogoUrl,
          message:
            'Thank you! Your sponsor application and logo have been saved to our Google Sheet and will appear on the Home page once verified.',
        };
      }
    } catch {
      // Fall through to /api/sync proxy
    }
  }

  // 2. Fallback: POST through serverless /api/sync endpoint
  try {
    const apiRes = await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
    });
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data && data.ok) {
        return {
          ok: true,
          uploadedLogoUrl: data.logoUrl || finalLogoUrl,
          message:
            'Thank you! Your sponsor application and logo have been saved to our Google Sheet and will appear on the Home page once verified.',
        };
      }
    }
  } catch {
    // Silent fallback
  }

  return {
    ok: false,
    message:
      'Unable to reach Google Apps Script right now. Please make sure your Google Apps Script Web App is deployed with doPost() and set in VITE_GOOGLE_APPS_SCRIPT_WEBHOOK_URL.',
  };
}

/**
 * Dynamically fetches all tabs from the verified Google Sheet
 * (`1-qP7fgEI1mvwjE8cplR9_Rn-9tnHFaBP3beH6ETZC7s`) via:
 * 1) `VITE_GOOGLE_APPS_SCRIPT_WEBHOOK_URL` (Google Apps Script Web App `doGet`), OR
 * 2) `/api/sync` serverless proxy.
 */
export async function syncVerifiedGoogleSheet(): Promise<DynamicSyncResult | null> {
  const appsScriptUrl =
    import.meta.env.VITE_GOOGLE_APPS_SCRIPT_WEBHOOK_URL ||
    import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL ||
    '';

  // 1. Try direct Google Apps Script Web App URL if configured
  if (
    appsScriptUrl &&
    appsScriptUrl.startsWith('https://script.google.com/') &&
    !appsScriptUrl.includes('YOUR_')
  ) {
    try {
      const separator = appsScriptUrl.includes('?') ? '&' : '?';
      const res = await fetch(`${appsScriptUrl}${separator}_t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const payload = await res.json();
        return parseAppsScriptPayload(payload);
      }
    } catch {
      // Fall through to /api/sync
    }
  }

  // 2. Try serverless /api/sync endpoint with cache-busting
  try {
    const apiRes = await fetch(`/api/sync?_t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (apiRes.ok) {
      const payload = await apiRes.json();
      if (
        payload &&
        (payload.sheets ||
          payload.players ||
          payload.events ||
          payload.board ||
          payload.coaches ||
          payload.sponsors)
      ) {
        return parseAppsScriptPayload(payload);
      }
    }
  } catch {
    // Silent fallback
  }

  return null;
}
