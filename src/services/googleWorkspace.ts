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

/**
 * Dynamically fetches all tabs from the verified Google Sheet
 * (`1-qP7fgEI1mvwjE8cplR9_Rn-9tnHFaBP3beH6ETZC7s`) via:
 * 1) `VITE_GOOGLE_APPS_SCRIPT_WEBHOOK_URL` (Google Apps Script Web App `doGet`), OR
 * 2) `/api/sync` serverless proxy.
 *
 * If the sheet is currently empty (0 rows below the header), returns empty arrays
 * so the UI shows temporary placeholders until rows are added.
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
      if (payload && (payload.sheets || payload.players || payload.events || payload.board || payload.coaches)) {
        return parseAppsScriptPayload(payload);
      }
    }
  } catch {
    // Silent fallback
  }

  return null;
}
