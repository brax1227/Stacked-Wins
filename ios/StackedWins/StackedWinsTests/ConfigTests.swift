import XCTest
@testable import StackedWins

/// Where the app thinks the API is.
///
/// Resolution order is Settings override, then the URL baked in at build time,
/// then localhost. Each of those has bitten someone: the original scaffold
/// hardcoded port 3000 in two places while the backend listens on 3001.
final class ConfigTests: XCTestCase {

    override func setUp() {
        super.setUp()
        UserDefaults.standard.removeObject(forKey: Config.serverURLDefaultsKey)
    }

    override func tearDown() {
        UserDefaults.standard.removeObject(forKey: Config.serverURLDefaultsKey)
        super.tearDown()
    }

    // MARK: - Normalisation of what a person types

    func testAppendsApiToABareHost() {
        XCTAssertEqual(Config.apiBaseURLIfValid("http://192.168.1.20:3001")?.absoluteString,
                       "http://192.168.1.20:3001/api")
    }

    func testToleratesTrailingSlashesAndAnExistingApiSuffix() {
        XCTAssertEqual(Config.apiBaseURLIfValid("https://api.example.com///")?.absoluteString,
                       "https://api.example.com/api")
        XCTAssertEqual(Config.apiBaseURLIfValid("https://api.example.com/api")?.absoluteString,
                       "https://api.example.com/api")
        XCTAssertEqual(Config.apiBaseURLIfValid("  https://api.example.com/api/ \n")?.absoluteString,
                       "https://api.example.com/api")
    }

    func testRejectsThingsThatAreNotAnHttpURLWithAHost() {
        XCTAssertNil(Config.apiBaseURLIfValid(""))
        XCTAssertNil(Config.apiBaseURLIfValid("   "))
        XCTAssertNil(Config.apiBaseURLIfValid("not a url"))
        XCTAssertNil(Config.apiBaseURLIfValid("ftp://files.example.com"))
        XCTAssertNil(Config.apiBaseURLIfValid("http://"))
    }

    // MARK: - Resolution order

    func testFallsBackToLocalhostWhenNothingIsConfigured() {
        // Only meaningful where no URL is baked into the bundle.
        if Config.bundledServerURL == nil {
            XCTAssertEqual(Config.serverURL, Config.fallbackServerURL)
            XCTAssertEqual(Config.fallbackServerURL, "http://localhost:3001",
                           "the backend listens on 3001; 3000 was the original bug")
        }
    }

    func testAUserOverrideWinsAndPersists() {
        Config.serverURL = "http://10.0.0.5:3001"

        XCTAssertEqual(Config.serverURL, "http://10.0.0.5:3001")
        XCTAssertEqual(Config.apiBaseURL?.absoluteString, "http://10.0.0.5:3001/api")
        XCTAssertEqual(UserDefaults.standard.string(forKey: Config.serverURLDefaultsKey),
                       "http://10.0.0.5:3001")
    }

    func testClearingTheOverrideRemovesItRatherThanStoringAnEmptyString() {
        Config.serverURL = "http://10.0.0.5:3001"
        Config.serverURL = "   "

        XCTAssertNil(UserDefaults.standard.string(forKey: Config.serverURLDefaultsKey))
    }

    #if os(iOS)
    func testTheBuildTimeURLWasSubstitutedIntoTheBundle() throws {
        // Tests run hosted in the app, so Bundle.main is the app bundle. An
        // unsubstituted build setting leaves the literal "$(API_BASE_URL)".
        let bundled = try XCTUnwrap(Config.bundledServerURL,
                                    "API_BASE_URL is missing from Info.plist; check ios/project.yml")
        XCTAssertFalse(bundled.contains("$("), "API_BASE_URL was not substituted at build time")
        XCTAssertNotNil(Config.apiBaseURLIfValid(bundled), "bundled URL is not a valid http(s) URL")
    }
    #endif
}
