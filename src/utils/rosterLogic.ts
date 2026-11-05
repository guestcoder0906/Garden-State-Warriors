export const VERIFIED_SPREADSHEET_ID = '1-qP7fgEI1mvwjE8cplR9_Rn-9tnHFaBP3beH6ETZC7s';

export const EXACT_SHEET_HEADERS = [
  'Last Name',
  'First Name',
  'Jersey Number',
  'Position',
  'RosterTab',
  'Military Branch',
  'Military Rank',
  'Service Era',
  'Hometown',
  'Role Badge',
  'JerseyPhotoUrl',
  'MilitaryPhotoUrl',
  'Bio',
  'WhatWarriorMeans',
  'MediaUrlsCsv',
] as const;

export interface PlayerMediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  caption: string;
  placeholderInstruction?: string;
}

export interface PlayerProfile {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  jerseyNumber: string;
  position: string;
  branch: string;
  rank: string;
  tierTab: string;
  yearsOfService: string;
  hometown?: string;
  roleBadge?: 'Captain' | 'Alternate Captain' | 'Player' | 'None';
  shortCaption: string;
  bio: string;
  whatWarriorsMeans: string;
  isTestimonyFeatured?: boolean;
  jerseyPhotoUrl?: string;
  militaryPhotoUrl?: string;
  jerseyPhotoPlaceholder: string;
  militaryPhotoPlaceholder: string;
  mediaGallery: PlayerMediaItem[];
  isPlaceholder?: boolean;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  category: 'Board' | 'Coach';
  branchOrBackground?: string;
  rank?: string;
  serviceEra?: string;
  hometown?: string;
  whatWarriorMeans?: string;
  caption: string;
  photoUrl?: string;
  militaryPhotoUrl?: string;
  mediaGallery?: PlayerMediaItem[];
  photoPlaceholder: string;
  isPlaceholder?: boolean;
}

export interface FanItem {
  id: string;
  title: string;
  category: 'Family' | 'Friends' | 'Pets';
  roleLabel?: string;
  relatedPlayer?: string;
  caption: string;
  photoUrl?: string;
  photoPlaceholder: string;
}

export interface SponsorItem {
  id: string;
  name: string;
  tier: string;
  description: string;
  message?: string;
  website?: string;
  logoUrl?: string;
  placeholderNote: string;
}

export interface ClubEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  location: string;
  category: string;
  description: string;
  imageUrl?: string;
  placeholderBanner: string;
  externalUrl?: string;
  isPlaceholder?: boolean;
}

/**
 * Extracts a clean Google Spreadsheet ID from either a full Google Sheets URL or a raw ID string.
 */
export function extractSpreadsheetId(input: string): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Formats a standardized missing-media or missing-info instruction string:
 * [Replace with (name of info and instructions to get it) - (media type)]
 */
export function formatReplaceTag(infoAndInstructions: string, mediaType: string): string {
  const cleanInfo = infoAndInstructions.trim();
  const cleanType = mediaType.trim();
  return `[Replace with ${cleanInfo} - ${cleanType}]`;
}

/**
 * Normalizes a header string by lowercasing and stripping spaces/underscores
 * so "Last Name" and "LastName", or "WhatWarriorMeans" and "WhatWarriorsMeans" match identically.
 */
function normalizeHeaderKey(header: string): string {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

/**
 * Cleans a raw cell value from Google Sheets or Apps Script.
 * Any empty string, "--", "—", or "[Insert/Replace ...]" placeholder is treated as empty ('')
 * so its corresponding UI is completely hidden while the cell is empty.
 */
export function cleanSheetCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (!str || str === '--' || str === '—' || str === 'CellImage') return '';
  if (str.startsWith('[') && str.endsWith(']')) return '';
  return str;
}

/**
 * Normalizes any image cell value from Google Sheets:
 * - Extracts the URL inside `=IMAGE("https://...")` formulas if present
 * - Converts Google Drive sharing links (`drive.google.com/file/d/ID/view`, `drive.google.com/open?id=ID`, `drive.google.com/uc?id=ID`)
 *   into direct embeddable `https://lh3.googleusercontent.com/d/ID` image URLs
 * - Preserves Firebase Storage URLs, `lh3.googleusercontent.com` in-cell/Google Photos URLs, `data:image/...` URLs, and standard URLs
 */
export function normalizeSheetImageUrl(val: unknown): string {
  const cleaned = cleanSheetCell(val);
  if (!cleaned) return '';

  // 1. Unwrap =IMAGE("https://...") formula if present
  const formulaMatch = cleaned.match(/^=\s*IMAGE\s*\(\s*["']([^"']+)["']/i);
  const candidate = formulaMatch && formulaMatch[1] ? formulaMatch[1].trim() : cleaned;
  if (!candidate || candidate === 'CellImage') return '';

  // 2. Reject local-only blob: or base64 data:image strings from sheet cells
  if (candidate.startsWith('blob:') || candidate.startsWith('data:image/')) {
    return '';
  }

  // 3. Normalize permanent Firebase server asset URLs (/api/firebase-image?id=<assetId> or /documents/sponsor_assets/<assetId>)
  const fbApiMatch = candidate.match(/\/api\/firebase-image\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/i);
  const fbDocMatch = candidate.match(/\/documents\/sponsor_assets\/([a-zA-Z0-9_-]+)/i);
  const fbAssetId = fbApiMatch?.[1] || fbDocMatch?.[1];
  if (fbAssetId) {
    const origin =
      typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    return `${origin}/api/firebase-image?id=${encodeURIComponent(fbAssetId)}`;
  }

  // 4. Convert Google Drive file sharing links to direct embeddable image URLs
  const driveFileMatch = candidate.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (driveFileMatch && driveFileMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveFileMatch[1]}`;
  }
  const driveIdParamMatch = candidate.match(/drive\.google\.com\/(?:open|uc|thumbnail)\?[^#]*\bid=([a-zA-Z0-9_-]+)/i);
  if (driveIdParamMatch && driveIdParamMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveIdParamMatch[1]}`;
  }

  return candidate;
}

/**
 * Splits a MediaUrlsCsv cell that may contain either:
 * - A single in-cell image URL / Google Photos URL / `data:image/...` URL, OR
 * - Multiple comma-separated image/video URLs
 */
export function splitMediaUrlsCell(rawMedia: unknown): string[] {
  const cleaned = cleanSheetCell(rawMedia);
  if (!cleaned) return [];
  if (cleaned.startsWith('data:image/')) {
    return [cleaned];
  }
  if (/^=\s*IMAGE\s*\(/i.test(cleaned)) {
    const single = normalizeSheetImageUrl(cleaned);
    return single ? [single] : [];
  }
  return cleaned
    .split(',')
    .map((u) => normalizeSheetImageUrl(u))
    .filter(Boolean);
}

/**
 * Parses a 2D string array from a Google Sheet tab into PlayerProfile objects.
 * Matches the user's exact 15-column sheet format:
 * Last Name | First Name | Jersey Number | Position | RosterTab | Military Branch | Military Rank | Service Era | Hometown | Role Badge | JerseyPhotoUrl | MilitaryPhotoUrl | Bio | WhatWarriorMeans | MediaUrlsCsv
 *
 * Empty cells remain empty ('') so their corresponding UI elements are not rendered while empty.
 */
export function parseSheetRowsToPlayers(
  rows: string[][],
  defaultTabName = ''
): PlayerProfile[] {
  if (!rows || rows.length < 2) return [];
  const normHeaders = rows[0].map(normalizeHeaderKey);

  const findCol = (exactKeys: string[], partialKeys: string[]) => {
    const exactIdx = normHeaders.findIndex((h) => exactKeys.includes(h));
    if (exactIdx >= 0) return exactIdx;
    return normHeaders.findIndex((h) => partialKeys.some((k) => h.includes(k)));
  };

  const idxLastName = findCol(['lastname', 'last'], ['lastname']);
  const idxFirstName = findCol(['firstname', 'first'], ['firstname']);
  const idxFullName = findCol(['name', 'fullname', 'playername'], ['player']);
  const idxJersey = findCol(['jerseynumber', 'jersey', 'number', '#'], ['jersey', 'number']);
  const idxPos = findCol(['position', 'pos'], ['position', 'pos']);
  const idxRosterTab = findCol(['rostertab', 'tier', 'tab', 'division'], ['rostertab', 'tier', 'tab']);
  const idxBranch = findCol(['militarybranch', 'branch', 'servicebranch'], ['branch', 'service']);
  const idxRank = findCol(['militaryrank', 'rank', 'grade'], ['rank', 'grade']);
  const idxEra = findCol(['serviceera', 'era', 'yearsofservice', 'years'], ['serviceera', 'era', 'years']);
  const idxHometown = findCol(['hometown', 'city', 'town'], ['hometown', 'town']);
  const idxRole = findCol(['rolebadge', 'role', 'badge', 'captain'], ['role', 'badge', 'captain']);
  const idxJerseyPhoto = findCol(['jerseyphotourl', 'jerseyphoto', 'photo', 'headshot'], ['jerseyphoto', 'headshot', 'portrait']);
  const idxMilitaryPhoto = findCol(['militaryphotourl', 'militaryphoto', 'servicephoto'], ['militaryphoto', 'servicephoto']);
  const idxBio = findCol(['bio', 'biography'], ['bio', 'history']);
  const idxMeaning = findCol(
    ['whatwarriormeans', 'whatwarriorsmeans', 'testimony', 'meaning'],
    ['warriormeans', 'warriorsmeans', 'meaning', 'testimony', 'quote']
  );
  const idxMedia = findCol(['mediaurlscsv', 'mediaurls', 'media'], ['media', 'gallery']);

  const isGenericSheetName = (name: string) =>
    !name ||
    /^(sheet\d*|roster|garden state warriors roster|veterans roster|players)$/i.test(name.trim());

  const players: PlayerProfile[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((cell) => !cleanSheetCell(cell))) continue;

    const getCell = (idx: number) =>
      idx >= 0 && row[idx] !== undefined ? cleanSheetCell(row[idx]) : '';

    // Skip rows that are explicitly marked as Board, Coach, Events, Fans, or Sponsors in RosterTab
    const rawRosterTab = getCell(idxRosterTab);
    const rawRoleBadge = getCell(idxRole);
    if (
      /^(board|staff|coach|coaches|event|events|schedule|fan|fans|sponsor|sponsors)$/i.test(
        rawRosterTab
      )
    ) {
      continue;
    }

    const firstName = getCell(idxFirstName);
    const lastName = getCell(idxLastName);
    const explicitFull =
      idxFullName >= 0 && idxFullName !== idxFirstName && idxFullName !== idxLastName
        ? getCell(idxFullName)
        : '';

    let displayName = '';
    if (firstName && lastName) {
      displayName = `${firstName} ${lastName}`;
    } else if (firstName || lastName) {
      displayName = firstName || lastName;
    } else if (explicitFull) {
      displayName = explicitFull;
    }

    const jerseyNumber = getCell(idxJersey);
    const position = getCell(idxPos);
    const branch = getCell(idxBranch);
    const rank = getCell(idxRank);
    const fallbackTab = isGenericSheetName(defaultTabName) ? '' : defaultTabName.trim();
    const rawTier = rawRosterTab || fallbackTab;
    const yearsOfService = getCell(idxEra);
    const hometown = getCell(idxHometown);
    const rawBio = getCell(idxBio);
    const rawMeaning = getCell(idxMeaning);
    const jerseyPhotoUrl = normalizeSheetImageUrl(getCell(idxJerseyPhoto)) || undefined;
    const militaryPhotoUrl = normalizeSheetImageUrl(getCell(idxMilitaryPhoto)) || undefined;
    const rawMedia = getCell(idxMedia);

    let tierTab = rawTier;
    if (/^captain/i.test(rawTier)) {
      tierTab = 'Captains';
    } else if (/^alpha/i.test(rawTier)) {
      tierTab = 'Alpha';
    } else if (/^bravo/i.test(rawTier)) {
      tierTab = 'Bravo';
    } else if (/^charlie/i.test(rawTier)) {
      tierTab = 'Charlie';
    }

    let roleBadge: PlayerProfile['roleBadge'] = 'None';
    if (/alternate|\ba\b/i.test(rawRoleBadge)) {
      roleBadge = 'Alternate Captain';
    } else if (/captain|\bc\b/i.test(rawRoleBadge) || /^captains$/i.test(defaultTabName)) {
      roleBadge = 'Captain';
    } else if (rawRoleBadge) {
      roleBadge = 'Player';
    }

    const shortParts = [
      rank,
      branch,
      jerseyNumber ? `#${jerseyNumber}` : '',
      position,
      hometown,
    ].filter(Boolean);

    const shortCaption = shortParts.join(' · ');
    const bio = rawBio;
    const whatWarriorsMeans = rawMeaning;

    const mediaUrls = splitMediaUrlsCell(rawMedia);

    const mediaGallery: PlayerMediaItem[] = mediaUrls.map((url, idx) => ({
      id: `sheet-media-${i}-${idx}`,
      type: /\.(mp4|webm|mov)$/i.test(url) ? 'video' : 'image',
      url,
      caption: displayName ? `${displayName} — Media #${idx + 1}` : `Media #${idx + 1}`,
    }));

    players.push({
      id: `sheet-${(defaultTabName || 'roster').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${i}-${(
        displayName || `row-${i}`
      )
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')}`,
      name: displayName,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      jerseyNumber,
      position,
      branch,
      rank,
      tierTab,
      yearsOfService,
      hometown: hometown || undefined,
      roleBadge,
      shortCaption,
      bio,
      whatWarriorsMeans,
      isTestimonyFeatured: Boolean(rawMeaning),
      jerseyPhotoUrl,
      militaryPhotoUrl,
      jerseyPhotoPlaceholder: '',
      militaryPhotoPlaceholder: '',
      mediaGallery,
      isPlaceholder: false,
    });
  }

  return players;
}

/**
 * Extracts Board & Coaching Staff rows either from a dedicated "Board" / "Coaches" tab
 * OR from rows in the 15-column sheet where RosterTab is "Board"/"Coach" or Role Badge is
 * "President", "Vice President", "Secretary", "Treasurer", "Head Coach", or "Associate Coach".
 */
export function parseSheetRowsToStaff(
  rows: string[][],
  defaultCategory: 'Board' | 'Coach' | 'Auto' = 'Auto'
): StaffMember[] {
  if (!rows || rows.length < 2) return [];
  const normHeaders = rows[0].map(normalizeHeaderKey);
  const findCol = (keys: string[]) => {
    const exactIdx = normHeaders.findIndex((h) => keys.includes(h));
    if (exactIdx >= 0) return exactIdx;
    return normHeaders.findIndex((h) => keys.some((k) => h.includes(k)));
  };

  const idxLast = findCol(['lastname', 'last']);
  const idxFirst = findCol(['firstname', 'first']);
  const idxName = findCol(['name', 'fullname', 'officer', 'coach', 'member']);
  const idxRole = findCol(['role', 'rolebadge', 'title', 'position', 'office']);
  const idxRosterTab = findCol(['rostertab', 'category', 'type', 'group']);
  const idxBranch = findCol(['militarybranch', 'branch', 'servicebranch', 'background']);
  const idxRank = findCol(['militaryrank', 'rank']);
  const idxEra = findCol(['serviceera', 'era', 'yearsofservice']);
  const idxHometown = findCol(['hometown', 'city', 'town']);
  const idxCaption = findCol(['caption', 'bio', 'description']);
  const idxMeaning = findCol(['whatwarriormeans', 'whatwarriorsmeans', 'testimony']);
  const idxPhoto = findCol(['photourl', 'jerseyphotourl', 'photo', 'imageurl', 'image', 'headshot']);
  const idxMilitaryPhoto = findCol(['militaryphotourl', 'militaryphoto', 'servicephoto']);
  const idxMedia = findCol(['mediaurlscsv', 'mediaurls', 'media']);

  const staffList: StaffMember[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !cleanSheetCell(c))) continue;
    const getCell = (idx: number) =>
      idx >= 0 && row[idx] !== undefined ? cleanSheetCell(row[idx]) : '';

    const rawTab = getCell(idxRosterTab);
    const rawRole = getCell(idxRole);

    const isBoardRow =
      defaultCategory === 'Board' ||
      /^(board|staff|officer|officers)$/i.test(rawTab) ||
      (defaultCategory === 'Auto' &&
        !rawTab &&
        /^(president|vice president|secretary|treasurer)$/i.test(rawRole));
    const isCoachRow =
      defaultCategory === 'Coach' ||
      /^(coach|coaches|coaching)$/i.test(rawTab) ||
      (defaultCategory === 'Auto' && !rawTab && /coach/i.test(rawRole));

    if (defaultCategory === 'Auto' && !isBoardRow && !isCoachRow) {
      continue;
    }

    const category: 'Board' | 'Coach' = isCoachRow ? 'Coach' : 'Board';
    const first = getCell(idxFirst);
    const last = getCell(idxLast);
    const full =
      idxName >= 0 && idxName !== idxFirst && idxName !== idxLast ? getCell(idxName) : '';
    const role = rawRole;
    const name = first || last ? [first, last].filter(Boolean).join(' ') : full;

    const branchOrBackground = getCell(idxBranch);
    const rank = getCell(idxRank);
    const serviceEra = getCell(idxEra);
    const hometown = getCell(idxHometown);
    const caption = getCell(idxCaption);
    const whatWarriorMeans = getCell(idxMeaning);
    const photoUrl = normalizeSheetImageUrl(getCell(idxPhoto)) || undefined;
    const militaryPhotoUrl = normalizeSheetImageUrl(getCell(idxMilitaryPhoto)) || undefined;
    const mediaUrls = splitMediaUrlsCell(getCell(idxMedia));
    const mediaGallery: PlayerMediaItem[] = mediaUrls.map((url, idx) => ({
      id: `staff-media-${i}-${idx}`,
      type: /\.(mp4|webm|mov)$/i.test(url) ? 'video' : 'image',
      url,
      caption: name ? `${name} — Media #${idx + 1}` : `Media #${idx + 1}`,
    }));

    if (
      !name &&
      !role &&
      !caption &&
      !photoUrl &&
      !militaryPhotoUrl &&
      !branchOrBackground &&
      !whatWarriorMeans
    ) {
      continue;
    }

    staffList.push({
      id: `sheet-staff-${category.toLowerCase()}-${i}-${(role || name || `row-${i}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')}`,
      name,
      role,
      category,
      branchOrBackground: branchOrBackground || undefined,
      rank: rank || undefined,
      serviceEra: serviceEra || undefined,
      hometown: hometown || undefined,
      whatWarriorMeans: whatWarriorMeans || undefined,
      caption,
      photoUrl,
      militaryPhotoUrl,
      mediaGallery: mediaGallery.length > 0 ? mediaGallery : undefined,
      photoPlaceholder: '',
      isPlaceholder: false,
    });
  }
  return staffList;
}

/**
 * Parses an "Events" tab from the Google Sheet, OR inline rows in the 15-column sheet where RosterTab is "Events".
 * Dedicated Events Tab Columns (all optional):
 * Title | Date | Time | Location | Category | Description | FlyerUrl | ExternalUrl
 */
export function parseSheetRowsToEvents(
  rows: string[][],
  mode: 'DedicatedTab' | 'InlineRosterTab' = 'DedicatedTab'
): ClubEvent[] {
  if (!rows || rows.length < 2) return [];
  const normHeaders = rows[0].map(normalizeHeaderKey);
  const findCol = (keys: string[]) => {
    const exactIdx = normHeaders.findIndex((h) => keys.includes(h));
    if (exactIdx >= 0) return exactIdx;
    return normHeaders.findIndex((h) => keys.some((k) => h.includes(k)));
  };

  const idxRosterTab = findCol(['rostertab', 'tab']);
  const idxTitle = findCol(['title', 'event', 'eventname', 'name']);
  const idxDate = findCol(['date', 'eventdate', 'day']);
  const idxTime = findCol(['time', 'eventtime']);
  const idxLoc = findCol(['location', 'venue', 'rink', 'place']);
  const idxCategory = findCol(['category', 'type']);
  const idxDesc = findCol(['description', 'details', 'bio', 'info']);
  const idxImg = findCol(['flyerurl', 'imageurl', 'photourl', 'flyer', 'image', 'photo', 'banner']);
  const idxUrl = findCol(['externalurl', 'url', 'link']);

  const events: ClubEvent[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !cleanSheetCell(c))) continue;
    const getCell = (idx: number) =>
      idx >= 0 && row[idx] !== undefined ? cleanSheetCell(row[idx]) : '';

    if (mode === 'InlineRosterTab') {
      const rawTab = getCell(idxRosterTab);
      if (!/^(event|events|schedule)$/i.test(rawTab)) continue;
    }

    const title = getCell(idxTitle);
    const date = getCell(idxDate);
    const time = getCell(idxTime);
    const location = getCell(idxLoc);
    const category = getCell(idxCategory);
    const description = getCell(idxDesc);
    const imageUrl = normalizeSheetImageUrl(getCell(idxImg)) || undefined;
    const externalUrl = getCell(idxUrl) || undefined;

    if (!title && !date && !time && !location && !category && !description && !imageUrl) continue;

    events.push({
      id: `sheet-event-${mode}-${i}`,
      title,
      date,
      time: time || undefined,
      location,
      category,
      description,
      imageUrl,
      placeholderBanner: '',
      externalUrl,
      isPlaceholder: false,
    });
  }
  return events;
}

/**
 * Parses an optional "Fans" tab from the Google Sheet.
 * Dedicated Fans Tab Columns (supports both `Role,Name,Caption,PhotoUrl` and `Title,Category,RelatedPlayer,Caption,PhotoUrl`):
 */
export function parseSheetRowsToFans(rows: string[][]): FanItem[] {
  if (!rows || rows.length < 2) return [];
  const normHeaders = rows[0].map(normalizeHeaderKey);
  const findCol = (keys: string[]) => {
    const exactIdx = normHeaders.findIndex((h) => keys.includes(h));
    if (exactIdx >= 0) return exactIdx;
    return normHeaders.findIndex((h) => keys.some((k) => h.includes(k)));
  };

  const idxTitle = findCol(['name', 'title', 'fullname', 'fan']);
  const idxCategory = findCol(['role', 'category', 'rolebadge', 'type', 'group']);
  const idxPlayer = findCol(['relatedplayer', 'player', 'warrior']);
  const idxCaption = findCol(['caption', 'bio', 'description']);
  const idxPhoto = findCol(['photourl', 'photo', 'imageurl', 'image']);

  const fans: FanItem[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !cleanSheetCell(c))) continue;
    const getCell = (idx: number) =>
      idx >= 0 && row[idx] !== undefined ? cleanSheetCell(row[idx]) : '';

    const title = getCell(idxTitle);
    const rawCat = getCell(idxCategory);
    const category: 'Family' | 'Friends' | 'Pets' = /pet|dog|cat|pup|k9/i.test(rawCat)
      ? 'Pets'
      : /friend|supporter|fan/i.test(rawCat)
      ? 'Friends'
      : 'Family';
    const relatedPlayer = getCell(idxPlayer) || undefined;
    const caption = getCell(idxCaption);
    const photoUrl = normalizeSheetImageUrl(getCell(idxPhoto)) || undefined;

    if (!title && !rawCat && !caption && !photoUrl) continue;

    fans.push({
      id: `sheet-fan-${i}`,
      title,
      category: rawCat ? category : ('' as any),
      roleLabel: rawCat || undefined,
      relatedPlayer,
      caption,
      photoUrl,
      photoPlaceholder: '',
    });
  }
  return fans;
}

/**
 * Returns true if a Google Sheets checkbox / Verified column cell is checked.
 */
export function isSheetCheckmarkTrue(val: unknown): boolean {
  if (val === true || val === 1) return true;
  if (val === null || val === undefined || val === false) return false;
  const s = String(val).trim().toLowerCase();
  return (
    s === 'true' ||
    s === 'yes' ||
    s === '1' ||
    s === 'checked' ||
    s === '✓' ||
    s === '✔' ||
    s === '☑' ||
    s === 'x' ||
    s === 'y'
  );
}

/**
 * Regex pattern for validating a sponsor website URL (supports optional http/https, subdomains, domain, TLD, and optional path/query).
 */
export const WEBSITE_URL_REGEX =
  /^(https?:\/\/)?(www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/[^\s]*)?$/i;

/**
 * Validates whether a given string is a valid website URL using WEBSITE_URL_REGEX.
 */
export function isValidWebsiteUrl(input: string): boolean {
  const trimmed = String(input || '').trim();
  if (!trimmed) return false;
  return WEBSITE_URL_REGEX.test(trimmed);
}

/**
 * Ensures a valid website URL includes an http:// or https:// protocol prefix for anchor hrefs.
 */
export function normalizeWebsiteUrl(input: string): string {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Parses the "Sponsors" tab from the Google Sheet.
 * Dedicated Sponsors Tab Columns:
 * Verified, Timestamp Submitted, Name, Phone, Email, Preferred Contact, Website, Message, LogoUrl, Tier
 *
 * Only rows where the "Verified" column checkbox is checked (TRUE) are returned for the Home page.
 */
export function parseSheetRowsToSponsors(rows: string[][]): SponsorItem[] {
  if (!rows || rows.length < 2) return [];
  const normHeaders = rows[0].map(normalizeHeaderKey);
  const findCol = (keys: string[]) => {
    const exactIdx = normHeaders.findIndex((h) => keys.includes(h));
    if (exactIdx >= 0) return exactIdx;
    return normHeaders.findIndex((h) => keys.some((k) => h.includes(k)));
  };

  const idxVerified = findCol(['verified', 'approved', 'active', 'show']);
  const idxName = findCol(['name', 'sponsorname', 'sponsor', 'title', 'company', 'organization']);
  const idxTier = findCol(['tier', 'level', 'category', 'type']);
  const idxMsg = findCol(['message', 'quote', 'note', 'comment', 'testimony']);
  const idxDesc = findCol(['description', 'caption', 'bio', 'details']);
  const idxWeb = findCol(['website', 'url', 'link', 'site', 'webpage']);
  const idxLogo = findCol([
    'logourl',
    'logo',
    'sponsorlogo',
    'sponsorlogoflyerimageupload',
    'sponsorlogoflyer',
    'flyerurl',
    'flyer',
    'photourl',
    'photo',
    'imageurl',
    'image',
    'upload',
  ]);

  const sponsors: SponsorItem[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !cleanSheetCell(c))) continue;
    const getCell = (idx: number) =>
      idx >= 0 && row[idx] !== undefined ? cleanSheetCell(row[idx]) : '';

    // If a Verified column exists in the sheet, only include rows where Verified is checked (TRUE)
    if (idxVerified >= 0) {
      const rawVerified = row[idxVerified];
      if (!isSheetCheckmarkTrue(rawVerified)) {
        continue;
      }
    }

    const name = getCell(idxName);
    const tier = getCell(idxTier);
    const rawMsg = getCell(idxMsg);
    const rawDesc = getCell(idxDesc);
    const message = rawMsg || rawDesc;
    const description = message;
    const website = getCell(idxWeb) || undefined;
    const logoUrl = normalizeSheetImageUrl(getCell(idxLogo)) || undefined;

    if (!name && !logoUrl && !message && !website && !tier) continue;

    sponsors.push({
      id: `sheet-sponsor-${i}`,
      name,
      tier,
      description,
      message: message || undefined,
      website,
      logoUrl,
      placeholderNote: '',
    });
  }
  return sponsors;
}

/**
 * Parses a multi-tab JSON payload returned by the Google Apps Script Web App (`doGet`) or `/api/sync`.
 * Supports BOTH:
 * 1) `{ sheets: Record<string, string[][]> }` (raw 2D rows per tab), AND
 * 2) `{ players: [...], board: [...], coaches: [...], events: [...], fans: [...], sponsors: [...] }` (structured Apps Script payload).
 */
export function parseAppsScriptPayload(payload: {
  title?: string;
  tabs?: string[];
  sheets?: Record<string, string[][]>;
  players?: any[];
  board?: any[];
  coaches?: any[];
  events?: any[];
  fans?: any[];
  sponsors?: any[];
}): {
  players: PlayerProfile[];
  staff: StaffMember[];
  events: ClubEvent[];
  fans: FanItem[];
  sponsors: SponsorItem[];
  detectedTabs: string[];
} {
  const sheets = payload?.sheets || {};
  const tabNames = Object.keys(sheets);
  const allPlayers: PlayerProfile[] = [];
  const allStaff: StaffMember[] = [];
  const allEvents: ClubEvent[] = [];
  const allFans: FanItem[] = [];
  const allSponsors: SponsorItem[] = [];
  const playerTabsSet = new Set<string>();

  const hasDedicatedBoardSheet = tabNames.some((t) =>
    /^(board|staff|officers|board and staff)$/i.test(t.trim())
  );
  const hasDedicatedCoachesSheet = tabNames.some((t) =>
    /^(coaches|coach|coaching|coaching staff)$/i.test(t.trim())
  );
  const hasDedicatedEventsSheet = tabNames.some((t) =>
    /^(events|event|schedule|calendar)$/i.test(t.trim())
  );
  const hasDedicatedFansSheet = tabNames.some((t) =>
    /^(fans|fan|fan wall|supporters|family)$/i.test(t.trim())
  );
  const hasDedicatedSponsorsSheet = tabNames.some((t) =>
    /^(sponsors|sponsor|partners)$/i.test(t.trim())
  );

  // 1. Parse raw 2D tab arrays if present in `payload.sheets`
  for (const tabName of tabNames) {
    const rows = sheets[tabName];
    if (!Array.isArray(rows) || rows.length < 2) continue;

    if (/^(board|staff|officers|board and staff)$/i.test(tabName.trim())) {
      allStaff.push(...parseSheetRowsToStaff(rows, 'Board'));
    } else if (/^(coaches|coach|coaching|coaching staff)$/i.test(tabName.trim())) {
      allStaff.push(...parseSheetRowsToStaff(rows, 'Coach'));
    } else if (/^(events|event|schedule|calendar)$/i.test(tabName.trim())) {
      allEvents.push(...parseSheetRowsToEvents(rows, 'DedicatedTab'));
    } else if (/^(fans|fan|fan wall|supporters|family)$/i.test(tabName.trim())) {
      allFans.push(...parseSheetRowsToFans(rows));
    } else if (/^(sponsors|sponsor|partners)$/i.test(tabName.trim())) {
      allSponsors.push(...parseSheetRowsToSponsors(rows));
    } else {
      const parsedPlayers = parseSheetRowsToPlayers(rows, tabName);
      const inlineStaff = parseSheetRowsToStaff(rows, 'Auto');
      const inlineEvents = parseSheetRowsToEvents(rows, 'InlineRosterTab');
      if (parsedPlayers.length > 0) {
        allPlayers.push(...parsedPlayers);
        parsedPlayers.forEach((p) => {
          if (p.tierTab) playerTabsSet.add(p.tierTab);
        });
      }
      if (inlineStaff.length > 0) {
        allStaff.push(...inlineStaff);
      }
      if (inlineEvents.length > 0) {
        allEvents.push(...inlineEvents);
      }
    }
  }

  // 2. Also support structured arrays (`players`, `board`, `coaches`, `events`, `fans`, `sponsors`)
  if (allPlayers.length === 0 && Array.isArray(payload?.players) && payload.players.length > 0) {
    payload.players.forEach((p: any, i: number) => {
      const firstName = cleanSheetCell(p.firstName);
      const lastName = cleanSheetCell(p.lastName);
      const rawFull = cleanSheetCell(p.fullName || p.name);
      const name =
        [firstName, lastName].filter(Boolean).join(' ') ||
        (/^warrior #\d+$/i.test(rawFull) ? '' : rawFull);
      const rawTier = cleanSheetCell(p.rosterTab || p.tierTab);
      let tierTab = rawTier;
      if (/^captain/i.test(rawTier)) tierTab = 'Captains';
      else if (/^alpha/i.test(rawTier)) tierTab = 'Alpha';
      else if (/^bravo/i.test(rawTier)) tierTab = 'Bravo';
      else if (/^charlie/i.test(rawTier)) tierTab = 'Charlie';

      if (tierTab) playerTabsSet.add(tierTab);

      const jerseyNumber = cleanSheetCell(p.jerseyNumber);
      const rawPos = cleanSheetCell(p.position);
      const position = rawPos === 'Player' ? '' : rawPos;
      const rawBranch = cleanSheetCell(p.branch);
      const branch = rawBranch === 'U.S. Armed Forces' ? '' : rawBranch;
      const rank = cleanSheetCell(p.militaryRank || p.rank);
      const yearsOfService = cleanSheetCell(p.serviceEra || p.yearsOfService);
      const rawHometown = cleanSheetCell(p.hometown);
      const hometown = rawHometown;
      const bio = cleanSheetCell(p.bio);
      const whatWarriorsMeans = cleanSheetCell(p.whatWarriorMeans || p.whatWarriorsMeans);
      const jerseyPhotoUrl = normalizeSheetImageUrl(p.jerseyPhotoUrl) || undefined;
      const militaryPhotoUrl = normalizeSheetImageUrl(p.militaryPhotoUrl) || undefined;
      const rawRoleBadge = cleanSheetCell(p.roleBadge);

      allPlayers.push({
        id: p.id || `as-player-${i}`,
        name,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        jerseyNumber,
        position,
        branch,
        rank,
        tierTab,
        yearsOfService,
        hometown: hometown || undefined,
        roleBadge:
          /alternate|\ba\b/i.test(rawRoleBadge)
            ? 'Alternate Captain'
            : /captain|\bc\b/i.test(rawRoleBadge)
            ? 'Captain'
            : rawRoleBadge
            ? 'Player'
            : 'None',
        shortCaption: [rank, branch, jerseyNumber ? `#${jerseyNumber}` : '', position, hometown]
          .filter(Boolean)
          .join(' · '),
        bio,
        whatWarriorsMeans,
        isTestimonyFeatured: Boolean(whatWarriorsMeans),
        jerseyPhotoUrl,
        militaryPhotoUrl,
        jerseyPhotoPlaceholder: '',
        militaryPhotoPlaceholder: '',
        mediaGallery: Array.isArray(p.mediaGallery)
          ? p.mediaGallery
              .map((url: any, idx: number) =>
                typeof url === 'string'
                  ? {
                      id: `m-${i}-${idx}`,
                      type: /\.(mp4|webm|mov)$/i.test(url) ? 'video' : 'image',
                      url: normalizeSheetImageUrl(url),
                      caption: name ? `${name} — Media #${idx + 1}` : `Media #${idx + 1}`,
                    }
                  : url
              )
              .filter((m: any) => Boolean(m && m.url))
          : [],
        isPlaceholder: false,
      });
    });
  }

  if (!hasDedicatedBoardSheet && Array.isArray(payload?.board)) {
    payload.board.forEach((b: any, i: number) => {
      const name = cleanSheetCell(b.name);
      const role = cleanSheetCell(b.role);
      const caption = cleanSheetCell(b.caption);
      const photoUrl = normalizeSheetImageUrl(b.photoUrl) || undefined;
      if (!name && !role && !caption && !photoUrl) return;
      allStaff.push({
        id: b.id || `as-board-${i}`,
        name,
        role,
        category: 'Board',
        caption,
        photoUrl,
        photoPlaceholder: '',
        isPlaceholder: false,
      });
    });
  }

  if (!hasDedicatedCoachesSheet && Array.isArray(payload?.coaches)) {
    payload.coaches.forEach((c: any, i: number) => {
      const name = cleanSheetCell(c.name);
      const role = cleanSheetCell(c.role);
      const caption = cleanSheetCell(c.caption);
      const photoUrl = normalizeSheetImageUrl(c.photoUrl) || undefined;
      const militaryPhotoUrl = normalizeSheetImageUrl(c.militaryPhotoUrl) || undefined;
      const branchOrBackground = cleanSheetCell(c.branch || c.branchOrBackground) || undefined;
      const serviceEra = cleanSheetCell(c.serviceEra) || undefined;
      const hometown = cleanSheetCell(c.hometown) || undefined;
      const whatWarriorMeans = cleanSheetCell(c.whatWarriorMeans) || undefined;
      const mediaGallery: PlayerMediaItem[] = Array.isArray(c.mediaGallery)
        ? c.mediaGallery
            .map((url: any, idx: number) =>
              typeof url === 'string'
                ? {
                    id: `coach-m-${i}-${idx}`,
                    type: /\.(mp4|webm|mov)$/i.test(url) ? 'video' : 'image',
                    url: normalizeSheetImageUrl(url),
                    caption: name ? `${name} — Media #${idx + 1}` : `Media #${idx + 1}`,
                  }
                : url
            )
            .filter((m: any) => Boolean(m && m.url))
        : [];
      if (
        !name &&
        !role &&
        !caption &&
        !photoUrl &&
        !militaryPhotoUrl &&
        !branchOrBackground &&
        !whatWarriorMeans
      ) {
        return;
      }
      allStaff.push({
        id: c.id || `as-coach-${i}`,
        name,
        role,
        category: 'Coach',
        branchOrBackground,
        serviceEra,
        hometown,
        whatWarriorMeans,
        caption,
        photoUrl,
        militaryPhotoUrl,
        mediaGallery: mediaGallery.length > 0 ? mediaGallery : undefined,
        photoPlaceholder: '',
        isPlaceholder: false,
      });
    });
  }

  if (!hasDedicatedEventsSheet && Array.isArray(payload?.events)) {
    payload.events.forEach((ev: any, i: number) => {
      const title = cleanSheetCell(ev.title);
      const date = cleanSheetCell(ev.date);
      const time = cleanSheetCell(ev.time);
      const location = cleanSheetCell(ev.location);
      const category = cleanSheetCell(ev.category);
      const description = cleanSheetCell(ev.description);
      const imgCandidate = normalizeSheetImageUrl(ev.imageUrl || ev.flyerPlaceholder);
      const externalUrl = cleanSheetCell(ev.externalUrl);
      if (!title && !date && !location && !description && !imgCandidate) return;
      allEvents.push({
        id: ev.id || `as-event-${i}`,
        title,
        date,
        time: time || undefined,
        location,
        category,
        description,
        imageUrl: imgCandidate || undefined,
        placeholderBanner: '',
        externalUrl: externalUrl || undefined,
        isPlaceholder: false,
      });
    });
  }

  if (!hasDedicatedFansSheet && Array.isArray(payload?.fans)) {
    payload.fans.forEach((f: any, i: number) => {
      const title = cleanSheetCell(f.title || f.name);
      const rawCat = cleanSheetCell(f.category || f.role);
      const category: 'Family' | 'Friends' | 'Pets' = /pet|dog|cat|pup|k9/i.test(rawCat)
        ? 'Pets'
        : /friend|supporter|fan/i.test(rawCat)
        ? 'Friends'
        : 'Family';
      const relatedPlayer = cleanSheetCell(f.relatedPlayer) || undefined;
      const caption = cleanSheetCell(f.caption);
      const photoUrl = normalizeSheetImageUrl(f.photoUrl) || undefined;
      if (!title && !rawCat && !caption && !photoUrl) return;
      allFans.push({
        id: f.id || `as-fan-${i}`,
        title,
        category: rawCat ? category : ('' as any),
        roleLabel: rawCat || undefined,
        relatedPlayer,
        caption,
        photoUrl,
        photoPlaceholder: '',
      });
    });
  }

  if (!hasDedicatedSponsorsSheet && Array.isArray(payload?.sponsors)) {
    payload.sponsors.forEach((sp: any, i: number) => {
      if (sp.verified !== undefined && !isSheetCheckmarkTrue(sp.verified)) {
        return;
      }
      const name = cleanSheetCell(sp.name);
      const tier = cleanSheetCell(sp.tier);
      const message = cleanSheetCell(sp.message || sp.description);
      const description = message;
      const website = cleanSheetCell(sp.website) || undefined;
      const logoUrl = normalizeSheetImageUrl(sp.logoUrl || sp.photoUrl || sp.imageUrl) || undefined;
      if (!name && !logoUrl && !message && !website && !tier) return;
      allSponsors.push({
        id: sp.id || `as-sponsor-${i}`,
        name,
        tier,
        description,
        message: message || undefined,
        website,
        logoUrl,
        placeholderNote: '',
      });
    });
  }

  return {
    players: allPlayers,
    staff: allStaff,
    events: allEvents,
    fans: allFans,
    sponsors: allSponsors,
    detectedTabs: Array.from(playerTabsSet),
  };
}

/**
 * Filters players by rank, tier tab, or search query.
 */
export function filterPlayers(
  players: PlayerProfile[],
  options: {
    tierTab?: string;
    rankFilter?: string;
    branchFilter?: string;
    searchQuery?: string;
  }
): PlayerProfile[] {
  const { tierTab, rankFilter, branchFilter, searchQuery } = options;
  return players.filter((p) => {
    if (tierTab && tierTab !== 'All') {
      if (tierTab === 'Captains') {
        if (
          p.roleBadge !== 'Captain' &&
          p.roleBadge !== 'Alternate Captain' &&
          p.tierTab !== 'Captains'
        ) {
          return false;
        }
      } else if (p.tierTab.toLowerCase() !== tierTab.toLowerCase()) {
        return false;
      }
    }
    if (rankFilter && rankFilter !== 'All' && p.rank !== rankFilter && p.position !== rankFilter) {
      return false;
    }
    if (branchFilter && branchFilter !== 'All' && p.branch !== branchFilter) {
      return false;
    }
    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.trim().toLowerCase();
      const hay = `${p.name} ${p.jerseyNumber} ${p.rank} ${p.branch} ${p.position} ${p.tierTab} ${p.hometown || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
