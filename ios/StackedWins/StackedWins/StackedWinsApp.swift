import SwiftUI

@main
struct StackedWinsApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            Group {
                if appState.isAuthenticated {
                    RootView()
                } else {
                    LoginView()
                }
            }
            .environmentObject(appState)
        }
    }
}
