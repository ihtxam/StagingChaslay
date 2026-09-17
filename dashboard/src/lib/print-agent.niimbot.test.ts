/**
 * Niimbot label error toast — run: npx tsx dashboard/src/lib/print-agent.niimbot.test.ts
 */
import assert from 'node:assert/strict';
import { formatNiimbotLabelError, MIN_NIIMBOT_AGENT_VERSION } from './print-agent';

assert.equal(MIN_NIIMBOT_AGENT_VERSION, '1.10.2');

assert.match(
  formatNiimbotLabelError({
    agentMessage: "Print failed for 'NIIMBOT K3'",
    printerName: 'NIIMBOT K3',
    httpStatus: 500,
    health: { ok: true, version: '1.10.1', features: ['niimbot-label'] },
  }),
  /v1\.10\.1 is too old/
);

assert.equal(
  formatNiimbotLabelError({
    agentMessage: "WritePrinter failed for 'NIIMBOT K3' (Win32=5)",
    printerName: 'NIIMBOT K3',
    httpStatus: 500,
    health: { ok: true, version: '1.10.2', features: ['niimbot-label'] },
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
    agentMessage: "Niimbot COM3 is in use or access denied (close NIIMBOT.exe)",
    printerName: 'NIIMBOT K3',
    httpStatus: 500,
    health: { ok: true, version: '1.10.2', features: ['niimbot-label'] },
  }),
  /COM3 is in use/
);

console.log('print-agent.niimbot.test.ts ok');
