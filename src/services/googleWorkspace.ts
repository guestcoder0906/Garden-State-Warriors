import {
  PlayerProfile,
  StaffMember,
  ClubEvent,
  FanItem,
  SponsorItem,
  parseAppsScriptPayload,
} from '../utils/rosterLogic';

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
}

/**
 * Compresses an uploaded Sponsor Logo / Flyer image file on a canvas so its data URL
 * stays well under the 50,000-character Google Sheets cell limit and can be written directly
 * into the `LogoUrl` column of the `Sponsors` tab by Google Apps Script.
 */
export async function compressSponsorImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const maxDim = 380;
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
        let dataUrl = canvas.toDataURL('image/webp', 0.78);
        if (dataUrl.length > 42000 || !dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.72);
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
 * via Google Apps Script (`doPost`). New entries are saved with `Verified = FALSE` (unchecked)
 * so they only appear on the Home page once the Verified checkbox is checked in Google Sheets.
 */
export async function submitSponsorToGoogleSheet(
  input: SponsorSubmissionInput
): Promise<{ ok: boolean; message: string }> {
  const appsScriptUrl =
    import.meta.env.VITE_GOOGLE_APPS_SCRIPT_WEBHOOK_URL ||
    import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL ||
    '';

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
    logoUrl: input.logoUrl || '',
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
        return {
          ok: true,
          message:
            'Thank you! Your sponsor application has been added to our Google Sheet and will appear on the Home page once verified.',
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
          message:
            'Thank you! Your sponsor application has been added to our Google Sheet and will appear on the Home page once verified.',
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
