import Foundation

/// Which stack is the live one.
///
/// The app picks this at launch, and so does anything that runs without the
/// app's UI -- a Siri phrase, a Shortcut, a Spotlight result. Those can run
/// in a freshly launched background process where `AppState` has never
/// initialised, so the decision can't live there: a card captured by voice
/// has to land in the same stack as a card typed into the app.
enum StackBackends {
    /// Installs the real split assistant if this phone has one. Idempotent,
    /// and called from every entry point -- the app, and each intent, since
    /// an intent can run in a launch where the app's UI never appeared.
    private static func installAssistant() {
        if SplitAssistants.current is NoSplitAssistant {
            let onDevice = OnDeviceSplitAssist()
            if onDevice.isAvailable { SplitAssistants.current = onDevice }
        }
    }

    /// The stack this device is currently using. The phone's own unless the
    /// user has signed in to a server.
    static func current() -> StackBackend {
        installAssistant()
        // Idempotent, and required before `isAuthenticated` means anything:
        // the default store is in-memory and knows nothing about a token
        // saved on a previous launch.
        APIClient.shared.tokenStore = KeychainTokenStore()
        return APIClient.shared.isAuthenticated ? RemoteStackBackend() : LocalStackStore.shared
    }

    /// True when the stack is on a server rather than this phone.
    static var usesServer: Bool {
        APIClient.shared.tokenStore = KeychainTokenStore()
        return APIClient.shared.isAuthenticated
    }
}
