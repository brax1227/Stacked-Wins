import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { requestContext } from './middleware/requestContext.js';

// Load environment variables
dotenv.config();

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    // Don't log secrets; only log missing var name.
    logger.error('Missing required environment variable', { module: 'config', name });
    return false;
  }
  return true;
}

// Fail fast on critical config (prevents confusing runtime 500s)
const hasDatabaseUrl = requireEnv('DATABASE_URL');
const hasJwtSecret = requireEnv('JWT_SECRET');
if (!hasDatabaseUrl || !hasJwtSecret) {
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:5173',
  credentials: true
}));
app.use(requestContext);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

// Health check
// Support both /health and /api/health (docs/tools commonly use /api/health)
app.get(['/health', '/api/health'], (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
// IMPORTANT (ESM): static imports are evaluated before this module's top-level code runs.
// So we use dynamic imports to ensure dotenv has loaded before routes/controllers initialize
// (e.g. Prisma reads DATABASE_URL from env).
const authRoutes = (await import('./routes/authRoutes.js')).default;
const assessmentRoutes = (await import('./routes/assessmentRoutes.js')).default;
const planRoutes = (await import('./routes/planRoutes.js')).default;
const taskRoutes = (await import('./routes/taskRoutes.js')).default;
const checkInRoutes = (await import('./routes/checkInRoutes.js')).default;
const progressRoutes = (await import('./routes/progressRoutes.js')).default;
const journalRoutes = (await import('./routes/journalRoutes.js')).default;
const feedbackRoutes = (await import('./routes/feedbackRoutes.js')).default;

app.use('/api/auth', authRoutes);
app.use('/api/assessment', assessmentRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/checkin', checkInRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/feedback', feedbackRoutes);
// Coach chat disabled - high AI costs. Can be enabled if users request it.
// import coachRoutes from './routes/coachRoutes.js';
// app.use('/api/coach', coachRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, { module: 'server' });
});

export default app;
