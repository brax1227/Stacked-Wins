import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import {
  parseDump,
  normalizeTitle,
  normalizeKind,
  kindFilter,
  askableWhere,
  startOfToday,
  startOfTomorrow,
  shouldSuggestSplit,
  KINDS,
} from '../services/stackService.js';

/**
 * The stack: everything the user is carrying, dealt back one card at a time.
 *
 * Two jobs, and both have to work or neither does (PROBLEM.md):
 *   1. Get it out of the head  -> POST /api/stack/dump
 *   2. Only ever show one thing -> GET /api/stack/next
 *
 * Cards live in one of two lanes -- 'need' (obligations) and 'want' (the
 * things you actually want to do). The lane is picked once per dump session
 * rather than per item, and ranking within a lane is entirely optional:
 * dump order is the default, and nothing blocks on either. A sort you are
 * *required* to do before the app will deal you a card would rebuild the
 * exact freeze this product exists to break.
 */

/**
 * Position of the back of a lane. New and pushed cards land here.
 */
const backOfLane = async (userId, kind) => {
  const { _max } = await prisma.stackItem.aggregate({
    where: { userId, ...kindFilter(kind) },
    _max: { position: true },
  });
  return (_max?.position ?? 0) + 1;
};

/**
 * Position of the front of a lane. Split pieces and "do first" land here.
 */
const frontOfLane = async (userId, kind) => {
  const { _min } = await prisma.stackItem.aggregate({
    where: { userId, ...kindFilter(kind), status: 'open' },
    _min: { position: true },
  });
  return _min?.position ?? 0;
};

/**
 * Counts the UI is allowed to show.
 *
 * `remaining` is deliberately not rendered on the one-card screen -- it's for
 * the full-list view and the empty state. `lanes` lets the empty state say
 * "your needs are clear, there's still something in want" without ever
 * putting a number on the card screen.
 */
const stackCounts = async (userId, kind) => {
  const [remaining, sleeping, done, need, want] = await Promise.all([
    prisma.stackItem.count({ where: askableWhere(userId, kind) }),
    prisma.stackItem.count({
      where: { userId, ...kindFilter(kind), status: 'open', snoozedUntil: { gt: startOfToday() } },
    }),
    prisma.stackItem.count({ where: { userId, ...kindFilter(kind), status: 'done' } }),
    prisma.stackItem.count({ where: askableWhere(userId, 'need') }),
    prisma.stackItem.count({ where: askableWhere(userId, 'want') }),
  ]);
  return { remaining, sleeping, done, lanes: { need, want } };
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
 * or an array of strings and appends every line to the back of a lane. No
 * categories, no dates, no estimates -- structure is a tax charged at the
 * exact moment the user has the least to give. The lane is one choice for
 * the whole dump, and it defaults, so it can be ignored entirely.
 */
export const dump = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const kind = normalizeKind(req.body?.kind);
    const titles = parseDump(req.body?.items ?? req.body?.text);

    if (titles.length === 0) {
      return res.status(400).json({ error: 'Nothing to add' });
    }

    let position = await backOfLane(userId, kind);
    await prisma.stackItem.createMany({
      data: titles.map((title) => ({ userId, title, kind, position: position++ })),
    });

    logger.info('Stack dump', {
      module: 'stackController',
      userId,
      kind,
      added: titles.length,
    });

    const counts = await stackCounts(userId, kind);
    res.status(201).json({ added: titles.length, kind, ...counts });
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
    const kind = normalizeKind(req.body?.kind);

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const item = await prisma.stackItem.create({
      data: { userId, title, kind, position: await backOfLane(userId, kind) },
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
 * GET /api/stack/next?kind=need
 *
 * Job 2: the whole product. Returns exactly one card -- never a list. If the
 * lane is empty, `item` is null and the client shows the calm end state.
 */
export const getNext = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const kind = normalizeKind(req.query.kind);

    const item = await prisma.stackItem.findFirst({
      where: askableWhere(userId, kind),
      orderBy: { position: 'asc' },
    });

    const counts = await stackCounts(userId, kind);

    res.json({
      item: item ?? null,
      kind,
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
 * GET /api/stack?kind=need&status=open
 *
 * The full list. It's the user's data, so it's always available -- but it is
 * never the default view and nothing in the app navigates here on its own.
 */
export const getStack = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const status = req.query.status || 'open';
    const kind = req.query.kind === 'all' ? 'all' : normalizeKind(req.query.kind);

    const items = await prisma.stackItem.findMany({
      where: {
        userId,
        ...kindFilter(kind),
        ...(status === 'all' ? {} : { status }),
      },
      orderBy: status === 'done' ? { completedAt: 'desc' } : { position: 'asc' },
    });

    const counts = await stackCounts(userId, kind);
    res.json({ items, kind, ...counts });
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
 * POST /api/stack/:id/push — "Not now". To the back of its own lane, no
 * explanation asked for and no penalty applied.
 */
export const pushItem = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const item = await findOwnedItem(userId, req.params.id);

    if (!item) return res.status(404).json({ error: 'Card not found' });

    const updated = await prisma.stackItem.update({
      where: { id: item.id },
      data: {
        position: await backOfLane(userId, item.kind),
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

    // Pieces go to the front of the parent's lane: the card you just broke
    // down is the card you were about to do, so its first piece is next.
    const front = await frontOfLane(userId, item.kind);

    await prisma.$transaction([
      prisma.stackItem.update({
        where: { id: item.id },
        data: { status: 'split' },
      }),
      prisma.stackItem.createMany({
        data: pieces.map((title, index) => ({
          userId,
          title,
          kind: item.kind,
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
 * POST /api/stack/:id/kind — move a card between the two lanes.
 *
 * For the moment you realise a card you dumped as an obligation is really
 * something you want to do, or the reverse. It lands at the back of the
 * lane it moves into.
 */
export const setKind = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const item = await findOwnedItem(userId, req.params.id);

    if (!item) return res.status(404).json({ error: 'Card not found' });

    if (!KINDS.includes(req.body?.kind)) {
      return res.status(400).json({ error: `Kind must be one of: ${KINDS.join(', ')}` });
    }

    const kind = req.body.kind;
    const updated = await prisma.stackItem.update({
      where: { id: item.id },
      data: { kind, position: await backOfLane(userId, kind) },
    });

    res.json(updated);
  } catch (error) {
    logger.error('Set stack card kind error', {
      module: 'stackController',
      error: error.message,
      userId: req.user?.id,
    });
    next(error);
  }
};

/**
 * POST /api/stack/:id/rank — order a card against its lane-mates.
 *
 * `up` / `down` swap with the neighbour; `top` jumps to the front. Entirely
 * optional: dump order is the default and the app never asks anyone to rank
 * anything before it will deal them a card.
 */
export const rankItem = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const item = await findOwnedItem(userId, req.params.id);

    if (!item) return res.status(404).json({ error: 'Card not found' });

    const move = req.body?.move;
    if (!['up', 'down', 'top'].includes(move)) {
      return res.status(400).json({ error: 'Move must be one of: up, down, top' });
    }

    if (move === 'top') {
      const updated = await prisma.stackItem.update({
        where: { id: item.id },
        data: { position: (await frontOfLane(userId, item.kind)) - 1 },
      });
      return res.json(updated);
    }

    // Swap with the adjacent card in the same lane. Ordering is by position,
    // so a straight swap is all a one-step move needs.
    const neighbour = await prisma.stackItem.findFirst({
      where: {
        userId,
        kind: item.kind,
        status: 'open',
        position: move === 'up' ? { lt: item.position } : { gt: item.position },
      },
      orderBy: { position: move === 'up' ? 'desc' : 'asc' },
    });

    // Already at the end it was heading for -- not an error, just a no-op.
    if (!neighbour) return res.json(item);

    const [updated] = await prisma.$transaction([
      prisma.stackItem.update({
        where: { id: item.id },
        data: { position: neighbour.position },
      }),
      prisma.stackItem.update({
        where: { id: neighbour.id },
        data: { position: item.position },
      }),
    ]);

    res.json(updated);
  } catch (error) {
    logger.error('Rank stack card error', {
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
