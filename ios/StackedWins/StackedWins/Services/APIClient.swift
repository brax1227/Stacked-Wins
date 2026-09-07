import Foundation
#if canImport(FoundationNetworking)
// On Linux, URLSession lives in a separate module. No-op on Apple platforms;
// lets the networking layer be typechecked in CI without a Mac.
import FoundationNetworking
#endif

/// Where the session token lives. A protocol so the client stays free of the
/// Security framework (and testable without a device).
protocol TokenStore {
    var token: String? { get nonmutating set }
}

enum APIError: LocalizedError, Equatable {
    case badServerURL
    case unauthorized
    case server(status: Int, message: String)
    case decoding(String)
    case transport(String)

    var errorDescription: String? {
        switch self {
        case .badServerURL:
            return "That server address doesn't look right."
        case .unauthorized:
            return "Signed out. Sign in again."
        case .server(_, let message):
            return message
        case .decoding:
            return "The server sent something this version of the app doesn't understand."
        case .transport(let message):
            return message
        }
    }
}

/// Type-erased Encodable, so `request` can take any body without a generic
/// parameter callers have to spell out on body-less calls.
struct AnyEncodable: Encodable {
    private let encodeImpl: (Encoder) throws -> Void
    init<T: Encodable>(_ value: T) { encodeImpl = value.encode }
    func encode(to encoder: Encoder) throws { try encodeImpl(encoder) }
}

private struct ServerErrorBody: Decodable {
    let error: String
}

/// Posted when the server rejects the token, so the app can drop to sign-in.
extension Notification.Name {
    static let sessionExpired = Notification.Name("StackedWins.sessionExpired")
}

final class APIClient {
    static let shared = APIClient()

    var tokenStore: TokenStore
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init(tokenStore: TokenStore = InMemoryTokenStore(), session: URLSession = .shared) {
        self.tokenStore = tokenStore
        self.session = session
    }

    var isAuthenticated: Bool { tokenStore.token != nil }

    func request<T: Decodable>(
        _ method: String,
        _ path: String,
        query: [URLQueryItem] = [],
        body: AnyEncodable? = nil,
        authenticated: Bool = true
    ) async throws -> T {
        guard let base = Config.apiBaseURL,
              var components = URLComponents(url: base.appendingPathComponent(path), resolvingAgainstBaseURL: false)
        else { throw APIError.badServerURL }

        if !query.isEmpty { components.queryItems = query }
        guard let url = components.url else { throw APIError.badServerURL }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(body)
        }
        if authenticated, let token = tokenStore.token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.transport(Self.describe(transportError: error))
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0

        if status == 401 {
            // Token is dead. Forget it and let the app fall back to sign-in.
            if authenticated {
                tokenStore.token = nil
                NotificationCenter.default.post(name: .sessionExpired, object: nil)
            }
            throw APIError.unauthorized
        }

        guard (200..<300).contains(status) else {
            let message = (try? decoder.decode(ServerErrorBody.self, from: data))?.error
                ?? "The server said no (\(status))."
            throw APIError.server(status: status, message: message)
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(String(describing: error))
        }
    }

    private static func describe(transportError error: Error) -> String {
        let nsError = error as NSError
        switch (nsError.domain, nsError.code) {
        case (NSURLErrorDomain, NSURLErrorCannotConnectToHost),
             (NSURLErrorDomain, NSURLErrorCannotFindHost):
            return "Can't reach the server. Check the address in Settings."
        case (NSURLErrorDomain, NSURLErrorTimedOut):
            return "The server took too long to answer."
        case (NSURLErrorDomain, NSURLErrorNotConnectedToInternet):
            return "You're offline."
        default:
            return nsError.localizedDescription
        }
    }
}

/// Default store, used until the app installs the Keychain-backed one at
/// launch. Keeps this file free of the Security framework.
final class InMemoryTokenStore: TokenStore {
    private var value: String?
    var token: String? {
        get { value }
        set { value = newValue }
    }
}
