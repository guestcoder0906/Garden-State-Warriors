import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXACT_SHEET_HEADERS,
  extractSpreadsheetId,
  formatReplaceTag,
  parseSheetRowsToPlayers,
  parseAppsScriptPayload,
  filterPlayers,
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

test('formatReplaceTag formats missing media and text instructions accurately', () => {
  assert.equal(
    formatReplaceTag('team photos from their social media page(s)', 'images'),
    '[Replace with team photos from their social media page(s) - images]'
  );
});
