/**
 * Order label barcode helpers — run: npx tsx dashboard/src/lib/order-label-barcode.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildOrderLabelBarcode,
  buildOrderLabelData,
  orderLabelMetaLine,
  parseOrderLabelBarcode,
} from './order-label-barcode';

const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const code = buildOrderLabelBarcode(id);
assert.equal(code, `REBORN:O:${id}`);
assert.equal(parseOrderLabelBarcode(code), id);
assert.equal(parseOrderLabelBarcode(code.toLowerCase()), id);
assert.equal(parseOrderLabelBarcode('123456'), null);
assert.equal(parseOrderLabelBarcode('REBORN:T:shop:table-id'), null);

const data = buildOrderLabelData(id, [
  { name: 'Beef mince', lineTotal: 12.5, weightKg: 0.75, isWeighed: true },
  { name: 'Pork chops', lineTotal: 8.2, weightKg: 0.42, isWeighed: true },
]);
assert.equal(data.heldId, id);
assert.equal(data.price, 20.7);
assert.equal(data.weightKg, 1.17);
assert.match(data.productName, /Beef mince \+1/);
assert.equal(data.barcode, buildOrderLabelBarcode(id));
assert.match(orderLabelMetaLine(data), /20\.70/);
assert.match(orderLabelMetaLine(data), /1\.170 kg/);

console.log('order-label-barcode.test.ts OK');
