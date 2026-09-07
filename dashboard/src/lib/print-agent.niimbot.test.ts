/**
 * Niimbot label error toast — run: npx tsx dashboard/src/lib/print-agent.niimbot.test.ts
 */
import assert from 'node:assert/strict';
import { formatNiimbotLabelError, MIN_NIIMBOT_AGENT_VERSION } from './print-agent';

assert.equal(MIN_NIIMBOT_AGENT_VERSION, '1.10.13');

assert.match(
  formatNiimbotLabelError({
    agentMessage: "Print failed for 'NIIMBOT K3'",
    printerName: 'NIIMBOT K3',
    httpStatus: 500,
    health: { ok: true, version: '1.10.12', features: ['niimbot-label'] },
  }),
  /v1\.10\.12 is too old/
);

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
    agentMessage: 'Cannot POST /print/niimbot-label',
    printerName: 'NIIMBOT K3',
    httpStatus: 404,
    health: { ok: true, version: '1.9.8' },
  }),
  /too old/
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

// The real Windows exception must survive the toast formatter, not be replaced
// by a generic "label print failed".
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

console.log('print-agent.niimbot.test.ts ok');
