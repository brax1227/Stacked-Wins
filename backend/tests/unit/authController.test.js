import { describe, it, expect, beforeEach, beforeAll, jest } from '@jest/globals';
import bcrypt from 'bcrypt';

// Create mock Firestore - must be defined before mocking
const mockDb = {
  _usersByEmail: new Map(),
  collection: jest.fn(() => ({
    where: jest.fn((field, op, value) => ({
      limit: jest.fn(() => ({
        get: jest.fn(async () => {
          const doc = mockDb._usersByEmail.get(value) || null;
          return doc
            ? {
                empty: false,
                docs: [
                  {
                    id: doc.id,
                    data: () => doc.data,
                  },
                ],
              }
            : { empty: true, docs: [] };
        }),
      })),
    })),
    doc: jest.fn((id) => ({
      set: jest.fn(async (data) => {
        mockDb._usersByEmail.set(data.email, { id, data });
      }),
    })),
  })),
};

const mockAdminDefault = {
  firestore: {
    Timestamp: {
      now: () => ({ toDate: () => new Date() }),
    },
  },
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock modules BEFORE any imports - paths relative to test file
jest.unstable_mockModule('../../src/utils/firebase.js', () => ({
  db: mockDb,
  default: mockAdminDefault,
}));

// Logger is mocked globally via tests/setup.js

// Import modules after mocking
let register, login;
let createMockRequest, createMockResponse, createMockNext;

beforeAll(async () => {
  // Import helpers first (no mocks needed)
  const helpersModule = await import('../helpers.js');
  createMockRequest = helpersModule.createMockRequest;
  createMockResponse = helpersModule.createMockResponse;
  createMockNext = helpersModule.createMockNext;
  
  // Import controller after mocks are set up
  const authModule = await import('../../src/controllers/authController.js');
  register = authModule.register;
  login = authModule.login;
});

describe('Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb._usersByEmail.clear();
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '7d';
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const req = createMockRequest({
        body: {
          email: 'test@example.com',
          password: 'password123',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.any(String),
          user: expect.objectContaining({
            email: 'test@example.com',
          }),
        })
      );
    });

    it('should reject registration with existing email', async () => {
      const req = createMockRequest({
        body: {
          email: 'existing@example.com',
          password: 'password123',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      const passwordHash = await bcrypt.hash('password123', 10);
      mockDb._usersByEmail.set('existing@example.com', {
        id: 'existing-user',
        data: {
          email: 'existing@example.com',
          passwordHash,
          createdAt: { toDate: () => new Date() },
          updatedAt: { toDate: () => new Date() },
        },
      });

      await register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: 'User already exists',
      });
    });

    it('should reject registration with short password', async () => {
      const req = createMockRequest({
        body: {
          email: 'test@example.com',
          password: 'short',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Password must be at least 8 characters',
      });
    });
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);

      const req = createMockRequest({
        body: {
          email: 'test@example.com',
          password,
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mockDb._usersByEmail.set('test@example.com', {
        id: 'user-123',
        data: {
          email: 'test@example.com',
          passwordHash: hashedPassword,
          createdAt: { toDate: () => new Date() },
          updatedAt: { toDate: () => new Date() },
        },
      });

      await login(req, res, next);
      
      // Verify next was not called (no errors)
      expect(next).not.toHaveBeenCalled();
      
      // The controller calls res.json() directly (Express sets default 200)
      // So we check that json was called with the right data
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.any(String),
          user: expect.objectContaining({
            email: 'test@example.com',
          }),
        })
      );
      
      // If status was called, verify it's 200
      if (res.status.mock.calls.length > 0) {
        expect(res.status).toHaveBeenCalledWith(200);
      }
    });

    it('should reject login with invalid credentials', async () => {
      const req = createMockRequest({
        body: {
          email: 'test@example.com',
          password: 'wrongpassword',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      mockDb._usersByEmail.set('test@example.com', {
        id: 'user-123',
        data: {
          email: 'test@example.com',
          passwordHash: hashedPassword,
          createdAt: { toDate: () => new Date() },
          updatedAt: { toDate: () => new Date() },
        },
      });

      await login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid credentials',
      });
    });
  });
});
