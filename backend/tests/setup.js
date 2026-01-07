import { jest } from '@jest/globals';

// Mock Prisma client
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  assessment: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  growthPlan: {
    findFirst: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  task: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  dailyCheckIn: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn(),
  },
  taskCompletion: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  progressMetrics: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  journalEntry: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  feedback: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  milestone: {
    findFirst: jest.fn(),
  },
  $disconnect: jest.fn(),
};

// Mock Prisma module
jest.unstable_mockModule('../src/utils/prisma.js', () => ({
  default: mockPrisma,
}));

// Mock logger
jest.unstable_mockModule('../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock OpenAI
jest.unstable_mockModule('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  })),
}));

export { mockPrisma };
