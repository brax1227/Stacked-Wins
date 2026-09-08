import Foundation

/// The two lanes. One choice per dump session, never a gate on getting a card.
/// See PROBLEM.md -> "The two lanes".
enum StackKind: String, Codable, CaseIterable, Identifiable {
    case need
    case want

    var id: String { rawValue }

    var label: String {
        switch self {
        case .need: return "Need to"
        case .want: return "Want to"
        }
    }

    var blurb: String {
        switch self {
        case .need: return "The stuff that has to get done."
        case .want: return "The stuff you'd actually like to do."
        }
    }

    var other: StackKind { self == .need ? .want : .need }
}

/// One thing the user is carrying. Deliberately no due date, priority or
/// estimate -- structure is a tax charged when the user has the least to give.
struct StackItem: Codable, Identifiable, Equatable {
    var id: String
    var title: String
    var kind: StackKind
    /// 'open' | 'done' | 'dropped' | 'split'
    var status: String
    var position: Double
    var snoozedUntil: String?
    var pushCount: Int
    var parentId: String?
    var completedAt: String?
    var createdAt: String
    var updatedAt: String

    var isSleeping: Bool { snoozedUntil != nil }

    var completedDate: Date? { Timestamps.parse(completedAt) }
    var snoozedDate: Date? { Timestamps.parse(snoozedUntil) }
}

/// The wire format for dates: ISO 8601, kept as strings on the models so a
/// formatting change server-side can never break decoding.
///
/// Parsing accepts fractional seconds or not, because both ends write these:
/// the API through Prisma's toISOString ("...:18.075Z"), the phone without
/// ("...:18Z"), and either one may end up reading the other's data.
enum Timestamps {
    private static let withFraction: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let plain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func parse(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        return withFraction.date(from: raw) ?? plain.date(from: raw)
    }

    static func string(from date: Date) -> String { plain.string(from: date) }
}

/// Askable cards per lane. Lets an empty lane point at the other one without
/// ever putting a number on the card screen.
struct LaneCounts: Codable, Equatable {
    let need: Int
    let want: Int

    subscript(kind: StackKind) -> Int {
        kind == .need ? need : want
    }
}

/// GET /api/stack/next — exactly one card, never a list.
struct NextCard: Codable, Equatable {
    let item: StackItem?
    var kind: StackKind
    /// The card keeps getting pushed; offer to break it down before they ask.
    let suggestSplit: Bool
    let remaining: Int
    let sleeping: Int
    let done: Int
    let lanes: LaneCounts
}

/// GET /api/stack — the full list for one lane. The only screen a count
/// belongs on, because its whole point is that the pile has edges.
struct StackList: Codable {
    let items: [StackItem]
    var kind: StackKind
    let remaining: Int
    let sleeping: Int
    let done: Int
    let lanes: LaneCounts
}

/// GET /api/stack/capabilities — what this deployment can do, so the UI can
/// hide a button rather than show one that fails on tap.
struct StackCapabilities: Codable, Equatable {
    /// Ask Claude for the smallest first steps. Needs a server with a key.
    let splitAssist: Bool
    /// Put the last move back. The phone can; a server that doesn't say so
    /// (every deployment older than this field) is assumed not to.
    let undo: Bool

    init(splitAssist: Bool, undo: Bool = false) {
        self.splitAssist = splitAssist
        self.undo = undo
    }

    enum CodingKeys: String, CodingKey {
        case splitAssist, undo
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        splitAssist = try container.decode(Bool.self, forKey: .splitAssist)
        undo = try container.decodeIfPresent(Bool.self, forKey: .undo) ?? false
    }
}

struct DumpResult: Codable {
    let added: Int
    var kind: StackKind
}

struct SplitSuggestion: Codable {
    let pieces: [String]
}

struct SplitResult: Codable {
    let pieces: Int
}

enum RankMove: String, Encodable {
    case up, down, top
}
