# Release gate — trial build

**The trial cannot start on any build that exists today.** Every change the
rubric in [TRIAL.md](./TRIAL.md) depends on is unreleased and sits on a review
branch. This page is the gate between that branch and a build a trial user can
install.

**Nothing here has been executed.** No upload, no deployment, no TestFlight
submission. Assignment STACKED-20260918-03 forbids all of them, and this
document exists so the step is specified rather than improvised later.

---

## What is actually shipped versus what the rubric assumes

| | Reality |
|---|---|
| Latest build on TestFlight | **1.3.0 (68)**, uploaded 2026-09-09 from `da1444f4` |
| What it contains | The on-device "Too big" assist, capture by Siri/Shortcuts/URL, the card gestures, Wins |
| What it does **not** contain | The manual no-model fallback, **any measurement at all**, the Trial data screen |
| Consequence | A trial run on build 68 would produce **zero** activation records, and the "Just 5 minutes" fallback would not exist for testers whose phones lack Apple Intelligence — which is the population the fallback was built for |

The earlier claim in TRIAL.md that "the trial runs on TestFlight builds that
already exist" was **wrong**, and is corrected there.

## The reviewed SHA

Refreshed 2026-09-19. Any release must name the exact SHA it was built from.
"Latest main" is not an answer: the whole point of the fixture rules is that a
tally can be traced to the code that produced it.

| | |
|---|---|
| Branch | `claude/visualize-task-list-0kzjhk` (PR #23, open, **not merged**) |
| Last SHA reviewed by Codex | `14331e06855e8079ea92bdba0b017bcc0b920a69` (STACKED-20260918-02) |
| **Current candidate head** | **`__HEAD_SHA__`** (a later commit on this branch may substitute this identifier into this table and change nothing else) |
| Last commit touching iOS source | `b5045d96fad8ca31816b1283860411c7707b9f0b` — the STACKED-20260918-03 fixes (day-14 window close, build-selected source) |
| Verified CI on `b5045d9` | run [`35411722023`](https://github.com/brax1227/Stacked-Wins/actions/runs/35411722023) — success; simulator compile + test job green, **146 tests**, deployment job skipped |
| Verified CI on `14331e06` | run `35407659551` — success |

**What Codex has and has not reviewed.** Review closed at `14331e06`. Two
commits sit on top of it and are **awaiting review**:

| Commit | Contents | Touches the app binary |
|---|---|---|
| `b5045d9` | STACKED-20260918-03 review fixes in `ActivationLog`, `TrialView`, their tests, TRIAL.md, this file | **Yes** |
| `__HEAD_SHA__` | STACKED-20260919-04: `tools/trial-scorecard/` (offline Node CLI, run by the operator on a laptop), plus TRIAL.md and NORTH_STAR.md interpretation corrections | **No** — no file under `ios/` changed |

The scorecard is not shipped and cannot be: it is a Node script in `tools/`,
outside the Xcode project, and nothing in the app references it. It changes
what the operator does with an export after a participant sends it, not what
the build does.

---

## Gate: every item must pass before an upload is even proposed

### 1. Code review closed
- [ ] Codex has reviewed the head SHA, not merely an ancestor of it
- [ ] Findings from -02 and -03 confirmed fixed in the reviewed SHA
- [ ] PR #23 approved and merged by a human — **the implementer does not merge**

### 2. Automated checks on the exact SHA
- [ ] macOS `compile-check` green; record the run id and the executed/failed counts
- [ ] `#warning` guard in `OnDeviceSplitAssist` **absent** from the log (proves the on-device path compiled rather than being `#if`'d out)
- [ ] Preflight version check passes: `MARKETING_VERSION` strictly above every version already on App Store Connect

### 3. Device validation — none of this is coverable by CI

CI runs a simulator. A simulator now deliberately writes **fixture** records,
so it cannot validate the measurement path end to end. Each item below needs a
real phone and a human watching.

**On a phone WITHOUT Apple Intelligence** (the fallback's whole reason to exist):
- [ ] "Too big" shows **Just 5 minutes** and the opener chips
- [ ] "Suggest steps" is **absent** — not present-and-failing
- [ ] Tapping "Just 5 minutes" fills the editor with `spend 5 minutes on <card>` and leaves it **editable**
- [ ] Editing the number to something else and confirming produces exactly the edited text
- [ ] Tapping an opener appends a stem without destroying text already typed
- [ ] **"Never mind" leaves the stack byte-identical** — count cards before and after

**On a phone WITH Apple Intelligence:**
- [ ] "Suggest steps" appears and returns steps, or fails to the written fallback message
- [ ] Suggested steps land in the editor and **nothing is written until "Break it up"**

**Measurement, on a real device with a release build:**
- [ ] ⋯ → **Trial data** reads **"Counted as a real trial user"** — proving `currentSource()` resolved to `.real` off a simulator
- [ ] The same screen on a simulator or debug build reads **"excluded"**
- [ ] Break a card down without marking anything done → **"unknown — planned a step, no evidence they did it"**
- [ ] Mark a card done → **"started something"**
- [ ] The raw JSON shown contains only `version`, `source`, `environment`, `firstOpen`, `days` — and no task text
- [ ] Copy works; Delete removes the record and **leaves the stack untouched**

**Haptics, gestures, Siri** — unverifiable in CI, all of it:
- [ ] Card drags and leaves in the direction thrown; the stamp matches the move
- [ ] Clearing feels different from the other three moves
- [ ] "Add to Stacked Wins" by voice adds a card without opening the app
- [ ] `stackedwins://add?text=hello` opens the dump box already holding `hello`

### 4. Release mechanics
- [ ] `MARKETING_VERSION` bumped in `ios/project.yml` — it may only go **up** (1.3.0 is live; 0.2.0 was already rejected once for going backwards)
- [ ] A human dispatches the `testflight` job. **The implementer does not.**
- [ ] `builds` run afterwards confirms the new build is `VALID` / `IN_BETA_TESTING` and in the tester group

### 5. Trial bookkeeping before recruiting anyone
- [ ] Trial start date recorded, and it is **after** the build's upload date
- [ ] The author's own device recorded as excluded, with its `firstOpen` noted
- [ ] Every tester told, in plain words, what the app records and that they can read and delete it
- [ ] A dataset directory created for the real trial with `trialStart` set, the author's export filed under `"founder": true`, and **no** `DATASET.json` declaring it synthetic
- [ ] `node tools/trial-scorecard/demo.mjs` and `node --test 'tools/trial-scorecard/*.test.mjs'` both pass on the machine the operator will tally on

---

## Who does what

| Step | Who |
|---|---|
| Implementation, tests, this checklist, the offline scorecard | Claude |
| Code review, approval | Codex |
| Merge, version bump, dispatch, recruiting, tallying real exports | **A human — Braxton** |

The implementer proposing a release and the implementer performing it are
different things. Everything above stops at "proposed".
