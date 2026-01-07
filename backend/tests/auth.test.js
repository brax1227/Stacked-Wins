import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcrypt';

// Mock Firestore (Firebase Auth is no longer used)
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
        mockDb._lastDocId = id;
        mockDb._lastSetData = data;
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

jest.unstable_mockModule('../src/utils/firebase.js', () => ({
  db: mockDb,
  default: mockAdminDefault,
}));

let authRoutes;

// Create test app
const app = express();
app.use(express.json());

describe('Authentication Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb._usersByEmail.clear();
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '7d';
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
      };

      if (!authRoutes) {
        authRoutes = (await import('../src/routes/authRoutes.js')).default;
        app.use('/api/auth', authRoutes);
      }

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(userData.email);
    });

    it('should reject registration with existing email', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'password123',
      };

      if (!authRoutes) {
        authRoutes = (await import('../src/routes/authRoutes.js')).default;
        app.use('/api/auth', authRoutes);
      }

      // Seed existing user in mock Firestore
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

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.error).toBe('User already exists');
    });

    it('should reject registration with short password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'short',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('Password must be at least 8 characters');
    });

    it('should reject registration with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(response.body.error).toBe('Email and password are required');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login user with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const hashedPassword = await bcrypt.hash(loginData.password, 10);

      if (!authRoutes) {
        authRoutes = (await import('../src/routes/authRoutes.js')).default;
        app.use('/api/auth', authRoutes);
      }

      mockDb._usersByEmail.set('test@example.com', {
        id: 'user-123',
        data: {
          email: loginData.email,
          passwordHash: hashedPassword,
          createdAt: { toDate: () => new Date() },
          updatedAt: { toDate: () => new Date() },
        },
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(loginData.email);
    });

    it('should reject login with invalid email', async () => {
      if (!authRoutes) {
        authRoutes = (await import('../src/routes/authRoutes.js')).default;
        app.use('/api/auth', authRoutes);
      }

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject login with invalid password', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 10);

      if (!authRoutes) {
        authRoutes = (await import('../src/routes/authRoutes.js')).default;
        app.use('/api/auth', authRoutes);
      }

      mockDb._usersByEmail.set('test@example.com', {
        id: 'user-123',
        data: {
          email: 'test@example.com',
          passwordHash: hashedPassword,
          createdAt: { toDate: () => new Date() },
          updatedAt: { toDate: () => new Date() },
        },
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should reject login with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(response.body.error).toBe('Email and password are required');
    });
  });
});
