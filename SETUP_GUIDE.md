# Stacked Wins — Setup Guide

This guide will help you get the Stacked Wins app up and running locally.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** installed ([download](https://nodejs.org/))
- **PostgreSQL 14+** installed and running
- **Xcode 15+** (for iOS development, macOS only)
- **Git** installed

## Quick Start

### 1. Database Setup

1. **Create PostgreSQL database:**
   ```bash
   createdb stacked_wins
   ```

2. **Or using psql:**
   ```sql
   CREATE DATABASE stacked_wins;
   ```

### 2. Backend Setup

1. **Navigate to backend:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment:**
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` file:**
   ```env
   # Prisma connection string for Postgres.
   #
   # If your local Postgres uses peer auth over the unix socket (common on Linux),
   # prefer the socket-based URL:
   DATABASE_URL="postgresql://USER@localhost:5432/stacked_wins?host=/var/run/postgresql&schema=public"
   #
   # If you prefer TCP (password-based), use:
   # DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/stacked_wins?schema=public"
   JWT_SECRET="your-super-secret-jwt-key-change-in-production"
   ANTHROPIC_API_KEY="sk-ant-your-anthropic-key"
   PORT=3001
   NODE_ENV=development
   ```

5. **Run database migrations:**
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

6. **Start backend server:**
   ```bash
   npm run dev
   ```

   Backend should be running on `http://localhost:3001`

### 3. Web App Setup

1. **Navigate to web directory:**
   ```bash
   cd ../web
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment:**
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` file:**
   ```env
   # Use Vite proxy in development
   VITE_API_URL=/api
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

   Web app should be running on `http://localhost:5173`

### 4. iOS App Setup (macOS only)

1. **Open Xcode project:**
   ```bash
   cd ../ios
   open StackedWins.xcodeproj
   ```
   
   **Note:** You'll need to create the Xcode project first. See iOS setup below.

2. **Configure signing:**
   - Select your development team in Xcode
   - Update bundle identifier if needed

3. **Update API URL:**
   - Edit `StackedWins/Utils/Config.swift`
   - Set `apiBaseURL` to your backend URL

4. **Run:**
   - Select simulator or device
   - Press Cmd+R to build and run

## Creating iOS Xcode Project

If you don't have an Xcode project yet:

1. **Open Xcode**
2. **File → New → Project**
3. **Select "iOS" → "App"**
4. **Configure:**
   - Product Name: `StackedWins`
   - Interface: `SwiftUI`
   - Language: `Swift`
   - Storage: `None` (we'll add Core Data later if needed)
5. **Save to:** `ios/StackedWins/`
6. **Move existing Swift files** into the project structure

## Project Structure Overview

```
Small_Wins/
├── PRODUCT_DESIGN.md          # Complete product design document
├── ARCHITECTURE.md            # Technical architecture
├── README.md                  # Main README
├── SETUP_GUIDE.md            # This file
│
├── backend/                   # Node.js API server
│   ├── src/
│   │   ├── index.js          # Entry point
│   │   ├── routes/           # API routes
│   │   ├── controllers/      # Request handlers
│   │   ├── models/           # Data models
│   │   ├── services/         # Business logic
│   │   ├── middleware/       # Express middleware
│   │   └── utils/            # Utilities
│   ├── prisma/
│   │   └── schema.prisma     # Database schema
│   ├── package.json
│   └── .env.example
│
├── web/                       # React web app
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/            # Page components
│   │   ├── hooks/            # Custom hooks
│   │   ├── services/         # API services
│   │   ├── utils/            # Utilities
│   │   ├── types/            # TypeScript types
│   │   └── styles/           # CSS/Tailwind
│   ├── package.json
│   └── vite.config.ts
│
├── ios/                       # iOS native app
│   └── StackedWins/
│       └── StackedWins/
│           ├── Views/        # SwiftUI views
│           ├── ViewModels/   # View models
│           ├── Models/       # Data models
│           ├── Services/     # API service
│           └── Utils/        # Utilities
│
└── shared/                    # Shared code
    └── types/                 # Shared TypeScript types
```

## Testing the Setup

### Backend Health Check

```bash
curl http://localhost:3001/health
```

Should return:
```json
{"status":"ok","timestamp":"2024-..."}
```

### Web App

Open `http://localhost:5173` in your browser. You should see the "Stacked Wins" placeholder page.

## Next Steps

1. **Implement authentication endpoints** in backend
2. **Create onboarding flow** in web/iOS
3. **Set up AI integration** (Anthropic Claude)
4. **Build daily plan UI**
5. **Implement progress tracking**

## Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running: `pg_isready`
- Check connection string in `.env`
- Ensure database exists: `psql -l | grep stacked_wins`

### Port Already in Use

- Backend (3000): Change `PORT` in `.env`
- Web (5173): Change port in `vite.config.ts`

### iOS Build Errors

- Ensure Xcode 15+ is installed
- Check Swift version compatibility
- Verify signing configuration

### API Connection Issues

- Check CORS settings in backend
- Verify API URL in frontend `.env`
- Check network tab in browser dev tools

## Development Workflow

1. **Start backend:** `cd backend && npm run dev`
2. **Start web:** `cd web && npm run dev` (in new terminal)
3. **Make changes** and see hot reload in action
4. **Run tests:** `npm test` in each directory

## Environment Variables Reference

### Backend (.env)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token signing
- `ANTHROPIC_API_KEY` - Anthropic API key. Optional: the server boots and the
  stack works without it; only the AI suggestion button disappears.
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `CORS_ORIGIN` - Allowed CORS origins

### Web (.env)
- `VITE_API_URL` - Backend API URL

## Security Notes

⚠️ **Never commit `.env` files to git!**

- Use `.env.example` as a template
- Add `.env` to `.gitignore`
- Use secret management in production (GCP Secret Manager, AWS Secrets Manager, etc.)

## Getting Help

- Check `PRODUCT_DESIGN.md` for product requirements
- Check `ARCHITECTURE.md` for technical details
- Review `README.md` in each subdirectory

---

**Status:** Ready for development! 🚀
