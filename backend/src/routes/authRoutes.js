import express from 'express';
import { register, login } from '../controllers/authController.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Apply stricter rate limiting to auth routes.
// Disabled outside production so tests/local dev aren't flaky.
const rateLimitMiddleware = process.env.NODE_ENV === 'production'
  ? authRateLimiter
  : (req, res, next) => next();

router.post('/register', rateLimitMiddleware, register);
router.post('/login', rateLimitMiddleware, login);

export default router;
