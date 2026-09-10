import Foundation
#if canImport(FoundationModels)
import FoundationModels
#else
// Nothing below this line is typechecked when the framework is missing, which
// would make a green build meaningless -- the calls could be wrong and nobody
// would know. Say so loudly instead. The absence of this warning in a build
// log is the proof that the on-device path really was compiled.
#warning("FoundationModels is not in this SDK: the on-device split assist is compiled out and every phone will report it unavailable.")
#endif

/// Breaking a card down, on the phone.
///
/// "Too big" is the move that exists because a vague card is the one that
/// freezes you: "clean" isn't a task, it's a mood. Someone who can already
/// see the first step doesn't need this button. Someone staring at "clean"
/// can't, and that's exactly when the pieces are hardest to produce.
///
/// This runs on Apple's on-device model, which means the thing you're
/// avoiding never leaves your phone, there's no key to hold, no server to
/// keep up, and it works on a plane. It also means it isn't there on every
/// phone: older hardware, Apple Intelligence switched off, a model still
/// downloading. All of those report unavailable and the button simply never
/// appears -- the app is fully usable without it, and always was.
///
/// This is the one file that touches FoundationModels, so the rest of the
/// app stays Foundation-only and testable without a Mac.
struct OnDeviceSplitAssist: SplitAssistant {

    var isAvailable: Bool {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            return SystemLanguageModel.default.isAvailable
        }
        #endif
        return false
    }

    func pieces(for title: String) async throws -> [String] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            guard SystemLanguageModel.default.isAvailable else {
                throw SplitAssistFailure.unavailable
            }

            let session = LanguageModelSession {
                Self.instructions
            }
            let answer = try await session.respond(to: Self.prompt(for: title))
            return Self.lines(from: answer.content)
        }
        #endif
        throw SplitAssistFailure.unavailable
    }

    // MARK: - What we ask it

    /// Written against the failure mode, not the task. A model asked to break
    /// something down will happily produce "Step 1: Plan your approach",
    /// which is another thing to think about — the exact tax this product
    /// exists to remove. So: physical, small, and startable without deciding
    /// anything first.
    private static let instructions = """
        You break an overwhelming task into its smallest first physical steps.

        Rules:
        - Between two and five steps. Fewer is better.
        - Each step is something you could start in under a minute, without \
        planning, deciding, or looking anything up first.
        - Write them the way someone would say them out loud: "find the phone \
        number", not "Step 1: Locate contact information".
        - No preamble, no numbering, no explanation. One step per line, and \
        nothing else.
        - Never suggest thinking, planning, deciding, organising, or making a \
        list. Those are the reasons this person is stuck.
        """

    private static func prompt(for title: String) -> String {
        """
        Break this down: \(title)
        """
    }

    /// The model was told one per line; this is what to do when it doesn't
    /// quite obey. Numbering and bullets get stripped by the same parser a
    /// typed dump goes through.
    static func lines(from response: String) -> [String] {
        DumpParser.parse(response)
    }
}
