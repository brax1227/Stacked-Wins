import express from 'express';
import { createPlan, getPlan } from '../controllers/planController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All plan routes require authentication
router.post('/generate', authenticate, createPlan);
router.get('/current', authenticate, getPlan);

export default router;
