# Shipping to TestFlight

The pipeline builds, signs, and uploads the iOS app from GitHub Actions, so
you never need a Mac to release. Setup is one-time and takes about 20 minutes;
after that, shipping is a button in the Actions tab.

**This has run against a real Apple account.** On the first `ios-v0.1.0`
release: preflight authenticated and found the app record, the archive signed
automatically with the API key, export produced a signed `.ipa`, and the
upload reached App Store Connect. Apple rejected that first upload for a
missing app icon (fixed; see the table below). Everything up to that point is
proven.

**You fire the first release run, not CI.** Until this branch is merged to
`main`, GitHub doesn't register `workflow_dispatch`, and tag pushes are only
possible from a machine with full push rights. So the sequence is: set the
bundle ID in `project.yml` (or tell whoever's driving the repo to), add the
four secrets, then either push an `ios-v*` tag or, once merged, use
**Run workflow → preflight** from the Actions tab.

---

## What you need before starting

- **Apple Developer Program membership** — $99/year, at
  [developer.apple.com/programs](https://developer.apple.com/programs/).
  There is no free path to TestFlight; this is a hard requirement.
- Admin (or App Manager) access to App Store Connect for that account.

---

## One-time setup

### 1. Pick a bundle ID and register it

A bundle ID is a reverse-DNS string that permanently identifies the app.
Use a domain you control — it can't be changed after the app is created.

1. [developer.apple.com/account/resources/identifiers](https://developer.apple.com/account/resources/identifiers/list)
   → **+** → **App IDs** → **App**
2. Description: `Stacked Wins`, Bundle ID: **Explicit**, e.g. `com.yourdomain.stackedwins`
3. Leave all capabilities off — the app doesn't need any yet. Register.

Then edit **`ios/project.yml`** and set `PRODUCT_BUNDLE_IDENTIFIER` to exactly
that string. This is the only file you need to change.

### 2. Create the app record in App Store Connect

[appstoreconnect.apple.com/apps](https://appstoreconnect.apple.com/apps) → **+**
→ **New App**. Platform iOS, pick the bundle ID from step 1, SKU can be
anything (`stacked-wins`). You do **not** need screenshots, a description, or
a privacy policy for TestFlight — only for public App Store release.

### 3. Create an App Store Connect API key

This is what lets CI sign and upload without a Mac or stored certificates.

**Already have one from another app on the same team?** API keys are issued
per *team*, not per app, so a key that drives another app's CI can drive this
one. Its Key ID and Issuer ID are whatever you set in that other repo's
secrets. The only trade-off: revoking the key breaks both pipelines at once.
Mint a second key if you want them independent.

1. [App Store Connect → Users and Access → Integrations → App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api)
2. **+** to generate a key. Name it `GitHub Actions`, access role **App Manager**.
3. Note the **Issuer ID** (a UUID, at the top of the page) and the **Key ID**.
4. **Download the `.p8` file.** Apple lets you download it exactly once —
   if you lose it you must revoke the key and make a new one.

Keep the `.p8` out of the repo. `.gitignore` blocks `*.p8`, but don't rely on that.

### 4. Find your Team ID

[developer.apple.com/account](https://developer.apple.com/account) →
**Membership details** → **Team ID** (10 characters, e.g. `A1B2C3D4E5`).

### 5. Add four repository secrets

**Settings → Secrets and variables → Actions → New repository secret** on
this repo. Names must match exactly:

| Secret | Value |
|---|---|
| `APPLE_TEAM_ID` | The 10-character Team ID from step 4 |
| `APPSTORE_CONNECT_ISSUER_ID` | The Issuer ID (UUID) from step 3 |
| `APPSTORE_CONNECT_API_KEY_ID` | The Key ID from step 3 |
| `APPSTORE_CONNECT_API_KEY_P8` | The `.p8` file's contents, pasted exactly as they are (see below) |

**The key goes in as plain text.** Open the `.p8` in any text viewer, select
everything from `-----BEGIN PRIVATE KEY-----` to `-----END PRIVATE KEY-----`
inclusive, copy, and paste it as the secret's value. Line breaks are fine;
GitHub secrets are multi-line. Windows or phone line endings are fine too.

**From a phone:** in the Files app, tap the `.p8`. If it won't preview, share
it to Notes, open it there, select all, copy. Then in Safari on github.com,
paste it into the secret. That's the whole step.

If you'd rather base64 it (`base64 -i AuthKey.p8 | pbcopy` on a Mac,
`base64 -w0 AuthKey.p8` on Linux), that's accepted too.

The workflow parses whatever it's given with `openssl` before doing anything
expensive, so a truncated or mangled paste fails in the first ten seconds with
a message saying exactly that.

---

## Shipping a build

**Actions** tab → **iOS TestFlight** → **Run workflow** → set *What to run* to
**testflight**. It defaults to `compile-check`, which only builds for the
simulator and uploads nothing, so a stray click can't burn a build number.

The three choices:

| Choice | What it does | Needs secrets? |
|---|---|---|
| `compile-check` | Simulator build. Proves the Swift compiles. | No |
| `preflight` | Read-only check that the key, IDs and app record line up. Seconds. | Yes |
| `testflight` | Preflight, then archive, sign, export and upload. | Yes |

Run `preflight` first after adding secrets. If it prints the app name and
bundle ID, everything Apple-side is correct and `testflight` will get through
to signing.

The preflight *script* has been exercised against the real App Store Connect
API (it correctly reports a rejected key). The preflight *job's* macOS steps
(`setup-python`, `pip`) have not yet run on a runner, because that requires a
tag or a dispatch. They are boilerplate; if they fail, the log will say why in
the first ten lines.

Or tag a release. From a terminal:

```bash
git tag ios-v0.1.0 && git push origin ios-v0.1.0
```

**From a phone or any browser:** the repo's **Releases** page → **Draft a new
release** → *Choose a tag* → type `ios-v0.1.0` → *Create new tag on publish* →
set *Target* to the branch you want built → **Publish release**. Publishing
creates the tag, and the tag push triggers the pipeline.

The run takes roughly 10-20 minutes. Apple then takes another 5-15 minutes to
process the build before it appears in TestFlight. You'll get an email when
it's ready, and you add testers in App Store Connect → your app → TestFlight.

### Version numbers

- **Build number** is set automatically to the workflow run number, so every
  upload is unique. App Store Connect rejects a repeated build number, which
  is the single most common cause of a failed upload.
- **Version** shown to testers is `MARKETING_VERSION` in `ios/project.yml`.
  Bump it by hand for a real release.

---

## How the signing works

There are no certificates or provisioning profiles in this repo, and none to
rotate. `xcodebuild -allowProvisioningUpdates`, authenticated with the App
Store Connect API key, creates and downloads whatever signing assets it needs
onto the runner at build time. The runner is destroyed afterwards, and the
workflow deletes the key from disk in an `always()` step regardless.

This is why the API key needs the **App Manager** role — a read-only key can
upload but cannot create signing certificates.

---

## The Xcode project is generated, not committed

`ios/project.yml` is the source of truth. CI runs `xcodegen generate` to
produce `StackedWins.xcodeproj` at build time, and both the project and the
generated `Info.plist` are gitignored.

This is deliberate: a `.pbxproj` is thousands of lines of generated UUIDs that
can't be reviewed or merged sanely, and nobody on this project has had a Mac
to maintain one. Add source files by dropping them in
`ios/StackedWins/StackedWins/` — they're picked up automatically, no project
edit needed.

To work on it locally (needs a Mac):

```bash
brew install xcodegen
cd ios && xcodegen generate && open StackedWins.xcodeproj
```

---

## What ships

The real app: dump, one card with the four moves, both lanes, and the
Everything list with ranking. Out of the box the stack lives on the phone —
no account, no server, nothing to connect to. Signing in to a server (⋯ menu)
is optional and adds the Claude break-it-up assist and the web app on the
same stack.

**What a signed-in build points at** is set two ways. CI bakes `API_BASE_URL` into the build
from a repository *variable* of that name (Settings → Secrets and variables →
Actions → **Variables**) — set it to wherever your backend is deployed. If it's
unset the build defaults to `localhost`, which on a phone means the phone.
Either way, testers can change it in-app under **⋯ → Server**; pointing a
TestFlight build at a laptop on the same Wi-Fi (`http://192.168.x.x:3001`)
works because the app allows plain http for local addresses only.

**Verified.** The `compile-check` job has run on a real `macos-latest` runner
(Xcode 26.6, iOS 26.5 simulator SDK): `xcodegen generate` produced the project
from `project.yml`, and all 16 Swift files compiled for arm64 and x86_64 with
zero errors and zero warnings, in 43 seconds. What is *not* yet exercised is
everything that needs your Apple account — signing, export, and the upload.
That's the shakedown the first `testflight` run does.

---

## If the first run fails

The `preflight` job runs before any build and turns the common Apple-side
mistakes into one-line messages:

| Preflight says | Fix |
|---|---|
| `Missing repository secrets: ...` | A secret name is misspelled; they're case-sensitive |
| `isn't a valid private key` | The paste is truncated; copy the whole file, first line to last |
| `rejected the key ... NOT_AUTHORIZED` | Key ID or Issuer ID doesn't match this `.p8`, or the key was revoked. Most often: you minted a new key and renamed the download, so the Key ID in the secret belongs to a different key. Read the real Key ID off the key's row in Users and Access → Integrations |
| `isn't allowed to list apps` | The key's role is Developer; it must be App Manager |
| `no app record for bundle id` | Typo in `project.yml`, or the app hasn't been created in App Store Connect yet (step 2) |

If preflight passes, anything that fails afterwards is signing or upload:

| Upload says | Fix |
|---|---|
| `90022 Missing required icon file` / `90713 CFBundleIconName is missing` | The app has no icon in an asset catalog. Ships with one now: `ios/StackedWins/StackedWins/Assets.xcassets/AppIcon.appiconset/Icon-1024.png`. Replace that single 1024×1024 opaque PNG to change it; Xcode derives every other size |

| Symptom | Cause |
|---|---|
| `No profiles for 'com.x.y' were found` | Bundle ID in `project.yml` doesn't match the registered App ID, or the API key lacks App Manager |
| `Missing repository secrets: ...` | A secret name is misspelled — they're case-sensitive |
| `isn't a valid private key` | The paste is truncated; copy the whole file, first line to last |
| `The bundle version must be higher than...` | A build with that number already exists; re-run (the run number increments) |
| `exportOptionsPlist error: method` | Only if the runner is somehow on Xcode < 15.3 — it currently ships 26.x, so unlikely; the fallback is `app-store` |
| `Invalid Team ID` | Team ID is the 10-char code, not the team *name* |

## Before handing the link to external testers

Internal testers (your own App Store Connect users) get builds the moment
Apple finishes processing. **External** testers require Beta App Review, and
reviewers can't sign up: they log in. Create a demo account in the backend
and record it under the app's TestFlight → Test Information → Sign-in
required before submitting for review.

The workflow saves the `.ipa` as a run artifact for 14 days even on failure,
so you can inspect or upload it manually via Transporter if the upload step is
the only thing broken.
