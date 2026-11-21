/** Shared helpers for Node scripts (run with tsx). */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema';

function requireDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error('DATABASE_URL is required. Copy .env.example to .env and set local credentials.');
  }
  return value;
}

export const DATABASE_URL = requireDatabaseUrl();

export function connect() {
  const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
  return { sql, db: drizzle(sql, { schema }) };
}

/** Hides credentials when printing the target database. */
export function redactedUrl(): string {
  try {
    const u = new URL(DATABASE_URL);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '(invalid DATABASE_URL)';
  }
}
