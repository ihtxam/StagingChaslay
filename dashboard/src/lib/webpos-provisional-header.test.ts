import assert from 'node:assert/strict';
import { lineWidthForPaper } from './receipt-labels.ts';
import {
  generateWebPosReceiptText,
  getReceiptHeaderLines,
  stripPlainReceiptHeaderFromBody,
  type WebPosReceipt,
} from './webpos-receipt.ts';

const width = lineWidthForPaper(80);
const shop = {
  businessName: 'Nova Portugália',
  address: 'Rue des Draizes 44',
  city: 'Neuchâtel',
  phone: '032 558 45 65',
  vatNumber: 'CHE-131.903.128',
  headerAlign: 'center' as const,
};

const headerLines = getReceiptHeaderLines(
  { ...shop, header: '', headerTitle: '', headerLines: [] },
  width,
  { padLines: false }
);
assert.ok(headerLines.includes('Nova Portugália'));
assert.ok(headerLines.includes('Rue des Draizes 44'));
assert.equal(headerLines.filter((line) => line.includes('Rue des Draizes')).length, 1);

const receipt: WebPosReceipt = {
  ...shop,
  header: '',
  headerTitle: '',
  headerLines: [],
  id: 'prov-1',
  completedAt: Date.now(),
  paymentMethod: 'cash',
  isProvisional: true,
  items: [{ name: 'Poulet mercredi', quantity: 1, unitPrice: 16, lineTotal: 16 }],
  subtotal: 15.59,
  discount: 0,
  taxAmount: 0.41,
  taxRate: 2.6,
  rounding: 0,
  total: 16,
  language: 'fr',
  paperWidthMm: 80,
  includeQr: false,
  showVat: true,
};

const text = generateWebPosReceiptText(receipt, 'fr');
assert.match(text, /PROVISIONAL/i);
assert.match(text, /Rue des Draizes 44/);

const stripped = stripPlainReceiptHeaderFromBody(text, headerLines, width, 'center', true);
assert.match(stripped, /PROVISIONAL/i);
assert.match(stripped, /Poulet mercredi/);
assert.equal(
  (stripped.match(/Rue des Draizes 44/g) || []).length,
  0,
  'provisional plain text must not keep the shop address under the bitmap header'
);
assert.equal((stripped.match(/CHE-131\.903\.128/g) || []).length, 0);
assert.equal((stripped.match(/Nova Portugália/g) || []).length, 0);

const staleCustom = [
  'PROVISIONAL',
  'Rue des Draizes 44',
  'Neuchâtel',
  'Tel: 032 558 45 65',
  'VAT: CHE-131.903.128',
  '-'.repeat(width),
  '1 x Poulet mercredi',
].join('\n');
const cleared = stripPlainReceiptHeaderFromBody(staleCustom, headerLines, width, 'left', false);
assert.match(cleared, /Poulet mercredi/);
assert.equal((cleared.match(/Rue des Draizes/g) || []).length, 0);

console.log('webpos-provisional-header.test.ts OK');
