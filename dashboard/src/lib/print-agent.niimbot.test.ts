/**
 * Niimbot dashboard wiring — run:
 * node --experimental-strip-types --test dashboard/src/lib/print-agent.niimbot.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const here = path.dirname(fileURLToPath(import.meta.url));

test('MIN_NIIMBOT_AGENT_VERSION is 1.10.12', () => {
  const src = fs.readFileSync(path.join(here, 'print-agent.ts'), 'utf8');
  assert.match(src, /export const MIN_NIIMBOT_AGENT_VERSION = '1.10.12'/);
  assert.match(src, /profile: opts.profile \|\| undefined/);
  assert.match(src, /invertBitmap: opts.invertBitmap === true/);
  assert.match(src, /export function printerSelectValue/);
  assert.match(src, /export function findPrinterBySelectValue/);
});

test('printer select values distinguish USB005 vs COM6', () => {
  const src = fs.readFileSync(path.join(here, 'print-agent.ts'), 'utf8');
  assert.match(src, /port \? `\$\{name\}\|\|\|\$\{port\}` : name/);
  assert.match(src, /seen.has\(key\)/);
});

test('niimbot-label.ts keeps USB005 for Test bars and does not rewrite to COM6', () => {
  const src = fs.readFileSync(path.join(here, 'niimbot-label.ts'), 'utf8');
  assert.match(src, /export function resolveNiimbotTestPortName/);
  assert.match(src, /export function extractNiimbotUsbPort/);
  assert.match(src, /savedUsb/);
  assert.equal(src.includes("extractNiimbotComPort(ap.portName, ap.name) === 'COM6'"), false);
});

test('formatNiimbotLabelError still prefers the agent Open() / COM message', () => {
  const src = fs.readFileSync(path.join(here, 'print-agent.ts'), 'utf8');
  assert.match(src, /export function formatNiimbotLabelError/);
  assert.match(src, /need v\$\{MIN_NIIMBOT_AGENT_VERSION\}\+/);
});
