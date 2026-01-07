import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { mockPrisma } from './setup.js';

// Mock auth middleware
jest.unstable_mockModule('../src/middleware/auth.js', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 'user-123' };
    next();
  },
}));

// Import controllers after mocking
const {
  createJournalEntry,
  getJournalEntry,
  getJournalEntries,
  updateJournalEntry,
  deleteJournalEntry,
} = await import('../src/controllers/journalController.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');

const app = express();
app.use(express.json());
// These tests call controllers directly (not via routes), so stub auth context.
app.use((req, res, next) => {
  req.user = { id: 'user-123' };
  next();
});
app.post('/api/journal', createJournalEntry);
app.get('/api/journal', getJournalEntries);
app.get('/api/journal/:id', getJournalEntry);
app.put('/api/journal/:id', updateJournalEntry);
app.delete('/api/journal/:id', deleteJournalEntry);
app.use(errorHandler);

describe('Journal Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/journal', () => {
    const validEntry = {
      title: 'Week 2 Reflection',
      content: 'I\'ve been consistent with my morning routine...',
      mood: 'proud',
      tags: ['progress', 'routine'],
    };

    it('should create journal entry successfully', async () => {
      mockPrisma.journalEntry.create.mockResolvedValue({
        id: 'journal-123',
        userId: 'user-123',
        ...validEntry,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .post('/api/journal')
        .send(validEntry)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(validEntry.title);
      expect(response.body.content).toBe(validEntry.content);
      expect(mockPrisma.journalEntry.create).toHaveBeenCalled();
    });

    it('should reject entry without content', async () => {
      const response = await request(app)
        .post('/api/journal')
        .send({ title: 'Test', content: '' })
        .expect(400);

      expect(response.body.error).toBe('Journal content is required');
    });

    it('should reject entry with invalid mood', async () => {
      const response = await request(app)
        .post('/api/journal')
        .send({ ...validEntry, mood: 'invalid' })
        .expect(400);

      expect(response.body.error).toContain('Mood must be one of');
    });

    it('should create entry with milestone link', async () => {
      mockPrisma.milestone.findFirst.mockResolvedValue({
        id: 'milestone-123',
        plan: { userId: 'user-123' },
      });
      mockPrisma.journalEntry.create.mockResolvedValue({
        id: 'journal-123',
        userId: 'user-123',
        ...validEntry,
        milestoneId: 'milestone-123',
      });

      const response = await request(app)
        .post('/api/journal')
        .send({ ...validEntry, milestoneId: 'milestone-123' })
        .expect(201);

      expect(response.body.milestoneId).toBe('milestone-123');
    });
  });

  describe('GET /api/journal', () => {
    it('should return journal entries with pagination', async () => {
      const mockEntries = [
        {
          id: 'journal-1',
          title: 'Entry 1',
          content: 'Content 1',
          createdAt: new Date(),
        },
        {
          id: 'journal-2',
          title: 'Entry 2',
          content: 'Content 2',
          createdAt: new Date(),
        },
      ];

      mockPrisma.journalEntry.findMany.mockResolvedValue(mockEntries);
      mockPrisma.journalEntry.count.mockResolvedValue(2);

      const response = await request(app)
        .get('/api/journal')
        .expect(200);

      expect(response.body).toHaveProperty('entries');
      expect(response.body).toHaveProperty('total');
      expect(response.body.entries.length).toBe(2);
      expect(response.body.total).toBe(2);
    });

    it('should filter entries by mood', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([]);
      mockPrisma.journalEntry.count.mockResolvedValue(0);

      await request(app)
        .get('/api/journal?mood=proud')
        .expect(200);

      expect(mockPrisma.journalEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ mood: 'proud' }),
        })
      );
    });
  });

  describe('PUT /api/journal/:id', () => {
    it('should update journal entry', async () => {
      const existingEntry = {
        id: 'journal-123',
        userId: 'user-123',
        title: 'Old Title',
        content: 'Old content',
      };

      mockPrisma.journalEntry.findFirst.mockResolvedValue(existingEntry);
      mockPrisma.journalEntry.update.mockResolvedValue({
        ...existingEntry,
        title: 'New Title',
      });

      const response = await request(app)
        .put('/api/journal/journal-123')
        .send({ title: 'New Title' })
        .expect(200);

      expect(response.body.title).toBe('New Title');
    });

    it('should return 404 for non-existent entry', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/journal/invalid-id')
        .send({ title: 'New Title' })
        .expect(404);

      expect(response.body.error).toBe('Journal entry not found');
    });
  });

  describe('DELETE /api/journal/:id', () => {
    it('should delete journal entry', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        id: 'journal-123',
        userId: 'user-123',
      });
      mockPrisma.journalEntry.delete.mockResolvedValue({});

      const response = await request(app)
        .delete('/api/journal/journal-123')
        .expect(200);

      expect(response.body.message).toContain('deleted');
      expect(mockPrisma.journalEntry.delete).toHaveBeenCalled();
    });
  });
});
