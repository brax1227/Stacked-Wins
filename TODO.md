# Stacked Wins — Current To-Do List

## 🚧 Backend API Implementation (HIGH PRIORITY)

The frontend UI is complete, but all backend endpoints need to be implemented.

### 1. Authentication Endpoints
- [ ] `POST /api/auth/register` - User registration
  - Hash password with bcrypt
  - Create user in database
  - Generate JWT token
  - Return user + token
- [ ] `POST /api/auth/login` - User login
  - Verify credentials
  - Generate JWT token
  - Return user + token
- [ ] `POST /api/auth/refresh` - Refresh token (optional)
- [ ] Create auth middleware for protected routes

### 2. Assessment Endpoints
- [ ] `POST /api/assessment` - Submit onboarding assessment
  - Save assessment to database
  - Link to user
- [ ] `GET /api/assessment` - Get user's assessment (optional)

### 3. Plan Endpoints
- [ ] `POST /api/plan/generate` - Generate AI growth plan
  - Get user's assessment
  - Call OpenAI/Anthropic API with assessment data
  - Parse AI response into structured plan
  - Save plan to database
  - Create initial tasks
- [ ] `GET /api/plan/current` - Get current active plan
  - Return plan with milestones and tasks
- [ ] `PUT /api/plan/:id` - Update plan (optional)

### 4. Tasks Endpoints
- [ ] `GET /api/tasks/today` - Get today's tasks
  - Query tasks for today
  - Check for completions
  - Return tasks with completion status
- [ ] `POST /api/tasks/complete` - Mark task as complete
  - Create TaskCompletion record
  - Update progress metrics
- [ ] `PUT /api/tasks/adjust` - Adjust today's plan
  - Support "minimum" and "standard" modes
  - Return adjusted task list

### 5. Check-in Endpoints
- [ ] `POST /api/checkin` - Submit daily check-in
  - Save energy, stress, sleep quality
  - Optional reflection
  - Update progress metrics
- [ ] `GET /api/checkin/history` - Get check-in history (optional)

### 6. Progress Endpoints
- [ ] `GET /api/progress/dashboard` - Get dashboard data
  - Calculate wins stacked
  - Calculate consistency rate
  - Get baseline streak
  - Get mood trend (from check-ins)
  - Get recent check-ins
  - Return all metrics

### 7. Coach Endpoints
- [ ] `POST /api/coach/chat` - Send message to AI coach
  - Get user's plan, recent check-ins, progress
  - Build context for AI
  - Call OpenAI/Anthropic API
  - Save chat history
  - Return response
- [ ] `GET /api/coach/history` - Get chat history

## 🗄️ Database Setup

- [ ] Run Prisma migrations
  ```bash
  cd backend
  npx prisma migrate dev --name init
  ```
- [ ] Generate Prisma client
  ```bash
  npx prisma generate
  ```
- [ ] Verify database connection
- [ ] Seed initial data (optional)

## 🤖 AI Integration

- [ ] Set up OpenAI or Anthropic API client
- [ ] Create prompt templates for:
  - Plan generation
  - Coach responses
- [ ] Implement error handling for AI API
- [ ] Add rate limiting for AI calls
- [ ] Test AI responses

## 📱 iOS App Setup

- [ ] Create Xcode project
  - File → New → Project
  - iOS App template
  - SwiftUI interface
- [ ] Move existing Swift files into project
- [ ] Configure API base URL
- [ ] Test API connectivity
- [ ] Build basic UI screens

## 🧪 Testing

- [ ] Write unit tests for backend services
- [ ] Write integration tests for API endpoints
- [ ] Test authentication flow
- [ ] Test plan generation
- [ ] Test task completion
- [ ] Test AI coach responses

## 🔒 Security & Polish

- [ ] Add input validation (Zod schemas)
- [ ] Add request sanitization
- [ ] Implement proper error messages
- [ ] Add request logging
- [ ] Set up environment-specific configs
- [ ] Add API documentation (Swagger/OpenAPI)

## 📊 Monitoring & Observability

- [ ] Add metrics collection
- [ ] Set up error tracking
- [ ] Add performance monitoring
- [ ] Log important events (plan creation, task completion)

## 🚀 Deployment Prep

- [ ] Set up production database
- [ ] Configure environment variables
- [ ] Set up CI/CD pipeline
- [ ] Create deployment scripts
- [ ] Set up monitoring/alerts

---

## Current Status

✅ **Complete:**
- Frontend UI (all pages)
- Frontend infrastructure (routing, state, API services)
- Backend structure (folders, middleware, logging)
- Database schema (Prisma)
- Project documentation

🚧 **In Progress:**
- Backend API implementation (0% complete)

⏳ **Not Started:**
- Database migrations
- AI integration
- iOS app
- Testing
- Deployment

---

## Next Immediate Steps

1. **Set up database** - Run Prisma migrations
2. **Implement authentication** - Register and login endpoints
3. **Implement assessment** - Save user assessment
4. **Implement plan generation** - AI integration for creating plans
5. **Implement tasks** - Daily task management
6. **Implement check-ins** - Daily check-in tracking
7. **Implement progress** - Dashboard metrics
8. **Implement coach** - AI chat functionality

---

**Priority Order:**
1. Database setup
2. Authentication (blocks everything else)
3. Assessment + Plan generation (needed for onboarding)
4. Tasks + Check-ins (core daily functionality)
5. Progress dashboard
6. AI Coach
7. Polish and testing
