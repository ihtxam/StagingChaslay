/**
 * BT/COM detection must not treat USB thermal names as slow radios.
 * Run: node --experimental-strip-types --test dashboard/src/lib/print-agent.bt.test.ts
 * (avoids importing print-agent.ts → api.ts / import.meta.env)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'print-agent.ts'), 'utf8');
const reLine = src.match(/const BT_COM_PRINTER_RE =\s*\/([^/\n]+)\/i/)?.[1] || '';

test('BT_COM_PRINTER_RE does not match USB thermal brand names', () => {
  assert.match(reLine, /com\\d\+/);
  assert.match(reLine, /bluetooth/);
  assert.doesNotMatch(reLine, /xprinter|gprinter|80mm|thermal|receipt|\brpp\b/);
  assert.match(src, /usb\\d\+\\b\|\\busb00\|usbprint/);
});

const BT_COM_PRINTER_RE =
  /com\d+|bthenum|\bbth\b|bluetooth|\bble\b|rfcomm|cpbt|serial over|bluetoothprinter|\bbt_/i;

type P = {
  name?: string;
  portName?: string;
  driverName?: string;
  matchHint?: string;
  connectionType?: string;
};

function looksLikeBluetoothOrComPrinter(printer?: P | string | null): boolean {
  if (!printer) return false;
  if (typeof printer === 'object' && printer.connectionType === 'bluetooth') return true;
  const blob =
    typeof printer === 'string'
      ? printer
      : [printer.portName, printer.connectionType, printer.name, printer.driverName, printer.matchHint]
          .filter(Boolean)
          .join(' ');
  if (/\busb\d+\b|\busb00|usbprint|\bdot4\b|\blpt\d*\b/i.test(blob) && !BT_COM_PRINTER_RE.test(blob)) {
    return false;
  }
  return BT_COM_PRINTER_RE.test(blob);
}

test('USB thermal queues are not treated as Bluetooth', () => {
  assert.equal(looksLikeBluetoothOrComPrinter({ name: 'XP-80C', portName: 'USB001' }), false);
  assert.equal(looksLikeBluetoothOrComPrinter('XP-80 Receipt'), false);
  assert.equal(looksLikeBluetoothOrComPrinter({ name: 'Thermal 80mm', portName: 'USB002' }), false);
});

test('COM and Bluetooth ports still match', () => {
  assert.equal(looksLikeBluetoothOrComPrinter({ name: 'RPP02', portName: 'COM7' }), true);
  assert.equal(looksLikeBluetoothOrComPrinter('RPP02 (COM12)'), true);
  assert.equal(
    looksLikeBluetoothOrComPrinter({
      name: 'Kitchen',
      portName: 'BTHENUM\\{00001101-0000-1000-8000-00805f9b34fb}_LOCALMFG',
    }),
    true
  );
  assert.equal(looksLikeBluetoothOrComPrinter({ name: 'Sunmi', connectionType: 'bluetooth' }), true);
});
