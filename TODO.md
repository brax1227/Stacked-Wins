# Stacked Wins — Current To-Do List

> **Direction changed.** The problem we're solving is now the one in
> [PROBLEM.md](./PROBLEM.md): a pile held in your head that freezes you, fixed
> by dumping it out and seeing one thing at a time. The growth-plan work below
> is Layer 2 and is on hold — not deleted, just no longer the front door.

## ✅ The Stack — core loop (done)

- [x] `StackItem` model (Prisma) — no due dates or estimates by design
- [x] `POST /api/stack/dump` — brain dump, one thing per line, forgiving parsing
- [x] `GET /api/stack/next` — exactly one card, never a list
- [x] The four moves: `done`, `push` ("Not now"), `later` ("Not today"), `split` ("Too big")
- [x] `GET /api/stack` + `POST /api/stack/:id/drop` — the opt-in full list
- [x] Split hint after 3 pushes ("this might be bigger than one thing")
- [x] Web: `/dump`, `/now`, `/stack`; `/now` is the front door after login
- [x] Nav hidden on `/now` so the one-card screen stays a one-card screen
- [x] Two lanes: **Need to** / **Want to** — one choice per dump session, never a gate
- [x] Optional ranking (`↑ ↓ do first`) on `/stack` only; dump order is the default
- [x] `POST /api/stack/:id/kind` and `/rank`; lane-aware dump, next, push and split
- [x] Empty Need lane points you at the Want lane — clearing needs is the reward
- [x] **"I don't know where to start"** — Claude suggests the smallest first steps
      on the "Too big" screen. Suggests only: pieces land in the editable box and
      nothing is written until the user confirms.
- [x] Ported plan generation and coach chat from OpenAI to Claude, with structured
      outputs replacing hand-parsed JSON
- [x] AI client built lazily — a missing key no longer stops the server booting,
      it just hides the suggestion button (`GET /api/stack/capabilities`)
- [x] Tests: 60 backend (service + endpoints + assist), 9 web (one-card + lane contract)

## 🚧 The Stack — next up (HIGH PRIORITY)

- [ ] **Get `stack_items` into the database.** Note this repo has never had a
      migrations directory, so the first `migrate dev` baselines the *whole*
      schema, not just this table:
  ```bash
  cd backend && npx prisma migrate dev --name init   # first time, creates everything
  # or, for a scratch dev database:
  cd backend && npx prisma db push
  ```
- [ ] **Cleared history screen** — `GET /api/stack?status=done` has no UI yet. This
      is where "wins stack" becomes visible, and it's the only place a growing
      number is a good thing.
- [ ] **Keyboard shortcuts on `/now`** — the four moves on 1–4 or D/N/T/B. Every
      tap saved is friction removed from the one screen that matters.
- [ ] **Undo the last move** — a mis-tapped "Done" currently needs a trip to the
      database. One-tap moves need a one-tap undo.
- [ ] **Empty-stack first run** — a brand-new user lands on `/now` with nothing.
      Should route to `/dump` on first visit rather than showing an empty lane.
- [ ] **iOS: the same three screens.** The one-card screen is a better fit on a
      phone than on the web, and the phone is where the pile gets remembered.
      **The release pipeline is ready and waiting for this** — see
      `ios/TESTFLIGHT.md`. What ships today is the placeholder `ContentView`;
      `APIService` still stubs the deleted growth-plan endpoints and knows
      nothing about `/stack/*`, and `Config.swift` points at `localhost:3000`
      (wrong port, and meaningless on a phone).
- [ ] **Capture from outside the app** — share sheet / widget / quick add. Anything
      that has to wait until you open the app is a thing that stays in your head.

## 🤔 The Stack — open questions

- [ ] **Drag-to-reorder on `/stack`.** Arrows and "do first" are robust and work
      on touch; dragging fits the "physically arrange it" instinct better. Needs
      a touch-capable approach, not HTML5 drag-and-drop.
- [ ] **Does "Not today" need a "not this week"?** Risk: every option added is a
      decision, and decisions are the failure mode. Probably no.
- [ ] **Should `/now` ever show progress?** PROBLEM.md says no — the size of the
      pile is what freezes them. Worth testing whether *cleared today* (a number
      that only goes up) is different enough to be safe.
- [ ] **Watch the lanes for scope creep.** Two buckets is the whole taxonomy. The
      moment someone asks for a third, or for tags, re-read PROBLEM.md first —
      every bucket added is a decision charged at capture time.
- [ ] **Recurring things.** Real, but recurrence is structure, and structure is
      the tax we refuse to charge. Needs a design that costs the user nothing.
- [ ] **Tune the split assist.** It runs at `output_config.effort: 'low'` — a
      deliberate per-route choice for a short, tightly-specified extraction that
      may be hit many times a sitting. Raise it if suggestions come back shallow.
- [ ] **Measure what the assist actually costs** before opening it up. Nothing in
      the app rate-limits it beyond the global limiter.

---

## ⏸️ Layer 2 — Growth Plan (ON HOLD)

Everything below was the previous direction. Kept for when a user is unfrozen
and asking "where is this going?" — see PROBLEM.md.

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
  - Call the Anthropic API with assessment data
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
  - Call the Anthropic API
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

- [x] Set up Anthropic API client (`src/utils/anthropic.js`, lazily constructed)
- [ ] Create prompt templates for:
  - Plan generation
  - Coach responses
- [ ] Implement error handling for AI API
- [ ] Add rate limiting for AI calls
- [ ] Test AI responses

## 📱 iOS App Setup

- [x] Xcode project — defined in `ios/project.yml`, generated by XcodeGen in CI
      (no `.xcodeproj` in git; add Swift files to `ios/StackedWins/StackedWins/`
      and they're picked up automatically)
- [x] TestFlight release pipeline (`.github/workflows/ios-testflight.yml`) —
      **unrun**: needs an Apple Developer account and four repo secrets first,
      see `ios/TESTFLIGHT.md`
- [ ] Register a bundle ID you own and set it in `ios/project.yml`
- [ ] First shakedown run of the pipeline
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

## Current Status (Layer 2)

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

**Priority Order (Layer 2, on hold):**
1. Database setup
2. Authentication (blocks everything else)
3. Assessment + Plan generation (needed for onboarding)
4. Tasks + Check-ins (core daily functionality)
5. Progress dashboard
6. AI Coach
7. Polish and testing
