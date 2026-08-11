import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'openpage', 'dist');
const dest = join(root, 'dashboard', 'public', 'openpage');

if (!existsSync(src)) {
  console.error('OpenPage dist missing. Run: npm --prefix openpage run build');
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dirname(dest), { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`Copied OpenPage build → ${dest}`);
