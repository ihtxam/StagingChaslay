/**
 * Bluetooth printer list: dedupe by Bridge id / MAC, not display name only.
 * Run: node print-agent-android/bluetooth-printer-names.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)));
const names = readFileSync(join(root, 'app/src/main/java/com/rebornsense/printbridge/print/BluetoothPrinterNames.kt'), 'utf8');
const registry = readFileSync(join(root, 'app/src/main/java/com/rebornsense/printbridge/print/DriverRegistry.kt'), 'utf8');
const http = readFileSync(join(root, 'app/src/main/java/com/rebornsense/printbridge/http/BridgeHttpServer.kt'), 'utf8');

assert.match(names, /disambiguateBluetoothPrinterNames/);
assert.match(registry, /disambiguateBluetoothPrinterNames\(usbFound \+ others\)/);
assert.match(http, /put\("id", ep\.id\)/);
assert.match(http, /put\("address", it\)/);

const dash = readFileSync(join(root, '../dashboard/src/lib/print-agent.ts'), 'utf8');
assert.match(dash, /export function agentPrinterListKey/);
assert.match(dash, /connectionType === 'bluetooth' && addr\)/);

console.log('bluetooth-printer-names.test.mjs ok');
