import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import { z } from 'zod';
import { createDb } from './db/client';
import type { AppEnv } from './env';
import { requireTrustedOrigin } from './middleware/auth';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { publicRoutes } from './routes/public';

const app = new Hono<AppEnv>();

app.use('*', secureHeaders({ crossOriginResourcePolicy: false }));
// CORP same-site by default; public figure images set their own `cross-origin` value.
app.use('*', async (c, next) => {
  await next();
  if (!c.res.headers.has('Cross-Origin-Resource-Policy')) {
    c.res.headers.set('Cross-Origin-Resource-Policy', 'same-site');
  }
});

app.use('/api/*', (c, next) =>
  cors({
    origin: (origin) => (origin === c.env.FRONTEND_ORIGIN ? origin : null),
    credentials: true,
    allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    maxAge: 600,
  })(c, next),
);

// CSRF: state-changing auth/admin requests must come from a trusted Origin.
app.use('/api/auth/*', requireTrustedOrigin);
app.use('/api/admin/*', requireTrustedOrigin);

// One postgres.js client per request (Hyperdrive does the real pooling).
app.use('/api/*', async (c, next) => {
  const { db, sql } = createDb(c.env.HYPERDRIVE.connectionString);
  c.set('db', db);
  try {
    await next();
  } finally {
    c.executionCtx.waitUntil(sql.end({ timeout: 5 }));
  }
});

app.route('/api', publicRoutes);
app.route('/api/auth', authRoutes);
app.route('/api/admin', adminRoutes);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

/** Postgres error code from a postgres.js error, possibly wrapped by Drizzle. */
function pgCode(err: unknown): string | undefined {
  for (let e: unknown = err, i = 0; e && i < 3; e = (e as { cause?: unknown }).cause, i++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
  }
  return undefined;
}

app.onError((err, c) => {
  if (err instanceof z.ZodError) {
    return c.json({ error: 'Invalid request', details: err.issues }, 400);
  }
  if (err instanceof HTTPException) {
    return c.json({ error: err.message || 'Request failed' }, err.status);
  }
  if (err instanceof SyntaxError) {
    return c.json({ error: 'Malformed JSON body' }, 400);
  }
  const code = pgCode(err);
  if (code === '23505') return c.json({ error: 'A record with this slug or key already exists' }, 409);
  if (code === '23503') return c.json({ error: 'Referenced record does not exist or is still in use' }, 409);
  if (code === '22P02' || code === '23502' || code === '22003') {
    return c.json({ error: 'Invalid value' }, 400);
  }
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
