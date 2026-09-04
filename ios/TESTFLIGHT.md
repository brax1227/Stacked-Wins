# Shipping to TestFlight

The pipeline builds, signs, and uploads the iOS app from GitHub Actions, so
you never need a Mac to release. Setup is one-time and takes about 20 minutes;
after that, shipping is a button in the Actions tab.

**Nothing below has been run yet.** It was written without access to a Mac or
an Apple account, so treat the first run as a shakedown — see
[If the first run fails](#if-the-first-run-fails).

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
| `APPSTORE_CONNECT_API_KEY_P8_BASE64` | The `.p8` file, base64-encoded (below) |

To encode the key — on a Mac:

```bash
base64 -i AuthKey_XXXXXXXXXX.p8 | pbcopy
```

On Linux, or anywhere with no clipboard:

```bash
base64 -w0 AuthKey_XXXXXXXXXX.p8
```

Paste the single-line result as the secret value. The workflow decodes it and
checks it's a real PEM key before doing anything expensive, so a mangled paste
fails immediately with a clear message rather than deep inside a build log.

---

## Shipping a build

**Actions** tab → **iOS TestFlight** → **Run workflow**.

Or tag a release:

```bash
git tag ios-v0.1.0 && git push origin ios-v0.1.0
```

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

The real app: sign in, dump, one card with the four moves, both lanes, the
Claude break-it-up assist, and the Everything list with ranking. It talks to
the same backend as the web app.

**What it points at** is set two ways. CI bakes `API_BASE_URL` into the build
from a repository *variable* of that name (Settings → Secrets and variables →
Actions → **Variables**) — set it to wherever your backend is deployed. If it's
unset the build defaults to `localhost`, which on a phone means the phone.
Either way, testers can change it in-app under **⋯ → Server**; pointing a
TestFlight build at a laptop on the same Wi-Fi (`http://192.168.x.x:3001`)
works because the app allows plain http for local addresses only.

**Unverified by a compiler.** No Mac was available while writing this. The
Foundation-only networking layer was typechecked with a Linux Swift toolchain;
the SwiftUI screens were only parse-checked. The PR `compile-check` job does
the first real build — expect to fix a handful of SwiftUI type errors on the
first run, not a broken design.

---

## If the first run fails

Most likely causes, roughly in order:

| Symptom | Cause |
|---|---|
| `No profiles for 'com.x.y' were found` | Bundle ID in `project.yml` doesn't match the registered App ID, or the API key lacks App Manager |
| `Missing repository secrets: ...` | A secret name is misspelled — they're case-sensitive |
| `Decoded key is not a PEM private key` | The base64 got line-wrapped or truncated; re-encode with `base64 -w0` |
| `The bundle version must be higher than...` | A build with that number already exists; re-run (the run number increments) |
| `exportOptionsPlist error: method` | Old Xcode on the runner — change `app-store-connect` to `app-store` in the workflow |
| `Invalid Team ID` | Team ID is the 10-char code, not the team *name* |

The workflow saves the `.ipa` as a run artifact for 14 days even on failure,
so you can inspect or upload it manually via Transporter if the upload step is
the only thing broken.
