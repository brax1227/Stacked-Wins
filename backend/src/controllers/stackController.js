import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import {
  parseDump,
  normalizeTitle,
  askableWhere,
  startOfToday,
  startOfTomorrow,
  shouldSuggestSplit,
} from '../services/stackService.js';

/**
 * The stack: everything the user is carrying, dealt back one card at a time.
 *
 * Two jobs, and both have to work or neither does (PROBLEM.md):
 *   1. Get it out of the head  -> POST /api/stack/dump
 *   2. Only ever show one thing -> GET /api/stack/next
 */

/**
 * Position of the back of the queue. New cards land here.
 */
const backOfStack = async (userId) => {
  const { _max } = await prisma.stackItem.aggregate({
    where: { userId },
    _max: { position: true },
  });
  return (_max?.position ?? 0) + 1;
};

/**
 * Position of the front of the queue. Split pieces land here, because the
 * card you just broke down is the card you were about to do.
 */
const frontOfStack = async (userId) => {
  const { _min } = await prisma.stackItem.aggregate({
    where: { userId, status: 'open' },
    _min: { position: true },
  });
  return _min?.position ?? 0;
};

/**
 * Counts the UI is allowed to show. Note that `remaining` is deliberately not
 * rendered on the one-card screen -- it's here for the full-list view and the
 * empty state, which needs to explain where the sleeping cards went.
 */
const stackCounts = async (userId) => {
  const [remaining, sleeping, done] = await Promise.all([
    prisma.stackItem.count({ where: askableWhere(userId) }),
    prisma.stackItem.count({
      where: { userId, status: 'open', snoozedUntil: { gt: startOfToday() } },
    }),
    prisma.stackItem.count({ where: { userId, status: 'done' } }),
  ]);
  return { remaining, sleeping, done };
};

/**
 * Load a card and prove it belongs to this user before touching it.
 */
const findOwnedItem = async (userId, id) =>
  prisma.stackItem.findFirst({ where: { id, userId } });

/**
 * POST /api/stack/dump
 *
 * Job 1: get it out of the head. Takes a blob of text (one thing per line)
 * or an array of strings and appends every line to the back of the stack.
 * No categories, no dates, no estimates -- structure is a tax charged at the
 * exact moment the user has the least to give.
 */
export const dump = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const titles = parseDump(req.body?.items ?? req.body?.text);

    if (titles.length === 0) {
      return res.status(400).json({ error: 'Nothing to add' });
    }

    let position = await backOfStack(userId);
    await prisma.stackItem.createMany({
      data: titles.map((title) => ({ userId, title, position: position++ })),
    });

    logger.info('Stack dump', {
      module: 'stackController',
      userId,
      added: titles.length,
    });

    const counts = await stackCounts(userId);
    res.status(201).json({ added: titles.length, ...counts });
  } catch (error) {
    logger.error('Stack dump error', {
      module: 'stackController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

/**
 * POST /api/stack
 *
 * Add one thing. Same as a dump of one line, but returns the created card so
 * the "add one more" input can confirm it landed.
 */
export const addItem = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const title = normalizeTitle(req.body?.title);

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const item = await prisma.stackItem.create({
      data: { userId, title, position: await backOfStack(userId) },
    });

    res.status(201).json(item);
  } catch (error) {
    logger.error('Add stack item error', {
      module: 'stackController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

/**
 * GET /api/stack/next
 *
 * Job 2: the whole product. Returns exactly one card -- never a list. If the
 * stack is empty, `item` is null and the client shows the calm end state.
 */
export const getNext = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const item = await prisma.stackItem.findFirst({
      where: askableWhere(userId),
      orderBy: { position: 'asc' },
    });

    const counts = await stackCounts(userId);

    res.json({
      item: item ?? null,
      // The card has been pushed enough times that it's probably several
      // tasks wearing a trench coat. Offer the split before they ask.
      suggestSplit: shouldSuggestSplit(item),
      ...counts,
    });
  } catch (error) {
    logger.error('Get next card error', {
      module: 'stackController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

/**
 * GET /api/stack
 *
 * The full list. It's the user's data, so it's always available -- but it is
 * never the default view and nothing in the app navigates here on its own.
 */
export const getStack = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const status = req.query.status || 'open';

    const items = await prisma.stackItem.findMany({
      where: { userId, ...(status === 'all' ? {} : { status }) },
      orderBy: status === 'done' ? { completedAt: 'desc' } : { position: 'asc' },
    });

    const counts = await stackCounts(userId);
    res.json({ items, ...counts });
  } catch (error) {
    logger.error('Get stack error', {
      module: 'stackController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

/**
 * POST /api/stack/:id/done — cleared it. That's a win.
 */
export const completeItem = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const item = await findOwnedItem(userId, req.params.id);

    if (!item) return res.status(404).json({ error: 'Card not found' });

    const updated = await prisma.stackItem.update({
      where: { id: item.id },
      data: { status: 'done', completedAt: new Date() },
    });

    logger.info('Stack card cleared', {
      module: 'stackController',
      userId,
      itemId: item.id,
    });

    res.json(updated);
  } catch (error) {
    logger.error('Complete stack card error', {
      module: 'stackController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

/**
 * POST /api/stack/:id/push — "Not now". Straight to the back, no explanation
 * asked for and no penalty applied.
 */
export const pushItem = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const item = await findOwnedItem(userId, req.params.id);

    if (!item) return res.status(404).json({ error: 'Card not found' });

    const updated = await prisma.stackItem.update({
      where: { id: item.id },
      data: {
        position: await backOfStack(userId),
        pushCount: { increment: 1 },
      },
    });

    res.json(updated);
  } catch (error) {
    logger.error('Push stack card error', {
      module: 'stackController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

/**
 * POST /api/stack/:id/later — "Not today". The card sleeps until tomorrow and
 * keeps its place in line.
 */
export const snoozeItem = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const item = await findOwnedItem(userId, req.params.id);

    if (!item) return res.status(404).json({ error: 'Card not found' });

    const updated = await prisma.stackItem.update({
      where: { id: item.id },
      data: { snoozedUntil: startOfTomorrow() },
    });

    res.json(updated);
  } catch (error) {
    logger.error('Snooze stack card error', {
      module: 'stackController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

/**
 * POST /api/stack/:id/split — "Too big". The reason the pile froze them in
 * the first place. Break the card into pieces and deal the first piece next.
 */
export const splitItem = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const item = await findOwnedItem(userId, req.params.id);

    if (!item) return res.status(404).json({ error: 'Card not found' });

    const pieces = parseDump(req.body?.pieces ?? req.body?.text);
    if (pieces.length === 0) {
      return res.status(400).json({ error: 'Break it into at least one piece' });
    }

    // Pieces go to the front: the card you just broke down is the card you
    // were about to do, so its first piece is what you do next.
    const front = await frontOfStack(userId);

    await prisma.$transaction([
      prisma.stackItem.update({
        where: { id: item.id },
        data: { status: 'split' },
      }),
      prisma.stackItem.createMany({
        data: pieces.map((title, index) => ({
          userId,
          title,
          parentId: item.id,
          position: front - (pieces.length - index),
        })),
      }),
    ]);

    logger.info('Stack card split', {
      module: 'stackController',
      userId,
      itemId: item.id,
      pieces: pieces.length,
    });

    res.status(201).json({ pieces: pieces.length });
  } catch (error) {
    logger.error('Split stack card error', {
      module: 'stackController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

/**
 * POST /api/stack/:id/drop — it doesn't matter anymore. Kept as a record
 * rather than hard-deleted, because "I let this go" is worth being able to
 * see later.
 */
export const dropItem = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const item = await findOwnedItem(userId, req.params.id);

    if (!item) return res.status(404).json({ error: 'Card not found' });

    const updated = await prisma.stackItem.update({
      where: { id: item.id },
      data: { status: 'dropped' },
    });

    res.json(updated);
  } catch (error) {
    logger.error('Drop stack card error', {
      module: 'stackController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

/**
 * PUT /api/stack/:id — fix a typo or sharpen the wording.
 */
export const updateItem = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const item = await findOwnedItem(userId, req.params.id);

    if (!item) return res.status(404).json({ error: 'Card not found' });

    const title = normalizeTitle(req.body?.title);
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const updated = await prisma.stackItem.update({
      where: { id: item.id },
      data: { title },
    });

    res.json(updated);
  } catch (error) {
    logger.error('Update stack card error', {
      module: 'stackController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};
