import Foundation

/// The stack API. Mirrors web/src/services/stackService.ts one for one.
enum StackService {
    private static var client: APIClient { APIClient.shared }

    // MARK: Job 1 — get it out of the head

    private struct DumpBody: Encodable {
        let text: String
        let kind: StackKind
    }

    static func dump(_ text: String, into kind: StackKind) async throws -> DumpResult {
        try await client.request("POST", "stack/dump", body: AnyEncodable(DumpBody(text: text, kind: kind)))
    }

    // MARK: Job 2 — one card

    static func next(in kind: StackKind) async throws -> NextCard {
        try await client.request("GET", "stack/next", query: [URLQueryItem(name: "kind", value: kind.rawValue)])
    }

    static func capabilities() async throws -> StackCapabilities {
        try await client.request("GET", "stack/capabilities")
    }

    /// The full list. Always reachable, never the default view.
    static func everything(in kind: StackKind) async throws -> StackList {
        try await client.request("GET", "stack", query: [
            URLQueryItem(name: "kind", value: kind.rawValue),
            URLQueryItem(name: "status", value: "open"),
        ])
    }

    // MARK: The four moves

    @discardableResult
    static func done(_ id: String) async throws -> StackItem {
        try await client.request("POST", "stack/\(id)/done")
    }

    /// "Not now" — to the back of its lane, no penalty.
    @discardableResult
    static func push(_ id: String) async throws -> StackItem {
        try await client.request("POST", "stack/\(id)/push")
    }

    /// "Not today" — sleeps until tomorrow, keeps its place.
    @discardableResult
    static func later(_ id: String) async throws -> StackItem {
        try await client.request("POST", "stack/\(id)/later")
    }

    private struct SplitBody: Encodable {
        let pieces: String
    }

    /// "Too big" — break it into pieces; the first piece is dealt next.
    static func split(_ id: String, pieces: String) async throws -> SplitResult {
        try await client.request("POST", "stack/\(id)/split", body: AnyEncodable(SplitBody(pieces: pieces)))
    }

    /// Ask Claude for the smallest first steps. Suggests only — nothing is
    /// written until the user confirms through `split`.
    static func suggestSplit(_ id: String) async throws -> SplitSuggestion {
        try await client.request("POST", "stack/\(id)/split/suggest")
    }

    // MARK: Lanes, ranking, letting go

    private struct KindBody: Encodable {
        let kind: StackKind
    }

    @discardableResult
    static func move(_ id: String, to kind: StackKind) async throws -> StackItem {
        try await client.request("POST", "stack/\(id)/kind", body: AnyEncodable(KindBody(kind: kind)))
    }

    private struct RankBody: Encodable {
        let move: RankMove
    }

    @discardableResult
    static func rank(_ id: String, _ move: RankMove) async throws -> StackItem {
        try await client.request("POST", "stack/\(id)/rank", body: AnyEncodable(RankBody(move: move)))
    }

    @discardableResult
    static func drop(_ id: String) async throws -> StackItem {
        try await client.request("POST", "stack/\(id)/drop")
    }
}
