import Foundation

/// A link that opens the app straight into "put it down".
///
///     stackedwins://add
///     stackedwins://add?text=call%20the%20bank
///     stackedwins://add?text=call%20the%20bank&kind=want
///
/// Why bother when the intents already cover Siri and Shortcuts: a URL is the
/// one capture route anything can drive. A Home Screen icon made in Shortcuts,
/// a Back Tap, an automation, a link in a note -- all of them can open a URL,
/// and none of them need this app to have shipped an extension for it.
///
/// Deliberately only opens the box. A link that wrote to the stack silently
/// would be a link anyone could hand you.
struct CaptureLink: Equatable {
    static let scheme = "stackedwins"

    /// Text to start the box with. Empty means an empty box.
    let text: String
    /// Which lane the box opens on.
    let kind: StackKind

    /// Parse a link, or nil if it isn't one of ours. Unknown hosts are
    /// rejected rather than guessed at, so a future `stackedwins://` route
    /// can't be silently swallowed by this one.
    static func parse(_ url: URL) -> CaptureLink? {
        guard url.scheme?.lowercased() == scheme else { return nil }

        // stackedwins://add and stackedwins:add both reach people; the second
        // is what you get when a link is typed by hand.
        let route = (url.host ?? url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
            .lowercased()
        guard route == "add" else { return nil }

        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        let value = { (name: String) in
            items.first { $0.name.lowercased() == name }?.value
        }

        // `text` is the documented name; `title` because that's what people
        // reach for, and being forgiving here costs nothing.
        let text = (value("text") ?? value("title") ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let kind = StackKind(rawValue: (value("kind") ?? "").lowercased()) ?? .need

        return CaptureLink(text: text, kind: kind)
    }
}
