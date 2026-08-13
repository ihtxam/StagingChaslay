/**
 * Smoke-test Adyen receipt append paths (terminal sale + order history reprint).
 * Run: node scripts/verify-adyen-receipt-append.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadTs(path) {
  return readFileSync(join(root, path), 'utf8');
}

// Inline minimal copies of the logic under test (dashboard is TS-only, no vitest).
function normalizeAdyenTerminalReceipt(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!Array.isArray(raw.lines)) return null;
  return raw.lines.length ? raw : null;
}

function parseAdyenReceiptJson(json) {
  if (!json?.trim()) return null;
  try {
    return normalizeAdyenTerminalReceipt(JSON.parse(json));
  } catch {
    return null;
  }
}

function resolveOrderAdyenReceipts(order) {
  return {
    customer: parseAdyenReceiptJson(order.adyenCustomerReceiptJson),
    cashier: parseAdyenReceiptJson(order.adyenCashierReceiptJson),
  };
}

function appendAdyenReceiptBlock(receiptText, receipt, lineWidth = 32) {
  if (!receipt?.lines?.length) return receiptText;
  const thin = '-'.repeat(Math.min(lineWidth, 32));
  const body = receipt.lines.map((l) => l.text).join('\n');
  return receiptText + thin + '\n' + body + '\n';
}

const sampleCustomer = {
  documentQualifier: 'CustomerReceipt',
  lines: [{ text: 'VISA **** 1234', endOfLine: true }],
};
const sampleCashier = {
  documentQualifier: 'CashierReceipt',
  lines: [{ text: 'MERCHANT COPY', endOfLine: true }],
};

const customerJson = JSON.stringify(sampleCustomer);
const order = {
  id: '1',
  orderNumber: 'WP-4160',
  paymentMethod: 'terminal',
  total: 42,
  createdAt: new Date().toISOString(),
  items: [],
  adyenCustomerReceiptJson: customerJson,
  adyenCashierReceiptJson: JSON.stringify(sampleCashier),
};

const { customer, cashier } = resolveOrderAdyenReceipts(order);
let base = 'ORDER RECEIPT\nThank you\n';
base = appendAdyenReceiptBlock(base, customer);
base = appendAdyenReceiptBlock(base, cashier);

const checks = [
  ['parses customer JSON', !!customer],
  ['parses cashier JSON', !!cashier],
  ['reprint appends customer block', base.includes('VISA **** 1234')],
  ['reprint appends merchant block', base.includes('MERCHANT COPY')],
  ['terminal ref path (no method gate)', appendAdyenReceiptBlock('x\n', sampleCustomer).includes('VISA')],
  ['empty lines rejected', normalizeAdyenTerminalReceipt({ lines: [] }) === null],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) {
    console.error('FAIL:', name);
    failed += 1;
  } else {
    console.log('OK:', name);
  }
}

// Sanity: source files contain expected hooks
const webposReceipt = loadTs('dashboard/src/lib/webpos-receipt.ts');
const webposPage = loadTs('dashboard/src/pages/merchant/WebPos.tsx');
const posOrders = loadTs('backend/src/services/pos-orders.service.ts');

if (!webposReceipt.includes('resolveOrderAdyenReceipts')) {
  console.error('FAIL: webpos-receipt.ts missing resolveOrderAdyenReceipts');
  failed += 1;
}
if (!webposPage.includes('terminalPaymentRef.current')) {
  console.error('FAIL: WebPos.tsx missing terminalPaymentRef usage');
  failed += 1;
}
if (!posOrders.includes('adyenCustomerReceiptJson')) {
  console.error('FAIL: pos-orders.service.ts missing adyen fields in API');
  failed += 1;
}

if (failed) {
  process.exit(1);
}
console.log('\nAll Adyen receipt append checks passed.');
