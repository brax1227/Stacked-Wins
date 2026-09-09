import AppIntents
import Foundation

/// Capture without opening the app.
///
/// Job 1 is getting it out of your head, and the tax on that is everything
/// between the thought and the box: unlock, find the icon, wait for a launch,
/// tap +, type. A thought has to survive all of it. Most don't.
///
/// These intents remove the whole trip. iOS surfaces them in Siri, Spotlight
/// and Shortcuts the moment the app is installed -- no setup by the user --
/// so "add wash the car to Stacked Wins" out loud, hands full, is a complete
/// capture.

/// The two lanes, as Siri and Shortcuts see them.
enum LaneChoice: String, AppEnum {
    case need
    case want

    static var typeDisplayRepresentation: TypeDisplayRepresentation { "Lane" }

    static var caseDisplayRepresentations: [LaneChoice: DisplayRepresentation] {
        [
            .need: DisplayRepresentation(title: "Need to", subtitle: "The stuff that has to get done"),
            .want: DisplayRepresentation(title: "Want to", subtitle: "The stuff you'd actually like to do"),
        ]
    }

    var kind: StackKind { self == .need ? .need : .want }
}

/// "Add wash the car to Stacked Wins."
struct AddToStackIntent: AppIntent {
    static var title: LocalizedStringResource { "Put something down" }

    static var description: IntentDescription {
        IntentDescription(
            "Adds something to your stack without opening the app. One thing, or several on separate lines.",
            categoryName: "Capture"
        )
    }

    /// The whole point is not to be taken out of what you were doing.
    static var openAppWhenRun: Bool { false }

    @Parameter(title: "What", requestValueDialog: "What do you need to put down?")
    var text: String

    @Parameter(title: "Lane", default: .need)
    var lane: LaneChoice

    static var parameterSummary: some ParameterSummary {
        Summary("Put \(\.$text) down in \(\.$lane)")
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let result = try await StackBackends.current().dump(text, into: lane.kind)
        // Short on purpose: Siri reads this out loud, and the reason you used
        // your voice is that you were in the middle of something else.
        let dialog: IntentDialog = result.added == 1
            ? "Got it."
            : "Got it — \(result.added) things."
        return .result(dialog: dialog)
    }
}

/// "What's next in Stacked Wins?" — one card, out loud, same as the screen.
struct WhatsNextIntent: AppIntent {
    static var title: LocalizedStringResource { "What's next" }

    static var description: IntentDescription {
        IntentDescription("Tells you the one thing at the top of your stack.", categoryName: "Capture")
    }

    static var openAppWhenRun: Bool { false }

    @Parameter(title: "Lane", default: .need)
    var lane: LaneChoice

    static var parameterSummary: some ParameterSummary {
        Summary("What's next in \(\.$lane)")
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let card = try await StackBackends.current().next(in: lane.kind)
        guard let item = card.item else {
            let empty: IntentDialog = lane == .need
                ? "Nothing you have to do."
                : "Nothing on your want list."
            return .result(dialog: empty)
        }
        return .result(dialog: IntentDialog(stringLiteral: item.title))
    }
}

/// Registers the phrases with Siri and Spotlight at install time, so nobody
/// has to go and set a shortcut up before any of this works.
struct StackedWinsShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AddToStackIntent(),
            phrases: [
                "Add to \(.applicationName)",
                "Put this down in \(.applicationName)",
                "Add something to my \(.applicationName)",
            ],
            shortTitle: "Put something down",
            systemImageName: "square.and.pencil"
        )
        AppShortcut(
            intent: WhatsNextIntent(),
            phrases: [
                "What's next in \(.applicationName)",
                "What should I do in \(.applicationName)",
            ],
            shortTitle: "What's next",
            systemImageName: "rectangle.on.rectangle"
        )
    }
}
