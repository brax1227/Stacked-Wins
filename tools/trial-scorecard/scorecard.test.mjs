// Unit tests for the operator scorecard.
//
//   node --test tools/trial-scorecard/
//
// The demo (demo.mjs) proves the four headline cases end to end on synthetic
// datasets. These go underneath it: the individual rules, the boundaries, and
// the ways a count of ten could be inflated or a missing answer promoted into
// evidence.
//
// Datasets are built in memory here rather than read from disk, so a test can
// state exactly the one thing it is about.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  RETURN_WINDOW, MILESTONE, ANSWER, ELIGIBILITY,
  parseDay, daysBetween, validateExport, mergeExports, eligibilityOf,
  returnAnswer, helpAnswer, fingerprint, loadDataset, score, render, runCLI,
} from './scorecard.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures');

// --- helpers ---------------------------------------------------------------

/** An export as the app writes it. `environment: null` writes no environment
 * key at all, which is what a record from before source selection looks like. */
function exp({ firstOpen = '2026-09-20', source = 'real', environment = 'device', days = {} } = {}) {
  const record = { version: 2, source, firstOpen, days };
  if (environment !== null) record.environment = environment;
  return record;
}

/** Days keyed by offset from firstOpen, so tests read in trial terms. */
function daysAt(firstOpen, offsets, counts = { opens: 1 }) {
  const base = Date.parse(`${firstOpen}T00:00:00Z`);
  const days = {};
  for (const offset of offsets) {
    days[new Date(base + offset * 86_400_000).toISOString().slice(0, 10)] = { ...counts };
  }
  return days;
}

function dataset(participants, files, { asOf = '2026-11-01', trialStart = '2026-09-20', synthetic = true } = {}) {
  return {
    descriptor: { synthetic, label: 'unit test' },
    annotations: { asOf, trialStart, participants },
    exports: new Map(Object.entries(files)),
    exportFiles: Object.keys(files),
    problems: [],
  };
}

// --- dates -----------------------------------------------------------------

test('parseDay accepts only whole YYYY-MM-DD dates', () => {
  assert.notEqual(parseDay('2026-09-20'), null);
  for (const bad of ['2026-9-20', '20-09-2026', '2026-09-20T10:00:00Z', '', null, 42, undefined]) {
    assert.equal(parseDay(bad), null, `${JSON.stringify(bad)} should not parse`);
  }
});

test('daysBetween is exact across a daylight-saving change', () => {
  // US DST ends 2026-11-01. A local-time implementation reads 25 hours here
  // and rounds the wrong way; UTC midnights do not.
  assert.equal(daysBetween('2026-10-31', '2026-11-01'), 1);
  assert.equal(daysBetween('2026-10-25', '2026-11-08'), 14);
  assert.equal(daysBetween('2026-11-01', '2026-10-31'), -1);
  assert.equal(daysBetween('nonsense', '2026-11-01'), null);
});

// --- validation ------------------------------------------------------------

test('an unexpected key is refused, not ignored', () => {
  // This is the guard that would catch task text arriving in an export.
  const check = validateExport({ ...exp(), title: 'call the dentist' }, 'f.json');
  assert.equal(check.ok, false);
  assert.match(check.problems.join('\n'), /unexpected key "title"/);
});

test('a bad source, environment, date or count is reported', () => {
  const problems = validateExport({
    version: 2, source: 'realish', environment: 'watch', firstOpen: '20 Sep', days: { 'someday': { opens: -1 } },
  }, 'f.json').problems.join('\n');
  assert.match(problems, /source must be/);
  assert.match(problems, /unknown environment/);
  assert.match(problems, /firstOpen is not/);
  assert.match(problems, /day key "someday" is not a date/);
  assert.match(problems, /opens must be a non-negative integer/);
});

test('a legacy conflated "actions" field parses but is not a count of anything', () => {
  const check = validateExport({ version: 1, source: 'real', firstOpen: '2026-09-20', days: { '2026-09-20': { actions: 3 } } }, 'f.json');
  assert.equal(check.ok, true);
  // It is accepted as a known v1 shape, and mergeExports never copies it into
  // brokenDown or started. Nobody can now say what it meant.
  const { merged } = mergeExports([{ label: 'f.json', data: check.export }]);
  assert.deepEqual(merged.days['2026-09-20'], { opens: 0, captures: 0, brokenDown: 0, started: 0 });
});

// --- merging repeat exports ------------------------------------------------

test('the same export sent twice changes nothing', () => {
  const data = exp({ days: daysAt('2026-09-20', [0, 8]) });
  const once = mergeExports([{ label: 'a.json', data }]).merged;
  const twice = mergeExports([{ label: 'a.json', data }, { label: 'b.json', data: structuredClone(data) }]).merged;
  assert.deepEqual(twice, once);
});

test('a later snapshot wins per day, and days are unioned', () => {
  const early = exp({ days: { '2026-09-20': { opens: 1, captures: 2 } } });
  const late = exp({ days: { '2026-09-20': { opens: 4, captures: 2 }, '2026-09-28': { opens: 1 } } });
  const { merged, conflicts } = mergeExports([{ label: 'a', data: early }, { label: 'b', data: late }]);
  assert.deepEqual(conflicts, []);
  assert.equal(merged.days['2026-09-20'].opens, 4);
  assert.equal(merged.days['2026-09-20'].captures, 2);
  assert.equal(merged.days['2026-09-28'].opens, 1);
});

test('two different phones under one pseudonym is a conflict, not an average', () => {
  const a = exp({ firstOpen: '2026-09-20' });
  const b = exp({ firstOpen: '2026-10-01' });
  const { conflicts } = mergeExports([{ label: 'a', data: a }, { label: 'b', data: b }]);
  assert.equal(conflicts.length, 1);
  assert.match(conflicts[0], /firstOpen/);
});

// --- fingerprinting --------------------------------------------------------

test('the fingerprint depends on the counts, not on key order', () => {
  const a = { version: 2, source: 'real', firstOpen: '2026-09-20', days: { '2026-09-20': { opens: 1, captures: 2 } } };
  const reordered = { days: { '2026-09-20': { captures: 2, opens: 1 } }, firstOpen: '2026-09-20', source: 'real', version: 2 };
  const different = { ...a, days: { '2026-09-20': { opens: 1, captures: 3 } } };

  assert.equal(fingerprint(a), fingerprint(reordered));
  // The regression this replaced: a replacer-array canonicalisation stripped
  // `days` entirely, so every export hashed alike and the duplicate check
  // flagged every participant.
  assert.notEqual(fingerprint(a), fingerprint(different));
});

test('exports differing only in a nested day hash differently', () => {
  const a = exp({ days: daysAt('2026-09-20', [0, 8]) });
  const b = exp({ days: daysAt('2026-09-20', [0, 9]) });
  assert.notEqual(fingerprint(a), fingerprint(b));
});

// --- eligibility -----------------------------------------------------------

test('only a real source from a device build is eligible outright', () => {
  assert.equal(eligibilityOf(exp()).status, ELIGIBILITY.eligible);
  assert.equal(eligibilityOf(exp({ source: 'fixture', environment: 'simulator' })).status, ELIGIBILITY.excludedFixture);
  assert.equal(eligibilityOf(exp(), { founder: true }).status, ELIGIBILITY.excludedFounder);
});

test('a founder or fixture record is excluded even with a confirmation attached', () => {
  const confirmation = { by: 'operator', on: '2026-10-21', basis: 'vouched' };
  assert.equal(eligibilityOf(exp(), { founder: true, confirmation }).status, ELIGIBILITY.excludedFounder);
  assert.equal(
    eligibilityOf(exp({ source: 'fixture', environment: 'simulator' }), { confirmation }).status,
    ELIGIBILITY.excludedFixture,
  );
});

test('a record from before the trial started is excluded and says so', () => {
  const result = eligibilityOf(exp({ firstOpen: '2026-08-01' }), { trialStart: '2026-09-20' });
  assert.equal(result.status, ELIGIBILITY.excludedPreTrial);
  assert.match(result.reason, /before the trial started/);
});

test('missing provenance is never promoted, and a confirmation must name a person', () => {
  const legacy = exp({ environment: null });
  assert.equal(eligibilityOf(legacy).status, ELIGIBILITY.needsConfirmation);

  const admitted = eligibilityOf(legacy, {
    confirmation: { by: 'operator', on: '2026-10-21', basis: 'watched them install it' },
  });
  assert.equal(admitted.status, ELIGIBILITY.eligible);
  assert.equal(admitted.byConfirmation, true);
  assert.match(admitted.reason, /admitted by operator on 2026-10-21/);
});

test('a bare `true` confirmation is rejected and the record stays held back', () => {
  const r = score(dataset(
    { p1: { exports: ['a.json'], eligibilityConfirmed: true } },
    { 'a.json': exp({ environment: null }) },
  ));
  assert.equal(r.rows[0].eligibility, ELIGIBILITY.needsConfirmation);
  assert.equal(r.totals.eligible, 0);
  assert.match(r.problems.join('\n'), /needs by, on and basis/);
});

test('a confirmation missing any of by/on/basis is rejected', () => {
  for (const partial of [
    { on: '2026-10-21', basis: 'x' },
    { by: 'operator', basis: 'x' },
    { by: 'operator', on: '2026-10-21' },
    { by: '  ', on: '2026-10-21', basis: 'x' },
    { by: 'operator', on: 'yesterday', basis: 'x' },
  ]) {
    const r = score(dataset(
      { p1: { exports: ['a.json'], eligibilityConfirmed: partial } },
      { 'a.json': exp({ environment: null }) },
    ));
    assert.equal(r.rows[0].eligibility, ELIGIBILITY.needsConfirmation, JSON.stringify(partial));
  }
});

// --- the return window -----------------------------------------------------

test('the window is days 7 to 13 inclusive', () => {
  assert.equal(RETURN_WINDOW.first, 7);
  assert.equal(RETURN_WINDOW.last, 13);
  for (const offset of [0, 1, 6, 14, 20]) {
    const record = exp({ days: daysAt('2026-09-20', [0, offset]) });
    assert.equal(returnAnswer(record, '2026-11-01').answer, ANSWER.no, `day ${offset}`);
  }
  for (const offset of [7, 10, 13]) {
    const record = exp({ days: daysAt('2026-09-20', [0, offset]) });
    assert.equal(returnAnswer(record, '2026-11-01').answer, ANSWER.yes, `day ${offset}`);
  }
});

test('the window closes at the start of day 14, so day 13 is still open all day', () => {
  const quiet = exp({ days: daysAt('2026-09-20', [0]) });
  // As-of day 13: the participant could still come back this afternoon.
  const onDay13 = returnAnswer(quiet, '2026-10-03');
  assert.equal(onDay13.answer, ANSWER.unknown);
  assert.equal(onDay13.incompleteWindow, true);
  // As-of day 14: the question is answered.
  assert.equal(returnAnswer(quiet, '2026-10-04').answer, ANSWER.no);
});

test('an open window is unknown, never a no', () => {
  const day5 = exp({ days: daysAt('2026-09-20', [0]) });
  const answer = returnAnswer(day5, '2026-09-25');
  assert.equal(answer.answer, ANSWER.unknown);
  assert.equal(answer.incompleteWindow, true);
  assert.match(answer.reason, /still open/);
});

test('a day recorded with all-zero counts is not activity', () => {
  const record = exp({ days: { '2026-09-20': { opens: 1 }, '2026-09-28': { opens: 0, captures: 0, brokenDown: 0, started: 0 } } });
  assert.equal(returnAnswer(record, '2026-11-01').answer, ANSWER.no);
});

test('a capture or a breakdown counts as coming back, though not as starting', () => {
  // Returning is "they opened it again"; what they did once there is the
  // other question entirely.
  const record = exp({ days: { ...daysAt('2026-09-20', [0]), ...daysAt('2026-09-20', [8], { brokenDown: 1 }) } });
  assert.equal(returnAnswer(record, '2026-11-01').answer, ANSWER.yes);
});

// --- the as-of cutoff ------------------------------------------------------
//
// A checkpoint is a question about a day in the past. An export sent later
// contains days beyond it -- a September tally re-run in November reads the
// same file -- and nothing after the checkpoint may answer for it. The bug
// this replaces: any day in the 7-13 window counted as a return however far
// in the future it was, so `returnAnswer` said YES on day 1.

test('activity after the as-of date does not establish a return', () => {
  // The reported case: first open 2026-09-01, activity on day 9, tallied on
  // day 1. Day 9 has not happened yet.
  const record = exp({ firstOpen: '2026-09-01', days: { '2026-09-10': { started: 1 } } });
  const early = returnAnswer(record, '2026-09-02');
  assert.equal(early.answer, ANSWER.unknown);
  assert.equal(early.incompleteWindow, true);
  assert.deepEqual(early.futureDays, ['2026-09-10']);

  // The same file at a checkpoint after that day answers yes. Nothing is lost,
  // only deferred to the checkpoint that can see it.
  assert.equal(returnAnswer(record, '2026-09-20').answer, ANSWER.yes);
});

test('the cutoff is the as-of day itself: that day counts, the next does not', () => {
  const record = exp({ firstOpen: '2026-09-01', days: { '2026-09-08': { opens: 1 } } });
  // Day 7 activity, tallied on day 7.
  assert.equal(returnAnswer(record, '2026-09-08').answer, ANSWER.yes);
  // Tallied the day before it happened.
  const before = returnAnswer(record, '2026-09-07');
  assert.equal(before.answer, ANSWER.unknown);
  assert.deepEqual(before.futureDays, ['2026-09-08']);
});

test('a future day never converts an answered no into a yes', () => {
  // Window closed quiet, and a later export shows day 20 activity. Day 20 is
  // outside the window anyway, but the point is the closed no stands.
  const record = exp({ firstOpen: '2026-09-01', days: { ...daysAt('2026-09-01', [0]), '2026-09-21': { opens: 4 } } });
  assert.equal(returnAnswer(record, '2026-09-16').answer, ANSWER.no);
});

test('a record that begins after the checkpoint answers nothing and is flagged', () => {
  const record = exp({ firstOpen: '2026-10-01', days: daysAt('2026-10-01', [0, 8]) });
  const answer = returnAnswer(record, '2026-09-20');
  assert.equal(answer.answer, ANSWER.unknown);
  assert.equal(answer.firstOpenAfterAsOf, true);
  assert.match(answer.reason, /after the as-of date/);
});

test('someone who had not opened the app yet is not a participant at that checkpoint', () => {
  const r = score(dataset(
    { later: { exports: ['a.json'] } },
    { 'a.json': exp({ firstOpen: '2026-10-01', days: daysAt('2026-10-01', [0, 8]) }) },
    { asOf: '2026-09-20' },
  ));
  assert.equal(r.rows[0].eligibility, ELIGIBILITY.excludedAfterCheckpoint);
  assert.equal(r.totals.eligible, 0);
  assert.equal(r.totals.excludedAfterCheckpoint, 1);
  assert.match(r.problems.join('\n'), /not a participant at this checkpoint/);
  assert.match(r.problems.join('\n'), /Re-run with a later --as-of/);
});

test('a day before the participant\'s own first open is impossible and reported', () => {
  const record = exp({ firstOpen: '2026-09-10', days: { '2026-09-01': { opens: 3 }, '2026-09-18': { opens: 1 } } });
  const answer = returnAnswer(record, '2026-11-01');
  assert.deepEqual(answer.impossibleDays, ['2026-09-01']);
  // The legitimate day 8 still answers.
  assert.equal(answer.answer, ANSWER.yes);

  const r = score(dataset({ p1: { exports: ['a.json'] } }, { 'a.json': record }));
  assert.match(r.problems.join('\n'), /before their own first open/);
});

test('an answer heard after the checkpoint is unknown there, and reported', () => {
  const late = { reportedHelp: 'yes', confirmedBy: 'operator', confirmedOn: '2026-10-20' };
  const answer = helpAnswer(late, '2026-10-01');
  assert.equal(answer.answer, ANSWER.unknown);
  assert.equal(answer.afterCheckpoint, true);
  // And is the plain yes it always was once the checkpoint reaches it.
  assert.equal(helpAnswer(late, '2026-10-20').answer, ANSWER.yes);
  assert.equal(helpAnswer(late, '2026-11-01').answer, ANSWER.yes);

  const r = score(dataset(
    { p1: { exports: ['a.json'], ...late } },
    { 'a.json': exp({ days: daysAt('2026-09-20', [0, 8]) }) },
    { asOf: '2026-10-01' },
  ));
  assert.equal(r.totals.helpYes, 0);
  assert.equal(r.totals.helpUnknown, 1);
  assert.match(r.problems.join('\n'), /after the as-of date/);
});

test('a confirmation dated after the checkpoint does not admit a record there', () => {
  const entry = {
    exports: ['a.json'],
    eligibilityConfirmed: { by: 'operator', on: '2026-10-21', basis: 'known tester' },
  };
  const legacy = { 'a.json': exp({ environment: null, days: daysAt('2026-09-20', [0]) }) };

  const early = score(dataset({ p1: entry }, legacy, { asOf: '2026-10-01' }));
  assert.equal(early.rows[0].eligibility, ELIGIBILITY.needsConfirmation);
  assert.equal(early.totals.eligible, 0);
  assert.match(early.problems.join('\n'), /cannot admit a record at an earlier checkpoint/);

  // On the day it was written, and after, it does its job.
  for (const asOf of ['2026-10-21', '2026-11-01']) {
    const later = score(dataset({ p1: entry }, legacy, { asOf }));
    assert.equal(later.rows[0].eligibility, ELIGIBILITY.eligible, asOf);
    assert.equal(later.rows[0].admittedByConfirmation, true, asOf);
  }
});

test('re-running an earlier checkpoint on newer files gives the earlier answer', () => {
  // The property the cutoff exists for: a tally of a past date must not move
  // when a participant sends a fresher export.
  const files = {
    'a.json': exp({ firstOpen: '2026-09-01', days: daysAt('2026-09-01', [0, 9]) }),
    'b.json': exp({ firstOpen: '2026-09-01', days: daysAt('2026-09-01', [0, 3]) }),
  };
  const annotation = { reportedHelp: 'yes', confirmedBy: 'operator', confirmedOn: '2026-09-25' };
  const at = asOf => score(dataset(
    { p1: { exports: ['a.json'], ...annotation }, p2: { exports: ['b.json'], ...annotation } },
    files,
    { asOf, trialStart: '2026-09-01' },
  ));

  const september = at('2026-09-05');
  assert.equal(september.totals.returnYes, 0);
  assert.equal(september.totals.helpYes, 0);
  assert.equal(september.totals.sameFive, 0);

  const november = at('2026-11-01');
  assert.equal(november.totals.returnYes, 1);
  assert.equal(november.totals.helpYes, 2);
  assert.equal(november.totals.sameFive, 1);
});

// --- reported help ---------------------------------------------------------

test('no answer recorded is unknown, not a no', () => {
  assert.equal(helpAnswer({}).answer, ANSWER.unknown);
  assert.equal(helpAnswer({ reportedHelp: null }).answer, ANSWER.unknown);
  assert.equal(helpAnswer(undefined).answer, ANSWER.unknown);
});

test('a yes nobody signed for is downgraded to unknown', () => {
  const answer = helpAnswer({ reportedHelp: 'yes' });
  assert.equal(answer.answer, ANSWER.unknown);
  assert.equal(answer.unattributed, true);
});

test('a no nobody signed for is also unknown — the rule is not one-sided', () => {
  assert.equal(helpAnswer({ reportedHelp: 'no' }).answer, ANSWER.unknown);
});

test('an attributed answer is taken at face value, yes or no', () => {
  const attribution = { confirmedBy: 'operator', confirmedOn: '2026-10-20' };
  assert.equal(helpAnswer({ reportedHelp: 'yes', ...attribution }).answer, ANSWER.yes);
  assert.equal(helpAnswer({ reportedHelp: 'no', ...attribution }).answer, ANSWER.no);
});

test('a value that is not yes/no/unknown is unknown, not truthy', () => {
  for (const claimed of [true, 1, 'YES', 'maybe', {}]) {
    assert.equal(helpAnswer({ reportedHelp: claimed, confirmedBy: 'operator', confirmedOn: '2026-10-20' }).answer, ANSWER.unknown);
  }
});

// --- scoring ---------------------------------------------------------------

test('a file nobody claims is not a participant', () => {
  const r = score(dataset({}, { 'orphan.json': exp() }));
  assert.equal(r.totals.eligible, 0);
  assert.equal(r.totals.participantsDeclared, 0);
  assert.equal(r.totals.unattributedFiles, 1);
  assert.match(r.problems.join('\n'), /no declared owner/);
});

test('one file claimed by two pseudonyms is reported', () => {
  const r = score(dataset(
    { p1: { exports: ['a.json'] }, p2: { exports: ['a.json'] } },
    { 'a.json': exp() },
  ));
  assert.match(r.problems.join('\n'), /claimed by both/);
});

test('identical content under two pseudonyms holds both back rather than counting two', () => {
  const shared = exp({ days: daysAt('2026-09-20', [0, 8]) });
  const r = score(dataset(
    { p1: { exports: ['a.json'] }, p2: { exports: ['b.json'] }, p3: { exports: ['c.json'] } },
    { 'a.json': shared, 'b.json': structuredClone(shared), 'c.json': exp({ days: daysAt('2026-09-20', [0, 9]) }) },
  ));
  assert.equal(r.rows.find(x => x.id === 'p1').eligibility, ELIGIBILITY.needsConfirmation);
  assert.equal(r.rows.find(x => x.id === 'p2').eligibility, ELIGIBILITY.needsConfirmation);
  assert.equal(r.rows.find(x => x.id === 'p3').counted, true);
  assert.equal(r.totals.eligible, 1);
});

test('an operator can attest that a collision really is two people', () => {
  const shared = exp({ days: daysAt('2026-09-20', [0, 8]) });
  const confirmed = { by: 'operator', on: '2026-10-21', basis: 'two people, both watched installing' };
  const r = score(dataset(
    { p1: { exports: ['a.json'], eligibilityConfirmed: confirmed }, p2: { exports: ['b.json'], eligibilityConfirmed: confirmed } },
    { 'a.json': shared, 'b.json': structuredClone(shared) },
  ));
  assert.equal(r.totals.eligible, 2);
  assert.match(r.problems.join('\n'), /admitted anyway by operator/);
});

test('a participant with several exports is one person', () => {
  const r = score(dataset(
    { p1: { exports: ['a.json', 'b.json', 'c.json'] } },
    {
      'a.json': exp({ days: daysAt('2026-09-20', [0]) }),
      'b.json': exp({ days: daysAt('2026-09-20', [0, 3]) }),
      'c.json': exp({ days: daysAt('2026-09-20', [0, 3, 8]) }),
    },
  ));
  assert.equal(r.totals.eligible, 1);
  assert.equal(r.rows[0].exports, 3);
  assert.equal(r.rows[0].returned, ANSWER.yes);
});

test('a claimed export that is not in the dataset is reported and the person is not counted', () => {
  const r = score(dataset({ p1: { exports: ['missing.json'] } }, {}));
  assert.equal(r.totals.eligible, 0);
  assert.equal(r.rows[0].eligibilityReason, 'no readable export');
  assert.match(r.problems.join('\n'), /which is not in the dataset/);
});

test('the milestone needs the SAME people, not two groups of five', () => {
  const participants = {};
  const files = {};
  for (let i = 1; i <= 10; i += 1) {
    const id = `p${String(i).padStart(2, '0')}`;
    const file = `${id}.json`;
    const helped = i <= 5;
    files[file] = exp({ days: daysAt('2026-09-20', helped ? [0, i] : [0, 7 + i % 7]) });
    participants[id] = {
      exports: [file],
      reportedHelp: helped ? 'yes' : 'no',
      confirmedBy: 'operator',
      confirmedOn: '2026-10-20',
    };
  }
  const r = score(dataset(participants, files));
  assert.equal(r.totals.eligible, 10);
  assert.equal(r.totals.helpYes, 5);
  assert.equal(r.totals.returnYes, 5);
  assert.equal(r.totals.sameFive, 0);
  assert.equal(r.milestone.participantsMet, true);
  assert.equal(r.milestone.sameFiveMet, false);
  assert.equal(r.milestone.met, false);
});

test('the milestone is met only when both halves land on the same five people', () => {
  const participants = {};
  const files = {};
  for (let i = 1; i <= 10; i += 1) {
    const id = `p${String(i).padStart(2, '0')}`;
    const file = `${id}.json`;
    const good = i <= MILESTONE.sameFive;
    // Distinct counts per person: two exports with identical content are a
    // collision the scorecard holds back, which is its own test above.
    files[file] = exp({ days: daysAt('2026-09-20', good ? [0, 8] : [0], { opens: i }) });
    participants[id] = {
      exports: [file],
      reportedHelp: good ? 'yes' : 'no',
      confirmedBy: 'operator',
      confirmedOn: '2026-10-20',
    };
  }
  const r = score(dataset(participants, files));
  assert.equal(r.totals.sameFive, 5);
  assert.equal(r.milestone.met, true);
});

test('unknowns are counted apart from the nos, on both questions', () => {
  const r = score(dataset(
    {
      openWindow: { exports: ['a.json'] },
      neverAsked: { exports: ['b.json'], reportedHelp: undefined },
    },
    {
      'a.json': exp({ firstOpen: '2026-10-28', days: daysAt('2026-10-28', [0]) }),
      'b.json': exp({ days: daysAt('2026-09-20', [0]) }),
    },
  ));
  assert.equal(r.totals.returnUnknownIncompleteWindow, 1);
  assert.equal(r.totals.returnNo, 1);
  assert.equal(r.totals.helpUnknown, 2);
  assert.equal(r.totals.helpNo, 0);
});

test('a missing as-of date is a problem, not a silent today', () => {
  const d = dataset({}, {});
  d.annotations.asOf = undefined;
  const r = score(d);
  assert.match(r.problems.join('\n'), /no as-of date/);
});

test('synthetic-ness comes from the descriptor and is carried into the output', () => {
  const r = score(dataset({ p1: { exports: ['a.json'] } }, { 'a.json': exp() }));
  assert.equal(r.synthetic, true);
  const text = render(r);
  assert.match(text, /SYNTHETIC DATA — NOT REAL PARTICIPANTS/);
  for (const line of text.split('\n')) {
    if (line.trim() === '' || line.startsWith('=') || /^ /.test(line)) continue;
    assert.match(line, /^\[SYNTHETIC\]/, `unlabelled line: ${line}`);
  }
});

test('a synthetic dataset modelling real participants says so loudly', () => {
  const r = score(dataset({ p1: { exports: ['a.json'] } }, { 'a.json': exp() }));
  assert.match(r.problems.join('\n'), /SYNTHETIC dataset contains 1 record\(s\) with source "real"/);
});

// --- privacy ---------------------------------------------------------------

test('nothing identifying can reach the output because nothing identifying is read', () => {
  // Even if a rogue export carried task text, it is rejected by validation
  // and never reaches a row.
  const d = dataset({ p1: { exports: ['a.json'] } }, {});
  d.exportFiles = ['a.json'];
  const raw = { ...exp(), title: 'call the dentist about the thing' };
  const check = validateExport(raw, 'a.json');
  assert.equal(check.ok, false);
  const r = score(d);
  assert.equal(JSON.stringify(r).includes('dentist'), false);
});

// --- fixtures on disk ------------------------------------------------------

test('every shipped fixture declares itself synthetic', () => {
  const dirs = readdirSync(fixtures, { withFileTypes: true }).filter(e => e.isDirectory());
  assert.ok(dirs.length >= 4);
  for (const dir of dirs) {
    const descriptor = JSON.parse(readFileSync(join(fixtures, dir.name, 'DATASET.json'), 'utf8'));
    assert.equal(descriptor.synthetic, true, `${dir.name} must declare synthetic: true`);
    assert.ok(dir.name.startsWith('synthetic-'), `${dir.name} must be named synthetic-*`);
    for (const file of readdirSync(join(fixtures, dir.name))) {
      if (file === 'DATASET.json' || file === 'annotations.json') continue;
      assert.ok(file.startsWith('synthetic-'), `${dir.name}/${file} must be named synthetic-*`);
    }
  }
});

test('loadDataset reads a fixture directory and marks it synthetic', () => {
  const loaded = loadDataset(join(fixtures, 'synthetic-disjoint'));
  assert.equal(loaded.descriptor.synthetic, true);
  assert.equal(loaded.exports.size, 10);
});

// --- CLI -------------------------------------------------------------------

test('the CLI exits non-zero when anything needs a human', () => {
  const { code, result } = runCLI(['--dataset', join(fixtures, 'synthetic-duplicates')]);
  assert.ok(result.problems.length > 0);
  assert.equal(code, 1);
});

test('the CLI refuses an unknown argument rather than guessing', () => {
  assert.equal(runCLI(['--upload']).code, 2);
});

test('--as-of overrides the dataset and moves the window boundary', () => {
  const day13 = runCLI(['--dataset', join(fixtures, 'synthetic-boundary'), '--as-of', '2026-11-01', '--json']);
  assert.equal(day13.result.asOf, '2026-11-01');
  const early = runCLI(['--dataset', join(fixtures, 'synthetic-boundary'), '--as-of', '2026-09-25', '--json']);
  // Rewound to before anyone's window closed, every no becomes an unknown.
  assert.equal(early.result.totals.returnNo, 0);
});
