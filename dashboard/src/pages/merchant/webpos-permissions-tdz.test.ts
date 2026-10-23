import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('WebPos staff permission flags (no module init TDZ)', () => {
  it('declares canManageSettings before hardwareGearOnly', () => {
    const src = readFileSync(join(root, 'pages/merchant/WebPos.tsx'), 'utf8');
    const manageIdx = src.indexOf('const canManageSettings = ownerOnRegister');
    const gearOnlyIdx = src.indexOf('const hardwareGearOnly =');
    expect(manageIdx).toBeGreaterThan(-1);
    expect(gearOnlyIdx).toBeGreaterThan(-1);
    expect(manageIdx).toBeLessThan(gearOnlyIdx);
  });
});
