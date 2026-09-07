# Stacked Wins iOS App

Native iOS application built with SwiftUI.

## Requirements

- Xcode 15.0+
- iOS 17.0+
- Swift 5.9+
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`)

## Setup

The Xcode project is **generated from `project.yml`** and is not committed.
A checked-in `.pbxproj` produces unreviewable diffs and conflicts on nearly
every branch; a YAML manifest does not.

```bash
cd ios
xcodegen generate      # creates StackedWins.xcodeproj
open StackedWins.xcodeproj
```

Re-run `xcodegen generate` after adding or removing source files, or after
editing `project.yml`. New files in `StackedWins/` are picked up automatically
by path, so there is no target membership to forget.

## Running tests

From Xcode press `Cmd+U`, or from the terminal:

```bash
cd ios
xcodebuild test \
  -project StackedWins.xcodeproj \
  -scheme StackedWins \
  -destination 'platform=iOS Simulator,name=iPhone 17'
```

The suite covers the JSON contract with the backend (`snake_case` keys, ISO
8601 dates, enum values) and the runtime configuration wiring.

## Configuration

`Config.apiBaseURL` is read from `Info.plist`, populated per build
configuration from `project.yml`:

| Configuration | API base URL                              |
| ------------- | ----------------------------------------- |
| Debug         | `http://localhost:3001/api`               |
| Release       | `https://api.stackedwins.example.com/api` |

**Set the Release URL before shipping** — the current value is an obvious
placeholder rather than a plausible-looking default that would fail silently.

Change these in `project.yml` under the target's `configs`, not in source: a
hardcoded URL is how the previous version ended up pointing at port 3000 while
the backend listens on 3001.

## Project Structure

```
ios/
├── project.yml                  # Source of truth for the Xcode project
└── StackedWins/
    ├── StackedWins/             # App target
    │   ├── Models/              # Codable models mirroring the API
    │   ├── Services/            # APIService (networking)
    │   ├── Utils/               # Config
    │   ├── Info.plist
    │   └── StackedWinsApp.swift
    └── StackedWinsTests/        # Unit test target
```

## Status

This is an early scaffold. It builds, runs, and its tests pass, but most of
the app is not implemented yet:

- `APIService` throws `APIError.notImplemented` from **every** method.
- `ContentView` is a static placeholder; there are no real screens.
- `AssessmentRequest` and `Assessment` have no fields.
- Core Data, push notifications, and offline support are not started.

### Known issue: `Task` shadows Swift's concurrency type

`Models/GrowthPlan.swift` declares `struct Task`, which shadows Swift's
built-in `Task` throughout the module. Any attempt to write

```swift
Task { await something() }
```

fails to compile with `no exact matches in call to initializer`, because it
resolves to the model struct instead. `APIService` is already `async`, so this
will be hit as soon as anyone spawns a task.

Renaming the model (for example to `PlanTask` or `MicroWin`) is the fix, but
it changes the app's domain vocabulary, so it is left as a deliberate decision
rather than an incidental rename.

## CI

Two systems, on purpose:

- **GitHub Actions** (`.github/workflows/ci.yml`) — builds and unit-tests on
  every PR using a simulator, with no signing. Free and fast.
- **Xcode Cloud** — signing, TestFlight, and App Store distribution, which
  Actions cannot do without exporting signing certificates.

### Xcode Cloud setup

Requires a **paid Apple Developer Program membership**. Xcode Cloud is
configured in Xcode and App Store Connect, not in this repository.

1. Register the bundle ID `com.stackedwins.app` in App Store Connect
   (Certificates, Identifiers & Profiles), then create the app record.
2. In Xcode: `Product` -> `Xcode Cloud` -> `Create Workflow`.
3. Select the **StackedWins** scheme (committed in `project.yml`, so it is
   shared and visible to Xcode Cloud).
4. Grant the Xcode Cloud GitHub app access to `brax1227/Stacked-Wins`.
5. Configure the workflow:
   - **Start Conditions:** Branch Changes on `main`, and Pull Request Changes.
   - **Actions:** Build, then Test using the `StackedWins` scheme against an
     iOS Simulator.
   - **Post-Actions:** optionally TestFlight for internal testing.

`ci_scripts/ci_post_clone.sh` runs automatically after Xcode Cloud clones the
repo. It installs XcodeGen and generates the project, which is required
because the `.xcodeproj` is not committed. Xcode Cloud discovers that script
by convention from its path — do not move or rename it.
