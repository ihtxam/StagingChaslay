import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, '..', 'src', 'styles', 'delicate-reservations.css');
const dest = path.join(root, '..', 'public', 'embed', 'delicate-reservations.css');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
