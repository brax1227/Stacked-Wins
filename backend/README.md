# Stacked Wins Backend API

RESTful API server for the Stacked Wins wellness app.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Firebase and JWT settings
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

Server runs on `http://localhost:3001` (configurable via `PORT`)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Assessment
- `POST /api/assessment` - Submit onboarding assessment
- `GET /api/assessment` - Get user's assessment

### Plan
- `POST /api/plan/generate` - Generate AI growth plan
- `GET /api/plan/current` - Get current active plan
- `PUT /api/plan/:id` - Update plan

### Tasks
- `GET /api/tasks/today` - Get today's tasks
- `POST /api/tasks/complete` - Mark task as complete
- `PUT /api/tasks/adjust` - Adjust today's plan

### Progress
- `GET /api/progress/dashboard` - Get progress dashboard data
- `GET /api/progress/metrics` - Get detailed metrics

### Coach
- `POST /api/coach/chat` - Send message to AI coach
- `GET /api/coach/history` - Get chat history

### Check-in
- `POST /api/checkin` - Submit daily check-in
- `GET /api/checkin/history` - Get check-in history

## Environment Variables

See `.env.example` for required variables.

**IMPORTANT:** Never commit `.env` file. Use GCP Secret Manager in production.

### Auth mode

This backend supports two token-verification modes (selected by `AUTH_MODE`):

- **jwt** (default): backend issues and verifies JWTs
- **firebase**: backend verifies Firebase ID tokens

## Database

Uses **Firebase Firestore** for app data and **local JWT auth** (users stored in Firestore with bcrypt hashes).

## Testing

```bash
npm test
```

## Logging

Structured JSON logs via Winston. Logs include:
- Level (error, warn, info, debug)
- Module name
- Correlation ID
- User ID (when available)
- Timestamp

## Security

- JWT authentication
- Password hashing (bcrypt)
- Rate limiting
- CORS configuration
- Input validation (Zod)
- SQL injection prevention (Prisma)
