# Release gate — trial build

**The trial cannot start on any build that exists today.** Every change the
rubric in [TRIAL.md](./TRIAL.md) depends on is unreleased and sits on a review
branch. This page holds two things:

1. **The ledger** — the immutable facts about what exists, verified against
   GitHub's own records rather than remembered.
2. **The readiness packet** — what is still missing, in the only order it can
   actually happen, and who decides each step.

**Nothing here has been executed.** No upload, no dispatch, no tag, no version
change, no credential or account action. Every assignment through
STACKED-20260920-05 forbids all of them, and this document exists so the steps
are specified rather than improvised later.

---

# 1. The ledger

Append-only. A row is a fact with a source; when a row turns out to be wrong it
is **corrected in the open** (see *Corrections*) rather than edited away,
because a record you can silently rewrite is not evidence.

## 1.1 The release candidate

| | |
|---|---|
| Branch | `claude/visualize-task-list-0kzjhk` (PR #23, open, **not merged**) |
| **Candidate head** | **`6fc88849468b05434a93637ac1d6fba02e18a9fb`** |
| Base | `origin/main` = `edf40c1086c9ea659981dd428f4e13174566e7ca` |
| Relationship | The branch is a **strict descendant** of `main`; 7 commits ahead, 0 behind, no divergence |
| Scope vs `main` | 63 files, +5305 / −21. 12 under `ios/`, the rest tooling and documents |

**The candidate SHA changes when you merge**, and the release must be built
from whatever SHA ends up on `main`:

| Merge method | Resulting SHA | CI on it |
|---|---|---|
| Fast-forward (possible here, no divergence) | **`6fc8884` unchanged** — CI below carries over exactly | none needed |
| Merge commit (GitHub's default button) | a **new** SHA | must re-run before upload |
| Squash or rebase | a **new** SHA, and the history above stops matching | must re-run before upload |

Fast-forward is the only method that keeps this ledger valid without a re-run.
Any other method means the merged SHA gets its own ledger row.

## 1.2 Commits on the candidate, and what verified each

| Commit | What it is | Touches `ios/` | CI run | Result |
|---|---|---|---|---|
| `8be46e1` | -01: no-model path from "too big" to one small step, plus local measurement | Yes | [`35402450442`](https://github.com/brax1227/Stacked-Wins/actions/runs/35402450442) | success, 123 tests |
| `14331e0` | -02: a plan is not an action — intent and evidence separated | Yes | [`35407659551`](https://github.com/brax1227/Stacked-Wins/actions/runs/35407659551) | success, 133 tests |
| `b5045d9` | -03: return window closes at day 14; the build picks its own source | Yes | [`35411722023`](https://github.com/brax1227/Stacked-Wins/actions/runs/35411722023) | success, 146 tests; `preflight` and `testflight` **skipped** |
| `c52b7dc` | -04: offline operator scorecard; TRIAL.md interpretations corrected | No | — | covered by the run below |
| `31f968a` | -04: SHA substitution in this file, nothing else | No | [`35476317137`](https://github.com/brax1227/Stacked-Wins/actions/runs/35476317137) | success, 146 tests; both release jobs **skipped** |
| `141e3a0` | -04 correction: the as-of cutoff, in the scorecard **and** in `TrialReport` | Yes | — | covered by the run below |
| **`6fc8884`** | -04: SHA substitution in this file, nothing else | No | [**`35477904737`**](https://github.com/brax1227/Stacked-Wins/actions/runs/35477904737) | **success, 150 tests, `preflight` and `testflight` skipped** |

**The candidate's CI match:** run `35477904737`, head SHA
`6fc88849468b05434a93637ac1d6fba02e18a9fb` — the exact candidate head, not an
ancestor. `compile-check` succeeded (150 executed, 0 failures); `preflight` and
`testflight` were skipped, so no credential touched that run.

Off-CI, on this Linux session: 125 XCTest cases in the Foundation-only slice,
53 Node tests and `demo.mjs` for the scorecard. Those are a faster inner loop,
not a substitute — the macOS run above is the check that counts.

## 1.3 Review status

| Reviewed | By | Outcome |
|---|---|---|
| `14331e06` | Codex | accepted (-02 findings closed) |
| `b5045d9` | Codex | **accepted** — -03 corrections confirmed |
| `141e3a0` | Codex (PM, STACKED-20260920-05) | **accepted** — as-of cutoff, verified independently with 53 Node tests, and run `35477904737` verified independently |
| `c52b7dc`, `31f968a`, `6fc8884` | — | documents and SHA substitution; no app code |

**Every commit on the candidate that touches `ios/` has been reviewed and
accepted.** No code review is outstanding.

## 1.4 What is actually live on TestFlight

| | |
|---|---|
| Newest build | **1.3.0 (75)** |
| Built from | `da1444f4` (Merge #21) |
| Uploaded | 2026-09-10, run [`34430246976`](https://github.com/brax1227/Stacked-Wins/actions/runs/34430246976) — `testflight` job success, artifact `StackedWins-ipa-75` |
| Previous | 1.2.0 (68) from `dea9a7b4`, 2026-09-09, run `34412926638` |
| Most recent dispatch of any kind | run 75. Nothing has been dispatched since |

**What 1.3.0 (75) contains:** the on-device "Too big" assist, capture by
Siri/Shortcuts/URL, the card gestures, Wins.

**What it does not contain:** the manual no-model fallback, **any measurement
at all**, the Trial data screen. A trial run on it would produce **zero**
activation records, and the "Just 5 minutes" fallback would not exist for
testers whose phones lack Apple Intelligence — which is the population the
fallback was built for.

## 1.5 Corrections to earlier ledger entries

| Was recorded | Actually | How it was checked |
|---|---|---|
| "Latest build on TestFlight: **1.3.0 (68)**, uploaded 2026-09-09 from `da1444f4`" | Two different uploads conflated. `da1444f4` produced **1.3.0 (75)** on **2026-09-10**; **(68)** was **1.2.0** from `dea9a7b4` on 2026-09-09 | The build number is `CURRENT_PROJECT_VERSION=${{ github.run_number }}`, so run 68 → build 68 and run 75 → build 75. `git show dea9a7b4:ios/project.yml` says `MARKETING_VERSION: "1.2.0"`; `da1444f4` says `1.3.0`. Run 75's job log names artifact `StackedWins-ipa-75` |
| "Review closed at `14331e06`; `b5045d9` and later await review" | Stale. `b5045d9` and `141e3a0` have both been reviewed and accepted | STACKED-20260920-05, and the -03 assignment that closed `b5045d9`'s findings |
| Gate ordering: device validation before an upload is proposed | **Impossible as written** for this project — see §3.1 | Nobody on the project has a Mac, and without one TestFlight is the only way onto a phone |

Why the build-number error mattered: the next upload's build number is the
workflow run number, and the preflight guard compares versions. Planning
against "68" would have understated what is already on App Store Connect.

---

# 2. Evidence: covered versus genuinely missing

The point of this section is to stop anyone re-testing what CI already proves,
and to be exact about the short list that it cannot.

## 2.1 Already evidenced — do not re-test by hand

| Behaviour | Evidenced by |
|---|---|
| The app compiles and its unit tests pass on iOS 17+ | run `35477904737`, 150 tests |
| The on-device model path genuinely compiled (not `#if`'d out) | the `#warning` guard in `OnDeviceSplitAssist` did not fire in that run |
| A simulator build calls itself a **fixture** | `testTheRunningBuildSelectsItsOwnSourceHonestly`, asserted on the CI simulator itself |
| The source/environment mapping, in all three directions | `testOnlyARealDeviceBuildProducesARealSource`, `testALogConstructedWithNoSourceArgumentStampsTheBuildsVerdict` |
| A real record can't be downgraded; a fixture can't be promoted | `testARealRecordIsNotDowngradedByALaterFixtureWriter`, `testAFixtureRecordIsNotPromotedByALaterRealWriter` |
| The return window's edges: days 6, 7, 13, 14, and across a DST change | six `testTheWindow…` cases |
| Nothing dated after today is evidence today | `testADayDatedAfterTodayIsNotAReturn`, `testTodayCountsAndTomorrowDoesNot`, `testAFutureDayIsNotEvidenceOfStarting` |
| A plan never becomes an action | `testSelectingAFirstStepWithoutStartingIsNotEvidence`, `testNoAmountOfPlanningEverBecomesEvidence` |
| The stored file holds dates and counts and nothing else | `testTheFileHoldsDatesAndCountsAndNothingElse` |
| The timebox and the openers: text produced, length caps, refusal to re-wrap | 19 `ManualFirstStepTests` |
| A one-piece split replaces the card instead of adding to the pile | `LocalStackStoreTests` |

## 2.2 Genuinely missing, and only a device can supply it

CI runs a **simulator**, and a simulator now deliberately writes `fixture`
records — by design, which is exactly why it cannot validate the measurement
path end to end.

| Missing | Why CI can't have it |
|---|---|
| A build that stamps itself `real` and reads "counted as a real trial user" | requires **Release configuration on physical hardware**; see §3.2 |
| The "Too big" sheet on a phone **without** Apple Intelligence | hardware capability, not simulatable |
| The "Too big" sheet on a phone **with** Apple Intelligence, returning real steps | the model is not on a CI runner |
| Gestures, haptics, the card leaving in the direction thrown | no touch input in `xcodebuild test` |
| Siri phrase, Shortcut, and `stackedwins://add` from outside the app | needs the system to route it |
| TestFlight install, tester group membership, the Update prompt | only exists after an upload |

**No device-only behaviour has been observed by anyone. Nothing in this
document claims it has.**

---

# 3. The readiness packet

## 3.1 The sequencing defect in the previous version of this gate

The previous gate required device validation **before** an upload could be
proposed. With no Mac on the project, the only way to get a build onto a phone
is TestFlight — so that ordering made the trial unstartable: validation waited
on a build, and the build waited on validation.

The fix is not to weaken the gate. It is to notice that there are **two
different decisions** being treated as one:

| | Decision | Risk | Gated on |
|---|---|---|---|
| **A** | Produce a build and install it **on the author's own phone** | Internal only. No outreach, no external tester, no App Store submission. The author's own device is already excluded from trial totals by `founder: true` and the pre-trial rule | review complete (it is) + merged SHA + green CI on that SHA |
| **B** | **Start the trial** — recruit and hand the build to real people | This is the irreversible one: other people's time and attention | everything in §3.3 actually observed on a device |

Approval A buys the evidence that Approval B needs. Collapsing them is what
made the old ordering circular.

## 3.2 A finding that changes what "device validation" means

The scheme's **Run** configuration is Debug and CI tests with
`-configuration Debug`. `currentEnvironment()` resolves at compile time:
simulator → `fixture`, `DEBUG` → `fixture`, otherwise → `real`.

So **a Debug build on a real phone still writes `fixture` records.** Plugging a
phone into Xcode and pressing Run does *not* validate the measurement path.
Only a **Release-configuration build on hardware** can — which means either a
TestFlight build, or Xcode with the scheme's Run configuration switched to
Release. Every measurement check below must name which build it was run on, or
it proves nothing.

(If a Debug build on a device ever reads "counted as a real trial user", that
is itself a finding — it would mean `DEBUG` is not defined in the Debug
configuration — and it is visible on the same screen at the same moment.)

## 3.3 The order, and who does each step

| # | Step | Who | Blocked by |
|---|---|---|---|
| 1 | Candidate exists, reviewed, CI green on its exact SHA | — | **done**: §1.1–1.3 |
| 2 | Merge PR #23. Fast-forward keeps the ledger valid; any other method needs a fresh CI run on the merged SHA | **Braxton** | nothing |
| 3 | Decide the version. `1.3.0` is live, so the next build must not go *below* it. Equal is allowed — the preflight guard only fails a **strictly lower** version, and TestFlight offers a higher build of the same version — but **1.4.0 is the better choice**, so a tester's export can be traced to a build by version alone | **Braxton** | 2 |
| 4 | **Approval A**, then dispatch `testflight` from `main`. Build number will be the run number, which must exceed 75 (it will: runs only go up) | **Braxton** — the implementer does not dispatch | 2, 3 |
| 5 | `builds` run confirms the new build is `VALID` / `IN_BETA_TESTING` and in the internal group | Braxton | 4 |
| 6 | Install on the author's own phone and work through §3.4 | Braxton | 5 |
| 7 | Record the author's own device as excluded, with its `firstOpen` | Braxton | 6 |
| 8 | **Approval B**, then recruit | **Braxton** | 6 passing |

Steps 4 and 8 are the two gates. Everything before 4 is reversible; everything
after 8 involves other people.

If a Mac becomes available, steps 4–6 can be replaced by a local
Release-configuration run onto the phone, which gets the same evidence with no
upload at all. Strictly preferable when possible; not a blocker.

## 3.4 The minimum device test plan

Eight checks. This is the gating set — not a tour of the app. Each one is
either measurement provenance or an invariant that would corrupt the trial if
broken. Everything else (haptics, the throw animation, Siri, the Wins screen)
is worth *noticing*, and none of it gates the trial.

**On the TestFlight build (Release), the author's own phone:**

1. ⋯ → **Trial data** reads **"counted as a real trial user"**. This is the one
   check the whole measurement rubric rests on; if it reads "excluded", nothing
   a tester sends can be counted.
2. The raw JSON on that screen shows only `version`, `source`, `environment`,
   `firstOpen`, `days` — and **no task text**.
3. Break a card down without marking anything done → the screen reads the
   **unknown** state ("planned a step, no evidence they did it"), not "started".
4. Mark a card done → it reads **started**.
5. **Delete** on that screen removes the record and **leaves the stack
   untouched** — count the cards before and after.
6. "Too big" → **"Just 5 minutes"** and the opener chips are present. On a phone
   without Apple Intelligence, "Suggest steps" is **absent**, not
   present-and-failing.
7. Tapping "Just 5 minutes" fills the editor with `spend 5 minutes on <card>`,
   **editable**; changing the number and confirming produces exactly the edited
   text.
8. **"Never mind" leaves the stack byte-identical** — count the cards before
   and after. This is the "never silently change user data" constraint, and it
   is the one whose failure a user would never report.

A check is passed only when someone has actually watched it happen on a phone,
and the build it happened on is written down beside it.

## 3.5 Approvals, in full

Exactly four decisions are a human's, and none of them are mine:

| Approval | What it authorises |
|---|---|
| Merge PR #23 | the candidate becomes the release SHA |
| Version choice | what testers see, and what App Store Connect accepts |
| **A** — dispatch `testflight` | a build exists and is installable. Internal only |
| **B** — begin the trial | real people are asked for their time |

Signing, credentials, account settings and any App Store *submission* are
outside all four and are not part of this trial.

---

## Who does what

| Step | Who |
|---|---|
| Implementation, tests, this ledger, the offline scorecard | Claude |
| Code review, approval of the work | Codex |
| Merge, version bump, dispatch, device validation, recruiting, tallying real exports | **A human — Braxton** |

The implementer proposing a release and the implementer performing it are
different things. Everything above stops at "proposed".
