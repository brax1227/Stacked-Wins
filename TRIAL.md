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

---

## Fixture data is never a user

Every record carries `source`, stored in the file rather than inferred:

| `source` | Means | Counted in trial totals |
|---|---|---|
| `real` | A person using the app | **Yes** |
| `fixture` | A test, demo, seeded or simulator record | **No** |

`TrialReport.countsAsRealUser` is false for anything but `real`, and the trial
tally must filter on it. Two rules make this hard to get wrong by accident:

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
  "firstOpen": "2026-09-18",
  "days": { "2026-09-18": { "opens": 3, "captures": 6, "brokenDown": 2, "started": 1 } }
}
```

`brokenDown` and `started` are deliberately separate keys. A version-1 file
stored a single conflated `actions`, and because nobody can now say what that
number meant, it is read as **neither** rather than being quietly promoted to
evidence (`testALegacyConflatedRecordIsNotReadAsEvidence`).

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

## Reading the result

**No number in the app can declare trial success on its own.** Success
requires a real user saying it helped *and* returning the following week.
`startEvidence` narrows who to ask and what to ask them; it does not vote.

| Outcome | What it means |
|---|---|
| 5+ report help **and the same 5** returned | Target hit. Move on to whether it lasts past two weeks. |
| High starting, low return | The help is real but not habitual. A tool for a bad week, not a product. |
| High capture, low starting | The bottleneck isn't task size. The north star is aimed wrong — re-read PROBLEM.md before building anything else. |
| Many breakdowns, few starts | The feature is being used and isn't working. People are picking first steps and not taking them, which is planning with extra steps — the failure mode `brokenDownOnly` exists to make visible instead of hiding inside an "actions" total. |
| Help reported only for already-small tasks | It's a decent list and the "too big" premise is doing no work. |
| Returns without reported help | Habit without value. The worst outcome to mistake for success. |

The last three are in [NORTH_STAR.md](./NORTH_STAR.md) as the things that would
falsify the direction. They were written down in advance on purpose.

---

## Out of scope for this trial

No paid services, no external telemetry, no recruitment or outreach performed
by the implementer, and no App Store release. The trial runs on TestFlight
builds that already exist.
