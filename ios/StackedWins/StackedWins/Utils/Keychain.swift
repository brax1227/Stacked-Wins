import Foundation
import Security

/// Minimal Keychain wrapper for the session token. A JWT in UserDefaults is
/// readable by anything with the device backup; the Keychain isn't.
enum Keychain {
    private static let service = Bundle.main.bundleIdentifier ?? "com.stackedwins.app"

    static func set(_ value: String, for key: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        // Replace rather than update: simpler, and there's only ever one row.
        SecItemDelete(query as CFDictionary)
        var insert = query
        insert[kSecValueData as String] = data
        insert[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(insert as CFDictionary, nil)
    }

    static func get(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete(_ key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

/// Keychain-backed token storage for `APIClient`.
struct KeychainTokenStore: TokenStore {
    private let key = "sessionToken"
    var token: String? {
        get { Keychain.get(key) }
        nonmutating set {
            if let newValue { Keychain.set(newValue, for: key) } else { Keychain.delete(key) }
        }
    }
}
