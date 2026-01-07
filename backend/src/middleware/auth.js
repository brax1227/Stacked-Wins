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

  // IMPORTANT (ESM): Avoid static imports of optional auth backends.
  // This repo may run in Postgres-only mode without Firebase configured.
  if (mode === 'firebase') {
    import('./auth.firebase.js')
      .then(({ authenticate: firebaseAuthenticate }) => firebaseAuthenticate(req, res, next))
      .catch((err) => next(err));
    return;
  }

  import('./auth.jwt.js')
    .then(({ authenticate: jwtAuthenticate }) => jwtAuthenticate(req, res, next))
    .catch((err) => next(err));
};
