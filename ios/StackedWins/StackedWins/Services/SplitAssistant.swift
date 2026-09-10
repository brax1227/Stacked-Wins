import Foundation

/// Something that can suggest the smallest first pieces of a card.
///
/// A protocol rather than a direct call, for two reasons: the on-device model
/// only exists on some phones and some iOS versions, and everything that
/// touches it has to stay out of the Foundation-only layer that gets
/// typechecked and tested without a Mac.
///
/// Whatever implements this only ever *suggests*. Nothing it returns is
/// written to the stack until the user taps "Break it up" themselves.
protocol SplitAssistant {
    /// Whether this phone can actually do it right now. The UI hides the
    /// button when false rather than showing one that fails on tap.
    var isAvailable: Bool { get }

    /// The smallest first steps for a card, in order. Suggestions only.
    func pieces(for title: String) async throws -> [String]
}

enum SplitAssistFailure: LocalizedError, Equatable {
    /// No model on this phone, or it isn't ready.
    case unavailable
    /// It ran and came back with nothing worth showing.
    case nothingUseful

    var errorDescription: String? {
        switch self {
        case .unavailable:
            return "This phone can't suggest steps."
        case .nothingUseful:
            return "Couldn't come up with steps for that one."
        }
    }
}

/// The default: no help. What a phone without the model gets, and what the
/// tests run against unless they say otherwise.
struct NoSplitAssistant: SplitAssistant {
    var isAvailable: Bool { false }

    func pieces(for title: String) async throws -> [String] {
        throw SplitAssistFailure.unavailable
    }
}

/// Which assistant the on-device stack asks.
///
/// A settable global rather than an injected dependency because the store is
/// an actor reached from three places (the app, an intent, a test) and none
/// of them should have to know whether this phone has a model on it. The app
/// sets the real one at launch; everything else gets the honest "no".
enum SplitAssistants {
    static var current: SplitAssistant = NoSplitAssistant()
}
