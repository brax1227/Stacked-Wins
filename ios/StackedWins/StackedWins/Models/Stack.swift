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
    let id: String
    let title: String
    let kind: StackKind
    /// 'open' | 'done' | 'dropped' | 'split'
    let status: String
    let position: Double
    let snoozedUntil: String?
    let pushCount: Int
    let parentId: String?
    let completedAt: String?
    let createdAt: String
    let updatedAt: String

    var isSleeping: Bool { snoozedUntil != nil }
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
    let kind: StackKind
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
    let kind: StackKind
    let remaining: Int
    let sleeping: Int
    let done: Int
    let lanes: LaneCounts
}

/// GET /api/stack/capabilities — what this deployment can do, so the UI can
/// hide an AI button rather than show one that fails on tap.
struct StackCapabilities: Codable {
    let splitAssist: Bool
}

struct DumpResult: Codable {
    let added: Int
    let kind: StackKind
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
