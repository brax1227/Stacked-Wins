import express from 'express';
import { submitFeedback, getMyFeedback } from '../controllers/feedbackController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All feedback routes require authentication
router.post('/', authenticate, submitFeedback);
router.get('/', authenticate, getMyFeedback);

export default router;
