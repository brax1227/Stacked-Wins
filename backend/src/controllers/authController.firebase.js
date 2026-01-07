import { auth, db } from '../utils/firebase.js';
import { logger } from '../utils/logger.js';

/**
 * Register a new user with Firebase Auth
 */
export const register = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      emailVerified: false,
    });

    // Create user document in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Generate custom token for client
    const customToken = await auth.createCustomToken(userRecord.uid);

    logger.info('User registered', { 
      module: 'auth', 
      userId: userRecord.uid, 
      email 
    });

    res.status(201).json({
      token: customToken, // Client will exchange this for ID token
      user: {
        id: userRecord.uid,
        email: userRecord.email,
      },
    });
  } catch (error) {
    logger.error('Registration failed', { 
      module: 'auth', 
      error: error.message 
    });

    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: 'User already exists' });
    }

    next(error);
  }
};

/**
 * Login user - Firebase handles this on client side
 * This endpoint verifies the ID token from client
 */
export const login = async (req, res, next) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'ID token is required' });
    }

    // Verify the ID token
    const decodedToken = await auth.verifyIdToken(idToken);
    
    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    logger.info('User logged in', { 
      module: 'auth', 
      userId: decodedToken.uid 
    });

    res.json({
      token: idToken, // Return the verified token
      user: {
        id: decodedToken.uid,
        email: decodedToken.email,
        ...userData,
      },
    });
  } catch (error) {
    logger.error('Login failed', { 
      module: 'auth', 
      error: error.message 
    });

    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired' });
    }

    next(error);
  }
};

/**
 * Verify Firebase ID token (middleware helper)
 */
export const verifyToken = async (idToken) => {
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    throw error;
  }
};
