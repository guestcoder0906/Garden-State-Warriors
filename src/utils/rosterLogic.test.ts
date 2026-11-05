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

test('extractSpreadsheetId extracts exact user spreadsheet ID', () => {
  assert.equal(
    extractSpreadsheetId(
      'https://docs.google.com/spreadsheets/d/1-qP7fgEI1mvwjE8cplR9_Rn-9tnHFaBP3beH6ETZC7s/edit?usp=drivesdk'
    ),
    '1-qP7fgEI1mvwjE8cplR9_Rn-9tnHFaBP3beH6ETZC7s'
  );
});

test('parseSheetRowsToPlayers matches exact spaced headers from Garden_State_Warriors_Roster and WhatWarriorMeans', () => {
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
    ],
    // Partial row with only First Name filled
    ['', 'Alex', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ];

  const players = parseSheetRowsToPlayers(rows, 'Sheet1');
  assert.equal(players.length, 2);
  assert.equal(players[0].name, 'James Miller');
  assert.equal(players[0].whatWarriorsMeans, 'Verified WhatWarriorMeans testimony.');
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
    ['One', 'Player', '21', 'F', 'Alpha', 'U.S. Army', 'CPT', '', '', '', '', '', '', '', ''],
    ['Two', 'Player', '82', 'D', 'Bravo', 'U.S. Navy', 'PO1', '', '', '', '', '', '', '', ''],
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

test('isValidWebsiteUrl validates valid website URLs via regex and rejects invalid strings', () => {
  assert.equal(isValidWebsiteUrl('https://www.gardenstatewarriors.org'), true);
  assert.equal(isValidWebsiteUrl('www.example.com/sponsors'), true);
  assert.equal(isValidWebsiteUrl('example.org'), true);
  assert.equal(isValidWebsiteUrl('not a website'), false);
  assert.equal(isValidWebsiteUrl('http://invalid'), false);
  assert.equal(normalizeWebsiteUrl('www.example.com'), 'https://www.example.com');
  assert.equal(normalizeWebsiteUrl('https://example.com'), 'https://example.com');
});

test('normalizeSheetImageUrl and splitMediaUrlsCell handle in-cell IMAGE formulas, Drive URLs, single in-cell images, and CSV URLs', () => {
  assert.equal(
    normalizeSheetImageUrl('=IMAGE("https://lh3.googleusercontent.com/d/abc123")'),
    'https://lh3.googleusercontent.com/d/abc123'
  );
  assert.equal(
    normalizeSheetImageUrl('https://drive.google.com/file/d/1xyz987/view?usp=sharing'),
    'https://lh3.googleusercontent.com/d/1xyz987'
  );
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
