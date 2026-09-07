import XCTest
@testable import StackedWins

/// Tests for the JSON contract between the iOS models and the backend API.
///
/// Why these exist: the models declare `snake_case` CodingKeys, but nothing
/// verified they actually match what the Express backend sends. A mismatch
/// here fails silently at runtime as a decode error, which is exactly the
/// class of bug a test target is cheapest at catching.
final class ModelDecodingTests: XCTestCase {

    /// The backend serialises dates with `.toISOString()` (see
    /// backend/src/controllers/authController.js), so the decoder must be
    /// configured for ISO 8601 or every date-bearing model fails to parse.
    private func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }

    // MARK: - User

    func testUserDecodesFromBackendPayload() throws {
        // Mirrors the exact shape returned by POST /api/auth/register.
        let json = Data("""
        {
          "id": "9f8c1b2e-0000-4a1b-9c3d-1a2b3c4d5e6f",
          "email": "test@example.com",
          "created_at": "2026-01-15T10:30:00.000Z",
          "updated_at": "2026-01-15T10:30:00.000Z"
        }
        """.utf8)

        let user = try makeDecoder().decode(User.self, from: json)

        XCTAssertEqual(user.id, "9f8c1b2e-0000-4a1b-9c3d-1a2b3c4d5e6f")
        XCTAssertEqual(user.email, "test@example.com")
    }

    func testUserDecodingFailsWhenRequiredFieldMissing() {
        // `email` is non-optional, so its absence must be an error rather than
        // quietly producing an empty string.
        let json = Data("""
        {
          "id": "abc",
          "created_at": "2026-01-15T10:30:00.000Z",
          "updated_at": "2026-01-15T10:30:00.000Z"
        }
        """.utf8)

        XCTAssertThrowsError(try makeDecoder().decode(User.self, from: json))
    }

    // MARK: - AuthResponse

    func testAuthResponseDecodesNestedUser() throws {
        let json = Data("""
        {
          "token": "header.payload.signature",
          "user": {
            "id": "abc",
            "email": "test@example.com",
            "created_at": "2026-01-15T10:30:00.000Z",
            "updated_at": "2026-01-15T10:30:00.000Z"
          }
        }
        """.utf8)

        let response = try makeDecoder().decode(AuthResponse.self, from: json)

        XCTAssertEqual(response.token, "header.payload.signature")
        XCTAssertEqual(response.user.email, "test@example.com")
    }

    // MARK: - Enums

    func testTaskCategoryDecodesEveryBackendValue() throws {
        // These four strings are what the backend actually emits; if a new
        // category is added server-side without updating this enum, decoding
        // breaks. This test documents the agreed set.
        for raw in ["mental", "physical", "purpose", "routine"] {
            let json = Data("\"\(raw)\"".utf8)
            let category = try makeDecoder().decode(TaskCategory.self, from: json)
            XCTAssertEqual(category.rawValue, raw)
        }
    }

    func testPlanIntensityDecodesEveryBackendValue() throws {
        for raw in ["low", "standard", "high"] {
            let json = Data("\"\(raw)\"".utf8)
            let intensity = try makeDecoder().decode(PlanIntensity.self, from: json)
            XCTAssertEqual(intensity.rawValue, raw)
        }
    }

    func testUnknownTaskCategoryIsRejected() {
        // Fail loudly on an unrecognised category rather than defaulting to
        // something arbitrary and mis-categorising the user's data.
        let json = Data("\"nonsense\"".utf8)
        XCTAssertThrowsError(try makeDecoder().decode(TaskCategory.self, from: json))
    }

    // MARK: - Milestone

    func testMilestoneDecodesWithNullCompletedAt() throws {
        // `completed_at` is null for every milestone the user has not yet
        // finished, which is the common case.
        let json = Data("""
        {
          "id": "m1",
          "plan_id": "p1",
          "title": "First milestone",
          "description": "Do the thing",
          "target_date": "2026-02-01T00:00:00.000Z",
          "progress": 40,
          "completed_at": null
        }
        """.utf8)

        let milestone = try makeDecoder().decode(Milestone.self, from: json)

        XCTAssertEqual(milestone.progress, 40)
        XCTAssertNil(milestone.completedAt)
    }
}
