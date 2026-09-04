import Foundation

/// Where the API lives.
///
/// Resolution order:
///   1. A URL the user typed into Settings (kept in UserDefaults). This is how
///      a TestFlight build talks to a backend running on your laptop: point it
///      at http://<your-mac's-lan-ip>:3001.
///   2. `API_BASE_URL` from Info.plist, which CI injects from the build setting
///      of the same name (see ios/project.yml and the workflow).
///   3. localhost, which only ever works in the simulator.
enum Config {
    static let serverURLDefaultsKey = "serverURL"
    static let fallbackServerURL = "http://localhost:3001"

    static var bundledServerURL: String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String else {
            return nil
        }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        // An unset build setting substitutes to an empty string, not to nil.
        return trimmed.isEmpty ? nil : trimmed
    }

    static var serverURL: String {
        get {
            let stored = UserDefaults.standard.string(forKey: serverURLDefaultsKey)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if let stored, !stored.isEmpty { return stored }
            return bundledServerURL ?? fallbackServerURL
        }
        set {
            let trimmed = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty {
                UserDefaults.standard.removeObject(forKey: serverURLDefaultsKey)
            } else {
                UserDefaults.standard.set(trimmed, forKey: serverURLDefaultsKey)
            }
        }
    }

    /// The API root, e.g. https://api.example.com/api. Tolerates the user
    /// typing the host with or without a trailing slash or `/api`.
    static var apiBaseURL: URL? { apiBaseURLIfValid(serverURL) }

    /// Same normalisation, for validating what the user is typing before it's
    /// saved. Rejects anything that isn't an http(s) URL with a host.
    static func apiBaseURLIfValid(_ candidate: String) -> URL? {
        var raw = candidate.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return nil }
        while raw.hasSuffix("/") { raw.removeLast() }
        if !raw.hasSuffix("/api") { raw += "/api" }
        guard let url = URL(string: raw),
              let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https",
              let host = url.host, !host.isEmpty
        else { return nil }
        return url
    }
}
