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

    /// Tests state the environment explicitly: a suite whose expectations
    /// changed depending on whether it ran on a simulator would be useless.
    private func makeLog(source: ActivationLog.Source = .real,
                         environment: ActivationLog.Environment = .device) -> ActivationLog {
        ActivationLog(fileURL: fileURL, calendar: calendar, now: { self.clock },
                      source: source, environment: environment)
    }

    private func advance(days: Int) {
        clock = calendar.date(byAdding: .day, value: days, to: clock)!
    }

    // MARK: - Fixtures are not people

    func testAFixtureIsNeverCountedAsARealUser() async throws {
        let log = makeLog(source: .fixture, environment: .simulator)
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

        let fixture = makeLog(source: .fixture, environment: .simulator)
        await fixture.recordStarted()

        let report = await fixture.report()
        XCTAssertEqual(report.source, .real)
        XCTAssertTrue(report.countsAsRealUser)
    }

    func testAFixtureRecordIsNotPromotedByALaterRealWriter() async throws {
        let fixture = makeLog(source: .fixture, environment: .simulator)
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
        let log = makeLog(source: .fixture, environment: .simulator)
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

    // MARK: - The source-selection boundary itself

    /// The rule, checked exhaustively rather than only in whichever build the
    /// tests happen to run under. This is the thing that keeps TRIAL.md's
    /// promise -- simulator and demo records are fixtures -- true in
    /// production, where nobody is passing `.fixture` by hand.
    func testOnlyARealDeviceBuildProducesARealSource() {
        XCTAssertEqual(ActivationLog.source(for: .device), .real)
        XCTAssertEqual(ActivationLog.source(for: .simulator), .fixture)
        XCTAssertEqual(ActivationLog.source(for: .debugBuild), .fixture)
    }

    /// What *this* build says about itself. On the CI simulator run this is
    /// the real assertion: a simulator can never write a trial participant.
    func testTheRunningBuildSelectsItsOwnSourceHonestly() {
        let environment = ActivationLog.currentEnvironment()
        let source = ActivationLog.currentSource()

        #if targetEnvironment(simulator)
        XCTAssertEqual(environment, .simulator)
        XCTAssertEqual(source, .fixture, "a simulator run must never be a trial user")
        #elseif DEBUG
        XCTAssertEqual(environment, .debugBuild)
        XCTAssertEqual(source, .fixture, "a debug build must never be a trial user")
        #else
        XCTAssertEqual(environment, .device)
        XCTAssertEqual(source, .real)
        #endif
        XCTAssertEqual(source, ActivationLog.source(for: environment))
    }

    /// The default-argument boundary: a log built the way `shared` builds it,
    /// with nothing passed, must stamp the build's own verdict. Previously
    /// this defaulted to `.real` regardless.
    func testALogConstructedWithNoSourceArgumentStampsTheBuildsVerdict() async throws {
        let log = ActivationLog(fileURL: fileURL, calendar: calendar, now: { self.clock })
        await log.recordOpen()

        let report = await log.report()
        XCTAssertEqual(report.source, ActivationLog.currentSource())
        XCTAssertEqual(report.environment, ActivationLog.currentEnvironment())

        #if targetEnvironment(simulator) || DEBUG
        XCTAssertEqual(report.eligibility, .excluded,
                       "a record written by this build must not be counted as a participant")
        #endif
    }

    // MARK: - Eligibility for the tally

    func testAReleaseBuildOnRealHardwareIsEligible() async throws {
        let log = makeLog(source: .real, environment: .device)
        await log.recordOpen()

        let report = await log.report()
        XCTAssertEqual(report.eligibility, .eligible)
        XCTAssertTrue(report.countsAsRealUser)
    }

    func testSimulatorAndDebugRecordsAreExcludedNotMerelyFlagged() async throws {
        for environment in [ActivationLog.Environment.simulator, .debugBuild] {
            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent("env-\(environment.rawValue)-\(UUID().uuidString)", isDirectory: true)
                .appendingPathComponent("activation.json")
            defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }

            let log = ActivationLog(fileURL: url, calendar: calendar, now: { self.clock },
                                    source: ActivationLog.source(for: environment),
                                    environment: environment)
            await log.recordOpen()
            await log.recordStarted()

            let report = await log.report()
            XCTAssertEqual(report.eligibility, .excluded, "\(environment.rawValue)")
            XCTAssertFalse(report.countsAsRealUser)
        }
    }

    /// A record from before source selection existed. Its `real` source is
    /// preserved -- history is not rewritten -- but it cannot be counted
    /// until a person vouches for it.
    func testARecordWithNoEnvironmentIsSurfacedRatherThanCountedOrDiscarded() async throws {
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        let historical = #"{"version":2,"source":"real","firstOpen":"2026-09-18","days":{"2026-09-18":{"opens":2,"captures":1,"brokenDown":0,"started":1}}}"#
        try Data(historical.utf8).write(to: fileURL)

        let report = await makeLog().report()

        XCTAssertEqual(report.source, .real, "history is not silently reclassified")
        XCTAssertTrue(report.countsAsRealUser, "its own source still says what it said")
        XCTAssertNil(report.environment)
        XCTAssertEqual(report.eligibility, .needsOperatorConfirmation,
                       "unknown provenance is neither counted nor thrown away")
        XCTAssertTrue(report.eligibility.summary.contains("operator"))
        // The activity itself is read normally.
        XCTAssertTrue(report.started)
    }

    func testAnExistingRealRecordKeepsItsEnvironmentWhenWrittenToAgain() async throws {
        // A device-stamped record reopened by any later writer keeps both its
        // source and the environment it was born in.
        let first = makeLog(source: .real, environment: .device)
        await first.recordOpen()

        let later = ActivationLog(fileURL: fileURL, calendar: calendar, now: { self.clock },
                                  source: .fixture, environment: .simulator)
        await later.recordStarted()

        let report = await later.report()
        XCTAssertEqual(report.source, .real)
        XCTAssertEqual(report.environment, .device)
        XCTAssertEqual(report.eligibility, .eligible)
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

    // MARK: - Nothing dated after today answers for today

    /// A clock set forward and then corrected writes a day that has not
    /// happened yet. Before this, any such day inside the window counted as a
    /// return the moment the file was read -- the report would say a user had
    /// come back on day 9 while they were still on day 1.
    func testADayDatedAfterTodayIsNotAReturn() async throws {
        let log = makeLog()
        await log.recordOpen()

        advance(days: 9)               // clock jumps forward
        await log.recordOpen()
        advance(days: -9)              // and is corrected

        let report = await log.report()
        XCTAssertFalse(report.returnedNextWeek,
                       "day 9 has not happened yet — it cannot be a return on day 0")
        XCTAssertFalse(report.nextWeekWindowComplete,
                       "and the window is still open, so this is unknown rather than a no")
    }

    /// The same file, once the date catches up. Nothing was thrown away.
    func testTheSameDayCountsOnceTheDateReachesIt() async throws {
        let log = makeLog()
        await log.recordOpen()

        advance(days: 9)
        await log.recordOpen()
        advance(days: -9)
        let tooEarly = await log.report()
        XCTAssertFalse(tooEarly.returnedNextWeek)

        advance(days: 9)
        let onTime = await log.report()
        XCTAssertTrue(onTime.returnedNextWeek,
                      "the day is still in the file and counts when it arrives")
    }

    /// The boundary itself: today counts, tomorrow does not.
    func testTodayCountsAndTomorrowDoesNot() async throws {
        let log = makeLog()
        await log.recordOpen()
        advance(days: 7)
        await log.recordOpen()

        advance(days: -1)
        let dayBefore = await log.report()
        XCTAssertFalse(dayBefore.returnedNextWeek,
                       "day 7 read on day 6: it has not happened yet")

        advance(days: 1)
        let onTheDay = await log.report()
        XCTAssertTrue(onTheDay.returnedNextWeek,
                      "the same day, read on the day itself, counts")
    }

    /// A start in the future is not evidence of starting, for the same reason.
    func testAFutureDayIsNotEvidenceOfStarting() async throws {
        let log = makeLog()
        await log.recordOpen()

        advance(days: 4)
        await log.recordStarted()
        advance(days: -4)

        let report = await log.report()
        XCTAssertEqual(report.startEvidence, .nothingYet,
                       "a card marked done on a day that has not happened is not evidence today")
        XCTAssertEqual(report.totalStarted, 0)
        XCTAssertNil(report.daysToFirstStart)

        advance(days: 4)
        let later = await log.report()
        XCTAssertEqual(later.startEvidence, .started, "and it is evidence once that day arrives")
        XCTAssertEqual(later.daysToFirstStart, 4)
    }

    // MARK: - When the window actually closes

    /// A report generated at `hour` on the day `day` after first open, with
    /// no return recorded. The question is only whether it dares call itself
    /// answered.
    private func windowComplete(onDay day: Int, hour: Int) async throws -> Bool {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("close-\(day)-\(hour)-\(UUID().uuidString)", isDirectory: true)
            .appendingPathComponent("activation.json")
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }

        let open = calendar.date(from: DateComponents(year: 2026, month: 9, day: 18, hour: 9))!
        var moment = open
        let log = ActivationLog(fileURL: url, calendar: calendar, now: { moment },
                                source: .real, environment: .device)
        await log.recordOpen()

        let thatDay = calendar.date(byAdding: .day, value: day, to: calendar.startOfDay(for: open))!
        moment = calendar.date(byAdding: .hour, value: hour, to: thatDay)!
        return await log.report().nextWeekWindowComplete
    }

    /// Day 13 is the last day a return counts, so the whole of it is still
    /// live. Closing at its first minute would turn someone who came back
    /// that afternoon into a recorded "no".
    func testTheWindowIsStillOpenAtTheVeryStartOfTheLastEligibleDay() async throws {
        let complete = try await windowComplete(onDay: 13, hour: 0)
        XCTAssertFalse(complete, "00:00 on day 13: the user has all day to come back")
    }

    func testTheWindowIsStillOpenAtTheVeryEndOfTheLastEligibleDay() async throws {
        let complete = try await windowComplete(onDay: 13, hour: 23)
        XCTAssertFalse(complete, "23:00 on day 13: still their day")
    }

    func testTheWindowClosesAtTheStartOfTheDayAfterTheLastEligibleOne() async throws {
        let complete = try await windowComplete(onDay: 14, hour: 0)
        XCTAssertTrue(complete, "00:00 on day 14: now a no is a no")
    }

    func testTheWindowStaysClosedAfterwards() async throws {
        for day in [14, 15, 30] {
            let complete = try await windowComplete(onDay: day, hour: 12)
            XCTAssertTrue(complete, "day \(day)")
        }
    }

    func testTheWindowIsOpenThroughoutTheDaysBeforeIt() async throws {
        for day in [0, 6, 7, 12] {
            let complete = try await windowComplete(onDay: day, hour: 12)
            XCTAssertFalse(complete, "day \(day) is inside or before the window")
        }
    }

    /// A day is 23 or 25 hours long across a DST change, so a close computed
    /// from elapsed time rather than from calendar days would drift by one.
    /// US DST ends on 2026-11-01; opening on 2026-10-26 puts that inside the
    /// return window.
    func testTheBoundaryHoldsAcrossADaylightSavingChange() async throws {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("dst-\(UUID().uuidString)", isDirectory: true)
            .appendingPathComponent("activation.json")
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }

        let open = calendar.date(from: DateComponents(year: 2026, month: 10, day: 26, hour: 9))!
        var moment = open
        let log = ActivationLog(fileURL: url, calendar: calendar, now: { moment },
                                source: .real, environment: .device)
        await log.recordOpen()

        func atDay(_ day: Int, hour: Int) -> Date {
            let midnight = calendar.date(byAdding: .day, value: day, to: calendar.startOfDay(for: open))!
            return calendar.date(byAdding: .hour, value: hour, to: midnight)!
        }

        // 2026-11-08, the last eligible day, five weekdays past the change.
        moment = atDay(13, hour: 23)
        var report = await log.report()
        XCTAssertFalse(report.nextWeekWindowComplete, "day 13 after a DST change is still day 13")

        moment = atDay(14, hour: 0)
        report = await log.report()
        XCTAssertTrue(report.nextWeekWindowComplete, "and day 14 is still day 14")

        // A return on the far side of the change still lands in the window.
        moment = atDay(9, hour: 10)
        await log.recordOpen()
        moment = atDay(14, hour: 0)
        report = await log.report()
        XCTAssertTrue(report.returnedNextWeek, "a day-9 return survives the clocks changing")
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

        // An exact key set, so that adding a field to the stored file is a
        // decision someone has to make on purpose rather than something that
        // happens quietly. `environment` describes the build -- device,
        // simulator, debug -- and says nothing about the person.
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any])
        XCTAssertEqual(Set(json.keys), ["version", "source", "environment", "firstOpen", "days"])
        XCTAssertTrue(["device", "simulator", "debugBuild"].contains(json["environment"] as? String ?? ""),
                      "environment is one of three fixed build kinds, never free text")

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
