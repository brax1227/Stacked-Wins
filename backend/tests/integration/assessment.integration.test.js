import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../../src/utils/prisma.js';
import assessmentRoutes from '../../src/routes/assessmentRoutes.js';

// Create test app
const app = express();
app.use(express.json());

// Mock auth middleware to create real token
app.use('/api/assessment', (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  } else {
    res.status(401).json({ error: 'No token provided' });
  }
});
app.use('/api/assessment', assessmentRoutes);

describe('Assessment Integration Tests (Production-like)', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Create a test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    testUser = await prisma.user.create({
      data: {
        email: 'assessment-test@example.com',
        passwordHash: hashedPassword,
      },
    });

    // Generate auth token
    authToken = jwt.sign(
      { id: testUser.id },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '7d' }
    );
  });

  afterAll(async () => {
    // Clean up
    if (testUser) {
      await prisma.assessment.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.user.delete({
        where: { id: testUser.id },
      });
    }
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up assessments before each test
    await prisma.assessment.deleteMany({
      where: { userId: testUser.id },
    });
  });

  describe('POST /api/assessment', () => {
    it('should save assessment to real database', async () => {
      const assessmentData = {
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

      const response = await request(app)
        .post('/api/assessment')
        .set('Authorization', `Bearer ${authToken}`)
        .send(assessmentData)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('baseline');
      expect(response.body.stressLevel).toBe(5);
      expect(response.body.isBaseline).toBe(true);

      // Verify it's actually in database
      const dbAssessment = await prisma.assessment.findUnique({
        where: { userId: testUser.id },
      });

      expect(dbAssessment).toBeTruthy();
      expect(dbAssessment.stressLevel).toBe(5);
      expect(dbAssessment.goals).toEqual(['Build discipline', 'Reduce anxiety']);
    });

    it('should update existing assessment', async () => {
      // Create initial assessment
      await prisma.assessment.create({
        data: {
          userId: testUser.id,
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
        },
      });

      // Update it
      const response = await request(app)
        .post('/api/assessment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          stressLevel: 4, // Changed
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
        })
        .expect(200);

      expect(response.body.stressLevel).toBe(4);

      // Verify database was updated
      const dbAssessment = await prisma.assessment.findUnique({
        where: { userId: testUser.id },
      });
      expect(dbAssessment.stressLevel).toBe(4);
    });
  });
});
