import { describe, it, expect, beforeEach, jest } from '@jest/globals';

/**
 * Why:
 * - Lock in env-driven auth selection so we don't accidentally break it.
 */

beforeEach(() => {
  jest.resetModules();
  delete process.env.AUTH_MODE;
});

describe('Auth selector middleware', () => {
  it('defaults to jwt when AUTH_MODE is unset', async () => {
    const jwtFn = jest.fn((req, res, next) => next());
    const firebaseFn = jest.fn((req, res, next) => next());

    jest.unstable_mockModule('../../src/middleware/auth.jwt.js', () => ({
      authenticate: jwtFn,
    }));
    jest.unstable_mockModule('../../src/middleware/auth.firebase.js', () => ({
      authenticate: firebaseFn,
    }));

    const { authenticate } = await import('../../src/middleware/auth.js');
    authenticate({}, {}, () => {});

    expect(jwtFn).toHaveBeenCalledTimes(1);
    expect(firebaseFn).toHaveBeenCalledTimes(0);
  });

  it('uses firebase when AUTH_MODE=firebase', async () => {
    process.env.AUTH_MODE = 'firebase';

    const jwtFn = jest.fn((req, res, next) => next());
    const firebaseFn = jest.fn((req, res, next) => next());

    jest.unstable_mockModule('../../src/middleware/auth.jwt.js', () => ({
      authenticate: jwtFn,
    }));
    jest.unstable_mockModule('../../src/middleware/auth.firebase.js', () => ({
      authenticate: firebaseFn,
    }));

    const { authenticate } = await import('../../src/middleware/auth.js');
    authenticate({}, {}, () => {});

    expect(firebaseFn).toHaveBeenCalledTimes(1);
    expect(jwtFn).toHaveBeenCalledTimes(0);
  });
});

