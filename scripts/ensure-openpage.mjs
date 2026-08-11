import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const marker = join(root, 'dashboard', 'public', 'openpage', 'index.html');

if (existsSync(marker)) process.exit(0);

console.log('OpenPage public assets missing — building…');
const build = spawnSync('npm', ['--prefix', join(root, 'openpage'), 'run', 'build'], {
  stdio: 'inherit',
  shell: true,
});
if (build.status !== 0) process.exit(build.status ?? 1);

const copy = spawnSync(process.execPath, [join(root, 'scripts', 'copy-openpage.mjs')], {
  stdio: 'inherit',
});
process.exit(copy.status ?? 1);
