import {
  VERIFIED_SPREADSHEET_ID,
  PlayerProfile,
  StaffMember,
  ClubEvent,
  FanItem,
  SponsorItem,
  extractSpreadsheetId,
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

const SHEET_CACHE_STORAGE_KEY = 'gsw_verified_sheet_cache_v3';
let inMemoryCache: DynamicSyncResult | null = null;
let inFlightSyncPromise: Promise<DynamicSyncResult | null> | null = null;

/**
 * Returns the most recent cached Google Sheet data synchronously (0ms) so all sheet-connected UIs
 * render immediately on startup or tab switch while background revalidation runs.
 */
export function getCachedSheetSyncResult(): DynamicSyncResult | null {
  if (inMemoryCache) return inMemoryCache;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SHEET_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DynamicSyncResult;
    if (parsed && Array.isArray(parsed.players)) {
      inMemoryCache = parsed;
      return parsed;
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

function saveCachedSheetSyncResult(result: DynamicSyncResult): void {
  inMemoryCache = result;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SHEET_CACHE_STORAGE_KEY, JSON.stringify(result));
  } catch {
    // Ignore quota errors
  }
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
 * Fetches a single tab directly from Google Sheets' fast JSON Visualization endpoint (`gviz/tq`)
 * using `&headers=1` so mixed string/number/boolean columns never lose their Row 1 column headers.
 */
async function fetchGvizSheetTabDirect(
  spreadsheetId: string,
  sheetName?: string
): Promise<string[][] | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5500);
    const sheetParam = sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : '';
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
      spreadsheetId
    )}/gviz/tq?tqx=out:json&headers=1${sheetParam}&_t=${Date.now()}`;

    const res = await fetch(gvizUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const text = await res.text();
    const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);?/);
    if (!match || !match[1]) return null;
    const json = JSON.parse(match[1]);
    if (json.status === 'error') return null;

    const cols: string[] = (json.table?.cols || []).map((c: any) => String(c?.label || '').trim());
    const rows: string[][] = (json.table?.rows || []).map((r: any) =>
      (r?.c || []).map((cell: any) => {
        if (!cell || (cell.v === null && cell.f === undefined)) return '';
        if (typeof cell.v === 'boolean') return cell.v ? 'TRUE' : 'FALSE';
        return String(cell.f ?? cell.v ?? '').trim();
      })
    );

    if (!cols.some(Boolean)) {
      return rows;
    }

    // If some string columns had their header left in rows[0] while numeric/boolean columns had theirs in cols,
    // check if rows[0] has values only where cols is blank
    if (rows.length > 0 && cols.some((c) => !c)) {
      const firstRow = rows[0];
      const looksLikeSplitHeader = cols.every(
        (colLabel, idx) => Boolean(colLabel) || Boolean(firstRow[idx])
      ) && cols.some((colLabel, idx) => Boolean(colLabel) && !firstRow[idx]);

      if (looksLikeSplitHeader) {
        const mergedHeaders = cols.map((colLabel, idx) => colLabel || firstRow[idx] || '');
        return [mergedHeaders, ...rows.slice(1)];
      }
    }

    return [cols, ...rows];
  } catch {
    return null;
  }
}

/**
 * Fetches all tabs directly from Google Sheets via `gviz/tq` in parallel (~200-350ms).
 */
async function fetchDirectGvizAllTabs(spreadsheetId: string): Promise<DynamicSyncResult | null> {
  try {
    const [rosterRows, eventsRows, boardRows, coachesRows, fansRows, sponsorsRows] =
      await Promise.all([
        fetchGvizSheetTabDirect(spreadsheetId),
        fetchGvizSheetTabDirect(spreadsheetId, 'Events'),
        fetchGvizSheetTabDirect(spreadsheetId, 'Board'),
        fetchGvizSheetTabDirect(spreadsheetId, 'Coaches'),
        fetchGvizSheetTabDirect(spreadsheetId, 'Fans'),
        fetchGvizSheetTabDirect(spreadsheetId, 'Sponsors'),
      ]);

    const sheets: Record<string, string[][]> = {};
    const rosterHeaderSig = JSON.stringify(rosterRows?.[0] || []);

    if (rosterRows && rosterRows.length > 0) {
      sheets.Roster = rosterRows;
    }
    if (
      eventsRows &&
      eventsRows.length > 0 &&
      JSON.stringify(eventsRows[0]) !== rosterHeaderSig
    ) {
      sheets.Events = eventsRows;
    }
    if (
      boardRows &&
      boardRows.length > 0 &&
      JSON.stringify(boardRows[0]) !== rosterHeaderSig
    ) {
      sheets.Board = boardRows;
    }
    if (
      coachesRows &&
      coachesRows.length > 0 &&
      JSON.stringify(coachesRows[0]) !== rosterHeaderSig
    ) {
      sheets.Coaches = coachesRows;
    }
    if (
      fansRows &&
      fansRows.length > 0 &&
      JSON.stringify(fansRows[0]) !== rosterHeaderSig
    ) {
      sheets.Fans = fansRows;
    }
    if (
      sponsorsRows &&
      sponsorsRows.length > 0 &&
      JSON.stringify(sponsorsRows[0]) !== rosterHeaderSig
    ) {
      sheets.Sponsors = sponsorsRows;
    }

    if (Object.keys(sheets).length === 0) return null;
    return parseAppsScriptPayload({
      title: 'Garden State Warriors Roster',
      tabs: Object.keys(sheets),
      sheets,
    });
  } catch {
    return null;
  }
}

/**
 * Fetches from the Google Apps Script Web App URL (`doGet`) or `/api/sync`.
 */
async function fetchAppsScriptOrApiPayload(
  appsScriptUrl: string
): Promise<DynamicSyncResult | null> {
  if (
    appsScriptUrl &&
    appsScriptUrl.startsWith('https://script.google.com/') &&
    !appsScriptUrl.includes('YOUR_')
  ) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7500);
      const separator = appsScriptUrl.includes('?') ? '&' : '?';
      // Simple GET request with no custom headers avoids CORS preflight on Apps Script redirects
      const res = await fetch(`${appsScriptUrl}${separator}_t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().startsWith('{')) {
          const payload = JSON.parse(text);
          return parseAppsScriptPayload(payload);
        }
      }
    } catch {
      // Fall through to /api/sync
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const apiRes = await fetch(`/api/sync?_t=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (apiRes.ok) {
      const text = await apiRes.text();
      if (text && text.trim().startsWith('{')) {
        const payload = JSON.parse(text);
        if (
          payload &&
          (payload.sheets ||
            payload.players ||
            payload.events ||
            payload.board ||
            payload.coaches ||
            payload.fans ||
            payload.sponsors)
        ) {
          return parseAppsScriptPayload(payload);
        }
      }
    }
  } catch {
    // Silent fallback
  }

  return null;
}

/**
 * Merges two sync results (e.g., Apps Script + Direct gviz/tq) so that:
 * - No tab is ever blank if either source succeeded for that tab
 * - In-cell image URLs extracted by Apps Script enrich corresponding items from gviz/tq
 */
function mergeDynamicSyncResults(
  appsScriptRes: DynamicSyncResult | null,
  gvizRes: DynamicSyncResult | null
): DynamicSyncResult | null {
  if (!appsScriptRes && !gvizRes) return null;
  if (appsScriptRes && !gvizRes) return appsScriptRes;
  if (!appsScriptRes && gvizRes) return gvizRes;

  const a = appsScriptRes!;
  const g = gvizRes!;

  const players = a.players.length >= g.players.length ? a.players : g.players;

  // Merge Board and Coach staff members separately so neither category is lost
  const aBoard = a.staff.filter((s) => s.category === 'Board');
  const gBoard = g.staff.filter((s) => s.category === 'Board');
  const board = aBoard.length >= gBoard.length ? aBoard : gBoard;

  const aCoaches = a.staff.filter((s) => s.category === 'Coach');
  const gCoaches = g.staff.filter((s) => s.category === 'Coach');
  const coaches = aCoaches.length >= gCoaches.length ? aCoaches : gCoaches;

  const staff = [...board, ...coaches];
  const events = a.events.length >= g.events.length ? a.events : g.events;
  const fans = a.fans.length >= g.fans.length ? a.fans : g.fans;
  const sponsors = a.sponsors.length >= g.sponsors.length ? a.sponsors : g.sponsors;
  const detectedTabs = Array.from(new Set([...a.detectedTabs, ...g.detectedTabs]));

  return {
    players,
    staff,
    events,
    fans,
    sponsors,
    detectedTabs,
  };
}

/**
 * Dynamically fetches all tabs from the verified Google Sheet (`1-qP7fgEI1mvwjE8cplR9_Rn-9tnHFaBP3beH6ETZC7s`)
 * by running Direct Google Sheets `gviz/tq` AND Google Apps Script `doGet` in parallel:
 * - Whichever resolves first immediately triggers `onFastResult` (typically < 300ms) so the UI renders fast.
 * - Once both settle, merges them and caches the result in memory + localStorage.
 */
export async function syncVerifiedGoogleSheet(
  onFastResult?: (fastData: DynamicSyncResult) => void
): Promise<DynamicSyncResult | null> {
  if (inFlightSyncPromise) {
    const shared = await inFlightSyncPromise;
    if (shared && onFastResult) onFastResult(shared);
    return shared;
  }

  const run = async (): Promise<DynamicSyncResult | null> => {
    const appsScriptUrl =
      import.meta.env.VITE_GOOGLE_APPS_SCRIPT_WEBHOOK_URL ||
      import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL ||
      '';
    const rawSheetId =
      import.meta.env.VITE_GOOGLE_SPREADSHEET_ID || VERIFIED_SPREADSHEET_ID;
    const spreadsheetId = extractSpreadsheetId(rawSheetId) || VERIFIED_SPREADSHEET_ID;

    let fastDelivered = false;

    const gvizPromise = fetchDirectGvizAllTabs(spreadsheetId).then((res) => {
      if (res && !fastDelivered) {
        fastDelivered = true;
        saveCachedSheetSyncResult(res);
        if (onFastResult) onFastResult(res);
      }
      return res;
    });

    const appsScriptPromise = fetchAppsScriptOrApiPayload(appsScriptUrl).then((res) => {
      if (res && !fastDelivered) {
        fastDelivered = true;
        saveCachedSheetSyncResult(res);
        if (onFastResult) onFastResult(res);
      }
      return res;
    });

    const [gvizRes, appsScriptRes] = await Promise.all([gvizPromise, appsScriptPromise]);
    const merged = mergeDynamicSyncResults(appsScriptRes, gvizRes);

    if (merged) {
      saveCachedSheetSyncResult(merged);
    }

    return merged;
  };

  inFlightSyncPromise = run();
  try {
    return await inFlightSyncPromise;
  } finally {
    inFlightSyncPromise = null;
  }
}

