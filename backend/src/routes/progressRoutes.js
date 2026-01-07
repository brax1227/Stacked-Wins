import express from 'express';
import { getDashboard, getMetrics } from '../controllers/progressController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All progress routes require authentication
router.get('/dashboard', authenticate, getDashboard);
router.get('/metrics', authenticate, getMetrics);

export default router;
