import XCTest
@testable import StackedWins

/// The pieces of the networking layer that can be exercised without a server.
final class APIClientTests: XCTestCase {

    private struct Payload: Encodable {
        let text: String
        let kind: StackKind
    }

    func testAnyEncodableForwardsToTheWrappedValue() throws {
        let data = try JSONEncoder().encode(AnyEncodable(Payload(text: "laundry", kind: .want)))
        let decoded = try JSONSerialization.jsonObject(with: data) as? [String: Any]

        XCTAssertEqual(decoded?["text"] as? String, "laundry")
        XCTAssertEqual(decoded?["kind"] as? String, "want")
    }

    func testTokenStoreRoundTripsAndClears() {
        let store = InMemoryTokenStore()
        let client = APIClient(tokenStore: store)

        XCTAssertFalse(client.isAuthenticated)

        store.token = "jwt"
        XCTAssertTrue(client.isAuthenticated)

        store.token = nil
        XCTAssertFalse(client.isAuthenticated)
    }

    func testEveryErrorHasSomethingToShowTheUser() {
        let errors: [APIError] = [
            .badServerURL, .unauthorized,
            .server(status: 404, message: "Card not found"),
            .decoding("x"), .transport("offline"),
        ]
        for error in errors {
            XCTAssertFalse((error.errorDescription ?? "").isEmpty, "\(error) has no message")
        }
    }

    func testServerErrorsSurfaceTheBackendsOwnMessage() {
        // The backend answers {"error": "..."} in plain language; show it as-is.
        XCTAssertEqual(APIError.server(status: 404, message: "Card not found").errorDescription,
                       "Card not found")
    }
}
