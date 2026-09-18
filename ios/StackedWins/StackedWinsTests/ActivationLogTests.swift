import XCTest
@testable import StackedWins

/// Measurement for the 90-day trial: did a person get to a first action, and
/// did they come back the week after.
///
/// The load-bearing test in here is the fixture one. A trial of ten that
/// quietly counted seeded or test data would produce a number that looks like
/// evidence and isn't.
final class ActivationLogTests: XCTestCase {

    private var fileURL: URL!
    private var clock: Date!
    private var calendar: Calendar!

    override func setUp() {
        super.setUp()
        fileURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("stacked-wins-activation-\(UUID().uuidString)", isDirectory: true)
            .appendingPathComponent("activation.json")
        calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Chicago")!
        clock = calendar.date(from: DateComponents(year: 2026, month: 9, day: 18, hour: 9))!
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: fileURL.deletingLastPathComponent())
        super.tearDown()
    }

    private func makeLog(source: ActivationLog.Source = .real) -> ActivationLog {
        ActivationLog(fileURL: fileURL, calendar: calendar, now: { self.clock }, source: source)
    }

    private func advance(days: Int) {
        clock = calendar.date(byAdding: .day, value: days, to: clock)!
    }

    // MARK: - Fixtures are not people

    func testAFixtureIsNeverCountedAsARealUser() async throws {
        let log = makeLog(source: .fixture)
        await log.recordOpen()
        await log.recordCapture()
        await log.recordStarted()

        let report = await log.report()

        XCTAssertEqual(report.source, .fixture)
        XCTAssertFalse(report.countsAsRealUser, "a seeded record must never inflate a trial total")
        // The activity is still recorded truthfully; it just isn't a person.
        XCTAssertTrue(report.started)
    }

    func testARealRecordIsNotDowngradedByALaterFixtureWriter() async throws {
        // Same file, opened later by a fixture-sourced instance. The record's
        // own source wins: a real trial user can't be turned into test data.
        let real = makeLog(source: .real)
        await real.recordOpen()

        let fixture = makeLog(source: .fixture)
        await fixture.recordStarted()

        let report = await fixture.report()
        XCTAssertEqual(report.source, .real)
        XCTAssertTrue(report.countsAsRealUser)
    }

    func testAFixtureRecordIsNotPromotedByALaterRealWriter() async throws {
        let fixture = makeLog(source: .fixture)
        await fixture.recordOpen()

        let real = makeLog(source: .real)
        await real.recordStarted()

        let report = await real.report()
        XCTAssertEqual(report.source, .fixture, "seeded data stays seeded")
        XCTAssertFalse(report.countsAsRealUser)
    }

    func testFixtureBreakdownsAndStartsAreBothExcludedFromTrialTotals() async throws {
        // Both counters, not just the old conflated one, have to be
        // unusable as trial evidence when the record is seeded.
        let log = makeLog(source: .fixture)
        await log.recordOpen()
        await log.recordBrokenDown()
        await log.recordStarted()

        let report = await log.report()

        XCTAssertFalse(report.countsAsRealUser)
        XCTAssertEqual(report.source, .fixture)
        // Recorded truthfully; simply not a person.
        XCTAssertEqual(report.totalBrokenDown, 1)
        XCTAssertEqual(report.totalStarted, 1)
        XCTAssertEqual(report.startEvidence, .started)
    }

    // MARK: - Intent is not evidence

    func testAFreshInstallHasStartedNothing() async throws {
        let report = await makeLog().report()

        XCTAssertFalse(report.started)
        XCTAssertEqual(report.startEvidence, .nothingYet)
        XCTAssertNil(report.firstOpen)
        XCTAssertNil(report.daysToFirstStart)
        XCTAssertEqual(report.activeDays, 0)
    }

    func testCaptureAloneIsNotStarting() async throws {
        // A full inbox nobody acts on is the problem, not the fix.
        let log = makeLog()
        await log.recordOpen()
        await log.recordCapture()
        await log.recordCapture()

        let report = await log.report()
        XCTAssertEqual(report.totalCaptures, 2)
        XCTAssertFalse(report.started)
        XCTAssertEqual(report.startEvidence, .nothingYet)
        XCTAssertNil(report.daysToFirstStart)
    }

    /// The correction this whole change exists for: selecting a first step is
    /// the user editing a plan, and must never be reported as having started.
    func testSelectingAFirstStepWithoutStartingIsNotEvidence() async throws {
        let log = makeLog()
        await log.recordOpen()
        await log.recordCapture()
        await log.recordBrokenDown()

        let report = await log.report()

        XCTAssertEqual(report.totalBrokenDown, 1)
        XCTAssertEqual(report.totalStarted, 0)
        XCTAssertFalse(report.started, "breaking a task down is intent, not action")
        XCTAssertNil(report.daysToFirstStart)
        XCTAssertEqual(report.daysToFirstBreakdown, 0)
    }

    /// Missing evidence reads as unknown. Not as a no, which would quietly
    /// count a user the operator has simply not asked yet as a failure.
    func testABreakdownWithNoStartIsUnknownRatherThanNo() async throws {
        let log = makeLog()
        await log.recordOpen()
        await log.recordBrokenDown()
        await log.recordBrokenDown()

        let report = await log.report()

        XCTAssertEqual(report.startEvidence, .brokenDownOnly)
        XCTAssertTrue(report.startEvidence.summary.contains("unknown"))
        XCTAssertFalse(report.started)
    }

    func testNoAmountOfPlanningEverBecomesEvidence() async throws {
        // Ten breakdowns is ten plans, not one start.
        let log = makeLog()
        await log.recordOpen()
        for _ in 0..<10 { await log.recordBrokenDown() }

        let report = await log.report()
        XCTAssertEqual(report.totalBrokenDown, 10)
        XCTAssertFalse(report.started)
        XCTAssertEqual(report.startEvidence, .brokenDownOnly)
    }

    func testMarkingSomethingDoneIsEvidence() async throws {
        let log = makeLog()
        await log.recordOpen()
        await log.recordCapture()
        await log.recordStarted()

        let report = await log.report()
        XCTAssertTrue(report.started)
        XCTAssertEqual(report.startEvidence, .started)
        XCTAssertEqual(report.daysToFirstStart, 0)
        XCTAssertEqual(report.totalStarted, 1)
        XCTAssertEqual(report.firstOpen, "2026-09-18")
    }

    func testBreakingDownThenDoingItReadsAsStarted() async throws {
        // The hoped-for path, and the two counts stay distinguishable.
        let log = makeLog()
        await log.recordOpen()
        await log.recordBrokenDown()
        advance(days: 1)
        await log.recordStarted()

        let report = await log.report()
        XCTAssertEqual(report.startEvidence, .started)
        XCTAssertEqual(report.totalBrokenDown, 1)
        XCTAssertEqual(report.totalStarted, 1)
        XCTAssertEqual(report.daysToFirstBreakdown, 0)
        XCTAssertEqual(report.daysToFirstStart, 1)
    }

    func testStartingIsMeasuredFromTheFirstOneNotTheLast() async throws {
        let log = makeLog()
        await log.recordOpen()
        advance(days: 2)
        await log.recordStarted()
        advance(days: 5)
        await log.recordStarted()

        let report = await log.report()
        XCTAssertEqual(report.daysToFirstStart, 2)
        XCTAssertEqual(report.totalStarted, 2)
    }

    /// A version-1 file stored a single conflated `actions` count. It must not
    /// be read as evidence, because nobody can now say what it was.
    func testALegacyConflatedRecordIsNotReadAsEvidence() async throws {
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        let legacy = """
        {"version":1,"source":"real","firstOpen":"2026-09-18",\
        "days":{"2026-09-18":{"opens":4,"captures":3,"actions":9}}}
        """.replacingOccurrences(of: "\\\n", with: "")
        try Data(legacy.utf8).write(to: fileURL)

        let report = await makeLog().report()

        XCTAssertEqual(report.totalCaptures, 3, "unambiguous fields still read")
        XCTAssertEqual(report.totalStarted, 0, "an ambiguous 9 is not 9 starts")
        XCTAssertEqual(report.totalBrokenDown, 0, "nor 9 breakdowns")
        XCTAssertFalse(report.started)
    }

    // MARK: - Next-week return

    func testComingBackTheFollowingWeekCounts() async throws {
        let log = makeLog()
        await log.recordOpen()
        await log.recordStarted()

        advance(days: 8)
        await log.recordOpen()

        let report = await log.report()
        XCTAssertTrue(report.returnedNextWeek)
        XCTAssertEqual(report.activeDays, 2)
    }

    func testComingBackTheSameWeekIsNotNextWeek() async throws {
        let log = makeLog()
        await log.recordOpen()
        advance(days: 3)
        await log.recordOpen()

        let report = await log.report()
        XCTAssertFalse(report.returnedNextWeek, "day 3 is the same week")
    }

    func testComingBackAFortnightLaterIsNotNextWeekEither() async throws {
        let log = makeLog()
        await log.recordOpen()
        advance(days: 20)
        await log.recordOpen()

        let report = await log.report()
        XCTAssertFalse(report.returnedNextWeek, "day 20 is outside the 7-13 window")
    }

    func testTheDayBeforeAndAfterTheWindowAreOutside() async throws {
        for day in [6, 14] {
            let report = try await reportReturning(onDay: day)
            XCTAssertFalse(report.returnedNextWeek, "day \(day) is outside the 7-13 window")
        }
    }

    func testBothEdgesOfTheWindowAreInside() async throws {
        for day in [7, 13] {
            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent("edge-\(day)-\(UUID().uuidString)", isDirectory: true)
                .appendingPathComponent("activation.json")
            defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }

            var moment = calendar.date(from: DateComponents(year: 2026, month: 9, day: 18, hour: 9))!
            let log = ActivationLog(fileURL: url, calendar: calendar, now: { moment }, source: .real)
            await log.recordOpen()
            moment = calendar.date(byAdding: .day, value: day, to: moment)!
            await log.recordOpen()

            let report = await log.report()
            XCTAssertTrue(report.returnedNextWeek, "day \(day) should be inside the window")
        }
    }

    /// A fresh record that opens on day 0 and comes back on `day`.
    private func reportReturning(onDay day: Int) async throws -> TrialReport {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("boundary-\(day)-\(UUID().uuidString)", isDirectory: true)
            .appendingPathComponent("activation.json")
        var moment = calendar.date(from: DateComponents(year: 2026, month: 9, day: 18, hour: 9))!
        let log = ActivationLog(fileURL: url, calendar: calendar, now: { moment }, source: .real)
        await log.recordOpen()
        moment = calendar.date(byAdding: .day, value: day, to: moment)!
        await log.recordOpen()
        let report = await log.report()
        try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
        return report
    }

    func testAnUnfinishedWindowReadsAsTooEarlyRatherThanAFailure() async throws {
        let log = makeLog()
        await log.recordOpen()
        advance(days: 3)
        await log.recordOpen()

        var report = await log.report()
        XCTAssertFalse(report.returnedNextWeek)
        XCTAssertFalse(report.nextWeekWindowComplete, "only day 3: the question isn't answerable yet")

        advance(days: 11)
        report = await log.report()
        XCTAssertTrue(report.nextWeekWindowComplete, "day 14: now a no really is a no")
    }

    // MARK: - What it stores, and what it doesn't

    func testTheFileHoldsDatesAndCountsAndNothingElse() async throws {
        let log = makeLog()
        await log.recordOpen()
        await log.recordCapture()
        await log.recordBrokenDown()
        await log.recordStarted()

        let raw = try String(contentsOf: fileURL, encoding: .utf8)

        // Nothing resembling a task, an id, or a clock time. (A colon alone
        // proves nothing -- JSON is full of them -- so look for the shape of
        // a timestamp instead.)
        XCTAssertNil(raw.range(of: #"\d{1,2}:\d{2}"#, options: .regularExpression),
                     "no times of day anywhere in the file")
        XCTAssertNil(raw.range(of: #"\d{4}-\d{2}-\d{2}T"#, options: .regularExpression),
                     "dates are date-only, never instants")
        XCTAssertFalse(raw.lowercased().contains("title"))
        XCTAssertFalse(raw.lowercased().contains("uuid"))

        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any])
        XCTAssertEqual(Set(json.keys), ["version", "source", "firstOpen", "days"])

        let days = try XCTUnwrap(json["days"] as? [String: [String: Int]])
        XCTAssertEqual(days.keys.first, "2026-09-18", "keyed by date only")
        XCTAssertEqual(days["2026-09-18"],
                       ["opens": 1, "captures": 1, "brokenDown": 1, "started": 1],
                       "intent and evidence are stored as separate numbers")
        XCTAssertNil(days["2026-09-18"]?["actions"], "the conflated field is gone")
    }

    func testTheExportIsSomethingAPersonCanReadBeforeSendingIt() async throws {
        let log = makeLog()
        await log.recordOpen()
        await log.recordStarted()

        let text = await log.exportJSON()

        XCTAssertTrue(text.contains("\"started\" : 1") || text.contains("\"started\": 1"))
        XCTAssertTrue(text.contains("2026-09-18"))
        // Round-trips, so what they read is what an operator receives.
        XCTAssertNoThrow(try JSONDecoder().decode(ActivationLog.Record.self, from: Data(text.utf8)))
    }

    func testItSurvivesARelaunch() async throws {
        let first = makeLog()
        await first.recordOpen()
        await first.recordStarted()

        let reopened = makeLog()
        let report = await reopened.report()

        XCTAssertTrue(report.started)
        XCTAssertEqual(report.firstOpen, "2026-09-18")
    }

    func testResetLeavesNothingBehind() async throws {
        let log = makeLog()
        await log.recordOpen()
        await log.recordStarted()

        try await log.reset()

        XCTAssertFalse(FileManager.default.fileExists(atPath: fileURL.path))
        let report = await makeLog().report()
        XCTAssertFalse(report.started)
        XCTAssertNil(report.firstOpen)
    }

    func testNothingIsWrittenUntilSomethingHappens() async throws {
        _ = await makeLog().report()
        XCTAssertFalse(FileManager.default.fileExists(atPath: fileURL.path),
                       "opening a report must not create a record")
    }
}
