import Foundation

/// Whether the app is doing its job, measured without spying on anyone.
///
/// The north star is "help users start tasks that feel too big" and the
/// 90-day target needs two numbers per trial user: did they get to a first
/// action, and did they come back the week after. Getting those honestly at
/// this size does not need analytics — it needs counts and dates.
///
/// So this stores **dates and integers, and nothing else**. No task titles,
/// no card ids, no device identifiers, no timestamps finer than a day, no
/// network. The file sits next to the stack in the app's own folder, the
/// person it describes can read the whole thing in the app, and it leaves the
/// phone only if they choose to send it.
///
/// ## Fixtures are not people
///
/// Every record carries a `source`. Anything written by a test, a demo or a
/// seeded fixture is `.fixture` and is excluded from trial totals by
/// `TrialReport`. A trial of ten that quietly counted the developer's own
/// simulator runs would be worse than no measurement at all, so the
/// distinction is in the data rather than in a convention someone has to
/// remember. See TRIAL.md.
actor ActivationLog {
    static let shared = ActivationLog()

    /// Where a record came from. Stored, not inferred.
    enum Source: String, Codable, Equatable {
        /// A person using the app.
        case real
        /// A test, a demo, or seeded data. Never counted as a trial user.
        case fixture
    }

    /// What one day looked like. Counts only.
    struct DayCounts: Codable, Equatable {
        var opens = 0
        /// Things put down — a dump, a Siri capture, a link.
        var captures = 0
        /// Cards actually moved on: cleared, or broken down and confirmed.
        /// This is the one that means "started something".
        var actions = 0

        var isEmpty: Bool { opens == 0 && captures == 0 && actions == 0 }
    }

    struct Record: Codable, Equatable {
        var version = 1
        var source: Source = .real
        /// Date only, "2026-09-18". The day the app was first opened.
        var firstOpen: String?
        /// Day -> what happened. Keyed by date only, on purpose.
        var days: [String: DayCounts] = [:]
    }

    private let fileURL: URL
    private let calendar: Calendar
    private let now: () -> Date
    private let source: Source
    private var record: Record?

    init(
        fileURL: URL = ActivationLog.defaultFileURL(),
        calendar: Calendar = .autoupdatingCurrent,
        now: @escaping () -> Date = Date.init,
        source: Source = .real
    ) {
        self.fileURL = fileURL
        self.calendar = calendar
        self.now = now
        self.source = source
    }

    static func defaultFileURL() -> URL {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
        return support.appendingPathComponent("StackedWins", isDirectory: true)
            .appendingPathComponent("activation.json")
    }

    // MARK: - Recording

    func recordOpen() { bump { $0.opens += 1 } }
    func recordCapture() { bump { $0.captures += 1 } }

    /// A card was cleared, or broken down and confirmed. The moment the north
    /// star is about.
    func recordAction() { bump { $0.actions += 1 } }

    private func bump(_ change: (inout DayCounts) -> Void) {
        var current = load()
        let today = Self.day(from: now(), in: calendar)

        // The source of the file wins over the source of the writer: a real
        // record must never be silently downgraded, and a fixture record must
        // never be promoted by a later real write.
        if current.firstOpen == nil {
            current.firstOpen = today
            current.source = source
        }

        var counts = current.days[today] ?? DayCounts()
        change(&counts)
        current.days[today] = counts

        record = current
        try? save(current)
    }

    // MARK: - Reading

    func report() -> TrialReport {
        TrialReport(record: load(), calendar: calendar, today: now())
    }

    /// The whole file, pretty-printed, for a person to read before they decide
    /// to share it. Being readable is the privacy promise: you can see there
    /// is nothing in here but dates and numbers.
    func exportJSON() -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        guard let data = try? encoder.encode(load()),
              let text = String(data: data, encoding: .utf8)
        else { return "{}" }
        return text
    }

    /// Forget everything. For a tester who wants to start clean, and for
    /// anyone who simply doesn't want it kept.
    func reset() throws {
        record = nil
        if FileManager.default.fileExists(atPath: fileURL.path) {
            try FileManager.default.removeItem(at: fileURL)
        }
    }

    // MARK: - Plumbing

    private func load() -> Record {
        if let record { return record }
        guard let data = try? Data(contentsOf: fileURL),
              let decoded = try? JSONDecoder().decode(Record.self, from: data)
        else {
            let fresh = Record(source: source)
            record = fresh
            return fresh
        }
        record = decoded
        return decoded
    }

    private func save(_ record: Record) throws {
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        try encoder.encode(record).write(to: fileURL, options: .atomic)
    }

    /// Date only. The whole point is that we never learn the time of day.
    static func day(from date: Date, in calendar: Calendar) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }
}

/// The two questions the 90-day target asks, answered from a record.
///
/// Deliberately a value type computed from stored counts rather than
/// something incremented as it goes: a derived number can be recomputed and
/// argued with, a stored one can only be trusted.
struct TrialReport: Equatable {
    /// Whether this record describes a person at all. `false` for fixtures,
    /// and the reason a fixture can never inflate a trial total.
    let countsAsRealUser: Bool
    let source: ActivationLog.Source

    let firstOpen: String?
    let totalCaptures: Int
    let totalActions: Int

    /// **Activation.** They got a card to a first action — cleared it, or
    /// broke it down and confirmed. Capture alone is not activation: a full
    /// inbox nobody acts on is the problem, not the fix (NORTH_STAR.md).
    let activated: Bool
    /// Days between first open and first action. 0 means same day.
    let daysToActivation: Int?

    /// Distinct days with any activity.
    let activeDays: Int
    /// **Next-week return.** Any activity 7 to 13 days after first open.
    /// A window rather than a point, because "the following week" is a week.
    let returnedNextWeek: Bool
    /// How much of that window has actually elapsed — so an unfinished trial
    /// reads as "too early to say" instead of a failure.
    let nextWeekWindowComplete: Bool

    init(record: ActivationLog.Record, calendar: Calendar, today: Date) {
        source = record.source
        countsAsRealUser = record.source == .real
        firstOpen = record.firstOpen

        let days = record.days.filter { !$0.value.isEmpty }
        totalCaptures = days.values.reduce(0) { $0 + $1.captures }
        totalActions = days.values.reduce(0) { $0 + $1.actions }
        activeDays = days.count
        activated = totalActions > 0

        guard let firstOpen, let start = Self.date(from: firstOpen, in: calendar) else {
            daysToActivation = nil
            returnedNextWeek = false
            nextWeekWindowComplete = false
            return
        }

        let offset = { (day: String) -> Int? in
            guard let date = Self.date(from: day, in: calendar) else { return nil }
            return calendar.dateComponents([.day], from: start, to: date).day
        }

        daysToActivation = days
            .filter { $0.value.actions > 0 }
            .compactMap { offset($0.key) }
            .min()

        returnedNextWeek = days.contains { day, counts in
            guard !counts.isEmpty, let delta = offset(day) else { return false }
            return (7...13).contains(delta)
        }

        let elapsed = calendar.dateComponents([.day], from: start, to: today).day ?? 0
        nextWeekWindowComplete = elapsed >= 13
    }

    private static func date(from day: String, in calendar: Calendar) -> Date? {
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }
}
