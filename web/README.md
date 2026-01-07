# Stacked Wins Web App

React + TypeScript web application for Stacked Wins wellness platform.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your API URL (recommended: VITE_API_URL=/api for local dev)
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

App runs on `http://localhost:5173`

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/          # Page components
├── hooks/          # Custom React hooks
├── services/       # API service layer
├── utils/          # Utility functions
├── types/          # TypeScript type definitions
└── styles/         # Global styles
```

## Key Features

- **Onboarding Flow** - Deep assessment survey
- **Daily Plan** - Today's micro-wins
- **Progress Dashboard** - Wins, streaks, metrics
- **AI Coach Chat** - Structured coaching conversations
- **Responsive Design** - Works on mobile and desktop

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Query (data fetching)
- React Router (navigation)
- Zustand (state management)

## Building

```bash
npm run build
```

Outputs to `dist/` directory.

## Testing

```bash
npm test
```
