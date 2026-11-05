import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXACT_SHEET_HEADERS,
  extractSpreadsheetId,
  formatReplaceTag,
  parseSheetRowsToPlayers,
  parseSheetRowsToSponsors,
  parseAppsScriptPayload,
  filterPlayers,
  isValidWebsiteUrl,
  normalizeWebsiteUrl,
  normalizeSheetImageUrl,
  splitMediaUrlsCell,
} from './rosterLogic.ts';
import {
  validateWarriorApplicationInput,
  verifyAntiSpamSubmission,
  isValidEmailAddress,
  isValidPhoneNumber,
  containsSpamPatterns,
} from './formSecurity.ts';

const BECOME_WARRIOR_HEADERS = [
  'Verified',
  'FirstName',
  'LastName',
  'Branch',
  'Phone',
  'Email',
  'PreferredContact',
  'Experience',
  'QuestionsInfo',
] as const;

test('extractSpreadsheetId extracts exact user spreadsheet ID', () => {
  assert.equal(
    extractSpreadsheetId(
      'https://docs.google.com/spreadsheets/d/1-qP7fgEI1mvwjE8cplR9_Rn-9tnHFaBP3beH6ETZC7s/edit?usp=drivesdk'
    ),
    '1-qP7fgEI1mvwjE8cplR9_Rn-9tnHFaBP3beH6ETZC7s'
  );
});

test('parseSheetRowsToPlayers matches exact spaced headers from Garden_State_Warriors_Roster and WhatWarriorMeans', () => {
  assert.deepEqual(EXACT_SHEET_HEADERS, [
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
    'PreferredContact',
    'QuestionsInfo',
  ]);

  const rows = [
    [...EXACT_SHEET_HEADERS],
    [
      'Miller',
      'James',
      '21',
      'F',
      'Captains',
      'U.S. Army',
      'CPT',
      '2012-2020',
      'Morristown, NJ',
      'Captain',
      'https://example.com/jersey.jpg',
      '',
      'Verified bio from sheet.',
      'Verified WhatWarriorMeans testimony.',
      'https://example.com/media1.jpg',
      'Text, Email',
      'Available for all tournaments.',
    ],
    // Partial row with only First Name filled
    ['', 'Alex', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ];

  const players = parseSheetRowsToPlayers(rows, 'Sheet1');
  assert.equal(players.length, 2);
  assert.equal(players[0].name, 'James Miller');
  assert.equal(players[0].whatWarriorsMeans, 'Verified WhatWarriorMeans testimony.');
  assert.equal(players[0].preferredContact, 'Text, Email');
  assert.equal(players[0].questionsInfo, 'Available for all tournaments.');
  assert.equal(players[0].roleBadge, 'Captain');
  assert.equal(players[1].name, 'Alex');
});

test('parseAppsScriptPayload returns empty arrays when sheet only has header row so temporary placeholders are shown', () => {
  const emptySheetPayload = {
    title: 'Garden State Warriors Roster',
    tabs: ['Sheet1'],
    sheets: {
      Sheet1: [[...EXACT_SHEET_HEADERS]],
    },
  };

  const parsed = parseAppsScriptPayload(emptySheetPayload);
  assert.equal(parsed.players.length, 0);
  assert.equal(parsed.staff.length, 0);
});

test('filterPlayers filters by tierTab, rankFilter, and searchQuery', () => {
  const rows = [
    [...EXACT_SHEET_HEADERS],
    ['One', 'Player', '21', 'F', 'Alpha', 'U.S. Army', 'CPT', '', '', '', '', '', '', '', '', '', ''],
    ['Two', 'Player', '82', 'D', 'Bravo', 'U.S. Navy', 'PO1', '', '', '', '', '', '', '', '', '', ''],
  ];
  const players = parseSheetRowsToPlayers(rows);
  assert.equal(filterPlayers(players, { rankFilter: 'PO1' }).length, 1);
  assert.equal(filterPlayers(players, { tierTab: 'Alpha' }).length, 1);
  assert.equal(filterPlayers(players, { searchQuery: '82' }).length, 1);
});

test('parseSheetRowsToSponsors only returns sponsors where Verified checkbox is checked (TRUE) and parses Website & Message', () => {
  const rows = [
    ['Verified', 'Timestamp Submitted', 'Name', 'Phone', 'Email', 'Preferred Contact', 'Website', 'Message', 'LogoUrl'],
    ['FALSE', '11/5/2026, 9:30 AM', 'Pending Sponsor', '555-1111', 'pending@example.com', 'Email', 'https://pending.com', 'Pending message', 'data:image/png;base64,abc'],
    ['TRUE', '11/5/2026, 9:35 AM', 'Approved Sponsor', '555-2222', 'approved@example.com', 'Text, Call', 'www.approved.org', 'Proud to support NJ veterans!', 'https://example.com/logo.png'],
  ];
  const sponsors = parseSheetRowsToSponsors(rows);
  assert.equal(sponsors.length, 1);
  assert.equal(sponsors[0].name, 'Approved Sponsor');
  assert.equal(sponsors[0].website, 'www.approved.org');
  assert.equal(sponsors[0].message, 'Proud to support NJ veterans!');
  assert.equal(sponsors[0].logoUrl, 'https://example.com/logo.png');
});

test('parseAppsScriptPayload ignores Become Warrior tab directly and reads verified players appended into Garden State Warriors Roster tab', () => {
  const payload = {
    title: 'Garden State Warriors Roster',
    tabs: ['Garden State Warriors Roster', 'Become Warrior'],
    sheets: {
      'Garden State Warriors Roster': [
        [...EXACT_SHEET_HEADERS],
        ['Miller', 'James', '21', 'F', 'Alpha', 'U.S. Army', 'CPT', '2012-2020', 'Morristown, NJ', 'Captain', '', '', 'Existing roster player.', '', '', 'Email', ''],
        // Row written by Apps Script into the last available row of Garden State Warriors Roster
        [
          'Rivera',
          'Carlos',
          '',
          '',
          '',
          'U.S. Navy',
          'PO1',
          '2014-2022',
          'Hoboken, NJ',
          'Purple Heart',
          '',
          'https://firestore.googleapis.com/v1/projects/gen-lang-client-0103247541/databases/ai-studio-1d56a7c8-3851-4214-ae04-c41254eeb012/documents/sponsor_assets/wr_carlos_mil',
          'Served 8 years aboard USS New Jersey.',
          'Brotherhood on and off the ice.',
          'https://firestore.googleapis.com/v1/projects/gen-lang-client-0103247541/databases/ai-studio-1d56a7c8-3851-4214-ae04-c41254eeb012/documents/sponsor_assets/wr_carlos_m1, https://firestore.googleapis.com/v1/projects/gen-lang-client-0103247541/databases/ai-studio-1d56a7c8-3851-4214-ae04-c41254eeb012/documents/sponsor_assets/wr_carlos_m2',
          'Text, Call',
          'Needs right-handed sticks.',
        ],
      ],
      'Become Warrior': [
        [...BECOME_WARRIOR_HEADERS],
        [
          'TRUE',
          'Applicant',
          'Unmerged',
          'U.S. Marine Corps',
          '(973) 555-0199',
          'applicant@example.com',
          'Text, Email',
          'Played adult rec league defense for 4 years.',
          'Looking forward to skating with the team.',
        ],
      ],
      Roster: [
        [...EXACT_SHEET_HEADERS],
        [
          'Doe',
          'John',
          '',
          '',
          'U.S. Army',
          'SGT',
          '2012-2016',
          'Newark, NJ',
          '',
          'Veteran',
          '',
          '',
          'Leftover duplicate Roster tab player should be ignored',
          'Quote',
          '',
          '',
          '',
        ],
      ],
    },
  };

  const parsed = parseAppsScriptPayload(payload);
  assert.equal(parsed.players.length, 2);
  const johnDoe = parsed.players.find((p) => p.name === 'John Doe');
  assert.equal(johnDoe, undefined, 'Leftover duplicate Roster tab should be ignored when Garden State Warriors Roster tab exists');
  const carlos = parsed.players.find((p) => p.name === 'Carlos Rivera');
  assert.ok(carlos, 'Player row in Garden State Warriors Roster tab should be parsed');
  assert.equal(carlos.jerseyNumber, '');
  assert.equal(carlos.position, '');
  assert.equal(carlos.tierTab, '');
  assert.equal(carlos.jerseyPhotoUrl, undefined);
  assert.equal(carlos.branch, 'U.S. Navy');
  assert.equal(carlos.rank, 'PO1');
  assert.equal(carlos.preferredContact, 'Text, Call');
  assert.equal(carlos.questionsInfo, 'Needs right-handed sticks.');
  assert.equal(carlos.militaryPhotoUrl, '/api/firebase-image?id=wr_carlos_mil');
  assert.equal(carlos.mediaGallery.length, 2);
});

test('formSecurity validates non-empty fields, email/phone formats, honeypot, fill-time, and math challenge', () => {
  assert.equal(isValidEmailAddress('warrior@gardenstatewarriors.org'), true);
  assert.equal(isValidEmailAddress('bad-email'), false);
  assert.equal(isValidPhoneNumber('(973) 555-0199'), true);
  assert.equal(isValidPhoneNumber('123'), false);
  assert.equal(containsSpamPatterns('Normal veteran hockey inquiry message.'), false);
  assert.equal(containsSpamPatterns('<script>alert(1)</script>'), true);

  // Reject empty Become a Warrior form
  const emptyCheck = validateWarriorApplicationInput({
    firstName: '',
    lastName: '',
    branch: '',
    phone: '',
    email: '',
    preferredContact: [],
    experience: '',
    questionsInfo: '',
  });
  assert.equal(emptyCheck.ok, false);

  // Accept valid Become a Warrior form
  const validCheck = validateWarriorApplicationInput({
    firstName: 'Carlos',
    lastName: 'Rivera',
    branch: 'U.S. Navy',
    phone: '(973) 555-0199',
    email: 'carlos@gardenstatewarriors.org',
    preferredContact: ['Text', 'Email'],
    experience: 'Played 5 years of adult league hockey as defenseman.',
    questionsInfo: 'Available for weekend practices.',
  });
  assert.equal(validCheck.ok, true);

  // Reject honeypot bot fill
  const honeypotCheck = verifyAntiSpamSubmission({
    formKey: 'warrior',
    honeypotValue: 'http://spambot.ru',
    formLoadedAt: Date.now() - 10000,
    captchaToken: 'google-recaptcha-token-xyz',
    payloadFingerprint: 'fp1',
  });
  assert.equal(honeypotCheck.ok, false);

  // Reject missing Google reCAPTCHA token
  const missingCaptchaCheck = verifyAntiSpamSubmission({
    formKey: 'warrior',
    honeypotValue: '',
    formLoadedAt: Date.now() - 10000,
    captchaToken: '',
    payloadFingerprint: 'fp1',
  });
  assert.equal(missingCaptchaCheck.ok, false);
});

test('isValidWebsiteUrl validates valid website URLs via regex and rejects invalid strings', () => {
  assert.equal(isValidWebsiteUrl('https://www.gardenstatewarriors.org'), true);
  assert.equal(isValidWebsiteUrl('www.example.com/sponsors'), true);
  assert.equal(isValidWebsiteUrl('example.org'), true);
  assert.equal(isValidWebsiteUrl('not a website'), false);
  assert.equal(isValidWebsiteUrl('http://invalid'), false);
  assert.equal(normalizeWebsiteUrl('www.example.com'), 'https://www.example.com');
  assert.equal(normalizeWebsiteUrl('https://example.com'), 'https://example.com');
});

test('normalizeSheetImageUrl and splitMediaUrlsCell handle Firebase server URLs, in-cell IMAGE formulas, Drive URLs, and reject local base64', () => {
  assert.equal(
    normalizeSheetImageUrl('=IMAGE("https://lh3.googleusercontent.com/d/abc123")'),
    'https://lh3.googleusercontent.com/d/abc123'
  );
  assert.equal(
    normalizeSheetImageUrl('https://drive.google.com/file/d/1xyz987/view?usp=sharing'),
    'https://lh3.googleusercontent.com/d/1xyz987'
  );
  assert.equal(
    normalizeSheetImageUrl('https://ais-dev-example.run.app/api/firebase-image?id=sp_1730829500_logo'),
    '/api/firebase-image?id=sp_1730829500_logo'
  );
  assert.equal(
    normalizeSheetImageUrl(
      'https://firestore.googleapis.com/v1/projects/gen-lang-client-0103247541/databases/ai-studio-1d56a7c8-3851-4214-ae04-c41254eeb012/documents/sponsor_assets/sp_1730829500_logo'
    ),
    '/api/firebase-image?id=sp_1730829500_logo'
  );
  assert.equal(normalizeSheetImageUrl('data:image/png;base64,iVBORw0KGgo='), '');
  assert.deepEqual(
    splitMediaUrlsCell('=IMAGE("https://lh3.googleusercontent.com/d/singlePhoto")'),
    ['https://lh3.googleusercontent.com/d/singlePhoto']
  );
  assert.deepEqual(
    splitMediaUrlsCell('https://example.com/one.jpg, https://drive.google.com/file/d/2abc/view'),
    ['https://example.com/one.jpg', 'https://lh3.googleusercontent.com/d/2abc']
  );
});

test('formatReplaceTag formats missing media and text instructions accurately', () => {
  assert.equal(
    formatReplaceTag('team photos from their social media page(s)', 'images'),
    '[Replace with team photos from their social media page(s) - images]'
  );
});

