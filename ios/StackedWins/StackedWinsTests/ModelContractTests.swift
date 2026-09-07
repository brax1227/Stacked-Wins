import XCTest
@testable import StackedWins

/// The JSON contract between the iOS models and the backend.
///
/// Every fixture here is shaped exactly like a real response from the Express
/// backend (camelCase keys, ISO 8601 strings, Prisma's null-for-absent). A
/// drift between the two only ever shows up as a runtime decode failure on a
/// phone, which is the most expensive place to find it.
final class ModelContractTests: XCTestCase {

    private let decoder = JSONDecoder()

    // MARK: - Auth (POST /api/auth/login, /register, GET /api/auth/me)

    func testAuthResponseDecodesTheCamelCasePayloadTheBackendSends() throws {
        // authController.js builds exactly this: token, then user with
        // createdAt/updatedAt via toISOString(). Not snake_case.
        let json = Data("""
        {
          "token": "header.payload.signature",
          "user": {
            "id": "876bc14d-cbbf-4c8f-a3ab-a1ef9e4637f2",
            "email": "stack@test.dev",
            "createdAt": "2026-09-01T14:08:18.075Z",
            "updatedAt": "2026-09-01T14:08:18.075Z"
          }
        }
        """.utf8)

        let response = try decoder.decode(AuthResponse.self, from: json)

        XCTAssertEqual(response.token, "header.payload.signature")
        XCTAssertEqual(response.user.id, "876bc14d-cbbf-4c8f-a3ab-a1ef9e4637f2")
        XCTAssertEqual(response.user.email, "stack@test.dev")
        XCTAssertEqual(response.user.createdAt, "2026-09-01T14:08:18.075Z")
    }

    func testUserDecodesWhenTimestampsAreNull() throws {
        // GET /api/auth/me falls back to null for missing timestamps.
        let json = Data(#"{"id":"u1","email":"a@b.c","createdAt":null,"updatedAt":null}"#.utf8)

        let user = try decoder.decode(User.self, from: json)

        XCTAssertEqual(user.email, "a@b.c")
        XCTAssertNil(user.createdAt)
    }

    func testUserDecodingFailsWithoutEmail() {
        // email is non-optional; its absence must be an error, not "".
        let json = Data(#"{"id":"u1","createdAt":null,"updatedAt":null}"#.utf8)

        XCTAssertThrowsError(try decoder.decode(User.self, from: json))
    }

    // MARK: - GET /api/stack/next

    func testNextCardDecodesARealDealtCard() throws {
        // Captured from a live backend. Note userId is present in the payload
        // and absent from the model: extra keys must be ignored, not fatal.
        let json = Data("""
        {
          "item": {
            "id": "f529937f-8980-4a8c-ba47-7707eb094332",
            "userId": "876bc14d-cbbf-4c8f-a3ab-a1ef9e4637f2",
            "title": "call the bank",
            "kind": "need",
            "status": "open",
            "position": 1,
            "snoozedUntil": null,
            "pushCount": 0,
            "parentId": null,
            "completedAt": null,
            "createdAt": "2026-09-01T14:08:18.075Z",
            "updatedAt": "2026-09-01T14:08:18.075Z"
          },
          "kind": "need",
          "suggestSplit": false,
          "remaining": 5,
          "sleeping": 0,
          "done": 0,
          "lanes": { "need": 4, "want": 3 }
        }
        """.utf8)

        let card = try decoder.decode(NextCard.self, from: json)

        let item = try XCTUnwrap(card.item)
        XCTAssertEqual(item.title, "call the bank")
        XCTAssertEqual(item.kind, .need)
        XCTAssertEqual(item.status, "open")
        XCTAssertEqual(item.position, 1, "integer JSON must decode into the Double position")
        XCTAssertFalse(item.isSleeping)
        XCTAssertEqual(card.kind, .need)
        XCTAssertFalse(card.suggestSplit)
        XCTAssertEqual(card.remaining, 5)
        XCTAssertEqual(card.lanes.need, 4)
        XCTAssertEqual(card.lanes.want, 3)
        XCTAssertEqual(card.lanes[.want], 3, "the lane subscript must read the right field")
    }

    func testNextCardDecodesAnEmptyLane() throws {
        // The whole empty-state UI hangs off item being nil, not absent.
        let json = Data("""
        {"item":null,"kind":"need","suggestSplit":false,"remaining":0,"sleeping":1,"done":6,"lanes":{"need":0,"want":2}}
        """.utf8)

        let card = try decoder.decode(NextCard.self, from: json)

        XCTAssertNil(card.item)
        XCTAssertEqual(card.sleeping, 1)
        XCTAssertEqual(card.done, 6)
        XCTAssertEqual(card.lanes[.want], 2)
    }

    func testASleepingCardCarriesItsSnoozeDate() throws {
        // "Not today" sets a date-only column; Prisma serialises it at midnight.
        let json = Data("""
        {"id":"i1","title":"email my advisor back","kind":"need","status":"open","position":3,
         "snoozedUntil":"2026-09-02T00:00:00.000Z","pushCount":0,"parentId":null,"completedAt":null,
         "createdAt":"2026-09-01T14:08:18.075Z","updatedAt":"2026-09-01T14:08:18.075Z"}
        """.utf8)

        let item = try decoder.decode(StackItem.self, from: json)

        XCTAssertTrue(item.isSleeping)
        XCTAssertEqual(item.snoozedUntil, "2026-09-02T00:00:00.000Z")
    }

    func testStackKindRejectsAnythingButTheTwoLanes() throws {
        XCTAssertEqual(try decoder.decode(StackKind.self, from: Data(#""need""#.utf8)), .need)
        XCTAssertEqual(try decoder.decode(StackKind.self, from: Data(#""want""#.utf8)), .want)
        // Two buckets is the whole taxonomy (PROBLEM.md). A third must fail loudly.
        XCTAssertThrowsError(try decoder.decode(StackKind.self, from: Data(#""urgent""#.utf8)))
    }

    func testStackKindOtherFlipsLanes() {
        XCTAssertEqual(StackKind.need.other, .want)
        XCTAssertEqual(StackKind.want.other, .need)
    }

    // MARK: - GET /api/stack, POST /api/stack/dump, split, capabilities

    func testStackListDecodesInDealOrder() throws {
        let json = Data("""
        {"items":[
          {"id":"a","title":"first","kind":"want","status":"open","position":1,"snoozedUntil":null,"pushCount":0,"parentId":null,"completedAt":null,"createdAt":"2026-09-01T00:00:00.000Z","updatedAt":"2026-09-01T00:00:00.000Z"},
          {"id":"b","title":"second","kind":"want","status":"open","position":2,"snoozedUntil":null,"pushCount":2,"parentId":"p","completedAt":null,"createdAt":"2026-09-01T00:00:00.000Z","updatedAt":"2026-09-01T00:00:00.000Z"}
         ],"kind":"want","remaining":2,"sleeping":0,"done":0,"lanes":{"need":0,"want":2}}
        """.utf8)

        let list = try decoder.decode(StackList.self, from: json)

        XCTAssertEqual(list.items.map(\.title), ["first", "second"])
        XCTAssertEqual(list.items[1].pushCount, 2)
        XCTAssertEqual(list.items[1].parentId, "p")
        XCTAssertEqual(list.kind, .want)
    }

    func testDumpResultIgnoresTheCountsItDoesNotModel() throws {
        // The dump endpoint returns counts too; the model only needs two fields.
        let json = Data(#"{"added":5,"kind":"need","remaining":5,"sleeping":0,"done":0,"lanes":{"need":5,"want":0}}"#.utf8)

        let result = try decoder.decode(DumpResult.self, from: json)

        XCTAssertEqual(result.added, 5)
        XCTAssertEqual(result.kind, .need)
    }

    func testSplitPayloadsDecode() throws {
        let suggestion = try decoder.decode(SplitSuggestion.self, from: Data(#"{"pieces":["find the number","make the call"]}"#.utf8))
        XCTAssertEqual(suggestion.pieces, ["find the number", "make the call"])

        let result = try decoder.decode(SplitResult.self, from: Data(#"{"pieces":3}"#.utf8))
        XCTAssertEqual(result.pieces, 3)
    }

    func testCapabilitiesDecode() throws {
        XCTAssertTrue(try decoder.decode(StackCapabilities.self, from: Data(#"{"splitAssist":true}"#.utf8)).splitAssist)
        XCTAssertFalse(try decoder.decode(StackCapabilities.self, from: Data(#"{"splitAssist":false}"#.utf8)).splitAssist)
    }

    // MARK: - What we send

    func testRankMoveEncodesAsTheBareWordTheAPIExpects() throws {
        // POST /api/stack/:id/rank expects {"move":"top"}, not an index.
        let data = try JSONEncoder().encode(RankMove.top)
        XCTAssertEqual(String(decoding: data, as: UTF8.self), #""top""#)
    }

    func testStackKindEncodesAsItsRawValue() throws {
        let data = try JSONEncoder().encode(StackKind.want)
        XCTAssertEqual(String(decoding: data, as: UTF8.self), #""want""#)
    }
}
