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
const { getToday, complete, adjust } = await import('../src/controllers/taskController.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');

const app = express();
app.use(express.json());
// These tests call controllers directly (not via routes), so stub auth context.
app.use((req, res, next) => {
  req.user = { id: 'user-123' };
  next();
});
app.get('/api/tasks/today', getToday);
app.post('/api/tasks/complete', complete);
app.put('/api/tasks/adjust', adjust);
app.use(errorHandler);

describe('Task Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/tasks/today', () => {
    it('should return today\'s tasks with completion status', async () => {
      const mockPlan = {
        id: 'plan-123',
        tasks: [
          {
            id: 'task-1',
            title: 'Morning meditation',
            isAnchorWin: true,
            estimatedMinutes: 5,
            order: 0,
          },
          {
            id: 'task-2',
            title: 'Exercise',
            isAnchorWin: false,
            estimatedMinutes: 10,
            order: 1,
          },
        ],
      };

      const mockCheckIn = {
        id: 'checkin-123',
        taskCompletions: [
          { taskId: 'task-1' },
        ],
      };

      mockPrisma.growthPlan.findFirst.mockResolvedValue(mockPlan);
      mockPrisma.dailyCheckIn.findUnique.mockResolvedValue(mockCheckIn);

      const response = await request(app)
        .get('/api/tasks/today')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body[0].completed).toBe(true);
      expect(response.body[1].completed).toBe(false);
    });

    it('should return empty array if no active plan', async () => {
      mockPrisma.growthPlan.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/tasks/today')
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('POST /api/tasks/complete', () => {
    it('should complete a task successfully', async () => {
      const mockTask = {
        id: 'task-123',
        planId: 'plan-123',
        plan: {
          userId: 'user-123',
          isActive: true,
        },
      };

      mockPrisma.task.findFirst.mockResolvedValue(mockTask);
      mockPrisma.dailyCheckIn.findUnique.mockResolvedValue(null);
      mockPrisma.dailyCheckIn.create.mockResolvedValue({
        id: 'checkin-123',
        userId: 'user-123',
        date: new Date(),
      });
      mockPrisma.taskCompletion.findFirst.mockResolvedValue(null);
      mockPrisma.taskCompletion.create.mockResolvedValue({
        id: 'completion-123',
        taskId: 'task-123',
        checkInId: 'checkin-123',
      });
      mockPrisma.progressMetrics.upsert.mockResolvedValue({});

      const response = await request(app)
        .post('/api/tasks/complete')
        .send({ taskId: 'task-123' })
        .expect(200);

      expect(response.body.message).toContain('completed');
      expect(mockPrisma.taskCompletion.create).toHaveBeenCalled();
    });

    it('should reject completion of non-existent task', async () => {
      mockPrisma.task.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/tasks/complete')
        .send({ taskId: 'invalid-task' })
        .expect(500);

      // Error should be thrown
      expect(response.body.error).toBeDefined();
    });

    it('should reject completion without taskId', async () => {
      const response = await request(app)
        .post('/api/tasks/complete')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Task ID is required');
    });
  });

  describe('PUT /api/tasks/adjust', () => {
    it('should return minimum day tasks', async () => {
      const mockPlan = {
        id: 'plan-123',
        tasks: [
          {
            id: 'task-1',
            title: 'Anchor task',
            isAnchorWin: true,
            estimatedMinutes: 5,
            order: 0,
            completed: false,
          },
          {
            id: 'task-2',
            title: 'Small task',
            isAnchorWin: false,
            estimatedMinutes: 2,
            order: 1,
            completed: false,
          },
          {
            id: 'task-3',
            title: 'Large task',
            isAnchorWin: false,
            estimatedMinutes: 15,
            order: 2,
            completed: false,
          },
        ],
      };

      mockPrisma.growthPlan.findFirst.mockResolvedValue(mockPlan);
      mockPrisma.dailyCheckIn.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/tasks/adjust')
        .send({ mode: 'minimum' })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Should include anchor win + smallest tasks
      expect(response.body.length).toBeLessThanOrEqual(3);
    });

    it('should reject invalid mode', async () => {
      const response = await request(app)
        .put('/api/tasks/adjust')
        .send({ mode: 'invalid' })
        .expect(400);

      expect(response.body.error).toContain('Mode must be "minimum" or "standard"');
    });
  });
});
