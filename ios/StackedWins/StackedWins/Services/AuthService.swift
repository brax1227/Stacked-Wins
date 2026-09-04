import Foundation

private struct Credentials: Encodable {
    let email: String
    let password: String
}

enum AuthService {
    static func register(email: String, password: String) async throws -> AuthResponse {
        try await APIClient.shared.request(
            "POST", "auth/register",
            body: AnyEncodable(Credentials(email: email, password: password)),
            authenticated: false
        )
    }

    static func login(email: String, password: String) async throws -> AuthResponse {
        try await APIClient.shared.request(
            "POST", "auth/login",
            body: AnyEncodable(Credentials(email: email, password: password)),
            authenticated: false
        )
    }

    static func me() async throws -> User {
        try await APIClient.shared.request("GET", "auth/me")
    }
}
