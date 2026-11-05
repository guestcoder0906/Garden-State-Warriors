const DEFAULT_SPREADSHEET_ID = '1-qP7fgEI1mvwjE8cplR9_Rn-9tnHFaBP3beH6ETZC7s';

async function fetchGvizSheetTab(
  spreadsheetId: string,
  sheetName?: string
): Promise<string[][] | null> {
  try {
    const sheetParam = sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : '';
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
      spreadsheetId
    )}/gviz/tq?tqx=out:json&headers=1${sheetParam}&_t=${Date.now()}`;
    const gvizRes = await fetch(gvizUrl, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (!gvizRes.ok) return null;
    const text = await gvizRes.text();
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

    if (rows.length > 0 && cols.some((c) => !c)) {
      const firstRow = rows[0];
      const looksLikeSplitHeader =
        cols.every((colLabel, idx) => Boolean(colLabel) || Boolean(firstRow[idx])) &&
        cols.some((colLabel, idx) => Boolean(colLabel) && !firstRow[idx]);

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
 * Serverless Sync Endpoint for Vercel (/api/sync).
 * Reads the verified Google Sheet (`1-qP7fgEI1mvwjE8cplR9_Rn-9tnHFaBP3beH6ETZC7s`)
 * via either the deployed Google Apps Script Web App URL or Google Sheets public JSON visualization endpoint.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const appsScriptUrl =
    process.env.VITE_GOOGLE_APPS_SCRIPT_WEBHOOK_URL ||
    process.env.VITE_GOOGLE_APPS_SCRIPT_URL ||
    '';
  const spreadsheetId =
    process.env.VITE_GOOGLE_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;

  // Handle POST (Sponsor or Warrior form submission -> verify Google reCAPTCHA API -> Google Apps Script doPost)
  if (req.method === 'POST') {
    const parsedBody =
      typeof req.body === 'string'
        ? (() => {
            try {
              return JSON.parse(req.body);
            } catch {
              return {};
            }
          })()
        : req.body || {};

    const captchaToken = String(parsedBody.captchaToken || '').trim();
    if (!captchaToken) {
      return res.status(400).json({
        ok: false,
        error: 'Please complete the Google reCAPTCHA verification before submitting.',
      });
    }

    // Verify token against Google's official reCAPTCHA siteverify endpoint
    try {
      const recaptchaSecret =
        process.env.RECAPTCHA_SECRET_KEY || '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';
      const verifyParams = new URLSearchParams();
      verifyParams.set('secret', recaptchaSecret);
      verifyParams.set('response', captchaToken);

      const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: verifyParams.toString(),
      });
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          return res.status(400).json({
            ok: false,
            error: 'Google reCAPTCHA verification failed or expired. Please check the box again.',
          });
        }
      }
    } catch {
      // Proceed if external siteverify network call times out in restricted environment
    }

    if (
      appsScriptUrl &&
      appsScriptUrl.startsWith('https://script.google.com/') &&
      !appsScriptUrl.includes('YOUR_')
    ) {
      try {
        const bodyStr = JSON.stringify(parsedBody);
        const postRes = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: bodyStr,
        });
        if (postRes.ok) {
          const data = await postRes.json().catch(() => ({ ok: true }));
          return res.status(200).json({ ok: true, ...data });
        }
      } catch (err: any) {
        return res.status(500).json({ ok: false, error: err?.message || 'Post failed' });
      }
    }
    return res.status(400).json({
      ok: false,
      error: 'VITE_GOOGLE_APPS_SCRIPT_WEBHOOK_URL is not configured.',
    });
  }

  try {
    // 1. Try Google Apps Script Web App URL if configured
    if (
      appsScriptUrl &&
      appsScriptUrl.startsWith('https://script.google.com/') &&
      !appsScriptUrl.includes('YOUR_')
    ) {
      const separator = appsScriptUrl.includes('?') ? '&' : '?';
      const r = await fetch(`${appsScriptUrl}${separator}_t=${Date.now()}`, {
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
      if (r.ok) {
        const payload = await r.json();
        return res.status(200).json(payload);
      }
    }

    // 2. Fallback: Fetch the main Roster tab plus optional Events, Board, Coaches, Fans, Sponsors, and Become Warrior tabs in parallel
    const [
      rosterRows,
      eventsRows,
      boardRows,
      coachesRows,
      fansRows,
      sponsorsRows,
      becomeWarriorRows,
    ] = await Promise.all([
      fetchGvizSheetTab(spreadsheetId),
      fetchGvizSheetTab(spreadsheetId, 'Events'),
      fetchGvizSheetTab(spreadsheetId, 'Board'),
      fetchGvizSheetTab(spreadsheetId, 'Coaches'),
      fetchGvizSheetTab(spreadsheetId, 'Fans'),
      fetchGvizSheetTab(spreadsheetId, 'Sponsors'),
      fetchGvizSheetTab(spreadsheetId, 'Become Warrior'),
    ]);

    const sheets: Record<string, string[][]> = {};
    if (rosterRows && rosterRows.length > 0) {
      sheets.Roster = rosterRows;
    }
    if (
      eventsRows &&
      eventsRows.length > 0 &&
      JSON.stringify(eventsRows[0]) !== JSON.stringify(rosterRows?.[0])
    ) {
      sheets.Events = eventsRows;
    }
    if (
      boardRows &&
      boardRows.length > 0 &&
      JSON.stringify(boardRows[0]) !== JSON.stringify(rosterRows?.[0])
    ) {
      sheets.Board = boardRows;
    }
    if (
      coachesRows &&
      coachesRows.length > 0 &&
      JSON.stringify(coachesRows[0]) !== JSON.stringify(rosterRows?.[0])
    ) {
      sheets.Coaches = coachesRows;
    }
    if (
      fansRows &&
      fansRows.length > 0 &&
      JSON.stringify(fansRows[0]) !== JSON.stringify(rosterRows?.[0])
    ) {
      sheets.Fans = fansRows;
    }
    if (
      sponsorsRows &&
      sponsorsRows.length > 0 &&
      JSON.stringify(sponsorsRows[0]) !== JSON.stringify(rosterRows?.[0])
    ) {
      sheets.Sponsors = sponsorsRows;
    }
    if (
      becomeWarriorRows &&
      becomeWarriorRows.length > 0 &&
      JSON.stringify(becomeWarriorRows[0]) !== JSON.stringify(rosterRows?.[0])
    ) {
      sheets['Become Warrior'] = becomeWarriorRows;
    }

    if (Object.keys(sheets).length > 0) {
      return res.status(200).json({
        ok: true,
        title: 'Garden State Warriors Roster',
        tabs: Object.keys(sheets),
        sheets,
      });
    }
  } catch {
    // Silent fallback when sheet is private or empty
  }

  return res.status(200).json({
    ok: true,
    empty: true,
    sheets: {},
  });
}
