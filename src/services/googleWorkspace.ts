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
import {
  uploadSponsorImageToFirebase,
  resolveSheetUrlIfFirebase,
} from './firebaseStorage';

export interface DynamicSyncResult {
  players: PlayerProfile[];
  staff: StaffMember[];
  events: ClubEvent[];
  fans: FanItem[];
  sponsors: SponsorItem[];
  detectedTabs: string[];
}

const SHEET_CACHE_STORAGE_KEY = 'gsw_verified_sheet_cache_v6';
const LEGACY_CACHE_KEYS = [
  'gsw_verified_sheet_cache_v1',
  'gsw_verified_sheet_cache_v2',
  'gsw_verified_sheet_cache_v3',
  'gsw_verified_sheet_cache_v4',
  'gsw_verified_sheet_cache_v5',
];
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
    for (const oldKey of LEGACY_CACHE_KEYS) {
      window.localStorage.removeItem(oldKey);
    }
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

export interface WarriorApplicationInput {
  firstName: string;
  lastName: string;
  militaryBranch: string;
  militaryRank: string;
  serviceEra: string;
  hometown: string;
  roleBadge: string;
  militaryPhotoUrl: string;
  bio: string;
  whatWarriorMeans: string;
  mediaUrls: string[];
  honeypot?: string;
  captchaToken?: string;
}

/**
 * Submits the direct website "Become a Warrior" form to the Google Sheet (`Become Warrior` tab)
 * via Google Apps Script (`doPost`).
 * Verified rows are automatically appended to the Players Roster tab.
 */
export async function submitWarriorToGoogleSheet(
  input: WarriorApplicationInput
): Promise<{ ok: boolean; message: string }> {
  const appsScriptUrl =
    import.meta.env.VITE_GOOGLE_APPS_SCRIPT_WEBHOOK_URL ||
    import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL ||
    '';

  const cleanMilitaryPhotoUrl =
    input.militaryPhotoUrl &&
    !input.militaryPhotoUrl.startsWith('data:') &&
    !input.militaryPhotoUrl.startsWith('blob:')
      ? input.militaryPhotoUrl.trim()
      : '';

  const cleanMediaUrls = (input.mediaUrls || [])
    .slice(0, 5)
    .map((u) => (u || '').trim())
    .filter((u) => u && !u.startsWith('data:') && !u.startsWith('blob:'));

  const bodyPayload = {
    action: 'submitWarrior',
    verified: false,
    timestampSubmitted: new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
    }),
    lastName: input.lastName.trim(),
    firstName: input.firstName.trim(),
    militaryBranch: input.militaryBranch.trim(),
    militaryRank: input.militaryRank.trim(),
    serviceEra: input.serviceEra.trim(),
    hometown: input.hometown.trim(),
    roleBadge: input.roleBadge.trim(),
    militaryPhotoUrl: cleanMilitaryPhotoUrl,
    bio: input.bio.trim(),
    whatWarriorMeans: input.whatWarriorMeans.trim(),
    mediaUrlsCsv: cleanMediaUrls.join(', '),
    mediaUrls: cleanMediaUrls,
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
            'Thank you for your service! Your Warrior application has been submitted to the Become Warrior tab in Google Sheets. Once verified, your profile will automatically appear on the Players Roster.',
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
            'Thank you for your service! Your Warrior application has been submitted to the Become Warrior tab in Google Sheets. Once verified, your profile will automatically appear on the Players Roster.',
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
    ] = await Promise.all([
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
    const timeoutId = setTimeout(() => controller.abort(), 6000);
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
 * Merges two sync results (Apps Script + Direct gviz/tq) without EVER resurrecting removed rows:
 * - `gvizRes` (direct live query to Google Sheets) is the authoritative source of which rows currently exist in the sheet.
 * - `appsScriptRes` enriches matching existing rows with any in-cell `CellImage.getContentUrl()` URLs that `gviz/tq` cannot see.
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

  // Use g.players as the authoritative list of rows currently in the Roster sheet,
  // enriched with any in-cell images from matching players in a.players
  const aPlayerByName = new Map<string, PlayerProfile>();
  for (const ap of a.players) {
    const key = (ap.name || '').trim().toLowerCase();
    if (key) aPlayerByName.set(key, ap);
  }

  const players: PlayerProfile[] = g.players.map((gp) => {
    const key = (gp.name || '').trim().toLowerCase();
    const ap = key ? aPlayerByName.get(key) : undefined;
    if (!ap) return gp;
    return {
      ...gp,
      jerseyPhotoUrl: gp.jerseyPhotoUrl || ap.jerseyPhotoUrl,
      militaryPhotoUrl: gp.militaryPhotoUrl || ap.militaryPhotoUrl,
      mediaGallery: gp.mediaGallery.length > 0 ? gp.mediaGallery : ap.mediaGallery,
    };
  });

  // Enrich Board and Coach staff members from Apps Script without resurrecting deleted rows
  const mergeStaffCategory = (category: 'Board' | 'Coach'): StaffMember[] => {
    const gList = g.staff.filter((s) => s.category === category);
    const aList = a.staff.filter((s) => s.category === category);
    if (gList.length === 0 && aList.length > 0 && !g.detectedTabs.includes(category)) {
      return aList;
    }
    return gList.map((gs, idx) => {
      const match =
        aList.find(
          (as) =>
            as.name &&
            gs.name &&
            as.name.trim().toLowerCase() === gs.name.trim().toLowerCase()
        ) || aList[idx];
      if (!match) return gs;
      return {
        ...gs,
        photoUrl: gs.photoUrl || match.photoUrl,
        militaryPhotoUrl: gs.militaryPhotoUrl || match.militaryPhotoUrl,
        mediaGallery:
          gs.mediaGallery && gs.mediaGallery.length > 0 ? gs.mediaGallery : match.mediaGallery,
      };
    });
  };

  const staff = [...mergeStaffCategory('Board'), ...mergeStaffCategory('Coach')];

  const events = g.events.map((ge, idx) => {
    const match =
      a.events.find(
        (ae) =>
          ae.title &&
          ge.title &&
          ae.title.trim().toLowerCase() === ge.title.trim().toLowerCase()
      ) || a.events[idx];
    return match ? { ...ge, imageUrl: ge.imageUrl || match.imageUrl } : ge;
  });

  const fans = g.fans.map((gf, idx) => {
    const match =
      a.fans.find(
        (af) =>
          af.title &&
          gf.title &&
          af.title.trim().toLowerCase() === gf.title.trim().toLowerCase()
      ) || a.fans[idx];
    return match ? { ...gf, photoUrl: gf.photoUrl || match.photoUrl } : gf;
  });

  const sponsors = g.sponsors.map((gs, idx) => {
    const match =
      a.sponsors.find(
        (as) =>
          as.name &&
          gs.name &&
          as.name.trim().toLowerCase() === gs.name.trim().toLowerCase()
      ) || a.sponsors[idx];
    return match ? { ...gs, logoUrl: gs.logoUrl || match.logoUrl } : gs;
  });

  const detectedTabs = Array.from(new Set([...g.detectedTabs, ...a.detectedTabs]));

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
 * Resolves any Firebase asset URLs (`/api/firebase-image?id=...` or `firestore.googleapis.com/.../sponsor_assets/...`)
 * 100% client-side in the browser via the Firebase SDK so no server is needed to render uploaded images.
 */
async function hydrateFirebaseImagesClientSide(
  result: DynamicSyncResult
): Promise<DynamicSyncResult> {
  const [sponsors, staff, fans, events, players] = await Promise.all([
    Promise.all(
      result.sponsors.map(async (sp) => ({
        ...sp,
        logoUrl: await resolveSheetUrlIfFirebase(sp.logoUrl),
      }))
    ),
    Promise.all(
      result.staff.map(async (st) => ({
        ...st,
        photoUrl: await resolveSheetUrlIfFirebase(st.photoUrl),
        militaryPhotoUrl: await resolveSheetUrlIfFirebase(st.militaryPhotoUrl),
      }))
    ),
    Promise.all(
      result.fans.map(async (fn) => ({
        ...fn,
        photoUrl: await resolveSheetUrlIfFirebase(fn.photoUrl),
      }))
    ),
    Promise.all(
      result.events.map(async (ev) => ({
        ...ev,
        imageUrl: await resolveSheetUrlIfFirebase(ev.imageUrl),
      }))
    ),
    Promise.all(
      result.players.map(async (pl) => ({
        ...pl,
        jerseyPhotoUrl: await resolveSheetUrlIfFirebase(pl.jerseyPhotoUrl),
        militaryPhotoUrl: await resolveSheetUrlIfFirebase(pl.militaryPhotoUrl),
        mediaGallery: await Promise.all(
          (pl.mediaGallery || []).map(async (item) => ({
            ...item,
            url: (await resolveSheetUrlIfFirebase(item.url)) || item.url,
          }))
        ),
      }))
    ),
  ]);

  return {
    ...result,
    sponsors,
    staff,
    fans,
    events,
    players,
  };
}

/**
 * Dynamically fetches all tabs from the verified Google Sheet (`1-qP7fgEI1mvwjE8cplR9_Rn-9tnHFaBP3beH6ETZC7s`)
 * by running Direct Google Sheets `gviz/tq` AND Google Apps Script `doGet` in parallel:
 * - Whichever resolves first immediately triggers `onFastResult` (typically < 300ms) so the UI renders fast.
 * - Once both settle, merges them, caches the result in localStorage, and hydrates any Firebase image URLs client-side.
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

    let mergeCompleted = false;

    const gvizPromise = fetchDirectGvizAllTabs(spreadsheetId).then(async (res) => {
      if (res && !mergeCompleted) {
        saveCachedSheetSyncResult(res);
        if (onFastResult && !mergeCompleted) onFastResult(res);
        const hydrated = await hydrateFirebaseImagesClientSide(res);
        if (!mergeCompleted) {
          saveCachedSheetSyncResult(hydrated);
          if (onFastResult) onFastResult(hydrated);
        }
      }
      return res;
    });

    const appsScriptPromise = fetchAppsScriptOrApiPayload(appsScriptUrl);

    const [gvizRes, appsScriptRes] = await Promise.all([gvizPromise, appsScriptPromise]);
    mergeCompleted = true;

    const merged = mergeDynamicSyncResults(appsScriptRes, gvizRes);

    if (merged) {
      const hydratedMerged = await hydrateFirebaseImagesClientSide(merged);
      saveCachedSheetSyncResult(hydratedMerged);
      return hydratedMerged;
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

