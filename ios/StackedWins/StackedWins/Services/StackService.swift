import Foundation

/// The stack, as the screens see it. A thin front for whichever backend is
/// active: this phone by default, a server once the user signs in to one.
///
/// Screens call these and never look behind them, so switching where the
/// stack lives is one assignment in AppState, not a change in every view.
@MainActor
enum StackService {
    /// Swapped by AppState. Starts on-device so the app works from the first
    /// open, with no account and no network.
    static var backend: StackBackend = LocalStackStore.shared

    // MARK: Job 1 — get it out of the head

    static func dump(_ text: String, into kind: StackKind) async throws -> DumpResult {
        try await backend.dump(text, into: kind)
    }

    // MARK: Job 2 — one card

    static func next(in kind: StackKind) async throws -> NextCard {
        try await backend.next(in: kind)
    }

    static func capabilities() async throws -> StackCapabilities {
        try await backend.capabilities()
    }

    /// The full list. Always reachable, never the default view.
    static func everything(in kind: StackKind) async throws -> StackList {
        try await backend.everything(in: kind)
    }

    // MARK: The four moves

    @discardableResult
    static func done(_ id: String) async throws -> StackItem {
        try await backend.done(id)
    }

    /// "Not now" — to the back of its lane, no penalty.
    @discardableResult
    static func push(_ id: String) async throws -> StackItem {
        try await backend.push(id)
    }

    /// "Not today" — sleeps until tomorrow, keeps its place.
    @discardableResult
    static func later(_ id: String) async throws -> StackItem {
        try await backend.later(id)
    }

    /// "Too big" — break it into pieces; the first piece is dealt next.
    static func split(_ id: String, pieces: String) async throws -> SplitResult {
        try await backend.split(id, pieces: pieces)
    }

    /// Ask Claude for the smallest first steps. Suggests only — nothing is
    /// written until the user confirms through `split`. Server only.
    static func suggestSplit(_ id: String) async throws -> SplitSuggestion {
        try await backend.suggestSplit(id)
    }

    // MARK: Lanes, ranking, letting go

    @discardableResult
    static func move(_ id: String, to kind: StackKind) async throws -> StackItem {
        try await backend.move(id, to: kind)
    }

    @discardableResult
    static func rank(_ id: String, _ move: RankMove) async throws -> StackItem {
        try await backend.rank(id, move)
    }

    @discardableResult
    static func drop(_ id: String) async throws -> StackItem {
        try await backend.drop(id)
    }
}
