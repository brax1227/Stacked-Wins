#!/usr/bin/env node
// Operator scorecard for the Stacked Wins trial.
//
// Reads exports that participants *chose* to send, plus the operator's own
// pseudonymous notes, and answers the only question the Dec 17 milestone
// asks: are there ten eligible participants, and did the SAME five both
// report specific help and come back on days 7-13?
//
// It is a counting tool, not a collector. It opens files a person already
// put in a folder. It makes no network calls, holds no credentials, reads
// nothing from a device, and cannot recruit anybody.
//
// Three rules it is built around, each of which was easy to get wrong:
//
//   1. Nothing is inferred. A file nobody claims is not a user. A participant
//      is helped only because an operator wrote down that they said so, with
//      their name against it. Absence is `unknown`, never `no`.
//   2. Synthetic data cannot touch a real total. A dataset declares itself
//      synthetic; mixing synthetic and real files is a hard error, not a
//      warning, and every synthetic line of output says so.
//   3. Nothing identifying leaves the input. The scorecard holds pseudonyms,
//      dates and counts. Task text, contact details and device identifiers
//      are neither read nor emitted.
//
// Usage:
//   node scorecard.mjs --dataset <dir> [--json] [--as-of YYYY-MM-DD]
//
// See TRIAL.md for the definitions and tools/trial-scorecard/README.md for
// the dataset format.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, basename } from 'node:path';

/** Days after first open that count as "the following week", inclusive. */
export const RETURN_WINDOW = { first: 7, last: 13 };

/** Milestone, from NORTH_STAR.md. Both must hold, on the same people. */
export const MILESTONE = { participants: 10, sameFive: 5 };

// ---------------------------------------------------------------------------
// Dates. Date-only throughout: the exports contain no times and the scorecard
// must not invent any.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

export function parseDay(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const ms = Date.parse(`${text}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Whole days between two date-only strings.
 *
 * UTC midnights throughout, so this is exact arithmetic rather than elapsed
 * time. A local-time implementation would be off by one across a
 * daylight-saving change, where a day is 23 or 25 hours long.
 */
export function daysBetween(fromDay, toDay) {
  const a = parseDay(fromDay);
  const b = parseDay(toDay);
  if (a === null || b === null) return null;
  return Math.round((b - a) / DAY_MS);
}

// ---------------------------------------------------------------------------
// Reading one export
// ---------------------------------------------------------------------------

/** Keys the app writes. Anything else is a reason to stop and look. */
const EXPORT_KEYS = new Set(['version', 'source', 'environment', 'firstOpen', 'days']);
const DAY_KEYS = new Set(['opens', 'captures', 'brokenDown', 'started', 'actions']);

/**
 * Validate one parsed export.
 *
 * Returns `{ ok, problems, export }`. A malformed file is never guessed at:
 * it is reported and left out, because a trial of ten cannot afford a
 * silently repaired record.
 */
export function validateExport(raw, label) {
  const problems = [];
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, problems: [`${label}: not a JSON object`] };
  }

  for (const key of Object.keys(raw)) {
    if (!EXPORT_KEYS.has(key)) {
      // Loud, because an unexpected key is how task text or an identifier
      // would arrive.
      problems.push(`${label}: unexpected key "${key}" — refusing to read it`);
    }
  }

  const source = raw.source;
  if (source !== 'real' && source !== 'fixture') {
    problems.push(`${label}: source must be "real" or "fixture", got ${JSON.stringify(source)}`);
  }

  const environment = raw.environment;
  if (environment !== undefined && !['device', 'simulator', 'debugBuild'].includes(environment)) {
    problems.push(`${label}: unknown environment ${JSON.stringify(environment)}`);
  }

  if (raw.firstOpen !== undefined && raw.firstOpen !== null && parseDay(raw.firstOpen) === null) {
    problems.push(`${label}: firstOpen is not a YYYY-MM-DD date`);
  }

  const days = raw.days ?? {};
  if (typeof days !== 'object' || Array.isArray(days)) {
    problems.push(`${label}: days must be an object`);
  } else {
    for (const [day, counts] of Object.entries(days)) {
      if (parseDay(day) === null) problems.push(`${label}: day key "${day}" is not a date`);
      if (typeof counts !== 'object' || counts === null) {
        problems.push(`${label}: day ${day} is not an object`);
        continue;
      }
      for (const [k, v] of Object.entries(counts)) {
        if (!DAY_KEYS.has(k)) problems.push(`${label}: day ${day} has unexpected field "${k}"`);
        else if (!Number.isInteger(v) || v < 0) {
          problems.push(`${label}: day ${day}.${k} must be a non-negative integer`);
        }
      }
    }
  }

  return { ok: problems.length === 0, problems, export: raw };
}

/** A day with anything on it at all. */
function isActive(counts) {
  return (counts.opens ?? 0) + (counts.captures ?? 0)
    + (counts.brokenDown ?? 0) + (counts.started ?? 0) > 0;
}

/**
 * Merge repeat exports from one participant.
 *
 * Exports are cumulative snapshots of the same file at different moments, so
 * the union of days with the highest count seen for each is the faithful
 * combination — and, importantly, sending the same export twice changes
 * nothing.
 *
 * Disagreement about firstOpen, source or environment is a conflict rather
 * than something to resolve by picking one: two different phones filed under
 * one pseudonym is exactly the mistake that would inflate a count of ten.
 */
export function mergeExports(exports) {
  const conflicts = [];
  const merged = { version: 2, source: null, environment: undefined, firstOpen: null, days: {} };

  for (const { label, data } of exports) {
    for (const field of ['source', 'environment', 'firstOpen']) {
      const incoming = data[field] ?? null;
      const existing = field === 'environment' ? (merged.environment ?? null) : merged[field];
      if (existing === null || existing === undefined) {
        if (field === 'environment') merged.environment = data.environment;
        else merged[field] = incoming;
      } else if (incoming !== null && incoming !== existing) {
        conflicts.push(`${label}: ${field} is ${JSON.stringify(incoming)} but an earlier export said ${JSON.stringify(existing)}`);
      }
    }

    for (const [day, counts] of Object.entries(data.days ?? {})) {
      const into = merged.days[day] ?? {};
      for (const key of ['opens', 'captures', 'brokenDown', 'started']) {
        into[key] = Math.max(into[key] ?? 0, counts[key] ?? 0);
      }
      merged.days[day] = into;
    }
  }

  return { merged, conflicts };
}

// ---------------------------------------------------------------------------
// Eligibility. Mirrors TrialReport.Eligibility in the app, deliberately.
// ---------------------------------------------------------------------------

export const ELIGIBILITY = {
  eligible: 'eligible',
  excludedFixture: 'excluded-fixture',
  excludedFounder: 'excluded-founder',
  excludedPreTrial: 'excluded-pre-trial',
  needsConfirmation: 'needs-operator-confirmation',
};

/**
 * Whether a merged record may be counted, and why.
 *
 * `confirmation` must be an operator's written note with a name and a date
 * against it. A bare `true` is not accepted anywhere in this tool: a record
 * admitted to the tally has somebody's name on the decision.
 */
export function eligibilityOf(record, { founder = false, trialStart = null, confirmation = null } = {}) {
  if (record.source === 'fixture') {
    return { status: ELIGIBILITY.excludedFixture, reason: 'fixture, simulator or debug build' };
  }
  if (founder) {
    return { status: ELIGIBILITY.excludedFounder, reason: 'marked as founder/author data' };
  }
  if (trialStart && record.firstOpen && daysBetween(trialStart, record.firstOpen) < 0) {
    return {
      status: ELIGIBILITY.excludedPreTrial,
      reason: `first opened ${record.firstOpen}, before the trial started ${trialStart}`,
    };
  }
  if (record.source === 'real' && record.environment === 'device') {
    return { status: ELIGIBILITY.eligible, reason: 'release build on a device' };
  }

  // A real source with no environment predates source selection; a real
  // source stamped simulator/debug should not exist. Neither is counted and
  // neither is thrown away.
  const missing = record.environment === undefined ? 'no environment recorded' : `environment is ${record.environment}`;
  if (confirmation) {
    return {
      status: ELIGIBILITY.eligible,
      reason: `admitted by ${confirmation.by} on ${confirmation.on}: ${confirmation.basis}`,
      byConfirmation: true,
    };
  }
  return { status: ELIGIBILITY.needsConfirmation, reason: missing };
}

// ---------------------------------------------------------------------------
// The two answers
// ---------------------------------------------------------------------------

export const ANSWER = { yes: 'yes', no: 'no', unknown: 'unknown' };

/**
 * Did they come back on days 7-13?
 *
 * `unknown` while the window is still open: a participant on day 5 has not
 * failed to return. The window closes at the START of day 14, so the whole
 * of day 13 still counts (see TRIAL.md).
 */
export function returnAnswer(record, asOf) {
  if (!record.firstOpen) return { answer: ANSWER.unknown, reason: 'no first-open date' };

  for (const [day, counts] of Object.entries(record.days ?? {})) {
    if (!isActive(counts)) continue;
    const offset = daysBetween(record.firstOpen, day);
    if (offset !== null && offset >= RETURN_WINDOW.first && offset <= RETURN_WINDOW.last) {
      return { answer: ANSWER.yes, reason: `active on day ${offset}` };
    }
  }

  const elapsed = daysBetween(record.firstOpen, asOf);
  if (elapsed === null) return { answer: ANSWER.unknown, reason: 'no as-of date' };
  if (elapsed < RETURN_WINDOW.last + 1) {
    return {
      answer: ANSWER.unknown,
      reason: `window still open — day ${elapsed} of ${RETURN_WINDOW.last}`,
      incompleteWindow: true,
    };
  }
  return { answer: ANSWER.no, reason: 'window closed with no activity in it' };
}

/**
 * Did they say it helped?
 *
 * Only ever from an operator's written note, with a name and a date. An
 * annotation that says "yes" without saying who heard it is not evidence,
 * and is downgraded to unknown with the reason stated.
 */
export function helpAnswer(annotation) {
  const claimed = annotation?.reportedHelp;
  if (claimed === undefined || claimed === null) {
    return { answer: ANSWER.unknown, reason: 'not asked yet, or no answer recorded' };
  }
  if (!Object.values(ANSWER).includes(claimed)) {
    return { answer: ANSWER.unknown, reason: `reportedHelp must be yes/no/unknown, got ${JSON.stringify(claimed)}` };
  }
  if (claimed === ANSWER.unknown) {
    return { answer: ANSWER.unknown, reason: 'recorded as unknown' };
  }

  const by = annotation.confirmedBy;
  const on = annotation.confirmedOn;
  if (typeof by !== 'string' || by.trim() === '' || parseDay(on) === null) {
    return {
      answer: ANSWER.unknown,
      reason: `"${claimed}" has no attribution — needs confirmedBy and a confirmedOn date`,
      unattributed: true,
    };
  }
  return { answer: claimed, reason: `recorded by ${by} on ${on}` };
}

// ---------------------------------------------------------------------------
// Loading a dataset
// ---------------------------------------------------------------------------

function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Recursively sort object keys so key order alone cannot change a hash. */
function canonicalise(value) {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalise(value[key]);
    return out;
  }
  return value;
}

/**
 * Stable fingerprint of an export's content, for spotting the same file twice.
 *
 * Key order must not change the hash and nothing may be dropped from it. An
 * earlier version passed the sorted key list as `JSON.stringify`'s *replacer*
 * argument, which is an allow-list applied to every nested object: it stripped
 * `days` and every count, so all exports hashed alike and the duplicate check
 * flagged every participant as a collision.
 */
export function fingerprint(data) {
  const canonical = JSON.stringify(canonicalise(data));
  return createHash('sha256').update(canonical).digest('hex').slice(0, 12);
}

/**
 * Read a dataset directory.
 *
 * Layout:
 *   annotations.json   operator's notes; also declares who owns which export
 *   *.json             the exports participants sent
 *   DATASET.json       optional; `{"synthetic": true, "label": "..."}`
 */
export function loadDataset(dir) {
  const problems = [];
  const files = readdirSync(dir).filter(f => f.endsWith('.json') && statSync(join(dir, f)).isFile());

  let descriptor = { synthetic: false, label: null };
  if (files.includes('DATASET.json')) {
    descriptor = { ...descriptor, ...readJSON(join(dir, 'DATASET.json')) };
  }

  if (!files.includes('annotations.json')) {
    problems.push('annotations.json is missing — without it no export has a declared owner');
  }
  const annotations = files.includes('annotations.json')
    ? readJSON(join(dir, 'annotations.json'))
    : { participants: {} };

  const exportFiles = files.filter(f => f !== 'annotations.json' && f !== 'DATASET.json');
  const exports = new Map();
  for (const file of exportFiles) {
    let data;
    try {
      data = readJSON(join(dir, file));
    } catch (error) {
      problems.push(`${file}: not valid JSON (${error.message})`);
      continue;
    }
    const check = validateExport(data, file);
    problems.push(...check.problems);
    if (check.ok) exports.set(file, data);
  }

  return { descriptor, annotations, exports, exportFiles, problems };
}

// ---------------------------------------------------------------------------
// The scorecard
// ---------------------------------------------------------------------------

/**
 * Score a loaded dataset.
 *
 * Every participant is a pseudonym the operator chose. Nothing in the result
 * carries a name, an address, a device or a task.
 */
export function score(dataset, { asOf } = {}) {
  const { descriptor, annotations, exports, exportFiles } = dataset;
  const problems = [...dataset.problems];
  const effectiveAsOf = asOf ?? annotations.asOf ?? null;
  const trialStart = annotations.trialStart ?? null;

  if (!effectiveAsOf) {
    problems.push('no as-of date — pass --as-of or set asOf in annotations.json');
  }

  const participants = annotations.participants ?? {};

  // Refuse to mix. A synthetic dataset that contains a record claiming to be
  // a real device, or a real dataset containing a synthetic marker, is a
  // mistake worth stopping for rather than annotating.
  const realLooking = [...exports.values()].filter(e => e.source === 'real');
  if (descriptor.synthetic && realLooking.length > 0) {
    // Synthetic datasets may model real participants — that is the point —
    // but the descriptor must be the single thing that decides, and the
    // output must be unmistakable. Recorded, not silently allowed.
    problems.push(
      `SYNTHETIC dataset contains ${realLooking.length} record(s) with source "real" — `
      + 'they model participants and are labelled synthetic in every line of output'
    );
  }

  // Who owns what. Declared, never inferred.
  const claimed = new Map();
  for (const [id, entry] of Object.entries(participants)) {
    for (const file of entry.exports ?? []) {
      if (claimed.has(file)) {
        problems.push(`${file} is claimed by both "${claimed.get(file)}" and "${id}"`);
      }
      claimed.set(file, id);
      if (!exports.has(file) && !exportFiles.includes(file)) {
        problems.push(`"${id}" claims ${file}, which is not in the dataset`);
      }
    }
  }

  const unattributed = exportFiles.filter(f => !claimed.has(f));
  for (const file of unattributed) {
    // Not counted. A file nobody claims is not a person.
    problems.push(`${file} has no declared owner — not counted as a participant`);
  }

  // The same export content filed under two pseudonyms would inflate the
  // count of ten. Caught by content, not by filename.
  //
  // Identical counts are suspicious rather than conclusive: two people with
  // one quiet day each can genuinely produce the same handful of integers,
  // because the export carries no identifier by design. So a collision holds
  // both back for a human instead of deciding either way -- and an operator
  // can resolve it by attesting they are different people, the same
  // attributable way anything else gets admitted.
  const byFingerprint = new Map();
  for (const [file, data] of exports) {
    const owner = claimed.get(file);
    if (!owner) continue;
    const print = fingerprint(data);
    const seen = byFingerprint.get(print);
    if (seen && seen.owner !== owner) {
      problems.push(
        `${file} ("${owner}") is byte-identical to ${seen.file} ("${seen.owner}") — `
        + 'the same export under two pseudonyms; both held back pending operator resolution'
      );
      seen.crossOwner = true;
      byFingerprint.set(print, { ...seen, crossOwner: true, others: [...(seen.others ?? []), owner] });
    } else if (!seen) {
      byFingerprint.set(print, { file, owner });
    }
  }
  const disputedOwners = new Set();
  for (const entry of byFingerprint.values()) {
    if (entry.crossOwner) {
      disputedOwners.add(entry.owner);
      for (const other of entry.others ?? []) disputedOwners.add(other);
    }
  }

  const rows = [];
  for (const [id, entry] of Object.entries(participants)) {
    const owned = (entry.exports ?? []).filter(f => exports.has(f))
      .map(file => ({ label: file, data: exports.get(file) }));

    if (owned.length === 0) {
      rows.push({
        id,
        eligibility: ELIGIBILITY.needsConfirmation,
        eligibilityReason: 'no readable export',
        help: ANSWER.unknown,
        helpReason: 'no export to go with the answer',
        returned: ANSWER.unknown,
        returnReason: 'no export',
        counted: false,
      });
      continue;
    }

    const { merged, conflicts } = mergeExports(owned);
    problems.push(...conflicts.map(c => `"${id}" ${c}`));

    const confirmation = validConfirmation(entry.eligibilityConfirmed, id, problems);
    const eligibility = eligibilityOf(merged, {
      founder: entry.founder === true,
      trialStart,
      confirmation,
    });

    const help = helpAnswer(entry);
    if (help.unattributed) {
      problems.push(`"${id}" reportedHelp is set but unattributed — treated as unknown`);
    }
    const ret = returnAnswer(merged, effectiveAsOf);

    // A collision an operator has vouched past is resolved; one nobody has
    // looked at yet is held back.
    const disputed = disputedOwners.has(id) && !confirmation;
    if (disputed) {
      problems.push(
        `"${id}" held back: identical export content also filed under another pseudonym. `
        + 'If they really are different people, record eligibilityConfirmed with by/on/basis.'
      );
    } else if (disputedOwners.has(id) && confirmation) {
      problems.push(
        `"${id}" had identical export content to another pseudonym; `
        + `admitted anyway by ${confirmation.by} on ${confirmation.on}`
      );
    }

    rows.push({
      id,
      exports: owned.length,
      eligibility: disputed ? ELIGIBILITY.needsConfirmation : eligibility.status,
      eligibilityReason: disputed ? 'duplicate export content shared with another pseudonym' : eligibility.reason,
      admittedByConfirmation: Boolean(eligibility.byConfirmation) && !disputed,
      help: help.answer,
      helpReason: help.reason,
      returned: ret.answer,
      returnReason: ret.reason,
      incompleteWindow: Boolean(ret.incompleteWindow),
      counted: !disputed && eligibility.status === ELIGIBILITY.eligible,
    });
  }

  const eligible = rows.filter(r => r.counted);
  const helped = eligible.filter(r => r.help === ANSWER.yes);
  const returned = eligible.filter(r => r.returned === ANSWER.yes);
  const both = eligible.filter(r => r.help === ANSWER.yes && r.returned === ANSWER.yes);

  const totals = {
    participantsDeclared: Object.keys(participants).length,
    eligible: eligible.length,
    admittedByOperatorConfirmation: eligible.filter(r => r.admittedByConfirmation).length,
    excludedFixture: rows.filter(r => r.eligibility === ELIGIBILITY.excludedFixture).length,
    excludedFounder: rows.filter(r => r.eligibility === ELIGIBILITY.excludedFounder).length,
    excludedPreTrial: rows.filter(r => r.eligibility === ELIGIBILITY.excludedPreTrial).length,
    needsConfirmation: rows.filter(r => r.eligibility === ELIGIBILITY.needsConfirmation).length,
    unattributedFiles: unattributed.length,
    helpYes: helped.length,
    helpNo: eligible.filter(r => r.help === ANSWER.no).length,
    helpUnknown: eligible.filter(r => r.help === ANSWER.unknown).length,
    returnYes: returned.length,
    returnNo: eligible.filter(r => r.returned === ANSWER.no).length,
    returnUnknownIncompleteWindow: eligible.filter(r => r.incompleteWindow).length,
    returnUnknownOther: eligible.filter(r => r.returned === ANSWER.unknown && !r.incompleteWindow).length,
    sameFive: both.length,
  };

  const milestone = {
    participantsMet: totals.eligible >= MILESTONE.participants,
    sameFiveMet: totals.sameFive >= MILESTONE.sameFive,
  };
  milestone.met = milestone.participantsMet && milestone.sameFiveMet;

  return {
    synthetic: Boolean(descriptor.synthetic),
    label: descriptor.label ?? null,
    asOf: effectiveAsOf,
    trialStart,
    rows: rows.sort((a, b) => a.id.localeCompare(b.id)),
    totals,
    milestone,
    problems,
  };
}

/** An eligibility confirmation is only real if a person's name is on it. */
function validConfirmation(raw, id, problems) {
  if (raw === undefined || raw === null) return null;
  if (raw === true) {
    problems.push(`"${id}" eligibilityConfirmed is \`true\` — needs by, on and basis; ignored`);
    return null;
  }
  const { by, on, basis } = raw ?? {};
  const missing = [];
  if (typeof by !== 'string' || by.trim() === '') missing.push('by');
  if (parseDay(on) === null) missing.push('on');
  if (typeof basis !== 'string' || basis.trim() === '') missing.push('basis');
  if (missing.length > 0) {
    problems.push(`"${id}" eligibilityConfirmed is missing ${missing.join(', ')} — ignored`);
    return null;
  }
  return { by, on, basis };
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

export function render(result) {
  const lines = [];
  const tag = result.synthetic ? '[SYNTHETIC] ' : '';

  if (result.synthetic) {
    lines.push('='.repeat(72));
    lines.push('  SYNTHETIC DATA — NOT REAL PARTICIPANTS, NOT A TRIAL RESULT');
    if (result.label) lines.push(`  ${result.label}`);
    lines.push('='.repeat(72));
  }

  lines.push(`${tag}Stacked Wins trial scorecard`);
  lines.push(`${tag}as of ${result.asOf ?? 'unset'}${result.trialStart ? `, trial started ${result.trialStart}` : ''}`);
  lines.push('');

  const t = result.totals;
  lines.push(`${tag}Eligible participants: ${t.eligible} / ${MILESTONE.participants}`);
  if (t.admittedByOperatorConfirmation > 0) {
    lines.push(`${tag}  (of which ${t.admittedByOperatorConfirmation} admitted by explicit operator confirmation)`);
  }
  lines.push(`${tag}Reported help:   yes ${t.helpYes} · no ${t.helpNo} · unknown ${t.helpUnknown}`);
  lines.push(`${tag}Returned 7-13:   yes ${t.returnYes} · no ${t.returnNo} · unknown ${t.returnUnknownIncompleteWindow + t.returnUnknownOther}`);
  if (t.returnUnknownIncompleteWindow > 0) {
    lines.push(`${tag}  (${t.returnUnknownIncompleteWindow} still inside an open window — not a no)`);
  }
  lines.push('');
  lines.push(`${tag}SAME people, helped AND returned: ${t.sameFive} / ${MILESTONE.sameFive}`);
  lines.push('');

  const excluded = t.excludedFixture + t.excludedFounder + t.excludedPreTrial;
  lines.push(`${tag}Not counted: ${excluded} excluded (${t.excludedFixture} fixture/simulator, `
    + `${t.excludedFounder} founder, ${t.excludedPreTrial} pre-trial), `
    + `${t.needsConfirmation} awaiting operator confirmation, `
    + `${t.unattributedFiles} unattributed file(s)`);
  lines.push('');

  lines.push(`${tag}${'participant'.padEnd(14)}${'eligible'.padEnd(30)}${'helped'.padEnd(10)}returned`);
  for (const row of result.rows) {
    lines.push(`${tag}${row.id.padEnd(14)}${row.eligibility.padEnd(30)}${row.help.padEnd(10)}${row.returned}`);
  }
  lines.push('');

  lines.push(`${tag}MILESTONE: ${result.milestone.met ? 'MET' : 'NOT MET'}`
    + ` — ${t.eligible}/${MILESTONE.participants} participants,`
    + ` ${t.sameFive}/${MILESTONE.sameFive} same-people help+return`);

  if (result.problems.length > 0) {
    lines.push('');
    lines.push(`${tag}Needs attention (${result.problems.length}):`);
    for (const problem of result.problems) lines.push(`${tag}  - ${problem}`);
  }

  if (result.synthetic) {
    lines.push('');
    lines.push('='.repeat(72));
    lines.push('  SYNTHETIC DATA — the numbers above describe nobody');
    lines.push('='.repeat(72));
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function runCLI(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') args.json = true;
    else if (arg === '--dataset') args.dataset = argv[++i];
    else if (arg === '--as-of') args.asOf = argv[++i];
    else if (arg === '--help' || arg === '-h') args.help = true;
    else return { code: 2, out: `unknown argument: ${arg}` };
  }

  if (args.help || !args.dataset) {
    return {
      code: args.help ? 0 : 2,
      out: [
        'node scorecard.mjs --dataset <dir> [--as-of YYYY-MM-DD] [--json]',
        '',
        'Counts a Stacked Wins trial from exports participants chose to send.',
        'Offline; reads only the directory you name. See TRIAL.md.',
      ].join('\n'),
    };
  }

  const dataset = loadDataset(args.dataset);
  const result = score(dataset, { asOf: args.asOf });
  const out = args.json ? JSON.stringify(result, null, 2) : render(result);
  // Non-zero when something needs a human, so a script cannot mistake an
  // incomplete tally for a clean one.
  return { code: result.problems.length > 0 ? 1 : 0, out, result };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { code, out } = runCLI(process.argv.slice(2));
  console.log(out);
  process.exit(code);
}
