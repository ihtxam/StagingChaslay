/**
 * Niimbot dashboard wiring — run:
 * npx tsx --test dashboard/src/lib/print-agent.niimbot.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { formatNiimbotLabelError, MIN_NIIMBOT_AGENT_VERSION } from './print-agent';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => fs.readFileSync(path.join(here, rel), 'utf8');

test('the dashboard requires the agent build that can diagnose a blank label', () => {
  assert.equal(MIN_NIIMBOT_AGENT_VERSION, '1.10.13');
  const src = read('print-agent.ts');
  assert.match(src, /export async function probeNiimbotComPorts/);
  assert.match(src, /niimbot-label\/com-probe/);
});

test('an older agent is named as the reason, not a generic failure', () => {
  assert.match(
    formatNiimbotLabelError({
      agentMessage: "Print failed for 'NIIMBOT K3'",
      printerName: 'NIIMBOT K3',
      httpStatus: 500,
      health: { ok: true, version: '1.10.12', features: ['niimbot-label'] },
    }),
    /v1\.10\.12 is too old/
  );
  assert.match(
    formatNiimbotLabelError({
      agentMessage: 'Cannot POST /print/niimbot-label',
      printerName: 'NIIMBOT K3',
      httpStatus: 404,
      health: { ok: true, version: '1.9.8' },
    }),
    /too old/
  );
  assert.match(read('print-agent.ts'), /need v\$\{MIN_NIIMBOT_AGENT_VERSION\}\+/);
});

test('the real Windows exception survives the toast formatter', () => {
  assert.equal(
    formatNiimbotLabelError({
      agentMessage: "WritePrinter failed for 'NIIMBOT K3' (Win32=5)",
      printerName: 'NIIMBOT K3',
      httpStatus: 500,
      health: { ok: true, version: '1.10.13', features: ['niimbot-label'] },
    }),
    "WritePrinter failed for 'NIIMBOT K3' (Win32=5)"
  );
  assert.match(
    formatNiimbotLabelError({
      agentMessage:
        "Niimbot COM3 is already open at 115200 baud. Close NIIMBOT.exe (and any other app holding the port), then retry. — Access to the port 'COM3' is denied.",
      printerName: 'NIIMBOT K3',
      httpStatus: 500,
      health: { ok: true, version: '1.10.13', features: ['niimbot-label'] },
    }),
    /Access to the port 'COM3' is denied\./
  );
  assert.match(
    formatNiimbotLabelError({
      agentMessage:
        'Niimbot COM6 did not answer at 115200 baud. This is what a Bluetooth incoming/unconnected port does — connect the printer in Windows Bluetooth settings and use its outgoing port. — The semaphore timeout period has expired.',
      printerName: 'NIIMBOT K3',
      httpStatus: 500,
      health: { ok: true, version: '1.10.13', features: ['niimbot-label'] },
    }),
    /The semaphore timeout period has expired\./
  );
});
