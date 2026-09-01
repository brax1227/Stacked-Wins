import express from 'express';
import {
  dump,
  addItem,
  getNext,
  getStack,
  completeItem,
  pushItem,
  snoozeItem,
  splitItem,
  dropItem,
  updateItem,
} from '../controllers/stackController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All stack routes require authentication
router.post('/dump', authenticate, dump);
router.get('/next', authenticate, getNext);
router.get('/', authenticate, getStack);
router.post('/', authenticate, addItem);

// The four moves on a card, plus drop and edit.
router.post('/:id/done', authenticate, completeItem);
router.post('/:id/push', authenticate, pushItem);
router.post('/:id/later', authenticate, snoozeItem);
router.post('/:id/split', authenticate, splitItem);
router.post('/:id/drop', authenticate, dropItem);
router.put('/:id', authenticate, updateItem);

export default router;
