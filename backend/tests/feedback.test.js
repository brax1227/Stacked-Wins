import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { mockPrisma } from './setup.js';

// Mock auth middleware before importing routes
jest.unstable_mockModule('../src/middleware/auth.js', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 'user-123' };
    next();
  },
}));

// Import routes after mocking
const feedbackRoutes = (await import('../src/routes/feedbackRoutes.js')).default;
const { submitFeedback, getMyFeedback } = await import('../src/controllers/feedbackController.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');

const app = express();
app.use(express.json());
// These tests call controllers directly (not via routes), so stub auth context.
app.use((req, res, next) => {
  req.user = { id: 'user-123' };
  next();
});
app.post('/api/feedback', submitFeedback);
app.get('/api/feedback', getMyFeedback);
app.use(errorHandler);

describe('Feedback Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/feedback', () => {
    const validFeedback = {
      type: 'feature',
      title: 'Dark mode support',
      message: 'I\'d love to see a dark mode option for the app.',
      rating: 5,
    };

    it('should submit feedback successfully', async () => {
      mockPrisma.feedback.create.mockResolvedValue({
        id: 'feedback-123',
        userId: 'user-123',
        ...validFeedback,
        status: 'new',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .post('/api/feedback')
        .send(validFeedback)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.type).toBe(validFeedback.type);
      expect(response.body.message).toContain('Thank you');
      expect(mockPrisma.feedback.create).toHaveBeenCalled();
    });

    it('should reject feedback with invalid type', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .send({ ...validFeedback, type: 'invalid' })
        .expect(400);

      expect(response.body.error).toContain('Type must be one of');
    });

    it('should reject feedback without message', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .send({ type: 'feature', message: '' })
        .expect(400);

      expect(response.body.error).toBe('Feedback message is required');
    });

    it('should reject feedback with invalid rating', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .send({ ...validFeedback, rating: 10 })
        .expect(400);

      expect(response.body.error).toContain('Rating must be between 1 and 5');
    });

    it('should accept feedback without rating', async () => {
      mockPrisma.feedback.create.mockResolvedValue({
        id: 'feedback-123',
        userId: 'user-123',
        type: 'bug',
        message: 'Found a bug',
        rating: null,
        status: 'new',
      });

      const response = await request(app)
        .post('/api/feedback')
        .send({
          type: 'bug',
          message: 'Found a bug',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
    });
  });

  describe('GET /api/feedback', () => {
    it('should return user feedback history', async () => {
      const mockFeedback = [
        {
          id: 'feedback-1',
          type: 'feature',
          message: 'Feature request 1',
          createdAt: new Date(),
        },
        {
          id: 'feedback-2',
          type: 'bug',
          message: 'Bug report 1',
          createdAt: new Date(),
        },
      ];

      mockPrisma.feedback.findMany.mockResolvedValue(mockFeedback);

      const response = await request(app)
        .get('/api/feedback')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123' },
        })
      );
    });
  });
});
