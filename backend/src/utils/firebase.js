import admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    // Option 1: Use service account JSON file path (relative to backend directory)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      let serviceAccountPath;
      if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH.startsWith('/')) {
        // Absolute path
        serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      } else {
        // Relative path - resolve from backend directory (go up from src/utils to backend/)
        serviceAccountPath = join(__dirname, '../..', process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      }
      
      logger.info('Loading Firebase service account', { 
        module: 'firebase', 
        path: serviceAccountPath,
        exists: existsSync(serviceAccountPath)
      });
      
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id, // Explicitly set project ID
      });
      
      logger.info('Firebase Admin initialized with service account', { 
        module: 'firebase',
        projectId: serviceAccount.project_id
      });
    }
    // Option 2: Use service account JSON as environment variable (string)
    else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    // Option 3: Use individual environment variables
    else if (process.env.FIREBASE_PROJECT_ID) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }
    // Option 4: Use default credentials (for Firebase hosting/Cloud Run)
    else {
      admin.initializeApp();
    }

    logger.info('Firebase Admin initialized', { module: 'firebase' });
  } catch (error) {
    logger.error('Firebase initialization error', { module: 'firebase', error: error.message });
    throw error;
  }
}

// Get Firestore instance
export const db = admin.firestore();

export default admin;
