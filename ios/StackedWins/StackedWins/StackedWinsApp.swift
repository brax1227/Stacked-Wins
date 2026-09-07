import SwiftUI

@main
struct StackedWinsApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            // Straight to the stack. No sign-in, no onboarding: the first
            // thing you see is the one card (or the box to put things down).
            RootView()
                .environmentObject(appState)
        }
    }
}
