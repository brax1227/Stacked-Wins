# Stacked Wins — iOS

Native SwiftUI app for the stack: dump everything out of your head, get handed
one card at a time. It mirrors the web app screen for screen and talks to the
same backend. See [PROBLEM.md](../PROBLEM.md) for why it's shaped this way.

## Screens

| Screen | Job |
|---|---|
| **Now** (`NowView`) | One card, large, four moves: Done / Not now / Not today / Too big. Two lane tabs, **no counts anywhere**. This is the front door and the whole product. |
| **Break it up** (`BreakItUpSheet`) | Type the smallest first pieces. *"I don't know where to start"* asks Claude — it only ever suggests, nothing is written until you tap Break it up. Hidden when the server has no API key. |
| **Put it down** (`DumpView`) | The brain dump. One thing per line, one lane toggle, nothing else to fill in. |
| **Everything** (`EverythingView`) | The full list for one lane. The only screen with counts, and the only place ranking lives — swipe right for *Do first*, long-press for up/down/move lane/let go. |
| **Server** (`ServerSettingsView`) | Where the API is. How a TestFlight build reaches a backend on your laptop. |

## Layout

```
StackedWins/StackedWins/
├── StackedWinsApp.swift     # Entry; routes on signed-in state
├── AppState.swift           # Session only — no app-wide cache of the pile, on purpose
├── Models/
│   ├── Stack.swift          # StackItem, StackKind, NextCard … mirrors web/src/services/stackService.ts
│   └── User.swift
├── Services/
│   ├── APIClient.swift      # URLSession + JWT + error mapping. Foundation-only, typechecks on Linux
│   ├── AuthService.swift
│   └── StackService.swift   # One function per endpoint
├── Utils/
│   ├── Config.swift         # Server URL resolution (Settings → Info.plist → localhost)
│   └── Keychain.swift       # Token storage
├── Views/
├── Assets.xcassets/          # App icon: replace AppIcon.appiconset/Icon-1024.png (1024×1024, opaque)
└── PrivacyInfo.xcprivacy    # Apple privacy manifest; declares the UserDefaults use
```

There is **no `.xcodeproj` in git**. `../project.yml` is the source of truth and
XcodeGen generates the project. Drop a Swift file in `StackedWins/StackedWins/`
and it's picked up — no project edit.

## Running it locally (needs a Mac)

```bash
brew install xcodegen
cd ios && xcodegen generate && open StackedWins.xcodeproj
```

Start the backend (`cd backend && npm run dev`, port 3001). In the simulator
the default `http://localhost:3001` just works. On a real phone, open the
**⋯ → Server** menu and enter your Mac's Wi-Fi address, e.g.
`http://192.168.1.20:3001` — plain http is allowed for local addresses only.

## Shipping

See [TESTFLIGHT.md](./TESTFLIGHT.md). Releases are built and uploaded by
GitHub Actions; nobody needs a Mac for that.

## Working without a Mac

The networking layer (`Models/`, `Services/`, `Utils/Config.swift`) is
deliberately Foundation-only so it can be **typechecked on Linux** with a
stock Swift toolchain. SwiftUI files can only be parse-checked there.

The real build happens in CI: the `compile-check` job runs on a macOS runner
for every PR and every branch push touching `ios/` (Swift files — markdown
edits don't trigger it). The whole app was written and first compiled this
way, with no Mac involved: 16 files, zero errors, on Xcode 26.6.

## Requirements

- iOS 17.0+
- Xcode 15+ (CI uses whatever `macos-latest` ships)
