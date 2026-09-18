import XCTest
@testable import StackedWins

/// The no-model path from "too big" to one small step.
///
/// This is the only help a phone without Apple Intelligence gets, so it has to
/// be right on its own terms rather than as a degraded version of something
/// else.
final class ManualFirstStepTests: XCTestCase {

    // MARK: - The timebox

    func testTimeboxWrapsACardIntoSomethingSmallerThanItself() {
        XCTAssertEqual(ManualFirstStep.timebox("clean the apartment"),
                       "spend 5 minutes on clean the apartment")
    }

    func testTimeboxSaysMinuteWhenThereIsOnlyOne() {
        XCTAssertEqual(ManualFirstStep.timebox("taxes", minutes: 1),
                       "spend 1 minute on taxes")
        XCTAssertEqual(ManualFirstStep.timebox("taxes", minutes: 2),
                       "spend 2 minutes on taxes")
    }

    func testTimeboxRefusesToWrapATimebox() {
        // Otherwise: "spend 5 minutes on spend 5 minutes on clean".
        XCTAssertNil(ManualFirstStep.timebox("spend 5 minutes on clean"))
        XCTAssertNil(ManualFirstStep.timebox("Spend 10 Minutes On taxes"))
        XCTAssertNil(ManualFirstStep.timebox("  spend 1 minute on dishes"))
    }

    func testSomethingThatMerelyMentionsMinutesIsNotATimebox() {
        // "spend" and "minutes" in a sentence is not the shape we made.
        XCTAssertNotNil(ManualFirstStep.timebox("spend less time on my phone"))
        XCTAssertNotNil(ManualFirstStep.timebox("the 5 minutes of fame thing"))
        XCTAssertNotNil(ManualFirstStep.timebox("spend 5 minutes"), "no 'on' and no task after it")
    }

    func testTimeboxRejectsNothingToWrap() {
        XCTAssertNil(ManualFirstStep.timebox(""))
        XCTAssertNil(ManualFirstStep.timebox("   \n  "))
    }

    func testTimeboxRejectsAnImpossibleDuration() {
        XCTAssertNil(ManualFirstStep.timebox("clean", minutes: 0))
        XCTAssertNil(ManualFirstStep.timebox("clean", minutes: -5))
    }

    func testAnAbsurdlyLongCardIsClippedRatherThanDropped() {
        // A stub you can edit beats no offer at all.
        let long = String(repeating: "x", count: ManualFirstStep.maxLength + 200)
        let step = ManualFirstStep.timebox(long)

        XCTAssertNotNil(step)
        XCTAssertEqual(step?.count, ManualFirstStep.maxLength)
        XCTAssertTrue(step?.hasPrefix("spend 5 minutes on ") == true)
    }

    func testTheResultIsAlwaysSomethingTheStackWouldAccept() throws {
        // A step that the dump parser would throw away is not a step.
        for title in ["clean", "- taxes", "  laundry  ", String(repeating: "y", count: 900)] {
            let step = try XCTUnwrap(ManualFirstStep.timebox(title))
            XCTAssertEqual(DumpParser.parse(step).count, 1, "\(title) produced an unusable step")
            XCTAssertLessThanOrEqual(step.count, ManualFirstStep.maxLength)
        }
    }

    // MARK: - The openers

    func testEveryOpenerIsPhysicalNotAnotherDecision() {
        // The whole failure mode: a fallback that says "plan" or "decide"
        // hands back the exact move the user is stuck on.
        let banned = ["plan", "decide", "think", "review", "organis", "organiz",
                      "prioriti", "consider", "list out", "figure out"]
        for opener in ManualFirstStep.openers {
            let text = (opener.label + " " + opener.stem).lowercased()
            for word in banned {
                XCTAssertFalse(text.contains(word), "\(opener.id) suggests \(word)")
            }
        }
    }

    func testOpenerIdsAreStableAndUnique() {
        let ids = ManualFirstStep.openers.map(\.id)
        XCTAssertEqual(Set(ids).count, ids.count, "ids are how the UI and these tests name them")
        XCTAssertTrue(ids.allSatisfy { !$0.isEmpty })
    }

    func testEveryStemLeavesTheCursorInABlank() {
        for opener in ManualFirstStep.openers {
            XCTAssertTrue(opener.stem.hasSuffix(" "), "\(opener.id) would jam the caret against a letter")
            XCTAssertFalse(opener.stem.hasPrefix(" "), "\(opener.id) starts with whitespace")
        }
    }

    func testAStemOnItsOwnIsNotYetAStep() {
        // Tapping an opener must not be confusable with having written one:
        // the parser keeps it (it's non-empty) but it's a fragment, and the
        // user is expected to finish it before confirming.
        for opener in ManualFirstStep.openers {
            XCTAssertEqual(DumpParser.parse(opener.stem), [opener.stem.trimmingCharacters(in: .whitespaces)])
        }
    }

    func testInsertingIntoAnEmptyBoxJustStarts() {
        let opener = ManualFirstStep.openers[0]
        XCTAssertEqual(ManualFirstStep.insert(opener, into: ""), opener.stem)
    }

    func testInsertingNeverDestroysWhatWasAlreadyTyped() throws {
        let opener = try XCTUnwrap(ManualFirstStep.openers.first { $0.id == "call" })

        let result = ManualFirstStep.insert(opener, into: "find the number")

        XCTAssertEqual(result, "find the number\ncall ")
        XCTAssertTrue(result.hasPrefix("find the number"))
    }

    func testInsertingAfterATrailingNewlineDoesNotLeaveABlankLine() throws {
        let opener = try XCTUnwrap(ManualFirstStep.openers.first { $0.id == "open" })
        XCTAssertEqual(ManualFirstStep.insert(opener, into: "dishes\n"), "dishes\nopen ")
    }

    func testTwoOpenersInARowBecomeTwoLines() {
        let first = ManualFirstStep.openers[0]
        let second = ManualFirstStep.openers[1]

        let once = ManualFirstStep.insert(first, into: "")
        let twice = ManualFirstStep.insert(second, into: once)

        XCTAssertEqual(DumpParser.parse(twice).count, 2)
    }
}

/// The five minutes is a **default the user can edit**, never a timer the app
/// runs or a picker it makes them answer. These pin that contract.
extension ManualFirstStepTests {

    func testTheFiveMinutesIsADefaultArgumentNotARequiredChoice() {
        // Callable with no duration at all: the sheet never has to ask.
        XCTAssertEqual(ManualFirstStep.timebox("dishes"), "spend 5 minutes on dishes")
        XCTAssertEqual(ManualFirstStep.defaultMinutes, 5)
    }

    func testAnyOtherDurationIsEquallyValid() {
        // Nothing privileges 5 beyond being the default.
        for minutes in [1, 2, 10, 25, 90] {
            let step = ManualFirstStep.timebox("taxes", minutes: minutes)
            XCTAssertEqual(step, "spend \(minutes) minute\(minutes == 1 ? "" : "s") on taxes")
        }
    }

    func testWhatItProducesIsPlainEditableTextAndNothingElse() {
        // No timer object, no schedule, no duration field on the card: the
        // result is a string that goes into a box the user can rewrite.
        let step = ManualFirstStep.timebox("clean the apartment")

        XCTAssertNotNil(step)
        // A user who rewrites it entirely still gets a usable card.
        let rewritten = "just do the dishes"
        XCTAssertEqual(DumpParser.parse(rewritten), ["just do the dishes"])
        // And one who edits only the number does too.
        let edited = step?.replacingOccurrences(of: "5 minutes", with: "20 minutes")
        XCTAssertEqual(edited, "spend 20 minutes on clean the apartment")
        XCTAssertEqual(DumpParser.parse(edited ?? "").count, 1)
    }
}
