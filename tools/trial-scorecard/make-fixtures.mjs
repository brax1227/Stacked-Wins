#!/usr/bin/env node
// Regenerates the synthetic datasets under fixtures/.
//
// These describe nobody. Every dataset declares `"synthetic": true`, every
// file is named `synthetic-*`, and the scorecard prints a banner on both
// sides of any output derived from them. They exist so the counting rules
// can be demonstrated before a single real participant exists.
//
//   node make-fixtures.mjs

import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, 'fixtures');

const TRIAL_START = '2026-09-20';
const AS_OF = '2026-11-01';

const day = (from, offset) => {
  const ms = Date.parse(`${from}T00:00:00Z`) + offset * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
};

/**
 * A participant-shaped export. Counts only, exactly as the app writes them.
 *
 * `vary` nudges the numbers so that two different synthetic people do not
 * come out byte-identical. Real people rarely would, and where they do the
 * scorecard is supposed to hold them back for a human — which is a behaviour
 * these fixtures test deliberately (see synthetic-duplicates) rather than
 * trip over everywhere by accident.
 */
const record = (firstOpen, activeOffsets, { source = 'real', environment = 'device', vary = 0 } = {}) => {
  const days = {
    [firstOpen]: { opens: 2 + vary, captures: 3 + vary, brokenDown: 1, started: 1 },
  };
  for (const offset of activeOffsets) {
    days[day(firstOpen, offset)] = { opens: 1 + vary, captures: 0, brokenDown: 0, started: 0 };
  }
  const out = { version: 2, source, firstOpen, days };
  if (environment !== null) out.environment = environment;
  return out;
};

const said = (answer, on = '2026-10-20') =>
  ({ reportedHelp: answer, confirmedBy: 'operator', confirmedOn: on });

function write(name, { label, participants, files }) {
  const dir = join(root, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'DATASET.json'),
    JSON.stringify({ synthetic: true, label }, null, 2) + '\n');
  writeFileSync(join(dir, 'annotations.json'),
    JSON.stringify({ trialStart: TRIAL_START, asOf: AS_OF, participants }, null, 2) + '\n');
  for (const [file, data] of Object.entries(files)) {
    writeFileSync(join(dir, file), JSON.stringify(data, null, 2) + '\n');
  }
  console.log(`wrote fixtures/${name} (${Object.keys(files).length} exports, ${Object.keys(participants).length} declared)`);
}

// 1. Ten eligible people. Five said it helped. A DIFFERENT five came back.
//    The intersection is zero and the milestone is not met -- the case a
//    naive "5 helped, 5 returned, ship it" tally gets wrong.
{
  const participants = {};
  const files = {};
  for (let i = 1; i <= 10; i += 1) {
    const id = `p${String(i).padStart(2, '0')}`;
    const helped = i <= 5;
    // Helped group never returns; returning group never says it helped.
    files[`synthetic-${id}.json`] = record('2026-10-01', helped ? [2, 3] : [9], { vary: i });
    participants[id] = { exports: [`synthetic-${id}.json`], ...said(helped ? 'yes' : 'no') };
  }
  write('synthetic-disjoint', {
    label: 'Five helped, a different five returned. Intersection must be 0.',
    participants, files,
  });
}

// 2. Repeat exports from the same person, and one export filed twice under
//    two pseudonyms. Neither may inflate the participant count.
{
  const files = {};
  const participants = {};
  for (let i = 1; i <= 5; i += 1) {
    const id = `p${String(i).padStart(2, '0')}`;
    // Two cumulative snapshots from one phone: day 8 and day 14.
    files[`synthetic-${id}-first.json`] = record('2026-10-01', [8], { vary: i });
    files[`synthetic-${id}-second.json`] = record('2026-10-01', [8, 11], { vary: i });
    participants[id] = {
      exports: [`synthetic-${id}-first.json`, `synthetic-${id}-second.json`],
      ...said('yes'),
    };
  }
  // The same content under two names. Both are held back for a human.
  const shared = record('2026-10-02', [9]);
  files['synthetic-p06.json'] = shared;
  files['synthetic-p07-copy.json'] = shared;
  participants.p06 = { exports: ['synthetic-p06.json'], ...said('yes') };
  participants.p07 = { exports: ['synthetic-p07-copy.json'], ...said('yes') };

  write('synthetic-duplicates', {
    label: '12 export files, 7 pseudonyms, 5 real people. Must not read as 12 or 7.',
    participants, files,
  });
}

// 3. The return window's edges, and a window that has not closed.
{
  const files = {
    'synthetic-day13.json': record('2026-10-01', [13], { vary: 1 }),
    'synthetic-day14.json': record('2026-10-01', [14], { vary: 2 }),
    'synthetic-day6.json': record('2026-10-01', [6], { vary: 3 }),
    // First opened four days before as-of: days 7-13 have not happened.
    'synthetic-open-window.json': record('2026-10-28', [1], { vary: 4 }),
  };
  write('synthetic-boundary', {
    label: 'Day 13 counts, day 14 does not, day 6 does not, an open window is unknown.',
    participants: {
      day13: { exports: ['synthetic-day13.json'], ...said('yes') },
      day14: { exports: ['synthetic-day14.json'], ...said('yes') },
      day6: { exports: ['synthetic-day6.json'], ...said('yes') },
      stillOpen: { exports: ['synthetic-open-window.json'], ...said('yes') },
    },
    files,
  });
}

// 4. Missing and unattributed answers stay unknown. Fixtures and founder
//    data stay out. Missing provenance is never promoted.
{
  const files = {
    'synthetic-asked.json': record('2026-10-01', [9], { vary: 1 }),
    'synthetic-not-asked.json': record('2026-10-01', [9], { vary: 2 }),
    'synthetic-unattributed.json': record('2026-10-01', [9], { vary: 3 }),
    'synthetic-simulator.json': record('2026-10-01', [9], { source: 'fixture', environment: 'simulator', vary: 4 }),
    'synthetic-founder.json': record('2026-10-01', [9], { vary: 5 }),
    'synthetic-no-environment.json': record('2026-10-01', [9], { environment: null, vary: 6 }),
    'synthetic-confirmed-legacy.json': record('2026-10-02', [9], { environment: null, vary: 7 }),
    'synthetic-orphan.json': record('2026-10-01', [9], { vary: 8 }),
  };
  write('synthetic-unknowns', {
    label: 'Unknowns stay unknown; fixtures, founder and unclaimed files stay out.',
    participants: {
      asked: { exports: ['synthetic-asked.json'], ...said('yes') },
      notAsked: { exports: ['synthetic-not-asked.json'] },
      unattributed: { exports: ['synthetic-unattributed.json'], reportedHelp: 'yes' },
      simulator: { exports: ['synthetic-simulator.json'], ...said('yes') },
      founder: { exports: ['synthetic-founder.json'], founder: true, ...said('yes') },
      legacyUnconfirmed: { exports: ['synthetic-no-environment.json'], ...said('yes') },
      legacyConfirmed: {
        exports: ['synthetic-confirmed-legacy.json'],
        ...said('yes'),
        eligibilityConfirmed: {
          by: 'operator', on: '2026-10-21',
          basis: 'known tester, confirmed release build on their own phone',
        },
      },
      // synthetic-orphan.json is deliberately claimed by nobody.
    },
    files,
  });
}
