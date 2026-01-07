import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const normalizeEmail = (email) => (email || '').trim().toLowerCase();

async function findUserByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return prisma.user.findUnique({ where: { email: normalized } });
}

export const register = async (req, res, next) => {
  // Keep these in outer scope so we can reference them in error handling/debug paths.
  const { email, password } = req.body || {};

  try {
    const normalizedEmail = normalizeEmail(email);
    const log = (req.logger || logger).child({ module: 'auth' });

    // Validation
    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user exists (Postgres is source of truth)
    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({
        error: 'User already exists',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    let user;
    try {
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
        },
      });
    } catch (err) {
      // Prisma unique constraint race
      if (err?.code === 'P2002') {
        return res.status(409).json({ error: 'User already exists' });
      }
      throw err;
    }

    // Generate token
    const token = generateToken(user.id);

    log.info('User registered', { userId: user.id, email: normalizedEmail, correlationId: req.correlationId });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: normalizedEmail,
        createdAt: user.createdAt?.toISOString?.() || new Date().toISOString(),
        updatedAt: user.updatedAt?.toISOString?.() || new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Registration error', {
      module: 'auth',
      error: error.message, 
      code: error.code,
      stack: error.stack 
    });

    // In development, return more error details
    if (process.env.NODE_ENV === 'development') {
      return res.status(500).json({ 
        error: error.message || 'Registration failed',
        code: error.code,
        stack: error.stack
      });
    }
    
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    const log = (req.logger || logger).child({ module: 'auth' });

    // Validation
    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id);
    log.info('User logged in', { userId: user.id, email: normalizedEmail, correlationId: req.correlationId });

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: normalizedEmail,
        createdAt: user.createdAt?.toISOString?.() || new Date().toISOString(),
        updatedAt: user.updatedAt?.toISOString?.() || new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Login error', { module: 'auth', error: error.message });
    next(error);
  }
};

export const me = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.status(200).json({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt?.toISOString?.() || null,
      updatedAt: user.updatedAt?.toISOString?.() || null,
    });
  } catch (error) {
    logger.error('Get me error', { module: 'auth', error: error.message, userId: req.user?.id });
    next(error);
  }
};
