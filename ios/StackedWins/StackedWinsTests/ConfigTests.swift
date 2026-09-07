import XCTest
@testable import StackedWins

/// Guards the runtime configuration wiring.
///
/// Why: `Config.apiBaseURL` previously hardcoded port 3000 while the backend
/// listens on 3001, and the value was duplicated in APIService. Both were
/// wrong, and nothing caught it. These tests fail if the Info.plist plumbing
/// breaks or the port regresses.
final class ConfigTests: XCTestCase {

    func testAPIBaseURLIsPopulatedFromInfoPlist() {
        // A build-setting substitution that silently fails leaves the literal
        // "$(API_BASE_URL)" in the bundle. Assert we got a real URL instead.
        let url = Config.apiBaseURL

        XCTAssertFalse(url.absoluteString.contains("$("),
                       "API_BASE_URL was not substituted at build time")
        XCTAssertNotNil(url.scheme, "API base URL has no scheme")
        XCTAssertNotNil(url.host, "API base URL has no host")
    }

    func testAPIBaseURLPointsAtTheAPIPath() {
        XCTAssertTrue(Config.apiBaseURL.absoluteString.hasSuffix("/api"),
                      "Expected the base URL to end in /api, got \(Config.apiBaseURL)")
    }

    func testDebugBuildTargetsTheBackendsActualPort() {
        // Tests run against the Debug configuration, which points at
        // localhost. The backend defaults to 3001 (backend/src/index.js);
        // this asserts the two agree.
        #if DEBUG
        let url = Config.apiBaseURL
        XCTAssertEqual(url.host, "localhost")
        XCTAssertEqual(url.port, 3001,
                       "iOS is pointing at the wrong backend port")
        #endif
    }
}
