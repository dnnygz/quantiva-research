/**
 * Creates or resets an admin user.
 *   ADMIN_PASSWORD=... npm run admin:create -w @qa/api -- admin@example.com
 * Without ADMIN_PASSWORD the password is prompted (hidden input).
 */
import { stdin, stdout } from 'node:process';
import { z } from 'zod';
import { adminUsers } from '../src/db/schema';
import { hashPassword } from '../src/services/password';
import { connect, redactedUrl } from './db';

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY) {
      reject(new Error('No TTY available: set ADMIN_PASSWORD instead.'));
      return;
    }
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (c === '\u0003') {
          stdin.setRawMode(false);
          process.exit(130);
        }
        if (c === '\u007f' || c === '\b') value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on('data', onData);
  });
}

const email = z.email().max(254).safeParse(process.argv[2]?.trim().toLowerCase());
if (!email.success) {
  console.error('Usage: npm run admin:create -w @qa/api -- <email>');
  process.exit(1);
}

let password = process.env.ADMIN_PASSWORD;
if (!password) {
  password = await promptHidden('Password (min 12 chars): ');
  const confirm = await promptHidden('Repeat password: ');
  if (password !== confirm) {
    console.error('Passwords do not match.');
    process.exit(1);
  }
}
if (password.length < 12 || password.length > 256) {
  console.error('Password must be between 12 and 256 characters.');
  process.exit(1);
}

const { sql, db } = connect();
try {
  const passwordHash = await hashPassword(password);
  const [row] = await db
    .insert(adminUsers)
    .values({ email: email.data, passwordHash })
    .onConflictDoUpdate({ target: adminUsers.email, set: { passwordHash } })
    .returning({ id: adminUsers.id, email: adminUsers.email });
  console.log(`Admin ${row!.email} (id ${row!.id}) saved in ${redactedUrl()}.`);
} finally {
  await sql.end();
}
