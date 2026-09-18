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
    ///
    /// `brokenDown` and `started` are separate on purpose and must never be
    /// summed into a single "actions" number. Breaking a task into pieces is
    /// the user editing a plan; it is intent, and intent is not evidence that
    /// anything happened in the world. Conflating them would let the trial
    /// report planning as doing, which is the exact self-deception this
    /// product is supposed to interrupt.
    struct DayCounts: Codable, Equatable {
        var opens = 0
        /// Things put down — a dump, a Siri capture, a link.
        var captures = 0
        /// A card was broken into pieces and the user confirmed it.
        /// **Intent.** A first step was selected, not taken.
        var brokenDown = 0
        /// A card was marked done. **Evidence** — an explicit user act
        /// saying a specific thing is finished, which cannot happen without
        /// having started it.
        var started = 0

        var isEmpty: Bool { opens == 0 && captures == 0 && brokenDown == 0 && started == 0 }

        // Written by hand so that a version-1 file -- which stored a single
        // conflated `actions` -- decodes with both counters at zero rather
        // than having its ambiguous number silently become evidence. An old
        // record is missing data, and missing data is unknown, not a yes.
        enum CodingKeys: String, CodingKey {
            case opens, captures, brokenDown, started
        }

        init() {}

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            opens = try container.decodeIfPresent(Int.self, forKey: .opens) ?? 0
            captures = try container.decodeIfPresent(Int.self, forKey: .captures) ?? 0
            brokenDown = try container.decodeIfPresent(Int.self, forKey: .brokenDown) ?? 0
            started = try container.decodeIfPresent(Int.self, forKey: .started) ?? 0
        }
    }

    struct Record: Codable, Equatable {
        var version = 2
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

    /// A card was broken into pieces and the user confirmed it.
    ///
    /// **Intent, not evidence.** They selected a first step. Whether they
    /// then did it is something this app cannot see, and pretending
    /// otherwise would make the trial number worthless.
    func recordBrokenDown() { bump { $0.brokenDown += 1 } }

    /// A card was marked done.
    ///
    /// The strongest evidence available without asking the user anything: an
    /// explicit act naming a specific card as finished. Still a proxy -- they
    /// could tick off something they did yesterday -- and TRIAL.md says so.
    func recordStarted() { bump { $0.started += 1 } }

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

/// The two questions the 90-day target asks, answered from a record — with
/// **unknown** available as an answer, because it is often the true one.
///
/// The correction this type exists to carry: breaking a task down is the user
/// editing a plan. It is intent. Whether they then did the thing happens in
/// the world, where the app cannot see it. A report that counted a confirmed
/// breakdown as "they started" would be measuring our own feature being used
/// and calling it the user's life improving.
///
/// So there are three states, not two, and the operator resolves the third by
/// asking a person rather than by reading a number (TRIAL.md).
struct TrialReport: Equatable {

    /// What we can honestly say about whether this person started something.
    enum StartEvidence: String, Equatable {
        /// Nothing recorded. No intent, no evidence.
        case nothingYet
        /// They selected a first step and confirmed it, and nothing since
        /// says whether they did it. **Not a no.** The operator asks.
        case brokenDownOnly
        /// A card was marked done: an explicit act naming a thing finished.
        case started

        /// Deliberately plain, so nobody reading a report has to guess.
        var summary: String {
            switch self {
            case .nothingYet: return "nothing yet"
            case .brokenDownOnly: return "unknown — planned a step, no evidence they did it"
            case .started: return "started something"
            }
        }
    }

    /// Whether this record describes a person at all. `false` for fixtures,
    /// and the reason a fixture can never inflate a trial total.
    let countsAsRealUser: Bool
    let source: ActivationLog.Source

    let firstOpen: String?
    let totalCaptures: Int

    /// **Intent.** First steps selected and confirmed.
    let totalBrokenDown: Int
    /// **Evidence.** Cards marked done.
    let totalStarted: Int

    /// The honest three-way answer. Prefer this over the booleans below when
    /// reporting to a human.
    let startEvidence: StartEvidence

    /// True only where there is evidence — never for a breakdown alone.
    let started: Bool
    /// Days from first open to the first card marked done. 0 means same day.
    let daysToFirstStart: Int?
    /// Days from first open to the first confirmed breakdown. Useful for
    /// seeing whether the feature gets used at all, and nothing more.
    let daysToFirstBreakdown: Int?

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
        totalBrokenDown = days.values.reduce(0) { $0 + $1.brokenDown }
        totalStarted = days.values.reduce(0) { $0 + $1.started }
        activeDays = days.count

        started = totalStarted > 0
        startEvidence = started ? .started : (totalBrokenDown > 0 ? .brokenDownOnly : .nothingYet)

        guard let firstOpen, let start = Self.date(from: firstOpen, in: calendar) else {
            daysToFirstStart = nil
            daysToFirstBreakdown = nil
            returnedNextWeek = false
            nextWeekWindowComplete = false
            return
        }

        let offset = { (day: String) -> Int? in
            guard let date = Self.date(from: day, in: calendar) else { return nil }
            return calendar.dateComponents([.day], from: start, to: date).day
        }

        daysToFirstStart = days
            .filter { $0.value.started > 0 }
            .compactMap { offset($0.key) }
            .min()

        daysToFirstBreakdown = days
            .filter { $0.value.brokenDown > 0 }
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
