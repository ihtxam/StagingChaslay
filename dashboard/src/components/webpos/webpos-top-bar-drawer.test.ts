import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = dirname(fileURLToPath(import.meta.url));
const topBarSrc = readFileSync(join(root, 'WebPosTopBar.tsx'), 'utf8');

describe('WebPosTopBar cash drawer', () => {
  it('only shows the drawer control on the local print station', () => {
    expect(topBarSrc).toContain('{canDrawer && isLocalPrintStation ? (');
  });
});
