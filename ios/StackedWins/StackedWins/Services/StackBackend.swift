import Foundation

/// Where the stack lives. Two implementations:
///
///   - `LocalStackStore`: a JSON file on this phone. The default, and the
///     whole product for most people -- nothing to sign up for, nothing to
///     reach over the network, nothing to be "failed to connect" about.
///   - `RemoteStackBackend`: the Express API, for anyone who runs the
///     backend and wants the same stack on the web app too.
///
/// The one-card screen, the dump and the full list talk only to this, so
/// neither of them knows or cares which one is behind it.
protocol StackBackend {
    // Job 1 — get it out of the head
    func dump(_ text: String, into kind: StackKind) async throws -> DumpResult

    // Job 2 — one card
    func next(in kind: StackKind) async throws -> NextCard
    func capabilities() async throws -> StackCapabilities
    func everything(in kind: StackKind) async throws -> StackList

    // The four moves
    @discardableResult func done(_ id: String) async throws -> StackItem
    @discardableResult func push(_ id: String) async throws -> StackItem
    @discardableResult func later(_ id: String) async throws -> StackItem
    func split(_ id: String, pieces: String) async throws -> SplitResult
    func suggestSplit(_ id: String) async throws -> SplitSuggestion

    // Lanes, ranking, letting go
    @discardableResult func move(_ id: String, to kind: StackKind) async throws -> StackItem
    @discardableResult func rank(_ id: String, _ move: RankMove) async throws -> StackItem
    @discardableResult func drop(_ id: String) async throws -> StackItem

    // The wins, and taking a move back

    /// Everything cleared since a moment, newest first. The app is called
    /// Stacked Wins; this is the stack of wins.
    func cleared(since: Date) async throws -> [StackItem]

    /// Put the stack back the way it was before the last move, and say what
    /// was put back. Returns nil when there is nothing to undo.
    ///
    /// One level deep and only for this launch: undo is for the tap you
    /// regret two seconds later, not a history to browse.
    @discardableResult func undo() async throws -> String?
}
