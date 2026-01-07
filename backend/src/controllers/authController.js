import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../utils/firebase.js';
import adminInstance from '../utils/firebase.js';
import { logger } from '../utils/logger.js';

// Get Firestore Timestamp - use the default export (admin instance) from firebase utils
const getTimestamp = () => {
  return adminInstance.firestore.Timestamp.now();
};

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
  const snapshot = await db.collection('users')
    .where('email', '==', normalized)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

export const register = async (req, res, next) => {
  // Keep these in outer scope so we can reference them in error handling/debug paths.
  const { email, password } = req.body || {};

  try {
    const normalizedEmail = normalizeEmail(email);

    // Validation
    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user exists (Firestore is source of truth)
    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({
        error: 'User already exists',
        ...(process.env.NODE_ENV === 'development' && {
          existingUser: {
            id: existing.id,
            email: existing.email,
            createdAt: existing.createdAt?.toDate?.()?.toISOString?.() || null,
          },
        }),
      });
    }

    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user document in Firestore
    const userData = {
      email: normalizedEmail,
      passwordHash,
      createdAt: getTimestamp(),
      updatedAt: getTimestamp(),
    };

    await db.collection('users').doc(userId).set(userData);

    // Generate token
    const token = generateToken(userId);

    logger.info('User registered', { module: 'auth', userId, email: normalizedEmail });

    res.status(201).json({
      token,
      user: {
        id: userId,
        email: normalizedEmail,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
    if (process.env.NODE_ENV !== 'production') {
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
    logger.info('User logged in', { module: 'auth', userId: user.id, email: normalizedEmail });

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: normalizedEmail,
        createdAt: user.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
        updatedAt: user.updatedAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Login error', { module: 'auth', error: error.message });
    next(error);
  }
};
