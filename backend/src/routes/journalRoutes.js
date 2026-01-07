import express from 'express';
import {
  createJournalEntry,
  getJournalEntry,
  getJournalEntries,
  updateJournalEntry,
  deleteJournalEntry,
} from '../controllers/journalController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All journal routes require authentication
router.post('/', authenticate, createJournalEntry);
router.get('/', authenticate, getJournalEntries);
router.get('/:id', authenticate, getJournalEntry);
router.put('/:id', authenticate, updateJournalEntry);
router.delete('/:id', authenticate, deleteJournalEntry);

export default router;
