#!/usr/bin/env node
// One command that proves the scorecard counts the awkward cases correctly.
//
//   node tools/trial-scorecard/demo.mjs
//
// Runs the scorecard over four synthetic datasets and asserts the answer for
// each. Exits non-zero if any proof fails, so it is usable as a check rather
// than only as a demonstration.
//
// Everything it touches is synthetic and says so. No real participant exists
// and nothing here should ever be read as a trial result.

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDataset, score, render, ANSWER, ELIGIBILITY } from './scorecard.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures');

let failures = 0;

function check(description, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures += 1;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${description}`);
  if (!pass) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function run(name) {
  const result = score(loadDataset(join(fixtures, name)));
  if (!result.synthetic) {
    console.error(`FATAL: ${name} is not declared synthetic — refusing to demo with it`);
    process.exit(2);
  }
  return result;
}

const rowFor = (result, id) => result.rows.find(r => r.id === id);

console.log('='.repeat(72));
console.log('  SYNTHETIC PROOFS — no real participants exist, none of this is a result');
console.log('='.repeat(72));

// ---------------------------------------------------------------------------
console.log('\n1. Five helped and a DIFFERENT five returned is not success.');
{
  const r = run('synthetic-disjoint');
  check('ten eligible participants', r.totals.eligible, 10);
  check('five said it helped', r.totals.helpYes, 5);
  check('five came back in days 7-13', r.totals.returnYes, 5);
  check('SAME people who did both', r.totals.sameFive, 0);
  check('participant count alone is met', r.milestone.participantsMet, true);
  check('milestone NOT met', r.milestone.met, false);
}

// ---------------------------------------------------------------------------
console.log('\n2. Repeat exports do not inflate the count.');
{
  const r = run('synthetic-duplicates');
  check('twelve export files on disk', r.rows.reduce((n, row) => n + (row.exports ?? 0), 0), 12);
  check('seven pseudonyms declared', r.totals.participantsDeclared, 7);
  check('five eligible people, not twelve and not seven', r.totals.eligible, 5);
  check('two held back as the same export under two names', r.totals.needsConfirmation, 2);
  check('p06 held back', rowFor(r, 'p06').eligibility, ELIGIBILITY.needsConfirmation);
  check('p07 held back', rowFor(r, 'p07').eligibility, ELIGIBILITY.needsConfirmation);
  check('p01 still counted once despite two exports', rowFor(r, 'p01').counted, true);
  check('milestone NOT met on five', r.milestone.met, false);
}

// ---------------------------------------------------------------------------
console.log('\n3. The return window: day 13 is in, day 14 is out, an open window is unknown.');
{
  const r = run('synthetic-boundary');
  check('day 13 returned', rowFor(r, 'day13').returned, ANSWER.yes);
  check('day 14 did not', rowFor(r, 'day14').returned, ANSWER.no);
  check('day 6 did not', rowFor(r, 'day6').returned, ANSWER.no);
  check('an unelapsed window is unknown, not no', rowFor(r, 'stillOpen').returned, ANSWER.unknown);
  check('and is reported as an open window', rowFor(r, 'stillOpen').incompleteWindow, true);
  check('counted separately from the nos', r.totals.returnUnknownIncompleteWindow, 1);
  check('only day 13 counts as a return', r.totals.returnYes, 1);
}

// ---------------------------------------------------------------------------
console.log('\n4. Missing evidence stays unknown; fixtures, founder and orphans stay out.');
{
  const r = run('synthetic-unknowns');
  check('never asked is unknown', rowFor(r, 'notAsked').help, ANSWER.unknown);
  check('a "yes" with nobody attached is unknown', rowFor(r, 'unattributed').help, ANSWER.unknown);
  check('an attributed yes counts', rowFor(r, 'asked').help, ANSWER.yes);
  check('simulator data excluded', rowFor(r, 'simulator').eligibility, ELIGIBILITY.excludedFixture);
  check('founder data excluded', rowFor(r, 'founder').eligibility, ELIGIBILITY.excludedFounder);
  check('missing provenance is not promoted',
    rowFor(r, 'legacyUnconfirmed').eligibility, ELIGIBILITY.needsConfirmation);
  check('an attributable confirmation admits it',
    rowFor(r, 'legacyConfirmed').eligibility, ELIGIBILITY.eligible);
  check('and is reported as admitted by a person',
    rowFor(r, 'legacyConfirmed').admittedByConfirmation, true);
  check('an unclaimed file is nobody', r.totals.unattributedFiles, 1);
  check('eligible: asked, notAsked, unattributed, legacyConfirmed', r.totals.eligible, 4);
  check('help unknown for two of them', r.totals.helpUnknown, 2);
}

// ---------------------------------------------------------------------------
console.log('\n5. Nothing identifying reaches the scorecard.');
{
  const r = run('synthetic-disjoint');
  const text = JSON.stringify(r) + '\n' + render(r);
  const forbidden = ['title', 'task', 'email', '@', 'phone', 'udid', 'idfv', 'deviceId', 'name'];
  for (const needle of forbidden) {
    check(`no "${needle}" anywhere in the output`, text.toLowerCase().includes(needle.toLowerCase()), false);
  }
}

// ---------------------------------------------------------------------------
console.log('\nA full scorecard, for shape:\n');
console.log(render(run('synthetic-disjoint')));

console.log('\n' + '='.repeat(72));
if (failures > 0) {
  console.log(`  ${failures} PROOF(S) FAILED`);
  process.exit(1);
}
console.log('  All proofs passed. Still synthetic. Still zero real participants.');
console.log('='.repeat(72));
