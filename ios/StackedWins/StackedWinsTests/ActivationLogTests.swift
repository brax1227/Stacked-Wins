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
        await log.recordAction()

        let report = await log.report()

        XCTAssertEqual(report.source, .fixture)
        XCTAssertFalse(report.countsAsRealUser, "a seeded record must never inflate a trial total")
        // The activity is still recorded truthfully; it just isn't a person.
        XCTAssertTrue(report.activated)
    }

    func testARealRecordIsNotDowngradedByALaterFixtureWriter() async throws {
        // Same file, opened later by a fixture-sourced instance. The record's
        // own source wins: a real trial user can't be turned into test data.
        let real = makeLog(source: .real)
        await real.recordOpen()

        let fixture = makeLog(source: .fixture)
        await fixture.recordAction()

        let report = await fixture.report()
        XCTAssertEqual(report.source, .real)
        XCTAssertTrue(report.countsAsRealUser)
    }

    func testAFixtureRecordIsNotPromotedByALaterRealWriter() async throws {
        let fixture = makeLog(source: .fixture)
        await fixture.recordOpen()

        let real = makeLog(source: .real)
        await real.recordAction()

        let report = await real.report()
        XCTAssertEqual(report.source, .fixture, "seeded data stays seeded")
        XCTAssertFalse(report.countsAsRealUser)
    }

    // MARK: - Activation

    func testAFreshInstallHasActivatedNothing() async throws {
        let report = await makeLog().report()

        XCTAssertFalse(report.activated)
        XCTAssertNil(report.firstOpen)
        XCTAssertNil(report.daysToActivation)
        XCTAssertEqual(report.activeDays, 0)
    }

    func testCaptureAloneIsNotActivation() async throws {
        // The explicit north-star rule: a full inbox nobody acts on is the
        // problem, not the fix.
        let log = makeLog()
        await log.recordOpen()
        await log.recordCapture()
        await log.recordCapture()

        let report = await log.report()
        XCTAssertEqual(report.totalCaptures, 2)
        XCTAssertFalse(report.activated)
        XCTAssertNil(report.daysToActivation)
    }

    func testActingOnTheFirstDayIsSameDayActivation() async throws {
        let log = makeLog()
        await log.recordOpen()
        await log.recordCapture()
        await log.recordAction()

        let report = await log.report()
        XCTAssertTrue(report.activated)
        XCTAssertEqual(report.daysToActivation, 0)
        XCTAssertEqual(report.totalActions, 1)
        XCTAssertEqual(report.firstOpen, "2026-09-18")
    }

    func testActivationIsMeasuredFromTheFirstActionNotTheLast() async throws {
        let log = makeLog()
        await log.recordOpen()
        advance(days: 2)
        await log.recordAction()
        advance(days: 5)
        await log.recordAction()

        let report = await log.report()
        XCTAssertEqual(report.daysToActivation, 2)
        XCTAssertEqual(report.totalActions, 2)
    }

    // MARK: - Next-week return

    func testComingBackTheFollowingWeekCounts() async throws {
        let log = makeLog()
        await log.recordOpen()
        await log.recordAction()

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
        await log.recordAction()

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
        XCTAssertEqual(days["2026-09-18"], ["opens": 1, "captures": 1, "actions": 1])
    }

    func testTheExportIsSomethingAPersonCanReadBeforeSendingIt() async throws {
        let log = makeLog()
        await log.recordOpen()
        await log.recordAction()

        let text = await log.exportJSON()

        XCTAssertTrue(text.contains("\"actions\" : 1") || text.contains("\"actions\": 1"))
        XCTAssertTrue(text.contains("2026-09-18"))
        // Round-trips, so what they read is what an operator receives.
        XCTAssertNoThrow(try JSONDecoder().decode(ActivationLog.Record.self, from: Data(text.utf8)))
    }

    func testItSurvivesARelaunch() async throws {
        let first = makeLog()
        await first.recordOpen()
        await first.recordAction()

        let reopened = makeLog()
        let report = await reopened.report()

        XCTAssertTrue(report.activated)
        XCTAssertEqual(report.firstOpen, "2026-09-18")
    }

    func testResetLeavesNothingBehind() async throws {
        let log = makeLog()
        await log.recordOpen()
        await log.recordAction()

        try await log.reset()

        XCTAssertFalse(FileManager.default.fileExists(atPath: fileURL.path))
        let report = await makeLog().report()
        XCTAssertFalse(report.activated)
        XCTAssertNil(report.firstOpen)
    }

    func testNothingIsWrittenUntilSomethingHappens() async throws {
        _ = await makeLog().report()
        XCTAssertFalse(FileManager.default.fileExists(atPath: fileURL.path),
                       "opening a report must not create a record")
    }
}
