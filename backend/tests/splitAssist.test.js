import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { mockPrisma } from './setup.js';

// Why:
// - The assist must only ever SUGGEST. If it can write to the stack, the app
//   silently restructures the user's list and the surface stops being
//   trustworthy (PROBLEM.md).
// - A missing API key must degrade to "no button", never to a broken server.

const mockSuggestPieces = jest.fn();
jest.unstable_mockModule('../src/services/splitAssistService.js', () => ({
  suggestPieces: mockSuggestPieces,
}));

const { suggestSplitPieces, getCapabilities } = await import(
  '../src/controllers/stackController.js'
);
const { errorHandler } = await import('../src/middleware/errorHandler.js');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.user = { id: 'user-123' };
  next();
});
app.post('/api/stack/:id/split/suggest', suggestSplitPieces);
app.get('/api/stack/capabilities', getCapabilities);
app.use(errorHandler);

const card = { id: 'item-1', title: 'sort out the car situation', kind: 'need' };

describe('Split assist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('returns suggestions without writing anything to the stack', async () => {
    mockPrisma.stackItem.findFirst.mockResolvedValue(card);
    mockSuggestPieces.mockResolvedValue([
      'find the mechanic number',
      'write down what the noise sounds like',
    ]);

    const response = await request(app).post('/api/stack/item-1/split/suggest');

    expect(response.status).toBe(200);
    expect(response.body.pieces).toHaveLength(2);
    // The whole contract: suggesting must never mutate the stack.
    expect(mockPrisma.stackItem.create).not.toHaveBeenCalled();
    expect(mockPrisma.stackItem.createMany).not.toHaveBeenCalled();
    expect(mockPrisma.stackItem.update).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('sends the card title to the model, not the id', async () => {
    mockPrisma.stackItem.findFirst.mockResolvedValue(card);
    mockSuggestPieces.mockResolvedValue(['a', 'b']);

    await request(app).post('/api/stack/item-1/split/suggest');

    expect(mockSuggestPieces).toHaveBeenCalledWith('sort out the car situation');
  });

  it('refuses to suggest for a card belonging to another user', async () => {
    mockPrisma.stackItem.findFirst.mockResolvedValue(null);

    const response = await request(app).post('/api/stack/someone-elses/split/suggest');

    expect(response.status).toBe(404);
    expect(mockSuggestPieces).not.toHaveBeenCalled();
  });

  it('says so plainly when the model comes back with nothing usable', async () => {
    mockPrisma.stackItem.findFirst.mockResolvedValue(card);
    mockSuggestPieces.mockResolvedValue([]);

    const response = await request(app).post('/api/stack/item-1/split/suggest');

    expect(response.status).toBe(502);
  });

  describe('without an API key', () => {
    beforeEach(() => {
      delete process.env.ANTHROPIC_API_KEY;
    });

    it('reports the capability as off so the UI can hide the button', async () => {
      const response = await request(app).get('/api/stack/capabilities');

      expect(response.status).toBe(200);
      expect(response.body.splitAssist).toBe(false);
    });

    it('refuses the suggest call without ever reaching the model', async () => {
      const response = await request(app).post('/api/stack/item-1/split/suggest');

      expect(response.status).toBe(503);
      expect(mockSuggestPieces).not.toHaveBeenCalled();
      // It should not even load the card -- nothing to do without a key.
      expect(mockPrisma.stackItem.findFirst).not.toHaveBeenCalled();
    });
  });

  it('reports the capability as on when a key is present', async () => {
    const response = await request(app).get('/api/stack/capabilities');

    expect(response.body.splitAssist).toBe(true);
  });
});
