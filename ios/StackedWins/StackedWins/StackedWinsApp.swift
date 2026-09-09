import SwiftUI

@main
struct StackedWinsApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var capture = CaptureRouter()

    var body: some Scene {
        WindowGroup {
            // Straight to the stack. No sign-in, no onboarding: the first
            // thing you see is the one card (or the box to put things down).
            RootView()
                .environmentObject(appState)
                .environmentObject(capture)
                // stackedwins://add — a Shortcut, a Home Screen icon, a link
                // in a note. Anything that can open a URL can capture.
                .onOpenURL { capture.handle($0) }
        }
    }
}
