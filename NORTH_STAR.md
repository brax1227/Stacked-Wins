# North star

**Confirmed 2026-09-18** (assignment STACKED-20260918-01, authorized by Braxton).
This is the sentence every decision gets checked against. It is not a slogan:
where it conflicts with a feature request, it wins, and the conflict gets
written down rather than quietly resolved.

> **Help users start tasks that feel too big.**

Productivity is the primary category. The product should eventually be worth
paying for; nothing in it should be built in a way that depends on never
charging for it.

Read this together with [PROBLEM.md](./PROBLEM.md), which holds the user's own
words and the reasoning behind the two jobs. PROBLEM.md says *why*; this says
*what we are aiming at and how we will know*.

---

## What "start" means here

Not captured. Not organised. Not planned. **Started** — the user did a physical
thing in the world because the app made the next move small enough to begin.

The three failure modes this rules out, in order of how tempting they are:

1. **Capture that goes nowhere.** A beautifully fast inbox that fills up and is
   never acted on is a worse version of the problem, not a solution to it.
2. **Organisation as progress.** Ranking, tagging, scheduling and grooming all
   *feel* like work and produce none. Every one of them is a decision charged
   at the moment the user has least to give.
3. **Adding to the pile.** Anything that generates tasks the user did not ask
   for — suggestions, templates applied automatically, recurring items — makes
   the thing that freezes them bigger.

## Baseline and target

| | |
|---|---|
| **Baseline (2026-09-18)** | **Zero users.** One TestFlight tester, who is the author. |
| **90-day target** | **Ten trial users**, of whom **five report the app helped** and **five return the following week**. |
| **Same five** | The five who report help and the five who return are the **same five**. Two disjoint groups of five would not be evidence of anything. |

Ten is deliberately small. At this baseline the question is not "does it
scale" but "does it work for anybody at all", and that answer needs
conversations, not a dashboard.

## How we will know

Defined in [TRIAL.md](./TRIAL.md), which holds the operator rubric and the
exact definitions of *activation* and *next-week return*. Two rules from it
matter enough to repeat here:

- **Self-reported help is the primary signal.** Usage numbers can only ever
  corroborate it. An app people use and do not feel helped by has failed.
- **Fixture data is never counted as a real user.** Every record carries its
  source, and anything not marked `real` is excluded from trial totals. See
  `ActivationLog`.

## Constraints in force

- **Free resources only.** No paid services, no hosting bills, no per-use API
  costs. This is why the split assist runs on-device rather than against a
  server.
- **No external telemetry.** Measurement is local to the device, inspectable by
  the person it describes, and leaves the phone only when they choose to send
  it. Nothing phones home.
- **Never silently change user data.** Suggestions are suggestions; the stack
  changes when the user confirms, and not before.
- **Never count a plan as an action.** Breaking a task down is the user editing
  a plan. Whether they then did it happens in the world, where the app cannot
  see. Measurement stores the two separately and reports *unknown* where it is
  unknown (TRIAL.md).

## What would count against this

Worth writing down now, while it is cheap to be honest. These are the patterns
we agreed in advance to take seriously — the ones that should make us re-read
[PROBLEM.md](./PROBLEM.md) rather than explain them away:

- Trial users capture tasks and never act on them — which would suggest the
  bottleneck is not task size and "help users start" is aimed at the wrong half.
- Users act, but only on tasks that were already small — which would suggest the
  app is a decent list and the "too big" premise is not doing any work.
- Users report help but do not return — which would suggest the help is real but
  not habit-forming: a tool for a bad week rather than a product.

**None of the three falsifies the north star on its own.** Each has competing
explanations the counts cannot separate — a measurement gap, who dropped out
before day 7, what week it happened to be — and at n=10 a two-person swing moves
any of them. [TRIAL.md](./TRIAL.md) lists the competing explanations and what
would actually settle each one. Observing a pattern here means going and asking,
not concluding.
