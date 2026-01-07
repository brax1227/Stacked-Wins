# Stacked Wins — Wellness App

> Small wins build strong foundations

A mobile and web application focused on mental wellness, self-improvement, habit-building, and identity-level growth. Helps users define meaningful long-term goals, break them into tiny daily actions, and stack small wins over time.

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

- **Product Design:** See `PRODUCT_DESIGN.md`
- **Architecture:** See `ARCHITECTURE.md`
- **API Docs:** See `backend/README.md`
- **iOS Guide:** See `ios/README.md`
- **Web Guide:** See `web/README.md`

## 🎨 Design Principles

1. Clarity over clutter
2. Calm UI
3. Masculine but soft energy
4. No manipulation
5. Identity-based growth
6. Micro-wins first
7. Respect user autonomy
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

**Status:** 🚧 In Development — MVP Phase
