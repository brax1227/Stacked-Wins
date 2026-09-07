import Foundation

/// The signed-in user, as returned by /api/auth/*.
///
/// The API sends camelCase ISO-8601 strings; dates stay as strings here so a
/// formatting change server-side can never break sign-in.
struct User: Codable, Identifiable, Equatable {
    let id: String
    let email: String
    let createdAt: String?
    let updatedAt: String?
}

struct AuthResponse: Codable {
    let token: String
    let user: User
}
