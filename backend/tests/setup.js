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

// Mock Prisma module (use absolute path to avoid moduleNameMapper quirks)
const prismaModulePath = new URL('../src/utils/prisma.js', import.meta.url).pathname;
jest.unstable_mockModule(prismaModulePath, () => ({
  default: mockPrisma,
}));

// Mock logger (must include .child() because controllers may call it)
const loggerModulePath = new URL('../src/utils/logger.js', import.meta.url).pathname;
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(function child() {
    return mockLogger;
  }),
};
jest.unstable_mockModule(loggerModulePath, () => ({
  logger: mockLogger,
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
