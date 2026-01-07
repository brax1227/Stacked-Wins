import express from 'express';
import {
  submitAssessment,
  getAssessment,
  checkReassessment,
} from '../controllers/assessmentController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All assessment routes require authentication
router.post('/', authenticate, submitAssessment);
router.get('/', authenticate, getAssessment);
router.get('/reassessment', authenticate, checkReassessment);

export default router;
