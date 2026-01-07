import crypto from 'crypto';
import { logger } from '../utils/logger.js';

/**
 * Request context middleware
 *
 * Adds:
 * - req.correlationId (from header or generated)
 * - res header: x-correlation-id
 * - req.logger (winston child logger w/ correlationId + request info)
 *
 * Why:
 * - Trace logs across a single request end-to-end.
 * - Keep structured logging consistent and debuggable.
 */
export const requestContext = (req, res, next) => {
  const incoming = req.headers['x-correlation-id'];
  const correlationId =
    (typeof incoming === 'string' && incoming.trim()) || crypto.randomUUID();

  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  // Attach a child logger for consistent structured fields.
  req.logger = logger.child({
    correlationId,
    module: 'http',
    method: req.method,
    path: req.path,
  });

  next();
};

