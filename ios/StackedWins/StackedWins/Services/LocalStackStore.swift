import Foundation

/// The stack, kept on this phone.
///
/// A list of things to do does not need a server, an account or a network,
/// and for the person this app is for (PROBLEM.md) every one of those is a
/// reason not to open it. So this is the default: one JSON file in the app's
/// own folder, backed up with the phone, and the same moves the server
/// offers -- implemented here to the same rules, so a stack behaves the same
/// whether it lives on the phone or on a server.
///
/// An actor so the file is never read and written at the same time.
actor LocalStackStore: StackBackend {
    static let shared = LocalStackStore()

    enum Failure: LocalizedError, Equatable {
        case notFound
        case nothingToAdd
        case noPieces
        case assistNeedsServer

        var errorDescription: String? {
            switch self {
            case .notFound: return "Card not found"
            case .nothingToAdd: return "Nothing to add"
            case .noPieces: return "Break it into at least one piece"
            case .assistNeedsServer: return "Suggestions need a server. Break it up yourself — you know it better anyway."
            }
        }
    }

    /// Cards that keep getting pushed are several tasks in a trench coat.
    /// Same threshold as the backend (PUSHES_BEFORE_SPLIT_HINT).
    static let pushesBeforeSplitHint = 3

    private struct FileContents: Codable {
        var version: Int
        var items: [StackItem]
    }

    private let fileURL: URL
    private let calendar: Calendar
    private let now: () -> Date
    private var items: [StackItem] = []
    private var loaded = false

    /// The stack as it was before the last move, so one tap can put it back.
    /// In memory only: undo is for the tap you regret two seconds later, and
    /// a relaunch is well past that.
    private var undoState: (items: [StackItem], label: String)?

    /// - Parameters:
    ///   - fileURL: where the JSON lives. Defaults to Application Support.
    ///   - calendar: what "tomorrow" means. The phone's own, normally.
    ///   - now: the clock. Injected so tests can move the day along.
    init(
        fileURL: URL = LocalStackStore.defaultFileURL(),
        calendar: Calendar = .autoupdatingCurrent,
        now: @escaping () -> Date = Date.init
    ) {
        self.fileURL = fileURL
        self.calendar = calendar
        self.now = now
    }

    static func defaultFileURL() -> URL {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
        return support.appendingPathComponent("StackedWins", isDirectory: true)
            .appendingPathComponent("stack.json")
    }

    // MARK: StackBackend

    func dump(_ text: String, into kind: StackKind) async throws -> DumpResult {
        try load()
        let titles = DumpParser.parse(text)
        guard !titles.isEmpty else { throw Failure.nothingToAdd }

        remember(titles.count == 1 ? "Added \u{201C}\(titles[0])\u{201D}" : "Added \(titles.count) things")
        var position = backOfLane(kind)
        let stamp = timestamp()
        for title in titles {
            items.append(StackItem(
                id: Self.newID(), title: title, kind: kind, status: "open", position: position,
                snoozedUntil: nil, pushCount: 0, parentId: nil, completedAt: nil,
                createdAt: stamp, updatedAt: stamp
            ))
            position += 1
        }
        try save()
        return DumpResult(added: titles.count, kind: kind)
    }

    func next(in kind: StackKind) async throws -> NextCard {
        try load()
        try wakeExpiredSnoozes()
        let item = askable(in: kind).min { $0.position < $1.position }
        let counts = counts(kind)
        return NextCard(
            item: item,
            kind: kind,
            suggestSplit: (item?.pushCount ?? 0) >= Self.pushesBeforeSplitHint,
            remaining: counts.remaining, sleeping: counts.sleeping, done: counts.done, lanes: counts.lanes
        )
    }

    /// No AI on the phone -- the Break-it-up sheet hides that button. Undo
    /// is free here, because the whole stack is one array away.
    func capabilities() async throws -> StackCapabilities {
        StackCapabilities(splitAssist: false, undo: true)
    }

    func everything(in kind: StackKind) async throws -> StackList {
        try load()
        try wakeExpiredSnoozes()
        let open = items.filter { $0.kind == kind && $0.status == "open" }
            .sorted { $0.position < $1.position }
        let counts = counts(kind)
        return StackList(
            items: open, kind: kind,
            remaining: counts.remaining, sleeping: counts.sleeping, done: counts.done, lanes: counts.lanes
        )
    }

    func done(_ id: String) async throws -> StackItem {
        try remember(id) { "Cleared \u{201C}\($0.title)\u{201D}" }
        return try update(id) { item in
            item.status = "done"
            item.completedAt = self.timestamp()
        }
    }

    /// "Not now" — to the back of its own lane, no explanation, no penalty.
    func push(_ id: String) async throws -> StackItem {
        let index = try indexOf(id)
        remember("Pushed back \u{201C}\(items[index].title)\u{201D}")
        let back = backOfLane(items[index].kind)
        return try update(id) { item in
            item.position = back
            item.pushCount += 1
        }
    }

    /// "Not today" — sleeps until tomorrow and keeps its place in line.
    func later(_ id: String) async throws -> StackItem {
        try remember(id) { "\u{201C}\($0.title)\u{201D} until tomorrow" }
        let tomorrow = startOfTomorrow()
        return try update(id) { item in
            item.snoozedUntil = Timestamps.string(from: tomorrow)
        }
    }

    /// "Too big" — the reason the pile froze them. Pieces go to the front of
    /// the parent's lane: the card you just broke down is the card you were
    /// about to do, so its first piece is next.
    func split(_ id: String, pieces: String) async throws -> SplitResult {
        let index = try indexOf(id)
        let titles = DumpParser.parse(pieces)
        guard !titles.isEmpty else { throw Failure.noPieces }

        let parent = items[index]
        remember("Broke up \u{201C}\(parent.title)\u{201D}")
        let front = frontOfLane(parent.kind)
        let stamp = timestamp()
        items[index].status = "split"
        items[index].updatedAt = stamp
        for (offset, title) in titles.enumerated() {
            items.append(StackItem(
                id: Self.newID(), title: title, kind: parent.kind, status: "open",
                position: front - Double(titles.count - offset),
                snoozedUntil: nil, pushCount: 0, parentId: parent.id, completedAt: nil,
                createdAt: stamp, updatedAt: stamp
            ))
        }
        try save()
        return SplitResult(pieces: titles.count)
    }

    func suggestSplit(_ id: String) async throws -> SplitSuggestion {
        throw Failure.assistNeedsServer
    }

    /// Lands at the back of the lane it moves into.
    func move(_ id: String, to kind: StackKind) async throws -> StackItem {
        try remember(id) { "Moved \u{201C}\($0.title)\u{201D} to \(kind.label)" }
        let back = backOfLane(kind)
        return try update(id) { item in
            item.kind = kind
            item.position = back
        }
    }

    /// `up` / `down` swap with the neighbour; `top` jumps to the front.
    /// Already at the end it was heading for is a no-op, not an error.
    func rank(_ id: String, _ move: RankMove) async throws -> StackItem {
        let index = try indexOf(id)
        let item = items[index]
        remember("Reordered \u{201C}\(item.title)\u{201D}")

        if move == .top {
            let front = frontOfLane(item.kind)
            return try update(id) { $0.position = front - 1 }
        }

        let laneMates = items.filter { $0.kind == item.kind && $0.status == "open" && $0.id != item.id }
        let neighbour: StackItem?
        switch move {
        case .up:
            neighbour = laneMates.filter { $0.position < item.position }.max { $0.position < $1.position }
        case .down, .top:
            neighbour = laneMates.filter { $0.position > item.position }.min { $0.position < $1.position }
        }
        guard let neighbour, let neighbourIndex = items.firstIndex(where: { $0.id == neighbour.id }) else {
            return item
        }

        let stamp = timestamp()
        items[index].position = neighbour.position
        items[index].updatedAt = stamp
        items[neighbourIndex].position = item.position
        items[neighbourIndex].updatedAt = stamp
        try save()
        return items[index]
    }

    /// Kept rather than deleted: "I let this go" is worth being able to see.
    func drop(_ id: String) async throws -> StackItem {
        try remember(id) { "Let go of \u{201C}\($0.title)\u{201D}" }
        return try update(id) { $0.status = "dropped" }
    }

    // MARK: The wins, and taking a move back

    /// Everything cleared since a moment, newest first.
    func cleared(since: Date) async throws -> [StackItem] {
        try load()
        return items
            .filter { $0.status == "done" && ($0.completedDate ?? .distantPast) >= since }
            .sorted { ($0.completedDate ?? .distantPast) > ($1.completedDate ?? .distantPast) }
    }

    func undo() async throws -> String? {
        try load()
        guard let state = undoState else { return nil }
        items = state.items
        undoState = nil
        try save()
        return state.label
    }

    /// Snapshot before changing anything. Taken even when the move turns out
    /// to be a no-op -- undoing to an identical stack costs nothing, and a
    /// missing snapshot would silently undo the move before it instead.
    private func remember(_ label: String) {
        undoState = (items, label)
    }

    /// The same, for moves that need the card's own title in the label.
    private func remember(_ id: String, _ label: (StackItem) -> String) throws {
        let index = try indexOf(id)
        remember(label(items[index]))
    }

    // MARK: Extras the screens use

    /// True when nothing has ever been put down. The first open goes
    /// straight to the dump rather than to an empty card.
    func isEmpty() throws -> Bool {
        try load()
        return items.isEmpty
    }

    // MARK: Rules

    private func askable(in kind: StackKind) -> [StackItem] {
        let now = now()
        return items.filter { item in
            item.kind == kind && item.status == "open" && !isAsleep(item, at: now)
        }
    }

    private func isAsleep(_ item: StackItem, at now: Date) -> Bool {
        guard let until = item.snoozedDate else { return false }
        return until > now
    }

    /// A snooze that has passed is cleared, so the full list stops saying
    /// "sleeping" about a card that is back in play.
    private func wakeExpiredSnoozes() throws {
        let now = now()
        var changed = false
        for index in items.indices where items[index].snoozedUntil != nil && !isAsleep(items[index], at: now) {
            items[index].snoozedUntil = nil
            changed = true
        }
        if changed { try save() }
    }

    private func counts(_ kind: StackKind) -> (remaining: Int, sleeping: Int, done: Int, lanes: LaneCounts) {
        let now = now()
        let sleeping = items.filter { $0.kind == kind && $0.status == "open" && isAsleep($0, at: now) }.count
        let done = items.filter { $0.kind == kind && $0.status == "done" }.count
        let lanes = LaneCounts(need: askable(in: .need).count, want: askable(in: .want).count)
        return (lanes[kind], sleeping, done, lanes)
    }

    /// New and pushed cards land here. Counts every status, like the server,
    /// so a position is never reused.
    private func backOfLane(_ kind: StackKind) -> Double {
        (items.filter { $0.kind == kind }.map(\.position).max() ?? 0) + 1
    }

    /// Split pieces and "do first" land here.
    private func frontOfLane(_ kind: StackKind) -> Double {
        items.filter { $0.kind == kind && $0.status == "open" }.map(\.position).min() ?? 0
    }

    private func startOfTomorrow() -> Date {
        let today = calendar.startOfDay(for: now())
        return calendar.date(byAdding: .day, value: 1, to: today) ?? today.addingTimeInterval(86_400)
    }

    // MARK: Plumbing

    private func indexOf(_ id: String) throws -> Int {
        try load()
        guard let index = items.firstIndex(where: { $0.id == id }) else { throw Failure.notFound }
        return index
    }

    private func update(_ id: String, _ change: (inout StackItem) -> Void) throws -> StackItem {
        let index = try indexOf(id)
        change(&items[index])
        items[index].updatedAt = timestamp()
        try save()
        return items[index]
    }

    private func timestamp() -> String { Timestamps.string(from: now()) }

    private static func newID() -> String { UUID().uuidString.lowercased() }

    private func load() throws {
        guard !loaded else { return }
        loaded = true
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return }
        let data = try Data(contentsOf: fileURL)
        items = try JSONDecoder().decode(FileContents.self, from: data).items
    }

    private func save() throws {
        let folder = fileURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(FileContents(version: 1, items: items))
        try data.write(to: fileURL, options: .atomic)
    }
}

/// Turns a raw brain dump into clean titles. Same rules as the backend's
/// parseDump / normalizeTitle, because people paste from notes apps and type
/// fast, and none of that should cost them anything.
enum DumpParser {
    static let maxTitleLength = 500
    static let maxItems = 200

    /// Leading list markers people paste in: "- ", "* ", "• ", "1. ", "[ ] ".
    private static let listMarker = try! NSRegularExpression(
        pattern: #"^\s*(?:[-*•]|\d+[.)]|\[\s*[xX]?\s*\])\s*"#
    )

    static func parse(_ text: String) -> [String] {
        var seen = Set<String>()
        var titles: [String] = []
        for line in text.components(separatedBy: .newlines) {
            guard let title = normalizeTitle(line) else { continue }
            // Dedupe within one dump only: the same thing twice in one
            // sitting is a slip, not a second thing.
            let key = title.lowercased()
            guard !seen.contains(key) else { continue }
            seen.insert(key)
            titles.append(title)
            if titles.count >= maxItems { break }
        }
        return titles
    }

    static func normalizeTitle(_ raw: String) -> String? {
        let range = NSRange(raw.startIndex..., in: raw)
        let stripped = listMarker.stringByReplacingMatches(in: raw, range: range, withTemplate: "")
        let title = String(stripped.trimmingCharacters(in: .whitespacesAndNewlines).prefix(maxTitleLength))
        return title.isEmpty ? nil : title
    }
}
