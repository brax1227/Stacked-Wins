import express from 'express';
import { submitCheckIn, getCheckInHistory } from '../controllers/checkInController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All check-in routes require authentication
router.post('/', authenticate, submitCheckIn);
router.get('/history', authenticate, getCheckInHistory);

export default router;
