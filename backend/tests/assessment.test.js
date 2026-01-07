import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { mockPrisma } from './setup.js';

// Mock auth middleware before importing
jest.unstable_mockModule('../src/middleware/auth.js', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 'user-123' };
    next();
  },
}));

// Import controllers after mocking
const { submitAssessment, getAssessment } = await import('../src/controllers/assessmentController.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');

const app = express();
app.use(express.json());
// These tests call controllers directly (not via routes), so stub auth context.
app.use((req, res, next) => {
  req.user = { id: 'user-123' };
  next();
});
app.post('/api/assessment', submitAssessment);
app.get('/api/assessment', getAssessment);
app.use(errorHandler);

describe('Assessment Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/assessment', () => {
    const validAssessment = {
      stressLevel: 5,
      anxietyLevel: 6,
      moodStability: 5,
      sleepQuality: 6,
      sleepHours: 7,
      weekdayMinutes: 30,
      weekendMinutes: 60,
      goals: ['Build discipline', 'Reduce anxiety'],
      values: ['Honor', 'Growth'],
      currentStruggles: ['Lack of focus'],
      preferredTone: 'steady',
    };

    it('should create assessment successfully', async () => {
      mockPrisma.assessment.findUnique.mockResolvedValue(null);
      mockPrisma.assessment.create.mockResolvedValue({
        id: 'assessment-123',
        userId: 'user-123',
        ...validAssessment,
        completedAt: new Date(),
      });

      const response = await request(app)
        .post('/api/assessment')
        .send(validAssessment)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('baseline');
      expect(response.body.isBaseline).toBe(true);
      expect(mockPrisma.assessment.create).toHaveBeenCalled();
    });

    it('should update existing assessment', async () => {
      const existingAssessment = {
        id: 'assessment-123',
        userId: 'user-123',
        ...validAssessment,
      };

      mockPrisma.assessment.findUnique.mockResolvedValue(existingAssessment);
      mockPrisma.assessment.update.mockResolvedValue({
        ...existingAssessment,
        stressLevel: 4, // Updated value
      });

      const response = await request(app)
        .post('/api/assessment')
        .send({ ...validAssessment, stressLevel: 4 })
        .expect(200);

      expect(response.body.stressLevel).toBe(4);
      expect(mockPrisma.assessment.update).toHaveBeenCalled();
    });

    it('should reject assessment with invalid stress level', async () => {
      const response = await request(app)
        .post('/api/assessment')
        .send({ ...validAssessment, stressLevel: 15 })
        .expect(400);

      expect(response.body.error).toContain('between 1 and 10');
    });

    it('should reject assessment with missing required fields', async () => {
      const response = await request(app)
        .post('/api/assessment')
        .send({
          stressLevel: 5,
          // Missing other required fields
        })
        .expect(400);

      expect(response.body.error).toContain('Missing required fields');
    });

    it('should reject assessment with invalid preferred tone', async () => {
      const response = await request(app)
        .post('/api/assessment')
        .send({ ...validAssessment, preferredTone: 'invalid' })
        .expect(400);

      expect(response.body.error).toContain('Preferred tone must be one of');
    });
  });

  describe('GET /api/assessment', () => {
    it('should return user assessment with baseline', async () => {
      const assessment = {
        id: 'assessment-123',
        userId: 'user-123',
        stressLevel: 5,
        anxietyLevel: 6,
        moodStability: 5,
        sleepQuality: 6,
        sleepHours: 7,
        weekdayMinutes: 30,
        weekendMinutes: 60,
        goals: ['Build discipline'],
        values: ['Honor'],
        currentStruggles: [],
        preferredTone: 'steady',
        completedAt: new Date(),
      };

      mockPrisma.assessment.findUnique.mockResolvedValue(assessment);

      const response = await request(app)
        .get('/api/assessment')
        .expect(200);

      expect(response.body).toHaveProperty('baseline');
      expect(response.body.baseline.mentalHealth.stress).toBe(5);
    });

    it('should return 404 if assessment not found', async () => {
      mockPrisma.assessment.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/assessment')
        .expect(404);

      expect(response.body.error).toBe('Assessment not found');
    });
  });
});
