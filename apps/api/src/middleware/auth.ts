import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env';
import { getSessionUser, readSessionCookie } from '../services/session';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for state-changing requests: the Origin header must be the configured
 * frontend origin or the request's own origin (same-origin through the Pages proxy).
 */
export const requireTrustedOrigin = createMiddleware<AppEnv>(async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) return next();
  const origin = c.req.header('Origin');
  const self = new URL(c.req.url).origin;
  if (!origin || (origin !== c.env.FRONTEND_ORIGIN && origin !== self)) {
    return c.json({ error: 'Forbidden origin' }, 403);
  }
  return next();
});

/** Requires a valid admin session; sets c.var.user. */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = await getSessionUser(c.var.db, readSessionCookie(c));
  if (!user) return c.json({ error: 'Authentication required' }, 401);
  c.set('user', user);
  return next();
});
