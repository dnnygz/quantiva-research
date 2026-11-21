import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export function createDb(connectionString: string) {
  // Hyperdrive pools connections; keep the per-request client small.
  const sql = postgres(connectionString, { max: 5, fetch_types: false, prepare: true });
  const db = drizzle(sql, { schema });
  return { db, sql };
}

export type Db = ReturnType<typeof createDb>['db'];
