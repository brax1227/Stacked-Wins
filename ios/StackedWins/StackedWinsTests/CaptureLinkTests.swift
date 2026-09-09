import XCTest
@testable import StackedWins

/// stackedwins://add — the capture route anything can drive.
///
/// This is parsed from input the app doesn't control (a Shortcut someone
/// built, a link in a note, a typo), so the interesting cases are the
/// malformed ones.
final class CaptureLinkTests: XCTestCase {

    private func parse(_ string: String) -> CaptureLink? {
        guard let url = URL(string: string) else {
            XCTFail("\(string) isn't a URL at all")
            return nil
        }
        return CaptureLink.parse(url)
    }

    func testABareAddOpensAnEmptyBoxInNeed() {
        let link = parse("stackedwins://add")
        XCTAssertEqual(link, CaptureLink(text: "", kind: .need))
    }

    func testTextComesThroughDecoded() {
        XCTAssertEqual(parse("stackedwins://add?text=call%20the%20bank")?.text, "call the bank")
    }

    func testSeveralLinesSurviveTheTrip() {
        // What a Shortcut passing a multi-line variable produces.
        let link = parse("stackedwins://add?text=dishes%0Alaundry%0Acall%20mom")
        XCTAssertEqual(link?.text, "dishes\nlaundry\ncall mom")
    }

    func testTheLaneCanBeChosenAndDefaultsToNeed() {
        XCTAssertEqual(parse("stackedwins://add?text=guitar&kind=want")?.kind, .want)
        XCTAssertEqual(parse("stackedwins://add?text=taxes&kind=need")?.kind, .need)
        XCTAssertEqual(parse("stackedwins://add?text=taxes")?.kind, .need)
        // A lane nobody has heard of is the default, not a failure: the
        // capture matters more than the lane.
        XCTAssertEqual(parse("stackedwins://add?text=taxes&kind=someday")?.kind, .need)
    }

    func testTitleWorksAsWellAsText() {
        // Not documented, but it's what people reach for, and being
        // forgiving here costs nothing.
        XCTAssertEqual(parse("stackedwins://add?title=laundry")?.text, "laundry")
    }

    func testQueryNamesAndLanesAreCaseInsensitive() {
        let link = parse("stackedwins://add?TEXT=laundry&KIND=WANT")
        XCTAssertEqual(link, CaptureLink(text: "laundry", kind: .want))
    }

    func testTheSchemeIsCaseInsensitiveBecauseTypedLinksAre() {
        XCTAssertEqual(parse("StackedWins://add?text=x")?.text, "x")
    }

    func testSurroundingWhitespaceIsTrimmed() {
        XCTAssertEqual(parse("stackedwins://add?text=%20%20laundry%20%0A")?.text, "laundry")
    }

    func testSomebodyElsesLinkIsNotOurs() {
        XCTAssertNil(parse("https://example.com/add?text=x"))
        XCTAssertNil(parse("shortcuts://run-shortcut?name=x"))
    }

    func testAnUnknownRouteIsRefusedRatherThanGuessedAt() {
        // So a later stackedwins://done can't be quietly swallowed by add.
        XCTAssertNil(parse("stackedwins://done"))
        XCTAssertNil(parse("stackedwins://"))
    }

    func testAHandTypedLinkWithoutSlashesStillWorks() {
        XCTAssertEqual(parse("stackedwins:add?text=laundry")?.text, "laundry")
    }

    func testAnEmptyTextIsAnEmptyBoxNotAFailure() {
        XCTAssertEqual(parse("stackedwins://add?text=")?.text, "")
        XCTAssertEqual(parse("stackedwins://add?text=%20%20")?.text, "")
    }
}
