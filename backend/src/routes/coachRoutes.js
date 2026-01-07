import express from 'express';
import { chat, getHistory } from '../controllers/coachController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All coach routes require authentication
router.post('/chat', authenticate, chat);
router.get('/history', authenticate, getHistory);

export default router;
