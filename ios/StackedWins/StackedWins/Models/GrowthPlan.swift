import Foundation

struct GrowthPlan: Codable, Identifiable {
    let id: String
    let userId: String
    let vision: String
    let intensity: PlanIntensity
    let isActive: Bool
    let milestones: [Milestone]
    let tasks: [Task]
    let createdAt: Date
    let updatedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case vision
        case intensity
        case isActive = "is_active"
        case milestones
        case tasks
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

enum PlanIntensity: String, Codable {
    case low
    case standard
    case high
}

struct Milestone: Codable, Identifiable {
    let id: String
    let planId: String
    let title: String
    let description: String
    let targetDate: Date
    let progress: Int // 0-100
    let completedAt: Date?
    
    enum CodingKeys: String, CodingKey {
        case id
        case planId = "plan_id"
        case title
        case description
        case targetDate = "target_date"
        case progress
        case completedAt = "completed_at"
    }
}

struct Task: Codable, Identifiable {
    let id: String
    let planId: String
    let title: String
    let description: String?
    let estimatedMinutes: Int
    let isAnchorWin: Bool
    let category: TaskCategory
    let order: Int
    
    enum CodingKeys: String, CodingKey {
        case id
        case planId = "plan_id"
        case title
        case description
        case estimatedMinutes = "estimated_minutes"
        case isAnchorWin = "is_anchor_win"
        case category
        case order
    }
}

enum TaskCategory: String, Codable {
    case mental
    case physical
    case purpose
    case routine
}
