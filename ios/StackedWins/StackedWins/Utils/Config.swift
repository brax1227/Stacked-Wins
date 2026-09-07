import Foundation

/// Runtime configuration, resolved from the app bundle.
///
/// Why this reads from Info.plist rather than hardcoding:
/// the previous version pinned `http://localhost:3000/api` in two separate
/// places (here and APIService), and *both* were wrong — the backend listens
/// on 3001 (see backend/src/index.js). A single bundle-driven value means the
/// URL is declared once, in project.yml, and differs per build configuration
/// (Debug -> localhost, Release -> production).
enum Config {

    /// Base URL for the backend API, e.g. `http://localhost:3001/api`.
    ///
    /// Traps on a missing or malformed value rather than silently falling back
    /// to a default. A build that cannot reach its own API should fail loudly
    /// and immediately, not at some random point later in a network call.
    static let apiBaseURL: URL = {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "APIBaseURL") as? String,
              !raw.isEmpty else {
            fatalError("APIBaseURL missing from Info.plist — check API_BASE_URL in project.yml")
        }
        guard let url = URL(string: raw) else {
            fatalError("APIBaseURL is not a valid URL: \(raw)")
        }
        return url
    }()
}
