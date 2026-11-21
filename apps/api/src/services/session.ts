import { eq, lt } from 'drizzle-orm';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AdminUser } from '@qa/shared';
import type { Db } from '../db/client';
import { adminUsers, sessions } from '../db/schema';
import type { AppContext } from '../env';

export const SESSION_COOKIE = 'qa_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(db: Db, adminUserId: number): Promise<string> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await db.insert(sessions).values({ id: await sha256Hex(token), adminUserId, expiresAt });
  return token;
}

/** Returns the admin for a raw session token, or null. Expired sessions are deleted. */
export async function getSessionUser(db: Db, token: string | undefined): Promise<AdminUser | null> {
  if (!token || token.length > 100) return null;
  const id = await sha256Hex(token);
  const rows = await db
    .select({ id: adminUsers.id, email: adminUsers.email, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(adminUsers, eq(adminUsers.id, sessions.adminUserId))
    .where(eq(sessions.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  return { id: row.id, email: row.email };
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, await sha256Hex(token)));
}

export function readSessionCookie(c: AppContext): string | undefined {
  return getCookie(c, SESSION_COOKIE);
}

export function setSessionCookie(c: AppContext, token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    secure: c.env.COOKIE_SECURE === 'true',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(c: AppContext): void {
  deleteCookie(c, SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: c.env.COOKIE_SECURE === 'true',
  });
}
