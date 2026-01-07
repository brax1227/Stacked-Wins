import express from 'express';
import { getToday, complete, adjust } from '../controllers/taskController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All task routes require authentication
router.get('/today', authenticate, getToday);
router.post('/complete', authenticate, complete);
router.put('/adjust', authenticate, adjust);

export default router;
