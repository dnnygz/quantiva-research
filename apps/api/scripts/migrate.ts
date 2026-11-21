/** Applies SQL migrations from apps/api/drizzle.  Usage: npm run db:migrate -w @qa/api */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { connect, redactedUrl } from './db';

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');

const { sql, db } = connect();
try {
  console.log(`Applying migrations to ${redactedUrl()} ...`);
  await migrate(db, { migrationsFolder });
  console.log('Migrations applied.');
} catch (err) {
  console.error('Migration failed:', err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
