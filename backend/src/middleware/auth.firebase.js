import { auth } from '../utils/firebase.js';
import { logger } from '../utils/logger.js';

/**
 * Firebase Auth middleware - verifies ID token from client
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];

    // Verify Firebase ID token
    const decodedToken = await auth.verifyIdToken(idToken);

    // Attach user info to request
    req.user = {
      id: decodedToken.uid,
      email: decodedToken.email,
    };

    next();
  } catch (error) {
    logger.error('Authentication failed', { 
      module: 'auth', 
      error: error.message 
    });

    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired' });
    }

    if (error.code === 'auth/argument-error') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    res.status(401).json({ error: 'Authentication failed' });
  }
};
