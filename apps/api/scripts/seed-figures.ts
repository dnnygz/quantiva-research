/**
 * Uploads data/figures/*.png to R2 under seed/<file>.
 *   npm run figures:seed -w @qa/api              # local R2 (wrangler dev)
 *   npm run figures:seed -w @qa/api -- --remote  # production bucket
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const figuresDir = join(apiDir, '..', '..', 'data', 'figures');
const remote = process.argv.includes('--remote');
const BUCKET = 'quantum-aware-figures';

const files = readdirSync(figuresDir).filter((f) => f.toLowerCase().endsWith('.png')).sort();
let failed = 0;
for (const file of files) {
  const args = [
    'wrangler',
    'r2',
    'object',
    'put',
    `${BUCKET}/seed/${file}`,
    '--file',
    join(figuresDir, file),
    '--content-type',
    'image/png',
    remote ? '--remote' : '--local',
  ];
  const res = spawnSync('npx', args, { cwd: apiDir, stdio: 'inherit' });
  if (res.status !== 0) {
    failed++;
    console.error(`Failed to upload ${file}`);
  }
}
console.log(`Uploaded ${files.length - failed}/${files.length} figures (${remote ? 'remote' : 'local'}).`);
if (failed > 0) process.exitCode = 1;
