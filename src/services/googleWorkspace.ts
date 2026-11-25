import {
  VERIFIED_SPREADSHEET_ID,
  PlayerProfile,
  StaffMember,
  ClubEvent,
  FanItem,
  SponsorItem,
  DynamicSyncResult,
  extractSpreadsheetId,
  parseAppsScriptPayload,
  mergeDynamicSyncResults,
} from '../utils/rosterLogic';
import {
  uploadSponsorImageToFirebase,
  prewarmFirebaseImageUrl,
} from './firebaseStorage';

export type { DynamicSyncResult };
export { mergeDynamicSyncResults };

const SHEET_CACHE_STORAGE_KEY = 'gsw_verified_sheet_cache_v13';
const LEGACY_CACHE_KEYS = [
  'gsw_known_active_events_v1',
  'gsw_past_events_archive_v1',
  'gsw_verified_sheet_cache_v1',
  'gsw_verified_sheet_cache_v2',
  'gsw_verified_sheet_cache_v3',
  'gsw_verified_sheet_cache_v4',
  'gsw_verified_sheet_cache_v5',
  'gsw_verified_sheet_cache_v6',
  'gsw_verified_sheet_cache_v7',
  'gsw_verified_sheet_cache_v8',
  'gsw_verified_sheet_cache_v9',
  'gsw_verified_sheet_cache_v10',
  'gsw_verified_sheet_cache_v11',
  'gsw_verified_sheet_cache_v12',
];
let inMemoryCache: DynamicSyncResult | null = null;
let inFlightSyncPromise: Promise<DynamicSyncResult | null> | null = null;

function stripBlobUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url.startsWith('blob:') ? undefined : url;
}

function sanitizeSyncResultUrls(result: DynamicSyncResult): DynamicSyncResult {
  return {
    ...result,
    players: (result.players || []).map((p) => ({
      ...p,
      jerseyPhotoUrl: stripBlobUrl(p.jerseyPhotoUrl),
      profilePictureUrl: stripBlobUrl(p.profilePictureUrl),
      militaryPhotoUrl: stripBlobUrl(p.militaryPhotoUrl),
      mediaGallery: (p.mediaGallery || []).filter((m) => m.url && !m.url.startsWith('blob:')),
    })),
    staff: (result.staff || []).map((s) => ({
      ...s,
      photoUrl: stripBlobUrl(s.photoUrl),
      militaryPhotoUrl: stripBlobUrl(s.militaryPhotoUrl),
      mediaGallery: s.mediaGallery
        ? s.mediaGallery.filter((m) => m.url && !m.url.startsWith('blob:'))
        : undefined,
    })),
    events: (result.events || []).map((ev) => ({
      ...ev,
      imageUrl: stripBlobUrl(ev.imageUrl),
    })),
    pastEvents: (result.pastEvents || []).map((ev) => ({
      ...ev,
      imageUrl: stripBlobUrl(ev.imageUrl),
    })),
    homeSlides: (result.homeSlides || []).map((sl) => ({
      ...sl,
      imageUrl: stripBlobUrl(sl.imageUrl),
    })),
    fans: (result.fans || []).map((fn) => ({
      ...fn,
      photoUrl: stripBlobUrl(fn.photoUrl),
    })),
    sponsors: (result.sponsors || []).map((sp) => ({
      ...sp,
      logoUrl: stripBlobUrl(sp.logoUrl),
    })),
  };
}

/**
 * Returns the most recent cached Google Sheet data synchronously (0ms) so all sheet-connected UIs
 * render immediately on startup or tab switch while background revalidation runs.
 */
export function getCachedSheetSyncResult(): DynamicSyncResult | null {
  if (inMemoryCache) return inMemoryCache;
  if (typeof window === 'undefined') return null;
  try {
    for (const oldKey of LEGACY_CACHE_KEYS) {
      window.localStorage.removeItem(oldKey);
    }
    const raw = window.localStorage.getItem(SHEET_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DynamicSyncResult;
    if (parsed && Array.isArray(parsed.players)) {
      const sanitized = sanitizeSyncResultUrls(parsed);
      inMemoryCache = sanitized;
      return sanitized;
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

function saveCachedSheetSyncResult(result: DynamicSyncResult): void {
  const cleanResult = sanitizeSyncResultUrls(result);
  inMemoryCache = cleanResult;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SHEET_CACHE_STORAGE_KEY, JSON.stringify(cleanResult));
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
  firebaseAssetId?: string;
  logoFile?: File | null;
  logoFileName?: string;
  captchaToken?: string;
}

/**
 * Submits the direct website "Become a Sponsor" form to the Google Sheet (`Sponsors` tab)
 * via Google Apps Script (`doPost`).
 * Permanently uploads the image to the Firebase server first if not already uploaded,
 * and stores only the real HTTP URL (`https://.../api/firebase-image?id=...`) in Google Sheets.
 */
export async function submitSponsorToGoogleSheet(
  input: SponsorSubmissionInput
): Promise<{ ok: boolean; message: string; uploadedLogoUrl?: string }> {
  const appsScriptUrl =
    import.meta.env.VITE_GOOGLE_APPS_SCRIPT_WEBHOOK_URL ||
    import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL ||
    '';

  let finalLogoUrl = (input.logoUrl || '').trim();
  let firebaseAssetId = (input.firebaseAssetId || '').trim();
  const logoFileName = input.logoFileName || input.logoFile?.name || 'sponsor-logo.jpg';

  // Never allow local base64 or blob URLs to be sent to Google Sheets
  if (finalLogoUrl.startsWith('data:') || finalLogoUrl.startsWith('blob:')) {
    finalLogoUrl = '';
  }

  // If a File was selected and hasn't been uploaded to Firebase yet, upload it permanently now
  if (!finalLogoUrl && input.logoFile) {
    try {
      const uploaded = await uploadSponsorImageToFirebase(input.logoFile, input.name);
      finalLogoUrl = uploaded.url;
      firebaseAssetId = uploaded.assetId;
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error
            ? `Failed to upload image to Firebase server: ${err.message}`
            : 'Failed to upload image to Firebase server. Please try again.',
      };
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
    firebaseAssetId,
    logoFileName,
    captchaToken: input.captchaToken || '',
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
            'Thank you! Your sponsor application and logo have been saved to our Google Sheet and will appear on our Sponsors page and Home page once verified.',
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
          uploadedLogoUrl: data?.logoUrl || finalLogoUrl,
          message:
            'Thank you! Your sponsor application and logo have been saved to our Google Sheet and will appear on our Sponsors page and Home page once verified.',
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

export interface WarriorApplicationInput {
  firstName: string;
  lastName: string;
  branch: string;
  phone: string;
  email: string;
  preferredContact: string[];
  experience: string;
  questionsInfo: string;
  honeypot?: string;
  captchaToken?: string;
}

/**
 * Submits the direct website "Become a Warrior" form to the Google Sheet (`Become Warrior` tab)
 * via Google Apps Script (`doPost`).
 * Verified rows are automatically synced to the last available row in the `Garden State Warriors Roster` tab.
 */
export async function submitWarriorToGoogleSheet(
  input: WarriorApplicationInput
): Promise<{ ok: boolean; message: string }> {
  const appsScriptUrl =
    import.meta.env.VITE_GOOGLE_APPS_SCRIPT_WEBHOOK_URL ||
    import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL ||
    '';

  const preferredContactStr = Array.isArray(input.preferredContact)
    ? input.preferredContact.join(', ')
    : String(input.preferredContact || '').trim();

  const bodyPayload = {
    action: 'submitWarriorApplication',
    verified: false,
    timestampSubmitted: new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
    }),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    branch: input.branch.trim(),
    militaryBranch: input.branch.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    preferredContact: preferredContactStr,
    experience: input.experience.trim(),
    questionsInfo: input.questionsInfo.trim(),
    honeypot: input.honeypot || '',
    captchaToken: input.captchaToken || '',
  };

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
            'Thank you for your service! Your Warrior application has been submitted to the Become Warrior tab in Google Sheets. Once verified, your profile will automatically be added to the Garden State Warriors Roster.',
        };
      }
    } catch {
      // Fall through to /api/sync proxy
    }
  }

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
            'Thank you for your service! Your Warrior application has been submitted to the Become Warrior tab in Google Sheets. Once verified, your profile will automatically be added to the Garden State Warriors Roster.',
        };
      }
    }
  } catch {
    // Silent fallback
  }

  return {
    ok: false,
    message:
      'Unable to reach Google Apps Script right now. Please make sure your Google Apps Script Web App is deployed with the updated doPost() and set in VITE_GOOGLE_APPS_SCRIPT_WEBHOOK_URL.',
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
    const [
      rosterRows,
      eventsRows,
      boardRows,
      coachesRows,
      fansRows,
      sponsorsRows,
      homeSlidesRows,
    ] = await Promise.all([
      fetchGvizSheetTabDirect(spreadsheetId),
      fetchGvizSheetTabDirect(spreadsheetId, 'Events'),
      fetchGvizSheetTabDirect(spreadsheetId, 'Board'),
      fetchGvizSheetTabDirect(spreadsheetId, 'Coaches'),
      fetchGvizSheetTabDirect(spreadsheetId, 'Fans'),
      fetchGvizSheetTabDirect(spreadsheetId, 'Sponsors'),
      fetchGvizSheetTabDirect(spreadsheetId, 'Home Slides'),
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
    if (
      homeSlidesRows &&
      homeSlidesRows.length > 0 &&
      JSON.stringify(homeSlidesRows[0]) !== rosterHeaderSig
    ) {
      sheets['Home Slides'] = homeSlidesRows;
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
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const separator = appsScriptUrl.includes('?') ? '&' : '?';
      // Pass nocache=1&_t=... so Apps Script CacheService never serves stale/removed rows
      const res = await fetch(`${appsScriptUrl}${separator}nocache=1&_t=${Date.now()}`, {
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
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const apiRes = await fetch(`/api/sync?nocache=1&_t=${Date.now()}`, {
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
 * Pre-warms any Firebase asset URLs (`/api/firebase-image?id=...` or `firestore.googleapis.com/.../sponsor_assets/...`)
 * in the client-side in-memory cache while preserving canonical URLs in state & localStorage.
 */
async function prewarmFirebaseImagesClientSide(result: DynamicSyncResult): Promise<void> {
  const urlsToWarm: Array<string | undefined> = [
    ...result.sponsors.map((sp) => sp.logoUrl),
    ...result.staff.flatMap((st) => [st.photoUrl, st.militaryPhotoUrl]),
    ...result.fans.map((fn) => fn.photoUrl),
    ...result.events.map((ev) => ev.imageUrl),
    ...(result.pastEvents || []).map((ev) => ev.imageUrl),
    ...(result.homeSlides || []).map((sl) => sl.imageUrl),
    ...result.players.flatMap((pl) => [
      pl.jerseyPhotoUrl,
      pl.profilePictureUrl,
      pl.militaryPhotoUrl,
      ...(pl.mediaGallery || []).map((m) => m.url),
    ]),
  ];

  await Promise.all(
    urlsToWarm
      .filter((u): u is string => Boolean(u))
      .map((u) => prewarmFirebaseImageUrl(u))
  );
}

/**
 * Dynamically fetches all tabs from the verified Google Sheet (`1-qP7fgEI1mvwjE8cplR9_Rn-9tnHFaBP3beH6ETZC7s`)
 * by running Direct Google Sheets `gviz/tq` AND Google Apps Script `doGet` in parallel:
 * - On an empty cold cache, `gviz/tq` triggers `onFastResult` (~200-350ms) so the UI renders fast.
 * - On subsequent background polls, waits for Apps Script + `gviz/tq` together so `gviz` never
 *   temporarily wipes out in-cell `CellImage` (`sheets-images-rt`) URLs that only Apps Script sees.
 */
export async function syncVerifiedGoogleSheet(
  onFastResult?: (fastData: DynamicSyncResult) => void
): Promise<DynamicSyncResult | null> {
  if (inFlightSyncPromise) {
    const shared = await inFlightSyncPromise;
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

    const existingCache = inMemoryCache || getCachedSheetSyncResult();
    const hasWarmCache = Boolean(
      existingCache &&
        (existingCache.players.length > 0 ||
          existingCache.staff.length > 0 ||
          existingCache.sponsors.length > 0)
    );

    let mergeCompleted = false;

    const gvizPromise = fetchDirectGvizAllTabs(spreadsheetId).then(async (res) => {
      if (res && !mergeCompleted && !hasWarmCache) {
        await prewarmFirebaseImagesClientSide(res);
        if (!mergeCompleted) {
          saveCachedSheetSyncResult(res);
          if (onFastResult) onFastResult(res);
        }
      }
      return res;
    });

    const appsScriptPromise = fetchAppsScriptOrApiPayload(appsScriptUrl);

    const [gvizRes, appsScriptRes] = await Promise.all([gvizPromise, appsScriptPromise]);
    mergeCompleted = true;

    const merged = mergeDynamicSyncResults(appsScriptRes, gvizRes, existingCache);

    if (merged) {
      await prewarmFirebaseImagesClientSide(merged);
      saveCachedSheetSyncResult(merged);
      return merged;
    }

    return null;
  };

  inFlightSyncPromise = run();
  try {
    return await inFlightSyncPromise;
  } finally {
    inFlightSyncPromise = null;
  }
}


