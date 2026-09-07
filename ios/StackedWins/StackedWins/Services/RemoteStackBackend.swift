import Foundation

/// The stack API over HTTP. Mirrors web/src/services/stackService.ts one for
/// one. Used only when the user has signed in to a server (see AppState).
struct RemoteStackBackend: StackBackend {
    private var client: APIClient { APIClient.shared }

    // MARK: Job 1 — get it out of the head

    private struct DumpBody: Encodable {
        let text: String
        let kind: StackKind
    }

    func dump(_ text: String, into kind: StackKind) async throws -> DumpResult {
        try await client.request("POST", "stack/dump", body: AnyEncodable(DumpBody(text: text, kind: kind)))
    }

    // MARK: Job 2 — one card

    func next(in kind: StackKind) async throws -> NextCard {
        try await client.request("GET", "stack/next", query: [URLQueryItem(name: "kind", value: kind.rawValue)])
    }

    func capabilities() async throws -> StackCapabilities {
        try await client.request("GET", "stack/capabilities")
    }

    /// The full list. Always reachable, never the default view.
    func everything(in kind: StackKind) async throws -> StackList {
        try await client.request("GET", "stack", query: [
            URLQueryItem(name: "kind", value: kind.rawValue),
            URLQueryItem(name: "status", value: "open"),
        ])
    }

    // MARK: The four moves

    func done(_ id: String) async throws -> StackItem {
        try await client.request("POST", "stack/\(id)/done")
    }

    /// "Not now" — to the back of its lane, no penalty.
    func push(_ id: String) async throws -> StackItem {
        try await client.request("POST", "stack/\(id)/push")
    }

    /// "Not today" — sleeps until tomorrow, keeps its place.
    func later(_ id: String) async throws -> StackItem {
        try await client.request("POST", "stack/\(id)/later")
    }

    private struct SplitBody: Encodable {
        let pieces: String
    }

    /// "Too big" — break it into pieces; the first piece is dealt next.
    func split(_ id: String, pieces: String) async throws -> SplitResult {
        try await client.request("POST", "stack/\(id)/split", body: AnyEncodable(SplitBody(pieces: pieces)))
    }

    /// Ask Claude for the smallest first steps. Suggests only — nothing is
    /// written until the user confirms through `split`.
    func suggestSplit(_ id: String) async throws -> SplitSuggestion {
        try await client.request("POST", "stack/\(id)/split/suggest")
    }

    // MARK: Lanes, ranking, letting go

    private struct KindBody: Encodable {
        let kind: StackKind
    }

    func move(_ id: String, to kind: StackKind) async throws -> StackItem {
        try await client.request("POST", "stack/\(id)/kind", body: AnyEncodable(KindBody(kind: kind)))
    }

    private struct RankBody: Encodable {
        let move: RankMove
    }

    func rank(_ id: String, _ move: RankMove) async throws -> StackItem {
        try await client.request("POST", "stack/\(id)/rank", body: AnyEncodable(RankBody(move: move)))
    }

    func drop(_ id: String) async throws -> StackItem {
        try await client.request("POST", "stack/\(id)/drop")
    }
}
