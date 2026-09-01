# Stacked Wins

> Small wins build strong foundations

**The problem:** having a lot to do, holding all of it in your head, and
freezing — because thinking about the pile costs as much as doing something,
so you stop looking and nothing gets done.

**The app:** you dump everything out of your head in one box, and it hands you
back exactly one thing at a time. Clear it, that's a win. Wins stack.

Three screens, and that's the whole thing:

| Screen | Job |
|---|---|
| **Dump** (`/dump`) | Get it out of your head. One thing per line, no categories, no dates, no priorities. |
| **Now** (`/now`) | See one card. Big. Four moves: Done, Not now, Not today, Too big. Nothing else on screen. |
| **Everything** (`/stack`) | The full list. Always reachable, never the default — a list on screen is the overwhelm we just removed. |

📄 The problem statement this is built against: **[PROBLEM.md](./PROBLEM.md)**

## 🎯 Project Overview

**Platforms:** iOS (native) + Web (responsive)  
**Tech Stack:**
- **Backend:** Node.js/Express + PostgreSQL
- **iOS:** Swift/SwiftUI
- **Web:** React/TypeScript
- **AI:** OpenAI/Anthropic API for coaching

## 📁 Project Structure

```
Small_Wins/
├── PROBLEM.md                 # The problem we're solving (read this first)
├── PRODUCT_DESIGN.md          # Complete product design document
├── README.md                  # This file
├── ARCHITECTURE.md            # Technical architecture
├── backend/                   # API server
│   ├── src/
│   ├── tests/
│   └── package.json
├── ios/                       # iOS native app
│   └── StackedWins/
├── web/                       # Web app (React)
│   ├── src/
│   ├── public/
│   └── package.json
└── shared/                    # Shared types/utilities
    └── types/
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (for backend & web)
- Xcode 15+ (for iOS)
- PostgreSQL 14+
- Git

### Environment Setup

1. **Clone and navigate:**
   ```bash
   cd Small_Wins
   ```

2. **Backend setup:**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your database and API keys
   npm run dev
   ```

3. **Web setup:**
   ```bash
   cd web
   npm install
   cp .env.example .env
   npm run dev
   ```

4. **iOS setup:**
   ```bash
   cd ios
   open StackedWins.xcodeproj
   # Configure signing in Xcode
   # Run on simulator or device
   ```

## 🔐 Security & Secrets

**IMPORTANT:** No secrets in code or `.env` files checked into git.

- Use `.env.example` files with placeholders
- Use GCP Secret Manager in production
- All API keys must be environment variables
- See `backend/README.md` for setup instructions

## 📋 Development Workflow

### Git Workflow

- **Branch strategy:** `main` (protected), `dev`, feature branches `feat/<scope>`
- **Conventional commits:** `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `perf:`, `build:`, `ci:`

### PR Checklist

- [ ] Tests added/updated
- [ ] Lint/format passes
- [ ] Breaking changes documented
- [ ] Secrets not included
- [ ] Rollback plan noted

## 🧪 Testing

```bash
# Backend tests
cd backend && npm test

# Web tests
cd web && npm test

# iOS tests (in Xcode)
# Cmd+U to run tests
```

## 📊 Observability

- Structured JSON logs with level, module, correlation_id
- Metrics: latency, error rate, task completion, user engagement
- Health checks: `/health` endpoint

## 📚 Documentation

- **The Problem:** See `PROBLEM.md` — the source of truth for product decisions
- **Product Design:** See `PRODUCT_DESIGN.md`
- **Architecture:** See `ARCHITECTURE.md`
- **API Docs:** See `backend/README.md`
- **iOS Guide:** See `ios/README.md`
- **Web Guide:** See `web/README.md`

## 🎨 Design Principles

1. One thing on screen — the list is the failure state
2. Never make them decide — choosing is thinking, thinking is the freeze
3. Capture costs nothing — no required structure, ever
4. Clarity over clutter
5. Calm UI
6. No manipulation — no streak pressure, no punishment for a bad day
7. Respect user autonomy — the full list is always reachable
8. Privacy-first

## 🛠️ Tech Stack Details

### Backend
- Node.js + Express
- PostgreSQL (via Prisma ORM)
- JWT authentication
- OpenAI/Anthropic API integration
- Structured logging (Winston)

### iOS
- Swift 5.9+
- SwiftUI
- Combine for reactive state
- Core Data (local storage)
- URLSession for API calls

### Web
- React 18+
- TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- React Query (data fetching)

## 📝 License

[To be determined]

## 👥 Contributing

[To be added]

---

**Status:** 🚧 In Development — core loop (dump → one card → clear) implemented
