import { authenticate as jwtAuthenticate } from './auth.jwt.js';
import { authenticate as firebaseAuthenticate } from './auth.firebase.js';

/**
 * Auth selector middleware (env-driven)
 *
 * AUTH_MODE:
 * - jwt      (default): verifies locally-issued JWTs (Authorization: Bearer <jwt>)
 * - firebase          : verifies Firebase ID tokens (Authorization: Bearer <idToken>)
 *
 * Why:
 * - This repo currently contains both implementations; this makes the active
 *   behavior explicit and configurable without code changes.
 */
export const authenticate = (req, res, next) => {
  const mode = (process.env.AUTH_MODE || 'jwt').toLowerCase();

  if (mode === 'firebase') return firebaseAuthenticate(req, res, next);
  return jwtAuthenticate(req, res, next);
};
