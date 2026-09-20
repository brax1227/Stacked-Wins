# Trial rubric

How we find out whether [the north star](./NORTH_STAR.md) is being hit.
Written before the trial runs, so the bar can't move afterwards.

**Target, restated:** within 90 days of 2026-09-18, ten trial users, of whom
**the same five** both report the app helped and come back the following week.

**Baseline:** zero users. One TestFlight tester, who is the author, and whose
device is **not** a trial user (see *Excluding ourselves*).

---

## The two definitions

Both are computed by `TrialReport` from `ActivationLog`, on the user's own
phone. The computation is mechanical — but one of its answers is deliberately
**unknown**, and resolving that is a conversation, not a calculation.

### Starting — "they did something", with unknown allowed

Three states, not two. `report.startEvidence`:

| State | Means | Counts as started |
|---|---|---|
| `nothingYet` | No plan, no evidence | No |
| `brokenDownOnly` | They picked a first step and confirmed it. Nothing since says whether they did it | **Unknown — ask them** |
| `started` | A card was marked done | Yes |

`report.daysToFirstStart` gives the lag from first open (`0` = same day).

**Breaking a task down is not starting it.** It is the user editing a plan.
Counting it as action would be measuring our own feature being used and
calling it the user's life improving — the exact self-deception this product
exists to interrupt. `totalBrokenDown` and `totalStarted` are stored as
separate numbers that are never summed
(`testSelectingAFirstStepWithoutStartingIsNotEvidence`,
`testNoAmountOfPlanningEverBecomesEvidence`).

**Capture is not starting either.** Putting things down is Job 1, but a full
inbox nobody acts on is the problem, not evidence of fixing it
(`testCaptureAloneIsNotStarting`).

**`brokenDownOnly` is not a no.** A user who planned a step and hasn't been
asked yet is an open question, not a failure. Record it as unknown in the
sheet and resolve it with the one question below. Scoring unknowns as
failures would understate the product; scoring them as successes would
invent evidence. Do neither.

#### What "marked done" is actually worth

It is an explicit act — the user tapped Done on a specific card — and it is
the strongest signal available without asking them anything. It is still a
**proxy**: someone can tick off a thing they did before opening the app, or
tick off nothing while doing plenty. Treat it as corroboration for the
interview, never as the verdict.

### Next-week return — "it wasn't a one-off"

> Any activity on a day **7 to 13 days** after first open.

`report.returnedNextWeek`. A window, not a point, because "the following week"
is a week. Day 3 is the same week and does not count; day 20 is a fortnight
later and does not count either.

`report.nextWeekWindowComplete` says whether the window has actually elapsed,
so a trial still in progress reads as **"too early to say"** rather than a
failure. A user on day 5 has not failed to return.

**A day dated after today is not evidence today.** A record can legitimately
hold one — a clock set forward and corrected, a flight across the date line, a
device restored from a backup — and counting it would let a day that has not
happened answer a question about one that has. `TrialReport` drops such days
from the report and not from the file, so they count in full once the date
reaches them (`testADayDatedAfterTodayIsNotAReturn`,
`testTheSameDayCountsOnceTheDateReachesIt`, `testTodayCountsAndTomorrowDoesNot`,
`testAFutureDayIsNotEvidenceOfStarting`). The scorecard applies the same rule
against its as-of date.

**The window closes at the start of day 14, not during day 13.** Day 13 is the
last eligible day and stays open for the whole of it; an earlier version
closed at `elapsed >= 13` and so declared the question answered at 00:00 on
day 13, turning anyone who came back that afternoon into a recorded *no*. The
comparison is date-to-date, which also keeps it exact across a daylight-saving
change, where a day is 23 or 25 hours long
(`testTheWindowIsStillOpenAtTheVeryEndOfTheLastEligibleDay`,
`testTheWindowClosesAtTheStartOfTheDayAfterTheLastEligibleOne`,
`testTheBoundaryHoldsAcrossADaylightSavingChange`).

---

## Fixture data is never a user

Every record carries `source`, stored in the file rather than inferred:

| `source` | Means |
|---|---|
| `real` | Written by a release build on real hardware |
| `fixture` | A test, demo, seeded or simulator record |

### The tally filters on eligibility, not on source

`source` says what a record claims; **`TrialReport.eligibility` says whether it
may be counted**, and it has three values because two would force a guess:

| Eligibility | When | In the tally |
|---|---|---|
| `eligible` | `real` source, written by a release build on real hardware | **Counted** |
| `excluded` | Any fixture — simulator, debug build, demo, test | **Never counted** |
| `needsOperatorConfirmation` | A `real` source with **no environment recorded**, i.e. written before the app tracked which kind of build it was | **Counted only once a person vouches for it by name** |

The third exists because history is not rewritten. A pre-existing `real`
record keeps its source — it is not silently reclassified into test data — but
it also cannot walk into a tally unexamined, because it might be one of our
own simulator runs from before selection existed. Record it in the sheet as
unconfirmed and resolve it the same way an unknown start is resolved: ask.

### The build picks its own source

`ActivationLog.shared` no longer defaults to `real`. `currentEnvironment()`
resolves at compile time and `source(for:)` maps it:

| Build | Source |
|---|---|
| Release on a device | `real` |
| Simulator | `fixture` |
| Debug build | `fixture` |

So a simulator run cannot masquerade as a participant even if nobody
remembers to say so — which was the gap between this document's promise and
what production actually did. Tested at the boundary itself
(`testOnlyARealDeviceBuildProducesARealSource`,
`testTheRunningBuildSelectsItsOwnSourceHonestly`,
`testALogConstructedWithNoSourceArgumentStampsTheBuildsVerdict`), not only
through fixtures passed in by hand. On the CI simulator run, the second of
those asserts the build calls *itself* a fixture.

Two further rules make this hard to get wrong by accident:

- A record that starts `real` **cannot be downgraded** by a later fixture-sourced
  write. A real trial user can't be reclassified into test data.
- A record that starts `fixture` **cannot be promoted** by a later real write.
  Seeded data stays seeded.

Both are tested (`testARealRecordIsNotDowngradedByALaterFixtureWriter`,
`testAFixtureRecordIsNotPromotedByALaterRealWriter`).

**Why this is load-bearing:** at n=10, two or three miscounted records is the
difference between "it works" and "it doesn't". A number that quietly includes
the developer's own simulator runs looks like evidence and is not.

### Excluding ourselves

The author's own device has months of use and is not a trial user. When
tallying, exclude any export whose `firstOpen` predates the trial start, and
say in the tally how many were excluded and why. Do not delete them — a
discarded record you can't produce later is indistinguishable from one that
never existed.

---

## What the app records

Dates and integers. Nothing else.

```json
{
  "version": 2,
  "source": "real",
  "environment": "device",
  "firstOpen": "2026-09-18",
  "days": { "2026-09-18": { "opens": 3, "captures": 6, "brokenDown": 2, "started": 1 } }
}
```

`brokenDown` and `started` are deliberately separate keys. A version-1 file
stored a single conflated `actions`, and because nobody can now say what that
number meant, it is read as **neither** rather than being quietly promoted to
evidence (`testALegacyConflatedRecordIsNotReadAsEvidence`).

`environment` is one of three fixed build kinds — `device`, `simulator`,
`debugBuild` — and describes the build, never the person or the hardware
model. Its absence means the record predates source selection.

No task text. No card ids. No device identifier. No times of day — only dates,
which is why `testTheFileHoldsDatesAndCountsAndNothingElse` greps the written
file for anything timestamp-shaped and fails if it finds one.

It lives on the phone, in the app's own folder. **Nothing is transmitted.**
There is no analytics SDK and no endpoint to send to. A trial user sends their
data by opening **⋯ → Trial data**, reading the whole thing, and copying it to
the operator by hand. They can also delete it there, which leaves the stack
untouched.

---

## Running the trial

Ten people. Keep it to ten: at this baseline the question is "does this work
for anybody", and that answer comes from conversations, not a funnel.

**Per user, record in a sheet:** a pseudonym, install date, whether their phone
has Apple Intelligence (it changes which help they get — see *Two variants*
below), and the two answers at the end.

1. **Day 0.** They install and use it with no walkthrough. Watching someone's
   first two minutes unprompted is worth more than the rest of the trial;
   don't rescue them.
2. **Day 7–13.** Ask for the export and the one question. Don't remind them
   to use the app before asking — a return you prompted isn't a return.

**The one question**, asked exactly this way and not leading:

> "Did this help you start anything you'd been putting off? If yes, what?"

This is also how a `brokenDownOnly` unknown gets resolved. There is **no
in-app survey and no prompt asking the user to confirm every action** — that
would tax the one screen this product keeps clear, and people under-report
anyway. The app reports what it can see and says "unknown" for the rest; a
person asks about the rest.

A *yes* counts only with a specific task named. "Yeah it's nice" is a no.
Enthusiasm about the idea is not evidence about the product.

**Record verbatim.** The sentence someone uses about their own stuck task is
worth more than the counts, and it's the thing that will tell us whether the
premise is wrong.

---

## Two variants, by accident

Phones without Apple Intelligence get the manual fallback only (timebox and
openers); phones with it also get model-written suggestions. This is not a
designed A/B test and shouldn't be reported as one — assignment is by hardware,
not randomised, and n is far too small. But **record which each user had**,
because if the five who report help are all on one side of that line, that is
the most interesting thing the trial could tell us.

---

## Counting it: the operator scorecard

[`tools/trial-scorecard/`](./tools/trial-scorecard/README.md) does the
arithmetic offline, on a folder of exports participants chose to send plus the
operator's pseudonymous notes. It is a counting tool: no network, no
collection, no device access, nothing identifying read or written.

```
node tools/trial-scorecard/scorecard.mjs --dataset <dir>
node tools/trial-scorecard/demo.mjs      # proves the awkward cases, on synthetic data
```

It exists because the milestone is easy to *appear* to hit. It counts distinct
eligible people, not files; it holds back the same export filed under two
pseudonyms; it excludes fixtures, simulator runs and the author's own device;
it never promotes a record with missing provenance; and it intersects help and
return on the **same** people rather than adding two fives together. Anything
it cannot settle comes out as `unknown` and exits non-zero, so an incomplete
tally cannot be mistaken for a clean one.

**Every tally is as of a date, and nothing after that date answers for it.**
An export arrives later than the days it describes, so a tally of week one run
in November is reading days the operator could not have seen in September.
Activity, answers and confirmations dated after the checkpoint are skipped and
reported there, and counted in full at a checkpoint that reaches them — so
re-running a past date gives the same answer it gave at the time, and a
participant who had not installed the app yet is not counted as one.

What it does not do is interpret. See below.

---

## Reading the result

**No number in the app can declare trial success on its own.** Success
requires a real user saying it helped *and* returning the following week.
`startEvidence` narrows who to ask and what to ask them; it does not vote.

### One outcome is decisive; the rest are leads

| Outcome | What it means |
|---|---|
| 5+ report specific help **and the same 5** returned | **The milestone is hit.** It is the bar we set in advance and it stands. What it is *not* is proof the product works in general: ten self-selected people, no control group, no blinding, and an operator who wants a yes. The next question is whether it survives past two weeks and past people who know us. |

Every other pattern below is a **diagnostic observation**: a place to point the
next conversation, not a verdict. Each has at least two explanations that the
numbers alone cannot separate, and at n=10 a two-person swing moves any of them.

| Observation | Explanations it cannot separate | What would actually tell us |
|---|---|---|
| High starting, low return | (a) The help is real but occasional — a tool for a bad week. (b) They stopped needing it for a while. (c) They forgot the app exists; nothing prompts them. (d) The window landed on a holiday or a deadline. | Ask the ones who didn't return *why*, without suggesting an answer. Absence of a return is not a report of no value. |
| High capture, low starting | (a) The bottleneck isn't task size, so the north star is aimed at the wrong thing. (b) It **is** task size and the breakdown feature is bad at addressing it. (c) They start things and don't mark them done, so we can't see it. | (c) is a measurement gap and must be ruled out first — ask whether they did anything they didn't tick. Only then is this evidence about the premise. |
| Many breakdowns, few starts | (a) People pick first steps and don't take them — planning with extra steps. (b) The first steps we produce are still too big. (c) They took them and didn't tick. | Read the first steps they kept. If they are still vague, that is a feature problem, not a premise problem. |
| Help reported only for already-small tasks | (a) The "too big" premise is doing no work and this is a decent list. (b) The people who brought big tasks bounced before the breakdown ever ran. | Check what they actually captured, and who dropped out before day 7. A premise can't be tested by the people who left. |
| Returns without reported help | (a) Habit without value — the outcome most dangerous to mistake for success. (b) Value they can't articulate, or wouldn't say to our face. (c) They came back because we asked them for an export. | Do not score this as either. Ask what they were doing when they opened it. A prompted return isn't a return. |

**None of these rows falsifies the north star by itself, and none confirms it.**
They are written down in advance so that whatever comes back is read against a
bar set before the data existed, not against a story built afterwards. The
rows that would make us re-read [PROBLEM.md](./PROBLEM.md) hardest — high
capture with low starting, and help only on small tasks — appear in
[NORTH_STAR.md](./NORTH_STAR.md) for exactly that reason. Appearing there
means they are the things we agreed to take seriously, not things a number
proves.

Two rules that hold whatever the counts say:

- **A count is never a cause.** Nothing here establishes that the app caused a
  start, a return, or a habit. Ten unrandomised, unblinded, self-selected
  people, measured by a proxy, with the maker asking the questions. The
  verbatim sentences are the evidence; the counts say who to talk to.
- **Unknown stays unknown.** An unresolved `brokenDownOnly`, an open return
  window and an unasked question are three different kinds of missing, and none
  of them is a no. Reporting them as failures understates the product;
  reporting them as successes invents evidence.

---

## The trial cannot start on any build that exists today

**Correcting an earlier version of this document, which said the trial runs on
TestFlight builds that already exist. It does not.**

The newest build on TestFlight is **1.3.0 (68)**, from `da1444f4`. It contains
none of this: no manual fallback, **no measurement at all**, no Trial data
screen. A trial run on it would produce zero activation records, and testers
whose phones lack Apple Intelligence — exactly the people the fallback was
built for — would still get an empty box.

[RELEASE_GATE.md](./RELEASE_GATE.md) holds the reviewed SHA, the device
validation checklist, and the gate. Nothing in it has been executed: no
upload, no deployment, no submission.

## Out of scope for this trial

No paid services, no external telemetry, and no recruitment or outreach
performed by the implementer. Merge, version bump, release dispatch and
recruiting are a human's to do.
