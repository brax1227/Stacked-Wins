import Foundation
import Combine

/// Session state for the whole app: who's signed in, and nothing else.
///
/// Deliberately tiny. The stack itself is fetched by the screen showing it --
/// there is no app-wide cache of the pile, because no screen but Everything
/// is ever allowed to see more than one card of it.
@MainActor
final class AppState: ObservableObject {
    @Published private(set) var isAuthenticated: Bool
    @Published private(set) var user: User?

    private var expiryObserver: AnyCancellable?

    init() {
        // Swap in the Keychain-backed store before anything can make a request.
        APIClient.shared.tokenStore = KeychainTokenStore()
        // Trust a stored token optimistically; the first 401 signs us out.
        isAuthenticated = APIClient.shared.isAuthenticated

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

    func signOut() {
        APIClient.shared.tokenStore.token = nil
        user = nil
        isAuthenticated = false
    }

    private func install(_ response: AuthResponse) {
        APIClient.shared.tokenStore.token = response.token
        user = response.user
        isAuthenticated = true
    }
}
