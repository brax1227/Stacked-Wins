# Trial scorecard

An offline counting tool for the trial described in [TRIAL.md](../../TRIAL.md).
It answers one question — *are there ten eligible participants, and did the
**same five** both report specific help and come back on days 7–13?* — from
exports participants chose to send, plus the operator's own pseudonymous notes.

It is **not** a collector. It opens files a person already put in a folder. No
network calls, no credentials, no device access, no recruiting. Node 22, zero
dependencies.

```
node tools/trial-scorecard/scorecard.mjs --dataset <dir> [--as-of YYYY-MM-DD] [--json]
```

Exit code is `1` whenever anything needs a human, so a script cannot mistake an
incomplete tally for a clean one.

## Prove it works

```
node tools/trial-scorecard/demo.mjs
```

One command, four synthetic datasets, and an assertion on every awkward case:

| Proof | What it shows |
|---|---|
| 5 helped, a **different** 5 returned | 10 participants, `sameFive: 0`, **milestone NOT met** |
| 12 export files, 7 pseudonyms | 5 eligible people — repeats don't inflate, and identical content under two names is held back |
| Day 13 vs day 14 | Day 13 counts, day 14 doesn't, an unelapsed window is **unknown** rather than a no |
| Nothing asked, nobody signed | Missing benefit stays **unknown**; fixtures, founder data and unclaimed files stay out |

Unit tests underneath it:

```
node --test 'tools/trial-scorecard/*.test.mjs'
```

## Dataset format

A dataset is a directory:

```
my-trial/
  DATASET.json        optional descriptor
  annotations.json    the operator's notes — and the only place ownership is declared
  <anything>.json     the exports participants sent
```

### `DATASET.json`

```json
{ "synthetic": true, "label": "Five helped, a different five returned." }
```

Omit it, or set `synthetic: false`, for real data. A synthetic dataset prints a
banner above and below its output and prefixes every line with `[SYNTHETIC]`.
Fixture directories here are all named `synthetic-*`, as is every file inside
them, and a test fails if that ever stops being true.

### An export

Exactly what the app's **⋯ → Trial data → Copy** produces. Dates and integers,
nothing else:

```json
{
  "version": 2,
  "source": "real",
  "environment": "device",
  "firstOpen": "2026-09-20",
  "days": { "2026-09-20": { "opens": 3, "captures": 6, "brokenDown": 2, "started": 1 } }
}
```

Any key outside `version`, `source`, `environment`, `firstOpen`, `days` is a
hard problem, not a warning — an unexpected key is how task text or a device
identifier would arrive. Malformed files are reported and left out rather than
repaired: a trial of ten cannot afford a silently patched record.

### `annotations.json`

```json
{
  "trialStart": "2026-09-20",
  "asOf": "2026-11-01",
  "participants": {
    "p01": {
      "exports": ["p01-week2.json", "p01-week1.json"],
      "reportedHelp": "yes",
      "confirmedBy": "braxton",
      "confirmedOn": "2026-10-20"
    },
    "p07": {
      "exports": ["p07.json"],
      "founder": true
    },
    "p09": {
      "exports": ["p09.json"],
      "eligibilityConfirmed": {
        "by": "braxton",
        "on": "2026-10-21",
        "basis": "known tester; watched them install the release build"
      }
    }
  }
}
```

| Field | Meaning |
|---|---|
| `trialStart` | Anyone whose `firstOpen` predates it is excluded as pre-trial |
| `asOf` | The day the tally is being taken. `--as-of` overrides it |
| `participants.<pseudonym>` | A person. The key is a pseudonym the operator chose — never a name, email or device |
| `.exports` | The files this person sent. **Ownership is declared here and nowhere else** |
| `.reportedHelp` | `yes` \| `no` \| `unknown` — the answer to the one question |
| `.confirmedBy` / `.confirmedOn` | Who heard the answer and when. Without both, the answer is downgraded to `unknown` |
| `.founder` | `true` excludes the record as author/founder data |
| `.eligibilityConfirmed` | `{by, on, basis}` — admits a record that would otherwise be held back |

## The rules it is built around

**Nothing is inferred.** A file nobody claims is not a user; it is reported as
unattributed and counted as nobody. A participant reported help only because
an operator wrote down that they said so, with a name and a date against it.
An unsigned `"yes"` becomes `unknown`, and so does an unsigned `"no"` — the
rule is not one-sided. Absence is always `unknown`, never `no`.

**A confirmation has somebody's name on it.** `eligibilityConfirmed: true` is
rejected outright, as is any object missing `by`, `on` or `basis`. Nothing in
this tool admits a record on an inference.

**Missing provenance is never promoted.** A `real` export with no
`environment` predates source selection in the app and might be one of our own
simulator runs. It is neither reclassified into test data nor walked into the
tally: it reads `needs-operator-confirmation` until a person vouches for it.
Founder and fixture exclusions are not overridable by a confirmation at all.

**Repeats don't inflate.** Exports are cumulative snapshots, so several from
one person merge into one record (highest count per day, union of days) and
sending the same file twice changes nothing. Disagreement about `firstOpen`,
`source` or `environment` between two exports filed under one pseudonym is
reported as a conflict rather than resolved by picking one.

**The same content under two pseudonyms is held back, not counted twice.**
Detected by content hash, not filename. Identical counts are suspicious rather
than conclusive — the export carries no identifier by design, so two quiet
people can genuinely collide — and both are held for a human, who can attest
they are different people with an `eligibilityConfirmed` on each.

**Synthetic data cannot touch a real total.** The descriptor is the single
thing that decides, and everything derived from a synthetic dataset says so in
every line. `demo.mjs` refuses to run against a dataset that is not declared
synthetic.

**The window is days 7–13 inclusive and closes at the start of day 14**, so the
whole of day 13 still counts. A participant on day 5 has not failed to return:
the answer is `unknown` with `incompleteWindow`, counted separately from the
nos. Arithmetic is date-to-date over UTC midnights, which stays exact across a
daylight-saving change.

**Nothing identifying is read or emitted.** Pseudonyms, dates and counts. No
task text, no contact details, no device identifiers — an export containing any
of them fails validation instead of being trimmed.

## What it cannot tell you

It counts. It does not decide whether the north star is right. Five people
saying "yes, this got me to finally call the dentist" is the evidence; the
scorecard only makes sure that five is five real distinct people and not the
same export twice, a simulator run, or an operator's optimism about a `yes`
nobody wrote down.
