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
  caption: string;
  photoUrl?: string;
  photoPlaceholder: string;
  isPlaceholder?: boolean;
}

export interface FanItem {
  id: string;
  title: string;
  category: 'Family' | 'Friends' | 'Pets';
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
 * Parses a 2D string array from a Google Sheet tab into PlayerProfile objects.
 * Matches the user's exact 15-column sheet format:
 * Last Name | First Name | Jersey Number | Position | RosterTab | Military Branch | Military Rank | Service Era | Hometown | Role Badge | JerseyPhotoUrl | MilitaryPhotoUrl | Bio | WhatWarriorMeans | MediaUrlsCsv
 *
 * NOT ALL INPUTS ARE REQUIRED:
 * Any blank columns are gracefully handled with clean temporary placeholders.
 */
export function parseSheetRowsToPlayers(
  rows: string[][],
  defaultTabName = 'Veterans Roster'
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

  const players: PlayerProfile[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((cell) => !cell || !String(cell).trim())) continue;

    const getCell = (idx: number) =>
      idx >= 0 && row[idx] !== undefined ? String(row[idx]).trim() : '';

    // Skip rows that are explicitly marked as Board, Coach, or Events in RosterTab or Role Badge
    const rawRosterTab = getCell(idxRosterTab);
    const rawRoleBadge = getCell(idxRole);
    if (
      /^(board|staff|coach|coaches|event|events|schedule)$/i.test(rawRosterTab) ||
      /^(president|vice president|secretary|treasurer|head coach|associate coach)$/i.test(
        rawRoleBadge
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
    } else {
      const firstNonEmpty = row.find((c) => c && String(c).trim());
      displayName = firstNonEmpty ? String(firstNonEmpty).trim() : `Player #${i}`;
    }

    const jerseyNumber = getCell(idxJersey);
    const position = getCell(idxPos);
    const branch = getCell(idxBranch);
    const rank = getCell(idxRank);
    const rawTier = rawRosterTab || defaultTabName || 'Veterans Roster';
    const yearsOfService = getCell(idxEra);
    const hometown = getCell(idxHometown);
    const rawBio = getCell(idxBio);
    const rawMeaning = getCell(idxMeaning);
    const jerseyPhotoUrl = getCell(idxJerseyPhoto) || undefined;
    const militaryPhotoUrl = getCell(idxMilitaryPhoto) || undefined;
    const rawMedia = getCell(idxMedia);

    let tierTab = rawTier.trim() || 'Veterans Roster';
    if (/^captain/i.test(rawTier)) {
      tierTab = 'Captains';
    } else if (/^alpha/i.test(rawTier)) {
      tierTab = 'Alpha';
    } else if (/^bravo/i.test(rawTier)) {
      tierTab = 'Bravo';
    } else if (/^charlie/i.test(rawTier)) {
      tierTab = 'Charlie';
    }

    let roleBadge: PlayerProfile['roleBadge'] = 'Player';
    if (/alternate|\ba\b/i.test(rawRoleBadge)) {
      roleBadge = 'Alternate Captain';
    } else if (/captain|\bc\b/i.test(rawRoleBadge) || /^captains$/i.test(defaultTabName)) {
      roleBadge = 'Captain';
    } else if (/none/i.test(rawRoleBadge)) {
      roleBadge = 'None';
    }

    const shortParts = [
      rank,
      branch,
      jerseyNumber ? `#${jerseyNumber}` : '',
      position,
      hometown,
    ].filter(Boolean);

    const shortCaption =
      shortParts.length > 0
        ? shortParts.join(' · ')
        : '[Insert small caption / rank / branch in Google Sheets - text]';

    const bio = rawBio || '[Insert player bio in Google Sheets Bio column - text]';
    const whatWarriorsMeans =
      rawMeaning ||
      '[Insert player testimony in Google Sheets WhatWarriorMeans column - text]';

    const mediaUrls = rawMedia
      ? rawMedia
          .split(',')
          .map((u) => u.trim())
          .filter(Boolean)
      : [];

    const mediaGallery: PlayerMediaItem[] = mediaUrls.map((url, idx) => ({
      id: `sheet-media-${i}-${idx}`,
      type: /\.(mp4|webm|mov)$/i.test(url) ? 'video' : 'image',
      url,
      caption: `${displayName} — Media #${idx + 1}`,
    }));

    players.push({
      id: `sheet-${defaultTabName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${i}-${displayName
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
      jerseyPhotoPlaceholder: formatReplaceTag(
        `${displayName} jersey photo URL in Google Sheets JerseyPhotoUrl column`,
        'image'
      ),
      militaryPhotoPlaceholder: formatReplaceTag(
        `${displayName} military photo URL in Google Sheets MilitaryPhotoUrl column`,
        'image'
      ),
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
  const findCol = (keys: string[]) => normHeaders.findIndex((h) => keys.some((k) => h.includes(k)));

  const idxLast = findCol(['lastname']);
  const idxFirst = findCol(['firstname']);
  const idxName = findCol(['name', 'officer', 'coach', 'member']);
  const idxRole = findCol(['rolebadge', 'role', 'title', 'position', 'office']);
  const idxRosterTab = findCol(['rostertab', 'category', 'type', 'group']);
  const idxBranch = findCol(['militarybranch', 'branch', 'background']);
  const idxRank = findCol(['militaryrank', 'rank']);
  const idxCaption = findCol(['bio', 'caption', 'description', 'whatwarriormeans']);
  const idxPhoto = findCol(['jerseyphotourl', 'photo', 'image', 'headshot']);

  const staffList: StaffMember[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c || !String(c).trim())) continue;
    const getCell = (idx: number) =>
      idx >= 0 && row[idx] !== undefined ? String(row[idx]).trim() : '';

    const rawTab = getCell(idxRosterTab);
    const rawRole = getCell(idxRole);

    const isBoardRow =
      defaultCategory === 'Board' ||
      /^(board|staff|officer|officers)$/i.test(rawTab) ||
      /^(president|vice president|secretary|treasurer)$/i.test(rawRole);
    const isCoachRow =
      defaultCategory === 'Coach' ||
      /^(coach|coaches|coaching)$/i.test(rawTab) ||
      /coach/i.test(rawRole);

    if (defaultCategory === 'Auto' && !isBoardRow && !isCoachRow) {
      continue;
    }

    const category: 'Board' | 'Coach' = isCoachRow ? 'Coach' : 'Board';
    const first = getCell(idxFirst);
    const last = getCell(idxLast);
    const full =
      idxName >= 0 && idxName !== idxFirst && idxName !== idxLast ? getCell(idxName) : '';
    const role = rawRole || (category === 'Coach' ? `Coach #${i}` : `Board Officer #${i}`);
    const name =
      first || last
        ? [first, last].filter(Boolean).join(' ')
        : full || '[Insert Name in Google Sheets - text]';

    const branchOrBackground = getCell(idxBranch);
    const rank = getCell(idxRank);
    const caption =
      getCell(idxCaption) || '[Insert small caption in Google Sheets Bio column - text]';
    const photoUrl = getCell(idxPhoto) || undefined;

    staffList.push({
      id: `sheet-staff-${i}-${role.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name,
      role,
      category,
      branchOrBackground: branchOrBackground || undefined,
      rank: rank || undefined,
      caption,
      photoUrl,
      photoPlaceholder: formatReplaceTag(`${role} photo in Google Sheets`, 'image'),
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
  const findCol = (keys: string[]) => normHeaders.findIndex((h) => keys.some((k) => h.includes(k)));

  const idxRosterTab = findCol(['rostertab', 'tab']);
  const idxTitle = findCol(['title', 'event', 'name', 'firstname', 'lastname']);
  const idxDate = findCol(['date', 'day', 'serviceera']);
  const idxTime = findCol(['time', 'militaryrank']);
  const idxLoc = findCol(['location', 'venue', 'rink', 'place', 'hometown']);
  const idxCategory = findCol(['category', 'type', 'rolebadge', 'position']);
  const idxDesc = findCol(['description', 'details', 'bio', 'info', 'whatwarriormeans']);
  const idxImg = findCol(['flyerurl', 'imageurl', 'photourl', 'image', 'photo', 'banner', 'jerseyphotourl']);
  const idxUrl = findCol(['externalurl', 'url', 'link', 'mediaurlscsv']);

  const events: ClubEvent[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c || !String(c).trim())) continue;
    const getCell = (idx: number) =>
      idx >= 0 && row[idx] !== undefined ? String(row[idx]).trim() : '';

    if (mode === 'InlineRosterTab') {
      const rawTab = getCell(idxRosterTab);
      if (!/^(event|events|schedule)$/i.test(rawTab)) continue;
    }

    const title = getCell(idxTitle) || (row[0] ? String(row[0]).trim() : `Event #${i}`);
    const date = getCell(idxDate) || '[Insert event date - text]';
    const time = getCell(idxTime);
    const location = getCell(idxLoc) || '[Insert event location - text]';
    const category = getCell(idxCategory) || 'Event';
    const description = getCell(idxDesc) || '[Insert description of this event - text]';
    const imageUrl = getCell(idxImg) || undefined;
    const externalUrl = getCell(idxUrl) || undefined;

    events.push({
      id: `sheet-event-${mode}-${i}`,
      title,
      date,
      time: time || undefined,
      location,
      category,
      description,
      imageUrl,
      placeholderBanner: formatReplaceTag(`event image for ${title}`, 'image'),
      externalUrl,
      isPlaceholder: false,
    });
  }
  return events;
}

/**
 * Parses an optional "Fans" tab from the Google Sheet.
 * Dedicated Fans Tab Columns (all optional):
 * Title, Category, RelatedPlayer, Caption, PhotoUrl
 */
export function parseSheetRowsToFans(rows: string[][]): FanItem[] {
  if (!rows || rows.length < 2) return [];
  const normHeaders = rows[0].map(normalizeHeaderKey);
  const findCol = (keys: string[]) => normHeaders.findIndex((h) => keys.some((k) => h.includes(k)));

  const idxTitle = findCol(['title', 'name', 'fan']);
  const idxCategory = findCol(['category', 'type', 'group']);
  const idxPlayer = findCol(['relatedplayer', 'player', 'warrior']);
  const idxCaption = findCol(['caption', 'bio', 'description']);
  const idxPhoto = findCol(['photourl', 'photo', 'imageurl', 'image']);

  const fans: FanItem[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c || !String(c).trim())) continue;
    const getCell = (idx: number) =>
      idx >= 0 && row[idx] !== undefined ? String(row[idx]).trim() : '';

    const title = getCell(idxTitle) || (row[0] ? String(row[0]).trim() : `Warrior Fan #${i}`);
    const rawCat = getCell(idxCategory);
    const category: 'Family' | 'Friends' | 'Pets' = /pet|dog|cat/i.test(rawCat)
      ? 'Pets'
      : /friend/i.test(rawCat)
      ? 'Friends'
      : 'Family';
    const relatedPlayer = getCell(idxPlayer) || undefined;
    const caption = getCell(idxCaption) || '[Insert small caption for fan / family / pet - text]';
    const photoUrl = getCell(idxPhoto) || undefined;

    fans.push({
      id: `sheet-fan-${i}`,
      title,
      category,
      relatedPlayer,
      caption,
      photoUrl,
      photoPlaceholder: formatReplaceTag(`photo for ${title}`, 'image'),
    });
  }
  return fans;
}

/**
 * Parses an optional "Sponsors" tab from the Google Sheet.
 * Dedicated Sponsors Tab Columns (all optional):
 * Name, Tier, Description, Website, LogoUrl
 */
export function parseSheetRowsToSponsors(rows: string[][]): SponsorItem[] {
  if (!rows || rows.length < 2) return [];
  const normHeaders = rows[0].map(normalizeHeaderKey);
  const findCol = (keys: string[]) => normHeaders.findIndex((h) => keys.some((k) => h.includes(k)));

  const idxName = findCol(['name', 'sponsor', 'title', 'company']);
  const idxTier = findCol(['tier', 'level', 'category', 'type']);
  const idxDesc = findCol(['description', 'caption', 'bio', 'details']);
  const idxWeb = findCol(['website', 'url', 'link']);
  const idxLogo = findCol(['logourl', 'logo', 'photourl', 'imageurl', 'image']);

  const sponsors: SponsorItem[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c || !String(c).trim())) continue;
    const getCell = (idx: number) =>
      idx >= 0 && row[idx] !== undefined ? String(row[idx]).trim() : '';

    const name = getCell(idxName) || (row[0] ? String(row[0]).trim() : `Sponsor #${i}`);
    const tier = getCell(idxTier) || 'Sponsor';
    const description = getCell(idxDesc) || '[Insert description of sponsor / supporter - text]';
    const website = getCell(idxWeb) || undefined;
    const logoUrl = getCell(idxLogo) || undefined;

    sponsors.push({
      id: `sheet-sponsor-${i}`,
      name,
      tier,
      description,
      website,
      logoUrl,
      placeholderNote: formatReplaceTag(`logo for ${name}`, 'image'),
    });
  }
  return sponsors;
}

/**
 * Parses a multi-tab JSON payload returned by the Google Apps Script Web App (`doGet`) or `/api/sync`.
 * Supports BOTH:
 * 1) `{ sheets: Record<string, string[][]> }` (raw 2D rows per tab), AND
 * 2) `{ players: [...], board: [...], coaches: [...], events: [...], fans: [...], sponsors: [...] }` (structured Apps Script payload).
 * If the sheet has no data rows yet (only headers), returns empty arrays so temporary placeholders are shown.
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
  const playerTabs: string[] = [];

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
    } else if (/^(fans|fan|supporters|family)$/i.test(tabName.trim())) {
      allFans.push(...parseSheetRowsToFans(rows));
    } else if (/^(sponsors|sponsor|partners)$/i.test(tabName.trim())) {
      allSponsors.push(...parseSheetRowsToSponsors(rows));
    } else {
      const parsedPlayers = parseSheetRowsToPlayers(rows, tabName);
      const inlineStaff = parseSheetRowsToStaff(rows, 'Auto');
      const inlineEvents = parseSheetRowsToEvents(rows, 'InlineRosterTab');
      if (parsedPlayers.length > 0) {
        allPlayers.push(...parsedPlayers);
        playerTabs.push(tabName);
      }
      if (inlineStaff.length > 0) {
        allStaff.push(...inlineStaff);
      }
      if (inlineEvents.length > 0) {
        allEvents.push(...inlineEvents);
      }
    }
  }

  // 2. Also support structured arrays (`players`, `board`, `coaches`, `events`, `fans`, `sponsors`) if `sheets` wasn't used
  if (allPlayers.length === 0 && Array.isArray(payload?.players) && payload.players.length > 0) {
    payload.players.forEach((p: any, i: number) => {
      const name = p.fullName || p.name || [p.firstName, p.lastName].filter(Boolean).join(' ') || `Player #${i + 1}`;
      const tierTab = p.rosterTab || p.tierTab || 'Alpha';
      if (!playerTabs.includes(tierTab)) playerTabs.push(tierTab);
      const isValidImg = (u?: string) => Boolean(u && !u.startsWith('['));
      allPlayers.push({
        id: p.id || `as-player-${i}`,
        name,
        firstName: p.firstName || undefined,
        lastName: p.lastName || undefined,
        jerseyNumber: p.jerseyNumber || '',
        position: p.position || '',
        branch: p.branch || '',
        rank: p.militaryRank || p.rank || '',
        tierTab,
        yearsOfService: p.serviceEra || p.yearsOfService || '',
        hometown: p.hometown || undefined,
        roleBadge:
          /alternate|\ba\b/i.test(p.roleBadge || '')
            ? 'Alternate Captain'
            : /captain|\bc\b/i.test(p.roleBadge || '')
            ? 'Captain'
            : 'Player',
        shortCaption:
          [p.militaryRank || p.rank, p.branch, p.jerseyNumber ? `#${p.jerseyNumber}` : '', p.position]
            .filter(Boolean)
            .join(' · ') || '[Insert small caption / rank / branch in Google Sheets - text]',
        bio: p.bio || '[Insert player bio in Google Sheets Bio column - text]',
        whatWarriorsMeans:
          p.whatWarriorMeans ||
          p.whatWarriorsMeans ||
          '[Insert player testimony in Google Sheets WhatWarriorMeans column - text]',
        isTestimonyFeatured: Boolean(p.whatWarriorMeans || p.whatWarriorsMeans),
        jerseyPhotoUrl: isValidImg(p.jerseyPhotoUrl) ? p.jerseyPhotoUrl : undefined,
        militaryPhotoUrl: isValidImg(p.militaryPhotoUrl) ? p.militaryPhotoUrl : undefined,
        jerseyPhotoPlaceholder: formatReplaceTag(`${name} jersey photo in Google Sheets`, 'image'),
        militaryPhotoPlaceholder: formatReplaceTag(`${name} military photo in Google Sheets`, 'image'),
        mediaGallery: Array.isArray(p.mediaGallery)
          ? p.mediaGallery.map((url: any, idx: number) =>
              typeof url === 'string'
                ? { id: `m-${i}-${idx}`, type: 'image', url, caption: `${name} — Media #${idx + 1}` }
                : url
            )
          : [],
        isPlaceholder: false,
      });
    });
  }

  if (allStaff.length === 0) {
    if (Array.isArray(payload?.board)) {
      payload.board.forEach((b: any, i: number) => {
        const isValidImg = (u?: string) => Boolean(u && !u.startsWith('['));
        allStaff.push({
          id: b.id || `as-board-${i}`,
          name: b.name || '[Insert Name in Google Sheets - text]',
          role: b.role || `Board Officer #${i + 1}`,
          category: 'Board',
          caption: b.caption || '[Insert small caption in Google Sheets - text]',
          photoUrl: isValidImg(b.photoUrl) ? b.photoUrl : undefined,
          photoPlaceholder: formatReplaceTag(`${b.role || 'Board'} photo in Google Sheets`, 'image'),
          isPlaceholder: false,
        });
      });
    }
    if (Array.isArray(payload?.coaches)) {
      payload.coaches.forEach((c: any, i: number) => {
        const isValidImg = (u?: string) => Boolean(u && !u.startsWith('['));
        allStaff.push({
          id: c.id || `as-coach-${i}`,
          name: c.name || '[Insert Name in Google Sheets - text]',
          role: c.role || `Coach #${i + 1}`,
          category: 'Coach',
          caption: c.caption || '[Insert small caption in Google Sheets - text]',
          photoUrl: isValidImg(c.photoUrl) ? c.photoUrl : undefined,
          photoPlaceholder: formatReplaceTag(`${c.role || 'Coach'} photo in Google Sheets`, 'image'),
          isPlaceholder: false,
        });
      });
    }
  }

  if (allEvents.length === 0 && Array.isArray(payload?.events)) {
    payload.events.forEach((ev: any, i: number) => {
      const isValidImg = (u?: string) => Boolean(u && !u.startsWith('['));
      const imgCandidate = ev.imageUrl || ev.flyerPlaceholder;
      allEvents.push({
        id: ev.id || `as-event-${i}`,
        title: ev.title || `Event #${i + 1}`,
        date: ev.date || '[Insert event date - text]',
        time: ev.time || undefined,
        location: ev.location || '[Insert event location - text]',
        category: ev.category || 'Event',
        description: ev.description || '[Insert description of this event - text]',
        imageUrl: isValidImg(imgCandidate) ? imgCandidate : undefined,
        placeholderBanner: formatReplaceTag(`event image for ${ev.title || 'Event'}`, 'image'),
        externalUrl: ev.externalUrl || undefined,
        isPlaceholder: false,
      });
    });
  }

  return {
    players: allPlayers,
    staff: allStaff,
    events: allEvents,
    fans: allFans,
    sponsors: allSponsors,
    detectedTabs: playerTabs,
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
    if (rankFilter && rankFilter !== 'All' && p.rank !== rankFilter) {
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
