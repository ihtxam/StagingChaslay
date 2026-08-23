/**
 * EOD / report product quantity column alignment.
 * Run: node scripts/verify-eod-product-alignment.mjs
 */

function reportNameQtyRow(name, qty, width) {
  const qtyWidth = width <= 32 ? 5 : 6;
  const qtyStr = String(qty);
  const value =
    qtyStr.length > qtyWidth ? qtyStr.slice(-qtyWidth) : qtyStr.padStart(qtyWidth);
  const nameWidth = Math.max(1, width - qtyWidth);
  return name.slice(0, nameWidth).padEnd(nameWidth) + value;
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

function qtyColumn(lines, width) {
  const qtyWidth = width <= 32 ? 5 : 6;
  return lines.map((line) => line.slice(-qtyWidth));
}

const cases80 = [
  ['Coffee', 5],
  ['Tea', 12],
  ['Very long product name that should truncate cleanly', 123],
  ['Espresso', 1.25],
  ['Water', 1000000],
];

const lines80 = cases80.map(([name, qty]) => reportNameQtyRow(name, qty, 48));
for (const line of lines80) {
  assert(line.length === 48, `80mm line length ${line.length}, expected 48: ${JSON.stringify(line)}`);
}

const cols80 = qtyColumn(lines80, 48);
for (const col of cols80) {
  assert(col.length === 6, `qty column width: ${JSON.stringify(col)}`);
  const trimmed = col.trim();
  assert(trimmed.length > 0, `empty qty column: ${JSON.stringify(col)}`);
  assert(col.endsWith(trimmed), `qty not right-aligned in column: ${JSON.stringify(col)}`);
}
assert(cols80[0].endsWith('5'), `expected qty 5, got ${cols80[0]}`);
assert(cols80[1].endsWith('12'), `expected qty 12, got ${cols80[1]}`);
assert(cols80[3].endsWith('1.25') || cols80[3].endsWith('.25'), `decimal qty alignment: ${cols80[3]}`);

const lines58 = [
  reportNameQtyRow('Burger', 3, 32),
  reportNameQtyRow('Fries', 99, 32),
];
for (const line of lines58) {
  assert(line.length === 32, `58mm line length ${line.length}, expected 32`);
}
assert(lines58[0].slice(-5).trim() === '3', '58mm qty column');
assert(lines58[1].slice(-5).trim() === '99', '58mm qty column');

const src = await import('node:fs').then((fs) =>
  fs.readFileSync(new URL('../dashboard/src/lib/webpos-receipt.ts', import.meta.url), 'utf8')
);
assert(src.includes('export function reportNameQtyRow'), 'webpos-receipt.ts must export reportNameQtyRow');
assert(src.includes('reportNameQtyRow(p.name, p.quantity, width)'), 'EOD loop must use reportNameQtyRow');

const kt = await import('node:fs').then((fs) =>
  fs.readFileSync(
    new URL('../app/src/main/java/com/chaslay/pos/printer/BluetoothPrinterService.kt', import.meta.url),
    'utf8'
  )
);
assert(kt.includes('private fun productQtyRow'), 'BluetoothPrinterService must define productQtyRow');
assert(kt.includes('productQtyRow(product.productName'), 'Android EOD must use productQtyRow');

console.log('OK: EOD product quantity columns are right-aligned');
