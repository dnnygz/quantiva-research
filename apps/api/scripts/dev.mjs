import { spawn } from 'node:child_process';

const connectionString =
  process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is required. Copy .env.example to .env and set local credentials.');
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ['../../node_modules/wrangler/bin/wrangler.js', 'dev', '--port', '8787'],
  {
    cwd: new URL('..', import.meta.url),
    stdio: 'inherit',
    env: {
      ...process.env,
      CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: connectionString,
    },
  },
);

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
