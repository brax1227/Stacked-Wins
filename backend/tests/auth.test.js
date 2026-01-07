import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcrypt';
import { mockPrisma } from './setup.js';

let authRoutes;

// Create test app
const app = express();
app.use(express.json());

describe('Authentication Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-123',
        email: userData.email,
        passwordHash: await bcrypt.hash(userData.password, 10),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

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

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'existing@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        createdAt: new Date(),
        updatedAt: new Date(),
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

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: loginData.email,
        passwordHash: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
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

      mockPrisma.user.findUnique.mockResolvedValue(null);

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

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
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
