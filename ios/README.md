# Stacked Wins iOS App

Native iOS application built with SwiftUI.

> ###  Status: scaffold only — not yet a buildable app
>
> This directory currently contains **5 loose Swift files** and **no Xcode
> project**. There is no `.xcodeproj`, no `.xcworkspace`, and no `Package.swift`,
> so `open StackedWins.xcodeproj` below will not work yet.
>
> Consequences:
> - **The app cannot be built or run**, on a machine or in CI.
> - **There are no iOS tests** (no XCTest / Swift Testing target).
> - **Xcode Cloud cannot be configured.** It requires an Xcode project or
>   workspace to derive a scheme from, plus a paid Apple Developer Program
>   membership. CI for `backend/` and `web/` therefore runs on GitHub Actions
>   (see `.github/workflows/ci.yml`).
>
> To make this buildable, someone needs to create an Xcode project targeting
> these sources and commit it, along with a unit-test target. The "Project
> Structure" section below describes the **intended** layout — `Views/`,
> `ViewModels/`, and `Resources/` do not exist yet.

## Requirements

- Xcode 15.0+
- iOS 17.0+
- Swift 5.9+

## Setup

1. **Open project:**
   ```bash
   open StackedWins.xcodeproj
   ```

2. **Configure signing:**
   - Select your development team in Xcode
   - Update bundle identifier if needed

3. **Set API URL:**
   - Edit `Config.swift` with your backend API URL
   - Or use environment variables

4. **Run:**
   - Select simulator or device
   - Press Cmd+R to build and run

## Project Structure

```
StackedWins/
├── Views/          # SwiftUI views
│   ├── Onboarding/
│   ├── DailyPlan/
│   ├── Dashboard/
│   └── CoachChat/
├── ViewModels/     # View models (MVVM)
├── Models/         # Data models
├── Services/       # API service layer
├── Utils/          # Utilities & extensions
└── Resources/      # Assets, strings, etc.
```

## Key Features

- **Onboarding Flow** - Deep assessment survey
- **Daily Plan** - Today's micro-wins with progress tracking
- **Progress Dashboard** - Wins, streaks, metrics visualization
- **AI Coach Chat** - Structured coaching conversations
- **Offline Support** - Core Data for local caching
- **Push Notifications** - Daily reminders and check-ins

## Architecture

- **MVVM** pattern
- **Combine** for reactive state
- **URLSession** for networking
- **Core Data** for local storage
- **UserNotifications** for push notifications

## Testing

Run tests in Xcode:
- Cmd+U to run all tests
- Tests located in `StackedWinsTests/`

## Building for Production

1. Select "Any iOS Device" or specific device
2. Product → Archive
3. Distribute via App Store Connect
