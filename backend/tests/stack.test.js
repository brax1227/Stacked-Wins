import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { mockPrisma } from './setup.js';

// Why:
// - The one-card contract is the product (PROBLEM.md). These lock in that
//   /next hands back exactly one card and never a list, and that each of the
//   four moves puts the card where it belongs.

jest.unstable_mockModule('../src/middleware/auth.js', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 'user-123' };
    next();
  },
}));

const {
  dump,
  addItem,
  getNext,
  completeItem,
  pushItem,
  snoozeItem,
  splitItem,
  setKind,
  rankItem,
} = await import('../src/controllers/stackController.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');

const app = express();
app.use(express.json());
// These tests call controllers directly (not via routes), so stub auth context.
app.use((req, res, next) => {
  req.user = { id: 'user-123' };
  next();
});
app.post('/api/stack/dump', dump);
app.post('/api/stack', addItem);
app.get('/api/stack/next', getNext);
app.post('/api/stack/:id/done', completeItem);
app.post('/api/stack/:id/push', pushItem);
app.post('/api/stack/:id/later', snoozeItem);
app.post('/api/stack/:id/split', splitItem);
app.post('/api/stack/:id/kind', setKind);
app.post('/api/stack/:id/rank', rankItem);
app.use(errorHandler);

const mockCounts = ({ remaining = 0, sleeping = 0, done = 0, need = 0, want = 0 } = {}) => {
  mockPrisma.stackItem.count
    .mockResolvedValueOnce(remaining)
    .mockResolvedValueOnce(sleeping)
    .mockResolvedValueOnce(done)
    .mockResolvedValueOnce(need)
    .mockResolvedValueOnce(want);
};

describe('Stack Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/stack/dump', () => {
    it('appends every line of a brain dump to the back of the stack', async () => {
      mockPrisma.stackItem.aggregate.mockResolvedValue({ _max: { position: 4 } });
      mockPrisma.stackItem.createMany.mockResolvedValue({ count: 3 });
      mockCounts({ remaining: 3 });

      const response = await request(app)
        .post('/api/stack/dump')
        .send({ text: 'call the bank\nlaundry\nemail advisor' });

      expect(response.status).toBe(201);
      expect(response.body.added).toBe(3);
      expect(mockPrisma.stackItem.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'user-123', title: 'call the bank', kind: 'need', position: 5 },
          { userId: 'user-123', title: 'laundry', kind: 'need', position: 6 },
          { userId: 'user-123', title: 'email advisor', kind: 'need', position: 7 },
        ],
      });
    });

    it('starts at position 1 for a first-time dump', async () => {
      mockPrisma.stackItem.aggregate.mockResolvedValue({ _max: { position: null } });
      mockPrisma.stackItem.createMany.mockResolvedValue({ count: 1 });
      mockCounts({ remaining: 1 });

      await request(app).post('/api/stack/dump').send({ text: 'laundry' });

      expect(mockPrisma.stackItem.createMany).toHaveBeenCalledWith({
        data: [{ userId: 'user-123', title: 'laundry', kind: 'need', position: 1 }],
      });
    });

    it('rejects an empty dump without writing anything', async () => {
      const response = await request(app).post('/api/stack/dump').send({ text: '  \n\n ' });

      expect(response.status).toBe(400);
      expect(mockPrisma.stackItem.createMany).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/stack', () => {
    it('adds a single card to the back', async () => {
      mockPrisma.stackItem.aggregate.mockResolvedValue({ _max: { position: 2 } });
      mockPrisma.stackItem.create.mockResolvedValue({ id: 'item-9', title: 'rent' });

      const response = await request(app).post('/api/stack').send({ title: '  rent  ' });

      expect(response.status).toBe(201);
      expect(mockPrisma.stackItem.create).toHaveBeenCalledWith({
        data: { userId: 'user-123', title: 'rent', kind: 'need', position: 3 },
      });
    });

    it('rejects a blank title', async () => {
      const response = await request(app).post('/api/stack').send({ title: '   ' });

      expect(response.status).toBe(400);
      expect(mockPrisma.stackItem.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/stack/next', () => {
    it('returns exactly one card, never a list', async () => {
      mockPrisma.stackItem.findFirst.mockResolvedValue({
        id: 'item-1',
        title: 'call the bank',
        pushCount: 0,
      });
      mockCounts({ remaining: 12 });

      const response = await request(app).get('/api/stack/next');

      expect(response.status).toBe(200);
      expect(response.body.item.title).toBe('call the bank');
      expect(Array.isArray(response.body.item)).toBe(false);
      expect(response.body.items).toBeUndefined();
      // The front card is the lowest position among askable cards.
      expect(mockPrisma.stackItem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { position: 'asc' } })
      );
    });

    it('returns a null card when the stack is clear', async () => {
      mockPrisma.stackItem.findFirst.mockResolvedValue(null);
      mockCounts({ remaining: 0, sleeping: 2, done: 7 });

      const response = await request(app).get('/api/stack/next');

      expect(response.status).toBe(200);
      expect(response.body.item).toBeNull();
      // The end state needs to explain where the sleeping cards went.
      expect(response.body.sleeping).toBe(2);
      expect(response.body.done).toBe(7);
    });

    it('suggests a split for a card that keeps getting pushed', async () => {
      mockPrisma.stackItem.findFirst.mockResolvedValue({
        id: 'item-1',
        title: 'sort out the car situation',
        pushCount: 4,
      });
      mockCounts({ remaining: 5 });

      const response = await request(app).get('/api/stack/next');

      expect(response.body.suggestSplit).toBe(true);
    });
  });

  describe('the four moves', () => {
    const ownedCard = { id: 'item-1', title: 'laundry', kind: 'need', position: 3, pushCount: 0 };

    it('Done clears the card and stamps when', async () => {
      mockPrisma.stackItem.findFirst.mockResolvedValue(ownedCard);
      mockPrisma.stackItem.update.mockResolvedValue({ ...ownedCard, status: 'done' });

      const response = await request(app).post('/api/stack/item-1/done');

      expect(response.status).toBe(200);
      const { data } = mockPrisma.stackItem.update.mock.calls[0][0];
      expect(data.status).toBe('done');
      expect(data.completedAt).toBeInstanceOf(Date);
    });

    it('Not now sends the card to the back and counts the push', async () => {
      mockPrisma.stackItem.findFirst.mockResolvedValue(ownedCard);
      mockPrisma.stackItem.aggregate.mockResolvedValue({ _max: { position: 11 } });
      mockPrisma.stackItem.update.mockResolvedValue({ ...ownedCard, position: 12 });

      const response = await request(app).post('/api/stack/item-1/push');

      expect(response.status).toBe(200);
      expect(mockPrisma.stackItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { position: 12, pushCount: { increment: 1 } },
      });
    });

    it('Not today puts the card to sleep until tomorrow, keeping its place', async () => {
      mockPrisma.stackItem.findFirst.mockResolvedValue(ownedCard);
      mockPrisma.stackItem.update.mockResolvedValue(ownedCard);

      const response = await request(app).post('/api/stack/item-1/later');

      expect(response.status).toBe(200);
      const { data } = mockPrisma.stackItem.update.mock.calls[0][0];
      expect(data.snoozedUntil.getTime()).toBeGreaterThan(Date.now());
      // Position is untouched -- a snoozed card does not lose its turn.
      expect(data.position).toBeUndefined();
    });

    it('Too big splits the card and deals the pieces next', async () => {
      mockPrisma.stackItem.findFirst.mockResolvedValue(ownedCard);
      // Front of the open queue.
      mockPrisma.stackItem.aggregate.mockResolvedValue({ _min: { position: 3 } });
      mockPrisma.$transaction.mockResolvedValue([{}, { count: 2 }]);

      const response = await request(app)
        .post('/api/stack/item-1/split')
        .send({ pieces: 'sort the darks\nrun one load' });

      expect(response.status).toBe(201);
      expect(response.body.pieces).toBe(2);

      const [updateCall, createCall] = mockPrisma.$transaction.mock.calls[0][0];
      expect(updateCall).toBeDefined();
      expect(createCall).toBeDefined();
      // Pieces land ahead of everything else, in the order they were typed.
      expect(mockPrisma.stackItem.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'user-123', title: 'sort the darks', kind: 'need', parentId: 'item-1', position: 1 },
          { userId: 'user-123', title: 'run one load', kind: 'need', parentId: 'item-1', position: 2 },
        ],
      });
    });

    it('rejects a split with no pieces', async () => {
      mockPrisma.stackItem.findFirst.mockResolvedValue(ownedCard);

      const response = await request(app).post('/api/stack/item-1/split').send({ pieces: '' });

      expect(response.status).toBe(400);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('lanes', () => {
    it('dumps into the want lane when asked', async () => {
      mockPrisma.stackItem.aggregate.mockResolvedValue({ _max: { position: 2 } });
      mockPrisma.stackItem.createMany.mockResolvedValue({ count: 1 });
      mockCounts({ remaining: 1 });

      const response = await request(app)
        .post('/api/stack/dump')
        .send({ text: 'finally watch that series', kind: 'want' });

      expect(response.status).toBe(201);
      expect(response.body.kind).toBe('want');
      expect(mockPrisma.stackItem.createMany).toHaveBeenCalledWith({
        data: [{ userId: 'user-123', title: 'finally watch that series', kind: 'want', position: 3 }],
      });
    });

    it('never rejects a dump over a bad lane -- capture always goes through', async () => {
      mockPrisma.stackItem.aggregate.mockResolvedValue({ _max: { position: null } });
      mockPrisma.stackItem.createMany.mockResolvedValue({ count: 1 });
      mockCounts({ remaining: 1 });

      const response = await request(app)
        .post('/api/stack/dump')
        .send({ text: 'laundry', kind: 'nonsense' });

      expect(response.status).toBe(201);
      expect(response.body.kind).toBe('need');
    });

    it('deals from one lane at a time', async () => {
      mockPrisma.stackItem.findFirst.mockResolvedValue({
        id: 'item-1',
        title: 'finally watch that series',
        kind: 'want',
        pushCount: 0,
      });
      mockCounts({ remaining: 2 });

      const response = await request(app).get('/api/stack/next?kind=want');

      expect(response.body.kind).toBe('want');
      expect(mockPrisma.stackItem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ kind: 'want' }) })
      );
    });

    it('reports both lanes so an empty lane can point at the other one', async () => {
      mockPrisma.stackItem.findFirst.mockResolvedValue(null);
      mockCounts({ remaining: 0, need: 0, want: 3 });

      const response = await request(app).get('/api/stack/next?kind=need');

      expect(response.body.item).toBeNull();
      expect(response.body.lanes).toEqual({ need: 0, want: 3 });
    });

    it('moves a card to the other lane, landing it at that lane\'s back', async () => {
      mockPrisma.stackItem.findFirst.mockResolvedValue({
        id: 'item-1',
        title: 'read that book',
        kind: 'need',
        position: 2,
      });
      mockPrisma.stackItem.aggregate.mockResolvedValue({ _max: { position: 8 } });
      mockPrisma.stackItem.update.mockResolvedValue({ id: 'item-1', kind: 'want' });

      const response = await request(app).post('/api/stack/item-1/kind').send({ kind: 'want' });

      expect(response.status).toBe(200);
      expect(mockPrisma.stackItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { kind: 'want', position: 9 },
      });
    });

    it('rejects an unknown lane on an explicit move', async () => {
      mockPrisma.stackItem.findFirst.mockResolvedValue({ id: 'item-1', kind: 'need' });

      const response = await request(app).post('/api/stack/item-1/kind').send({ kind: 'someday' });

      expect(response.status).toBe(400);
      expect(mockPrisma.stackItem.update).not.toHaveBeenCalled();
    });

    it('keeps a pushed card in its own lane', async () => {
      mockPrisma.stackItem.findFirst.mockResolvedValue({
        id: 'item-1',
        title: 'finally watch that series',
        kind: 'want',
        position: 3,
      });
      mockPrisma.stackItem.aggregate.mockResolvedValue({ _max: { position: 6 } });
      mockPrisma.stackItem.update.mockResolvedValue({ id: 'item-1' });

      await request(app).post('/api/stack/item-1/push');

      // The back it goes to is the back of 'want', not of everything.
      expect(mockPrisma.stackItem.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-123', kind: 'want' } })
      );
    });

    it('gives split pieces the parent\'s lane', async () => {
      mockPrisma.stackItem.findFirst.mockResolvedValue({
        id: 'item-1',
        title: 'plan the trip',
        kind: 'want',
        position: 3,
      });
      mockPrisma.stackItem.aggregate.mockResolvedValue({ _min: { position: 3 } });
      mockPrisma.$transaction.mockResolvedValue([{}, { count: 1 }]);

      await request(app).post('/api/stack/item-1/split').send({ pieces: 'pick the dates' });

      expect(mockPrisma.stackItem.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'user-123', title: 'pick the dates', kind: 'want', parentId: 'item-1', position: 2 },
        ],
      });
    });
  });

  describe('ranking', () => {
    const card = { id: 'item-2', title: 'rent', kind: 'need', position: 5 };

    it('swaps with the card above it', async () => {
      mockPrisma.stackItem.findFirst
        .mockResolvedValueOnce(card)
        .mockResolvedValueOnce({ id: 'item-1', kind: 'need', position: 2 });
      mockPrisma.$transaction.mockResolvedValue([{ ...card, position: 2 }, {}]);

      const response = await request(app).post('/api/stack/item-2/rank').send({ move: 'up' });

      expect(response.status).toBe(200);
      const [moved, neighbour] = mockPrisma.stackItem.update.mock.calls;
      expect(moved[0]).toEqual({ where: { id: 'item-2' }, data: { position: 2 } });
      expect(neighbour[0]).toEqual({ where: { id: 'item-1' }, data: { position: 5 } });
    });

    it('only ever swaps within the same lane', async () => {
      mockPrisma.stackItem.findFirst
        .mockResolvedValueOnce({ ...card, kind: 'want' })
        .mockResolvedValueOnce({ id: 'item-1', kind: 'want', position: 2 });
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      await request(app).post('/api/stack/item-2/rank').send({ move: 'up' });

      expect(mockPrisma.stackItem.findFirst).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ kind: 'want' }) })
      );
    });

    it('sends a card to the front of its lane', async () => {
      mockPrisma.stackItem.findFirst.mockResolvedValue(card);
      mockPrisma.stackItem.aggregate.mockResolvedValue({ _min: { position: 2 } });
      mockPrisma.stackItem.update.mockResolvedValue({ ...card, position: 1 });

      const response = await request(app).post('/api/stack/item-2/rank').send({ move: 'top' });

      expect(response.status).toBe(200);
      expect(mockPrisma.stackItem.update).toHaveBeenCalledWith({
        where: { id: 'item-2' },
        data: { position: 1 },
      });
    });

    it('is a quiet no-op at the end of the lane, not an error', async () => {
      mockPrisma.stackItem.findFirst
        .mockResolvedValueOnce(card)
        .mockResolvedValueOnce(null);

      const response = await request(app).post('/api/stack/item-2/rank').send({ move: 'up' });

      expect(response.status).toBe(200);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a move it does not understand', async () => {
      mockPrisma.stackItem.findFirst.mockResolvedValue(card);

      const response = await request(app).post('/api/stack/item-2/rank').send({ move: 'sideways' });

      expect(response.status).toBe(400);
    });
  });

  describe('ownership', () => {
    it.each([
      ['done', '/api/stack/someone-elses/done'],
      ['push', '/api/stack/someone-elses/push'],
      ['later', '/api/stack/someone-elses/later'],
      ['split', '/api/stack/someone-elses/split'],
      ['re-lane', '/api/stack/someone-elses/kind'],
      ['rank', '/api/stack/someone-elses/rank'],
    ])('refuses to %s a card belonging to another user', async (_move, path) => {
      mockPrisma.stackItem.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(path)
        .send({ pieces: 'a\nb', kind: 'want', move: 'up' });

      expect(response.status).toBe(404);
      expect(mockPrisma.stackItem.update).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
