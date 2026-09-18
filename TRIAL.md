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
phone. Neither is a judgement call.

### Activation — "they started something"

> The user got at least one card to a **first action**: cleared it, or broke it
> down and confirmed the pieces.

`report.activated`, with `report.daysToActivation` giving the lag from first
open (`0` = same day).

**Capture is explicitly not activation.** Putting things down is Job 1, but a
full inbox nobody acts on is the problem this product exists to fix, not
evidence of fixing it. `testCaptureAloneIsNotActivation` pins this.

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
  "version": 1,
  "source": "real",
  "firstOpen": "2026-09-18",
  "days": { "2026-09-18": { "opens": 3, "captures": 6, "actions": 2 } }
}
```

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

| Outcome | What it means |
|---|---|
| 5+ report help **and the same 5** returned | Target hit. Move on to whether it lasts past two weeks. |
| High activation, low return | The help is real but not habitual. A tool for a bad week, not a product. |
| High capture, low activation | The bottleneck isn't task size. The north star is aimed wrong — re-read PROBLEM.md before building anything else. |
| Help reported only for already-small tasks | It's a decent list and the "too big" premise is doing no work. |
| Returns without reported help | Habit without value. The worst outcome to mistake for success. |

The last three are in [NORTH_STAR.md](./NORTH_STAR.md) as the things that would
falsify the direction. They were written down in advance on purpose.

---

## Out of scope for this trial

No paid services, no external telemetry, no recruitment or outreach performed
by the implementer, and no App Store release. The trial runs on TestFlight
builds that already exist.
