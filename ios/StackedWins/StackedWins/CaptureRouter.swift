import Foundation
import Combine

/// Where an outside capture lands.
///
/// A link, a Shortcut or a Home Screen icon can ask for the dump box; this
/// carries that request from wherever it arrived to the screen that shows it.
@MainActor
final class CaptureRouter: ObservableObject {
    /// Set when something outside the app asked to put something down.
    @Published var pending: CaptureLink?

    /// Handle a URL the system handed us. Returns false when it isn't ours,
    /// so the caller can leave it alone rather than swallowing it.
    @discardableResult
    func handle(_ url: URL) -> Bool {
        guard let link = CaptureLink.parse(url) else { return false }
        pending = link
        return true
    }

    /// The box has been opened; stop asking for it. Without this a rotation
    /// or a backgrounding would re-open the sheet the user just dismissed.
    func consume() {
        pending = nil
    }
}
