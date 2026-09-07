import Foundation
import Combine

/// Session state for the whole app: where the stack lives, and nothing else.
///
/// The stack lives on this phone unless the user has signed in to a server.
/// There is no sign-up wall: the app opens to the stack from the very first
/// launch, because an account is one more thing to do before you can put
/// anything down (PROBLEM.md).
///
/// Deliberately tiny. The stack itself is fetched by the screen showing it --
/// there is no app-wide cache of the pile, because no screen but Everything
/// is ever allowed to see more than one card of it.
@MainActor
final class AppState: ObservableObject {
    /// True when signed in to a server. False means the phone holds the stack.
    @Published private(set) var usesServer: Bool
    @Published private(set) var user: User?

    private var expiryObserver: AnyCancellable?

    init() {
        // Swap in the Keychain-backed store before anything can make a request.
        APIClient.shared.tokenStore = KeychainTokenStore()
        // Trust a stored token optimistically; the first 401 signs us out.
        usesServer = APIClient.shared.isAuthenticated
        StackService.backend = usesServer ? RemoteStackBackend() : LocalStackStore.shared

        expiryObserver = NotificationCenter.default
            .publisher(for: .sessionExpired)
            .sink { [weak self] _ in
                Task { @MainActor in self?.signOut() }
            }
    }

    func signIn(email: String, password: String) async throws {
        let response = try await AuthService.login(email: email, password: password)
        install(response)
    }

    func register(email: String, password: String) async throws {
        let response = try await AuthService.register(email: email, password: password)
        install(response)
    }

    /// Back to the stack on this phone. Whatever was put down here before
    /// signing in is still here.
    func signOut() {
        APIClient.shared.tokenStore.token = nil
        user = nil
        usesServer = false
        StackService.backend = LocalStackStore.shared
    }

    private func install(_ response: AuthResponse) {
        APIClient.shared.tokenStore.token = response.token
        user = response.user
        usesServer = true
        StackService.backend = RemoteStackBackend()
    }
}
