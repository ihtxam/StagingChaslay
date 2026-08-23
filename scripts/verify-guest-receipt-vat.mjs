/**
 * Guest receipt VAT smoke test (CH VAT-included merchandise).
 * Run: node scripts/verify-guest-receipt-vat.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function roundMoney2(amount) {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function extractNetFromGross(gross, ratePercent) {
  if (!Number.isFinite(gross) || gross <= 0 || ratePercent <= 0) return roundMoney2(gross);
  return roundMoney2(gross / (1 + ratePercent / 100));
}

function splitVatIncludedGross(gross, ratePercent) {
  const brut = roundMoney2(gross);
  if (brut <= 0 || ratePercent <= 0) return { net: brut, tax: 0, gross: brut };
  const net = extractNetFromGross(brut, ratePercent);
  const tax = roundMoney2(brut - net);
  return { net, tax, gross: brut };
}

function billMerchandiseTtc(tx) {
  const tip = roundMoney2(tx.tipAmount || 0);
  const rounding = roundMoney2(tx.rounding || 0);
  return roundMoney2(tx.total - tip - rounding);
}

function merchandiseBrutAfterDiscount(tx) {
  if (!tx.items?.length) return 0;
  const gross = roundMoney2(tx.items.reduce((sum, item) => sum + roundMoney2(item.lineTotal), 0));
  if (gross <= 0) return 0;
  const disc = roundMoney2(Math.max(0, tx.discount || 0));
  if (disc <= 0) return gross;
  return roundMoney2(Math.max(0, gross - Math.min(disc, gross)));
}

function resolveOrderReceiptVat(tx) {
  const rate = Number(tx.taxRate) || 0;
  const vatIncluded = tx.vatIncludedInPrice !== false;
  if (rate <= 0) return { subtotal: roundMoney2(tx.subtotal), taxAmount: 0, taxRate: rate };
  if (vatIncluded) {
    const fromItems = merchandiseBrutAfterDiscount(tx);
    const fromBill = billMerchandiseTtc(tx);
    let brut = fromBill > 0 ? fromBill : fromItems;
    if (fromBill > 0 && fromItems > 0 && Math.abs(fromItems - fromBill) > 0.02) {
      brut = fromBill;
    }
    const split = splitVatIncludedGross(brut, rate);
    return { subtotal: split.net, taxAmount: split.tax, taxRate: rate };
  }
  return { subtotal: roundMoney2(tx.subtotal), taxAmount: roundMoney2(tx.taxAmount), taxRate: rate };
}

const polacafeOrder = {
  businessName: 'PolaCafe',
  total: 16.6,
  tipAmount: 0,
  rounding: 0,
  discount: 9.35,
  taxRate: 2.6,
  vatIncludedInPrice: true,
  items: [{ name: 'Coffee', quantity: 1, unitPrice: 25.95, lineTotal: 25.95 }],
  subtotal: 25.32,
  taxAmount: 25.95,
};

const vat = resolveOrderReceiptVat(polacafeOrder);
const webposReceipt = readFileSync(join(root, 'dashboard/src/lib/webpos-receipt.ts'), 'utf8');
const androidReceipt = readFileSync(
  join(root, 'app/src/main/java/com/chaslay/pos/printer/BluetoothPrinterService.kt'),
  'utf8'
);
const androidCtx = readFileSync(
  join(root, 'app/src/main/java/com/chaslay/pos/printer/ReceiptPrintContext.kt'),
  'utf8'
);

const checks = [
  ['TVA is 0.42 for 16.60 TTC @ 2.6%', vat.taxAmount === 0.42],
  ['NET is 16.18 for 16.60 TTC @ 2.6%', vat.subtotal === 16.18],
  ['TVA is not stale subtotal 25.95', vat.taxAmount !== 25.95],
  ['webpos drops vatIncludedNote line', !webposReceipt.includes('vatIncludedNote.slice')],
  ['android drops terminal ref', !androidReceipt.includes('Terminal ref:')],
  ['android drops vat total summary', !androidReceipt.includes('labels.vatTotal, twoDp(vatTotal)')],
  ['android reconciles bill merchandise', androidCtx.includes('reconcileVatRowsToBillMerchandise')],
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

console.log('\nExample receipt VAT row (16.60 total):');
console.log(`  NET  ${vat.subtotal.toFixed(2)}  TVA  ${vat.taxAmount.toFixed(2)}  BRUT  ${(vat.subtotal + vat.taxAmount).toFixed(2)}`);

if (failed) process.exit(1);
console.log('\nAll guest receipt VAT checks passed.');
