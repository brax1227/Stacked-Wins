import XCTest
@testable import StackedWins

/// The on-device stack. This is what most people will be using, so it has to
/// follow the same rules as the server (backend/tests/stack.test.js): the
/// same moves, the same order, the same "tomorrow".
final class LocalStackStoreTests: XCTestCase {

    private var fileURL: URL!
    private var clock: Date!
    private var calendar: Calendar!

    override func setUp() {
        super.setUp()
        fileURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("stacked-wins-tests-\(UUID().uuidString)", isDirectory: true)
            .appendingPathComponent("stack.json")
        // A fixed clock in a fixed zone, so "tomorrow" is the same everywhere.
        calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Chicago")!
        clock = calendar.date(from: DateComponents(year: 2026, month: 9, day: 7, hour: 15, minute: 30))!
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: fileURL.deletingLastPathComponent())
        super.tearDown()
    }

    private func makeStore() -> LocalStackStore {
        LocalStackStore(fileURL: fileURL, calendar: calendar, now: { self.clock })
    }

    // MARK: - Job 1: get it out of the head

    func testDumpCleansLinesDedupesAndKeepsDumpOrder() async throws {
        let store = makeStore()

        let result = try await store.dump("- call the bank\n\n* Laundry\n1. email advisor\n[ ] call the bank\n   \n", into: .need)

        XCTAssertEqual(result.added, 3)
        XCTAssertEqual(result.kind, .need)
        let list = try await store.everything(in: .need)
        XCTAssertEqual(list.items.map(\.title), ["call the bank", "Laundry", "email advisor"])
        XCTAssertEqual(list.remaining, 3)
    }

    func testDumpWithNothingInItIsAnError() async {
        let store = makeStore()
        do {
            _ = try await store.dump("\n- \n", into: .need)
            XCTFail("expected an error")
        } catch {
            XCTAssertEqual(error as? LocalStackStore.Failure, .nothingToAdd)
        }
    }

    func testASecondDumpLandsBehindTheFirst() async throws {
        let store = makeStore()
        _ = try await store.dump("first", into: .need)
        _ = try await store.dump("second", into: .need)

        let list = try await store.everything(in: .need)
        XCTAssertEqual(list.items.map(\.title), ["first", "second"])
    }

    func testLanesAreSeparate() async throws {
        let store = makeStore()
        _ = try await store.dump("taxes", into: .need)
        _ = try await store.dump("guitar", into: .want)

        let need = try await store.next(in: .need)
        let want = try await store.next(in: .want)
        XCTAssertEqual(need.item?.title, "taxes")
        XCTAssertEqual(want.item?.title, "guitar")
        XCTAssertEqual(need.lanes, LaneCounts(need: 1, want: 1))
    }

    // MARK: - Job 2: one card

    func testNextDealsTheFrontOfTheLaneAndNothingElse() async throws {
        let store = makeStore()
        _ = try await store.dump("a\nb\nc", into: .need)

        let card = try await store.next(in: .need)

        XCTAssertEqual(card.item?.title, "a")
        XCTAssertEqual(card.kind, .need)
        XCTAssertFalse(card.suggestSplit)
        XCTAssertEqual(card.remaining, 3)
        XCTAssertEqual(card.sleeping, 0)
        XCTAssertEqual(card.done, 0)
    }

    func testAnEmptyLaneIsACalmNilNotAnError() async throws {
        let store = makeStore()
        _ = try await store.dump("guitar", into: .want)

        let card = try await store.next(in: .need)

        XCTAssertNil(card.item)
        XCTAssertEqual(card.lanes, LaneCounts(need: 0, want: 1))
    }

    func testDoneClearsTheCardAndDealsTheNextOne() async throws {
        let store = makeStore()
        _ = try await store.dump("a\nb", into: .need)
        let first = try await store.next(in: .need).item!

        let cleared = try await store.done(first.id)
        XCTAssertEqual(cleared.status, "done")
        XCTAssertNotNil(cleared.completedAt)

        let card = try await store.next(in: .need)
        XCTAssertEqual(card.item?.title, "b")
        XCTAssertEqual(card.done, 1)
        XCTAssertEqual(card.remaining, 1)
    }

    func testNotNowSendsTheCardToTheBackWithNoPenalty() async throws {
        let store = makeStore()
        _ = try await store.dump("a\nb\nc", into: .need)
        let a = try await store.next(in: .need).item!

        let pushed = try await store.push(a.id)
        XCTAssertEqual(pushed.pushCount, 1)
        XCTAssertEqual(pushed.status, "open")

        let list = try await store.everything(in: .need)
        XCTAssertEqual(list.items.map(\.title), ["b", "c", "a"])
        XCTAssertEqual(list.remaining, 3, "pushing costs nothing")
    }

    func testThreePushesSuggestBreakingItUp() async throws {
        let store = makeStore()
        _ = try await store.dump("big thing", into: .need)
        let item = try await store.next(in: .need).item!

        for _ in 0..<2 { _ = try await store.push(item.id) }
        let notYet = try await store.next(in: .need)
        XCTAssertFalse(notYet.suggestSplit)

        _ = try await store.push(item.id)
        let now = try await store.next(in: .need)
        XCTAssertTrue(now.suggestSplit)
    }

    func testNotTodaySleepsUntilTomorrowAndKeepsItsPlace() async throws {
        let store = makeStore()
        _ = try await store.dump("a\nb", into: .need)
        let a = try await store.next(in: .need).item!

        let sleeping = try await store.later(a.id)
        XCTAssertEqual(sleeping.snoozedUntil, "2026-09-08T05:00:00Z", "midnight in Chicago, as an instant")

        let card = try await store.next(in: .need)
        XCTAssertEqual(card.item?.title, "b")
        XCTAssertEqual(card.sleeping, 1)
        XCTAssertEqual(card.remaining, 1)

        // Still in the full list, still first, marked as asleep.
        let list = try await store.everything(in: .need)
        XCTAssertEqual(list.items.map(\.title), ["a", "b"])
        XCTAssertTrue(list.items[0].isSleeping)

        // Tomorrow morning it is back, and no longer marked as asleep.
        clock = calendar.date(byAdding: .hour, value: 16, to: clock)!
        let tomorrow = try await store.next(in: .need)
        XCTAssertEqual(tomorrow.item?.title, "a")
        XCTAssertFalse(tomorrow.item!.isSleeping)
        XCTAssertEqual(tomorrow.sleeping, 0)
    }

    func testNotTodayOnEveryCardLeavesTheLaneQuietUntilTomorrow() async throws {
        let store = makeStore()
        _ = try await store.dump("a", into: .need)
        let a = try await store.next(in: .need).item!
        _ = try await store.later(a.id)

        let card = try await store.next(in: .need)
        XCTAssertNil(card.item)
        XCTAssertEqual(card.sleeping, 1)
    }

    func testTooBigReplacesTheCardWithItsPiecesFirstPieceNext() async throws {
        let store = makeStore()
        _ = try await store.dump("clean the apartment\nemail", into: .need)
        let big = try await store.next(in: .need).item!

        let result = try await store.split(big.id, pieces: "- dishes\n- one load of laundry\n\n- dishes")
        XCTAssertEqual(result.pieces, 2)

        let list = try await store.everything(in: .need)
        XCTAssertEqual(list.items.map(\.title), ["dishes", "one load of laundry", "email"])
        XCTAssertEqual(list.items[0].parentId, big.id)
        XCTAssertEqual(list.items[1].parentId, big.id)

        let card = try await store.next(in: .need)
        XCTAssertEqual(card.item?.title, "dishes")
    }

    func testSplitWithNoPiecesIsAnError() async throws {
        let store = makeStore()
        _ = try await store.dump("x", into: .need)
        let x = try await store.next(in: .need).item!
        do {
            _ = try await store.split(x.id, pieces: " \n ")
            XCTFail("expected an error")
        } catch {
            XCTAssertEqual(error as? LocalStackStore.Failure, .noPieces)
        }
    }

    func testAPhoneWithNoModelOffersNoSuggestions() async throws {
        SplitAssistants.current = NoSplitAssistant()
        let store = makeStore()
        _ = try await store.dump("clean", into: .need)
        let card = try await store.next(in: .need).item!

        let caps = try await store.capabilities()
        XCTAssertFalse(caps.splitAssist, "so the button never appears")

        do {
            _ = try await store.suggestSplit(card.id)
            XCTFail("expected an error")
        } catch {
            XCTAssertEqual(error as? SplitAssistFailure, .unavailable)
            XCTAssertFalse(error.localizedDescription.isEmpty)
        }
    }

    // MARK: - Lanes, ranking, letting go

    func testMovingLanesLandsAtTheBackOfTheOtherLane() async throws {
        let store = makeStore()
        _ = try await store.dump("taxes\nread that book", into: .need)
        _ = try await store.dump("guitar", into: .want)
        let book = try await store.everything(in: .need).items[1]

        let moved = try await store.move(book.id, to: .want)
        XCTAssertEqual(moved.kind, .want)

        let want = try await store.everything(in: .want)
        XCTAssertEqual(want.items.map(\.title), ["guitar", "read that book"])
        let need = try await store.everything(in: .need)
        XCTAssertEqual(need.items.map(\.title), ["taxes"])
    }

    func testRankingIsOptionalAndOnlyEverReorders() async throws {
        let store = makeStore()
        _ = try await store.dump("a\nb\nc", into: .need)
        var items = try await store.everything(in: .need).items

        _ = try await store.rank(items[2].id, .top)
        items = try await store.everything(in: .need).items
        XCTAssertEqual(items.map(\.title), ["c", "a", "b"])

        _ = try await store.rank(items[2].id, .up)
        items = try await store.everything(in: .need).items
        XCTAssertEqual(items.map(\.title), ["c", "b", "a"])

        _ = try await store.rank(items[0].id, .down)
        items = try await store.everything(in: .need).items
        XCTAssertEqual(items.map(\.title), ["b", "c", "a"])

        // Already at the end it was heading for: a no-op, not an error.
        _ = try await store.rank(items[0].id, .up)
        _ = try await store.rank(items[2].id, .down)
        items = try await store.everything(in: .need).items
        XCTAssertEqual(items.map(\.title), ["b", "c", "a"])
        XCTAssertEqual(items.count, 3)
    }

    func testLettingGoKeepsTheRecordButNotTheCard() async throws {
        let store = makeStore()
        _ = try await store.dump("that thing", into: .need)
        let item = try await store.next(in: .need).item!

        let dropped = try await store.drop(item.id)
        XCTAssertEqual(dropped.status, "dropped")

        let card = try await store.next(in: .need)
        XCTAssertNil(card.item)
        XCTAssertEqual(card.done, 0, "letting go is not the same as clearing")
    }

    func testAnUnknownCardIsNotFound() async {
        let store = makeStore()
        do {
            _ = try await store.done("nope")
            XCTFail("expected an error")
        } catch {
            XCTAssertEqual(error as? LocalStackStore.Failure, .notFound)
        }
    }

    // MARK: - It's a file

    func testTheStackSurvivesARelaunch() async throws {
        _ = try await makeStore().dump("a\nb", into: .need)
        let a = try await makeStore().next(in: .need).item!
        _ = try await makeStore().done(a.id)

        let reopened = makeStore()
        let card = try await reopened.next(in: .need)
        XCTAssertEqual(card.item?.title, "b")
        XCTAssertEqual(card.done, 1)
        let empty = try await reopened.isEmpty()
        XCTAssertFalse(empty)
    }

    func testAFreshInstallIsEmptyWithoutAFileOnDisk() async throws {
        let store = makeStore()
        let empty = try await store.isEmpty()
        XCTAssertTrue(empty)
        XCTAssertFalse(FileManager.default.fileExists(atPath: fileURL.path), "nothing is written until something is put down")
    }

    func testTheFileIsTheSameShapeAsTheAPI() async throws {
        // A stack written by the phone can be read with the same models the
        // server responses use, so moving between the two later is a copy.
        let store = makeStore()
        _ = try await store.dump("a", into: .want)

        let data = try Data(contentsOf: fileURL)
        let json = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(json["version"] as? Int, 1)
        let items = try XCTUnwrap(json["items"] as? [[String: Any]])
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0]["kind"] as? String, "want")
        XCTAssertEqual(items[0]["status"] as? String, "open")
        XCTAssertEqual(items[0]["pushCount"] as? Int, 0)
        XCTAssertEqual(items[0]["createdAt"] as? String, "2026-09-07T20:30:00Z")
    }

    // MARK: - The dump parser

    func testNormalizeTitleStripsListMarkersAndWhitespace() {
        XCTAssertEqual(DumpParser.normalizeTitle("- call the bank"), "call the bank")
        XCTAssertEqual(DumpParser.normalizeTitle("* laundry "), "laundry")
        XCTAssertEqual(DumpParser.normalizeTitle("• dishes"), "dishes")
        XCTAssertEqual(DumpParser.normalizeTitle("3) taxes"), "taxes")
        XCTAssertEqual(DumpParser.normalizeTitle("12. taxes"), "taxes")
        XCTAssertEqual(DumpParser.normalizeTitle("[x] done thing"), "done thing")
        XCTAssertEqual(DumpParser.normalizeTitle("[ ] open thing"), "open thing")
        XCTAssertEqual(DumpParser.normalizeTitle("2026 planning"), "2026 planning", "a number that isn't a marker stays")
        XCTAssertNil(DumpParser.normalizeTitle("   "))
        XCTAssertNil(DumpParser.normalizeTitle("- "))
    }

    func testNormalizeTitleCapsAbsurdlyLongLines() {
        let long = String(repeating: "x", count: 600)
        XCTAssertEqual(DumpParser.normalizeTitle(long)?.count, DumpParser.maxTitleLength)
    }
}

/// Undo and the wins. Both are new surface on the phone store: undo has no
/// server endpoint behind it, and the wins are what the app is named after.
extension LocalStackStoreTests {

    // MARK: - Undo

    func testUndoPutsAClearedCardBack() async throws {
        let store = makeStore()
        _ = try await store.dump("a\nb", into: .need)
        let a = try await store.next(in: .need).item!
        _ = try await store.done(a.id)

        let label = try await store.undo()

        XCTAssertEqual(label, "Cleared \u{201C}a\u{201D}")
        let card = try await store.next(in: .need)
        XCTAssertEqual(card.item?.title, "a")
        XCTAssertEqual(card.done, 0, "the win is undone too, not just the card")
        XCTAssertNil(card.item?.completedAt)
    }

    func testUndoRestoresPositionAndPushCount() async throws {
        let store = makeStore()
        _ = try await store.dump("a\nb\nc", into: .need)
        let a = try await store.next(in: .need).item!
        _ = try await store.push(a.id)

        let label = try await store.undo()

        XCTAssertEqual(label, "Pushed back \u{201C}a\u{201D}")
        let list = try await store.everything(in: .need)
        XCTAssertEqual(list.items.map(\.title), ["a", "b", "c"])
        XCTAssertEqual(list.items[0].pushCount, 0, "the push is uncounted, so the split hint doesn't creep up")
    }

    func testUndoWakesACardSentToTomorrow() async throws {
        let store = makeStore()
        _ = try await store.dump("a", into: .need)
        let a = try await store.next(in: .need).item!
        _ = try await store.later(a.id)

        let label = try await store.undo()

        XCTAssertEqual(label, "\u{201C}a\u{201D} until tomorrow")
        let card = try await store.next(in: .need)
        XCTAssertEqual(card.item?.title, "a")
        XCTAssertEqual(card.sleeping, 0)
    }

    func testUndoRebuildsACardFromItsPieces() async throws {
        let store = makeStore()
        _ = try await store.dump("clean the apartment", into: .need)
        let big = try await store.next(in: .need).item!
        _ = try await store.split(big.id, pieces: "dishes\nlaundry")

        let label = try await store.undo()

        XCTAssertEqual(label, "Broke up \u{201C}clean the apartment\u{201D}")
        let list = try await store.everything(in: .need)
        XCTAssertEqual(list.items.map(\.title), ["clean the apartment"], "the pieces go with it")
    }

    func testUndoTakesBackADumpAndOnlyTheLastOne() async throws {
        let store = makeStore()
        _ = try await store.dump("first", into: .need)
        _ = try await store.dump("a\nb", into: .need)

        let undoneDump = try await store.undo()
        XCTAssertEqual(undoneDump, "Added 2 things")
        var list = try await store.everything(in: .need)
        XCTAssertEqual(list.items.map(\.title), ["first"])

        // One level deep: the dump before it is not on the hook.
        let nothingLeft = try await store.undo()
        XCTAssertNil(nothingLeft)
        list = try await store.everything(in: .need)
        XCTAssertEqual(list.items.map(\.title), ["first"])
    }

    func testUndoNamesASingleAddedThing() async throws {
        let store = makeStore()
        _ = try await store.dump("call the bank", into: .need)
        let undone = try await store.undo()
        XCTAssertEqual(undone, "Added \u{201C}call the bank\u{201D}")
    }

    func testThereIsNothingToUndoOnAFreshStack() async throws {
        let store = makeStore()
        let nothing = try await store.undo()
        XCTAssertNil(nothing)
    }

    func testUndoSurvivesTheMoveThatChangedNothing() async throws {
        // Ranking the front card up is a no-op. Undo must still refer to it,
        // not silently reach past it to the move before.
        let store = makeStore()
        _ = try await store.dump("a\nb", into: .need)
        let items = try await store.everything(in: .need).items
        _ = try await store.done(items[1].id)
        _ = try await store.rank(items[0].id, .up)

        let undoneRank = try await store.undo()
        XCTAssertEqual(undoneRank, "Reordered \u{201C}a\u{201D}")
        let card = try await store.next(in: .need)
        XCTAssertEqual(card.done, 1, "the clear before it is untouched")
    }

    func testUndoIsWrittenToDiskNotJustHeldInMemory() async throws {
        let store = makeStore()
        _ = try await store.dump("a", into: .need)
        let a = try await store.next(in: .need).item!
        _ = try await store.done(a.id)
        _ = try await store.undo()

        let reopened = makeStore()
        let card = try await reopened.next(in: .need)
        XCTAssertEqual(card.item?.title, "a")
    }

    func testUndoIsOfferedOnThePhone() async throws {
        let caps = try await makeStore().capabilities()
        XCTAssertTrue(caps.undo)
    }

    // MARK: - The wins

    func testClearedReturnsTodaysWinsNewestFirst() async throws {
        let store = makeStore()
        _ = try await store.dump("a\nb\nc", into: .need)
        let items = try await store.everything(in: .need).items

        _ = try await store.done(items[0].id)
        clock = clock.addingTimeInterval(60)
        _ = try await store.done(items[1].id)

        let wins = try await store.cleared(since: calendar.startOfDay(for: clock))
        XCTAssertEqual(wins.map(\.title), ["b", "a"])
    }

    func testClearedCountsBothLanesAndIgnoresEverythingElse() async throws {
        let store = makeStore()
        _ = try await store.dump("taxes\ndishes", into: .need)
        _ = try await store.dump("guitar", into: .want)
        let need = try await store.everything(in: .need).items
        let want = try await store.everything(in: .want).items

        _ = try await store.done(need[0].id)
        _ = try await store.done(want[0].id)
        _ = try await store.drop(need[1].id)

        let wins = try await store.cleared(since: calendar.startOfDay(for: clock))
        XCTAssertEqual(Set(wins.map(\.title)), ["taxes", "guitar"], "letting go is not a win")
    }

    func testYesterdaysWinsAreNotTodays() async throws {
        let store = makeStore()
        _ = try await store.dump("a\nb", into: .need)
        let items = try await store.everything(in: .need).items
        _ = try await store.done(items[0].id)

        // Tomorrow morning.
        clock = calendar.date(byAdding: .hour, value: 18, to: clock)!
        _ = try await store.done(items[1].id)

        let today = try await store.cleared(since: calendar.startOfDay(for: clock))
        XCTAssertEqual(today.map(\.title), ["b"])

        let bothDays = try await store.cleared(since: calendar.date(byAdding: .day, value: -7, to: clock)!)
        XCTAssertEqual(bothDays.map(\.title), ["b", "a"])
    }

    func testAWinUndoneIsNoLongerAWin() async throws {
        let store = makeStore()
        _ = try await store.dump("a", into: .need)
        let a = try await store.next(in: .need).item!
        _ = try await store.done(a.id)
        _ = try await store.undo()

        let wins = try await store.cleared(since: calendar.startOfDay(for: clock))
        XCTAssertTrue(wins.isEmpty)
    }

    // MARK: - Timestamps

    func testTimestampsParseBothWhatTheServerWritesAndWhatThePhoneWrites() {
        // Prisma's toISOString has fractional seconds; the phone's doesn't.
        // A stack that has been on both must read either.
        XCTAssertNotNil(Timestamps.parse("2026-09-07T20:30:00.075Z"))
        XCTAssertNotNil(Timestamps.parse("2026-09-07T20:30:00Z"))
        XCTAssertEqual(Timestamps.parse("2026-09-07T20:30:00.000Z"),
                       Timestamps.parse("2026-09-07T20:30:00Z"))
        XCTAssertNil(Timestamps.parse(nil))
        XCTAssertNil(Timestamps.parse(""))
        XCTAssertNil(Timestamps.parse("last tuesday"))
    }

    func testCapabilitiesFromAServerThatHasNeverHeardOfUndo() throws {
        let json = Data(#"{"splitAssist":true}"#.utf8)
        let caps = try JSONDecoder().decode(StackCapabilities.self, from: json)
        XCTAssertTrue(caps.splitAssist)
        XCTAssertFalse(caps.undo, "a server that doesn't say is assumed not to")
    }
}

/// A stand-in for the phone's model, so the cleaning around a suggestion can
/// be tested without one. The real assistant's output is unpredictable; what
/// has to be predictable is what the app does with it.
private struct FakeAssistant: SplitAssistant {
    var isAvailable = true
    var answer: [String] = []
    var failure: Error?

    func pieces(for title: String) async throws -> [String] {
        if let failure { throw failure }
        return answer
    }
}

extension LocalStackStoreTests {

    private func withAssistant(_ assistant: SplitAssistant) {
        SplitAssistants.current = assistant
        addTeardownBlock { SplitAssistants.current = NoSplitAssistant() }
    }

    private func card(in store: LocalStackStore, titled title: String) async throws -> StackItem {
        _ = try await store.dump(title, into: .need)
        return try await store.next(in: .need).item!
    }

    func testAPhoneWithAModelOffersTheButton() async throws {
        withAssistant(FakeAssistant(isAvailable: true))
        let caps = try await makeStore().capabilities()
        XCTAssertTrue(caps.splitAssist)
    }

    func testSuggestionsAreCleanedTheSameWayATypedDumpIs() async throws {
        // Models number things and add bullets however much you ask them not to.
        withAssistant(FakeAssistant(answer: [
            "1. find the phone number",
            "- write down what to ask",
            "",
            "   make the call   ",
        ]))
        let store = makeStore()
        let item = try await card(in: store, titled: "call the bank")

        let suggestion = try await store.suggestSplit(item.id)

        XCTAssertEqual(suggestion.pieces,
                       ["find the phone number", "write down what to ask", "make the call"])
    }

    func testAPieceThatJustRestatesTheCardIsDropped() async throws {
        // "clean" -> "Clean" is not a step, it's the same wall.
        withAssistant(FakeAssistant(answer: ["Clean", "dishes", "one load of laundry"]))
        let store = makeStore()
        let item = try await card(in: store, titled: "clean")

        let suggestion = try await store.suggestSplit(item.id)

        XCTAssertEqual(suggestion.pieces, ["dishes", "one load of laundry"])
    }

    func testTooManyPiecesAreCappedSoTheFixIsntItsOwnPile() async throws {
        withAssistant(FakeAssistant(answer: (1...12).map { "step \($0)" }))
        let store = makeStore()
        let item = try await card(in: store, titled: "move house")

        let suggestion = try await store.suggestSplit(item.id)

        XCTAssertEqual(suggestion.pieces.count, 6)
        XCTAssertEqual(suggestion.pieces.first, "step 1")
    }

    func testAnAnswerWithNothingUsableInItIsAnError() async throws {
        withAssistant(FakeAssistant(answer: ["", "  ", "- "]))
        let store = makeStore()
        let item = try await card(in: store, titled: "taxes")

        do {
            _ = try await store.suggestSplit(item.id)
            XCTFail("expected an error")
        } catch {
            XCTAssertEqual(error as? SplitAssistFailure, .nothingUseful)
        }
    }

    func testAModelThatFailsSurfacesRatherThanPretending() async throws {
        withAssistant(FakeAssistant(failure: SplitAssistFailure.unavailable))
        let store = makeStore()
        let item = try await card(in: store, titled: "taxes")

        do {
            _ = try await store.suggestSplit(item.id)
            XCTFail("expected an error")
        } catch {
            XCTAssertEqual(error as? SplitAssistFailure, .unavailable)
        }
    }

    func testSuggestingWritesNothingToTheStack() async throws {
        // The whole promise: it suggests, you confirm. Nothing lands until
        // the user taps "Break it up".
        withAssistant(FakeAssistant(answer: ["dishes", "laundry"]))
        let store = makeStore()
        let item = try await card(in: store, titled: "clean")

        _ = try await store.suggestSplit(item.id)

        let list = try await store.everything(in: .need)
        XCTAssertEqual(list.items.map(\.title), ["clean"], "still exactly the card we started with")
        XCTAssertEqual(list.items[0].status, "open")
    }

    func testSuggestingForACardThatIsNotThereIsNotFound() async throws {
        withAssistant(FakeAssistant(answer: ["x"]))
        do {
            _ = try await makeStore().suggestSplit("nope")
            XCTFail("expected an error")
        } catch {
            XCTAssertEqual(error as? LocalStackStore.Failure, .notFound)
        }
    }
}
