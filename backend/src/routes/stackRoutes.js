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
  setKind,
  rankItem,
  suggestSplitPieces,
  getCapabilities,
  dropItem,
  updateItem,
} from '../controllers/stackController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All stack routes require authentication
router.post('/dump', authenticate, dump);
router.get('/next', authenticate, getNext);
router.get('/capabilities', authenticate, getCapabilities);
router.get('/', authenticate, getStack);
router.post('/', authenticate, addItem);

// The four moves on a card, plus drop and edit.
router.post('/:id/done', authenticate, completeItem);
router.post('/:id/push', authenticate, pushItem);
router.post('/:id/later', authenticate, snoozeItem);
router.post('/:id/split', authenticate, splitItem);
// Suggests pieces only -- the user confirms them through /:id/split above.
router.post('/:id/split/suggest', authenticate, suggestSplitPieces);

// Lanes and ranking. Both optional -- neither ever gates getting a card.
router.post('/:id/kind', authenticate, setKind);
router.post('/:id/rank', authenticate, rankItem);
router.post('/:id/drop', authenticate, dropItem);
router.put('/:id', authenticate, updateItem);

export default router;
