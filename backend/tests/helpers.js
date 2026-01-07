import { jest } from '@jest/globals';

// Test helper utilities

export const createMockRequest = (overrides = {}) => ({
  user: { id: 'user-123' },
  body: {},
  params: {},
  query: {},
  headers: {},
  ...overrides,
});

export const createMockResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return res;
};

export const createMockNext = () => jest.fn();
