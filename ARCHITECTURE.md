# Stacked Wins — Technical Architecture

## System Overview

```
┌─────────────┐     ┌─────────────┐
│   iOS App   │     │  Web App    │
│  (SwiftUI)  │     │  (React)    │
└──────┬──────┘     └──────┬──────┘
       │                   │
       └──────────┬────────┘
                  │
         ┌────────▼────────┐
         │   API Server    │
         │  (Node/Express) │
         └────────┬─────────┘
                  │
       ┌──────────┼──────────┐
       │          │          │
┌──────▼─────┐ ┌─▼──────┐ ┌─▼────────┐
│ PostgreSQL │ │ OpenAI │ │  Push    │
│  Database  │ │   API  │ │ Notify   │
└────────────┘ └────────┘ └──────────┘
```

## Core Components

### 1. Backend API (`backend/`)

**Responsibilities:**
- User authentication & authorization
- Assessment data processing
- AI plan generation
- Daily task management
- Progress tracking
- AI coach chat
- Notification scheduling

**Tech Stack:**
- Node.js 18+
- Express.js
- PostgreSQL (via Prisma)
- JWT for auth
- OpenAI/Anthropic SDK
- Winston for logging

**Key Endpoints:**
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/assessment
POST   /api/plan/generate
GET    /api/plan/current
GET    /api/tasks/today
POST   /api/tasks/complete
GET    /api/progress/dashboard
POST   /api/coach/chat
POST   /api/checkin
```

### 2. iOS App (`ios/`)

**Responsibilities:**
- Native iOS experience
- Offline-first with sync
- Push notifications
- Local data caching
- Smooth animations

**Tech Stack:**
- Swift 5.9+
- SwiftUI
- Combine
- Core Data (local storage)
- URLSession (API calls)
- UserNotifications framework

**Key Screens:**
- Onboarding flow
- Daily Plan view
- Progress Dashboard
- Coach Chat
- Settings

### 3. Web App (`web/`)

**Responsibilities:**
- Responsive web experience
- Cross-platform access
- PWA capabilities
- Web push notifications

**Tech Stack:**
- React 18+
- TypeScript
- Vite
- Tailwind CSS
- React Query
- React Router

**Key Pages:**
- Onboarding
- Daily Plan
- Dashboard
- Coach Chat
- Settings

## Data Models

### User
```typescript
{
  id: UUID
  email: string
  passwordHash: string
  createdAt: timestamp
  updatedAt: timestamp
  preferences: {
    tone: 'steady' | 'firm' | 'gentle'
    notificationSettings: {...}
  }
}
```

### Assessment
```typescript
{
  id: UUID
  userId: UUID
  mentalBaseline: {
    stress: number (1-10)
    anxiety: number (1-10)
    moodStability: number (1-10)
  }
  sleep: {
    quality: number (1-10)
    hours: number
  }
  habits: string[]
  timeAvailable: {
    weekday: number (minutes)
    weekend: number (minutes)
  }
  goals: string[]
  values: string[]
  completedAt: timestamp
}
```

### GrowthPlan
```typescript
{
  id: UUID
  userId: UUID
  vision: string
  milestones: Milestone[]
  weeklyFocus: string
  dailyBaseline: Task[]
  intensity: 'low' | 'standard' | 'high'
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Milestone
```typescript
{
  id: UUID
  planId: UUID
  title: string
  description: string
  targetDate: date
  progress: number (0-100)
  completedAt: timestamp | null
}
```

### Task
```typescript
{
  id: UUID
  planId: UUID
  title: string
  description: string
  estimatedMinutes: number
  isAnchorWin: boolean
  category: 'mental' | 'physical' | 'purpose' | 'routine'
  order: number
}
```

### DailyCheckIn
```typescript
{
  id: UUID
  userId: UUID
  date: date
  energy: number (1-10)
  stress: number (1-10)
  sleepQuality: number (1-10)
  completedTasks: UUID[]
  reflection: string | null
  createdAt: timestamp
}
```

### ProgressMetrics
```typescript
{
  userId: UUID
  winsStacked: number
  consistencyRate: number (0-100)
  baselineStreak: number
  moodTrend: number[] // last 30 days
  recoveryStrength: number
  lastUpdated: timestamp
}
```

## AI Integration

### Plan Generation Flow

1. User completes assessment
2. Backend sends assessment data to AI (OpenAI/Anthropic)
3. AI generates structured plan:
   - Vision statement
   - 3 milestones
   - Weekly focus themes
   - Daily micro-actions
4. Plan saved to database
5. First daily plan created

### Coach Chat Flow

1. User sends message
2. Backend retrieves:
   - User's current plan
   - Recent check-ins
   - Progress metrics
   - Chat history
3. Context sent to AI with system prompt
4. AI responds with coaching message
5. Response saved to chat history

**System Prompt Principles:**
- Grounded, supportive tone
- No therapy claims
- Focus on structure and systems
- Identity-based reinforcement
- Small wins emphasis

## Authentication & Security

### Auth Flow
1. User registers/logs in
2. Backend validates credentials
3. JWT token issued (expires in 7 days)
4. Token stored securely (iOS Keychain, Web localStorage)
5. Token sent in `Authorization` header for API calls
6. Refresh token mechanism for long sessions

### Security Measures
- Password hashing (bcrypt)
- JWT signing with secret
- Rate limiting on API endpoints
- CORS configuration
- Input validation & sanitization
- SQL injection prevention (Prisma ORM)

## Notification System

### Types
1. **Prep Reminder** (morning)
2. **Start Window** (user-chosen time)
3. **Reflection Prompt** (evening)
4. **Recovery Support** (after missed days)

### Implementation
- Backend: Node-cron for scheduling
- iOS: UserNotifications framework
- Web: Web Push API
- Rules: Max 2/day default, adaptive based on stress

## Database Schema

### Tables
- `users`
- `assessments`
- `growth_plans`
- `milestones`
- `tasks`
- `daily_checkins`
- `task_completions`
- `reflections`
- `coach_chats`
- `progress_metrics`

### Relationships
- User → Assessment (1:1)
- User → GrowthPlan (1:many, active:1)
- GrowthPlan → Milestones (1:many)
- GrowthPlan → Tasks (1:many)
- User → DailyCheckIns (1:many)
- DailyCheckIn → TaskCompletions (1:many)

## API Design Principles

1. **RESTful conventions**
2. **Consistent error responses**
3. **Pagination for lists**
4. **Versioning** (`/api/v1/`)
5. **Rate limiting**
6. **Request/response logging**

## Deployment Strategy

### Environments
- **Development:** Local
- **Staging:** Cloud (GCP/AWS)
- **Production:** Cloud (GCP/AWS)

### Infrastructure
- **Backend:** Containerized (Docker) on Cloud Run / ECS
- **Database:** Managed PostgreSQL (Cloud SQL / RDS)
- **iOS:** App Store distribution
- **Web:** Vercel / Netlify / Cloud Storage + CDN

### CI/CD
1. Code push → GitHub Actions
2. Run tests
3. Build Docker image
4. Deploy to staging
5. Manual approval → Production

## Monitoring & Observability

### Logging
- Structured JSON logs
- Levels: error, warn, info, debug
- Correlation IDs for request tracking
- User IDs (anonymized in production)

### Metrics
- API latency (p50, p95, p99)
- Error rates
- Task completion rates
- User engagement (DAU, retention)
- AI API costs & latency

### Health Checks
- `/health` endpoint
- Database connectivity
- External API status (OpenAI)
- Response time monitoring

## Future Considerations

- **Caching:** Redis for frequently accessed data
- **Queue System:** Bull/BullMQ for async jobs
- **Real-time:** WebSocket for live coach updates
- **Analytics:** Privacy-respecting user behavior tracking
- **A/B Testing:** Feature flags for plan variations

---

**Last Updated:** 2024  
**Version:** 1.0
