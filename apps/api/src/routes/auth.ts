import { and, count, eq, gt, lt, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { loginSchema, type AdminUser } from '@qa/shared';
import { adminUsers, loginAttempts } from '../db/schema';
import type { AppEnv, AppContext } from '../env';
import { requireAdmin } from '../middleware/auth';
import { DUMMY_HASH, verifyPassword } from '../services/password';
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  readSessionCookie,
  setSessionCookie,
} from '../services/session';

export const authRoutes = new Hono<AppEnv>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

function clientIp(c: AppContext): string {
  const cf = c.req.header('CF-Connecting-IP');
  if (cf) return cf.trim();
  const fwd = c.req.header('X-Forwarded-For')?.split(',')[0]?.trim();
  return fwd || 'local';
}

authRoutes.post('/login', async (c) => {
  const db = c.var.db;
  const input = loginSchema.parse(await c.req.json());
  const email = input.email.trim().toLowerCase();
  const ip = clientIp(c);
  const since = new Date(Date.now() - WINDOW_MS);

  const [recent] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.success, false),
        gt(loginAttempts.createdAt, since),
        or(eq(loginAttempts.ip, ip), eq(loginAttempts.email, email)),
      ),
    );
  if ((recent?.n ?? 0) >= MAX_FAILURES) {
    return c.json({ error: 'Too many failed attempts. Try again in 15 minutes.' }, 429);
  }

  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
  // Always run PBKDF2 so response time does not reveal whether the email exists.
  const ok = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);

  // Opportunistic cleanup of old attempts.
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(Date.now() - 24 * 3600 * 1000)));
  await db.insert(loginAttempts).values({ ip, email, success: Boolean(user && ok) });

  if (!user || !ok) return c.json({ error: 'Invalid email or password' }, 401);

  const token = await createSession(db, user.id);
  setSessionCookie(c, token);
  const body: { user: AdminUser } = { user: { id: user.id, email: user.email } };
  return c.json(body);
});

authRoutes.post('/logout', async (c) => {
  const token = readSessionCookie(c);
  if (token) await deleteSession(c.var.db, token);
  clearSessionCookie(c);
  return c.json({ ok: true });
});

authRoutes.get('/me', requireAdmin, (c) => c.json({ user: c.var.user }));
