/**
 * Run: npx tsx dashboard/src/components/webpos/webpos-scan-create-product-modal.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = dirname(fileURLToPath(import.meta.url));
const modalSrc = readFileSync(join(root, 'WebPosScanCreateProductModal.tsx'), 'utf8');

test('scan create modal keeps form state across parent re-renders for same barcode', () => {
  assert.match(modalSrc, /formSessionRef/);
  assert.match(modalSrc, /formSessionRef\.current === barcode/);
});
