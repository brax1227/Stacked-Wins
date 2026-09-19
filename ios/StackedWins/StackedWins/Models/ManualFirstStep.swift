import Foundation

/// Getting from "too big" to one small step **without a model**.
///
/// The on-device assist only exists on some phones (`OnDeviceSplitAssist`).
/// On every other phone, "Too big" has until now opened a blank box and asked
/// "what's the smallest first piece?" — which is the blank-page problem
/// handed to someone at the exact moment they are frozen. Being asked to
/// produce the answer *is* the thing they came here unable to do.
///
/// So this is the fallback, and it is deliberately dumber than a model:
/// fixed text, no inference, no network, identical on every device. Two
/// shapes, both of which turn "write the answer" into "pick or fill a blank":
///
/// - **A timebox.** One tap turns "clean the apartment" into "spend 5 minutes
///   on clean the apartment". No typing, no thinking, always smaller than
///   what it replaces, and it needs to know nothing about the task.
/// - **Openers.** Physical stems — "find the ", "open " — that you finish
///   with one word. A blank with a beginning is a different thing from a
///   blank.
///
/// Nothing here writes to the stack. Everything it produces lands in the
/// editable box and waits for the user to confirm it (`split`).
enum ManualFirstStep {

    /// Short enough to be over before avoidance catches up.
    static let defaultMinutes = 5

    /// Same ceiling a typed card gets, so a step can never be a shape the
    /// rest of the app would reject.
    static let maxLength = DumpParser.maxTitleLength

    // MARK: - The timebox

    /// "clean the apartment" -> "spend 5 minutes on clean the apartment".
    ///
    /// Returns nil when there is nothing to gain: an empty title, or one that
    /// is already a timebox. The button is hidden rather than offering to
    /// wrap "spend 5 minutes on x" into "spend 5 minutes on spend 5 minutes
    /// on x", which is the kind of thing that makes a tool feel stupid.
    static func timebox(_ title: String, minutes: Int = defaultMinutes) -> String? {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, minutes > 0, !isTimeboxed(trimmed) else { return nil }

        let prefix = "spend \(minutes) minute\(minutes == 1 ? "" : "s") on "
        let room = maxLength - prefix.count
        guard room > 0 else { return nil }

        // A title long enough to overflow gets clipped rather than dropped:
        // a recognisable stub the user can edit beats no offer at all.
        let body = trimmed.count > room ? String(trimmed.prefix(room)) : trimmed
        return prefix + body
    }

    /// Already of the form "spend N minutes on ...".
    static func isTimeboxed(_ title: String) -> Bool {
        let range = NSRange(title.startIndex..., in: title)
        return timeboxPattern.firstMatch(in: title, range: range) != nil
    }

    private static let timeboxPattern = try! NSRegularExpression(
        pattern: #"^\s*spend\s+\d+\s+minutes?\s+on\s+\S"#,
        options: [.caseInsensitive]
    )

    // MARK: - The openers

    /// A stem you finish with one word.
    struct Opener: Identifiable, Equatable {
        /// Stable across releases: the UI and the tests both name these.
        let id: String
        /// What the button says.
        let label: String
        /// What lands in the box, ending in a space so the cursor sits in the
        /// blank rather than against a letter.
        let stem: String
    }

    /// Chosen so that every one of them is something you could be *doing*
    /// ten seconds after tapping it. Nothing here is "decide", "plan",
    /// "review" or "organise" — those are the moves that got the user stuck,
    /// and a fallback that suggests them is worse than an empty box.
    static let openers: [Opener] = [
        Opener(id: "find", label: "find the…", stem: "find the "),
        Opener(id: "open", label: "open…", stem: "open "),
        Opener(id: "getout", label: "get out the…", stem: "get out the "),
        Opener(id: "text", label: "text…", stem: "text "),
        Opener(id: "call", label: "call…", stem: "call "),
        Opener(id: "oneline", label: "write one line about…", stem: "write one line about "),
        Opener(id: "clear", label: "clear one…", stem: "clear one "),
        Opener(id: "throw", label: "throw away one…", stem: "throw away one "),
    ]

    /// Put a stem into whatever is already in the box.
    ///
    /// Appends on its own line rather than replacing, because a user who has
    /// already typed something is mid-thought and losing it would be the
    /// worst thing this screen could do.
    static func insert(_ opener: Opener, into existing: String) -> String {
        guard !existing.isEmpty else { return opener.stem }
        // Don't stack blank lines if they left a trailing newline.
        let needsBreak = !existing.hasSuffix("\n")
        return existing + (needsBreak ? "\n" : "") + opener.stem
    }
}
