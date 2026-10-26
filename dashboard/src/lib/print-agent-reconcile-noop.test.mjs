/**
 * Guard: reconcilePosPrinterProfiles must normalise portName on BOTH sides
 * before deciding a profile changed.
 *
 * A live printer with no port reports `undefined`; a stored profile holds
 * `null`. Comparing them unnormalised made every pass report changed=true,
 * so WebPOS re-saved byte-identical settings every 12 seconds — ~7k pointless
 * merchant-row writes per Android till per day.
 *
 * Run: node dashboard/src/lib/print-agent-reconcile-noop.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(root, 'print-agent.ts'), 'utf8');

// Both sides must be coalesced to null before comparing.
assert.match(
  src,
  /if \(resolved === name && \(picked\?\.portName \?\? null\) === \(p\.portName \?\? null\)\) return p;/,
  'reconcilePosPrinterProfiles must compare (picked?.portName ?? null) with (p.portName ?? null)'
);

// The unnormalised form must not come back.
assert.doesNotMatch(
  src,
  /picked\?\.portName === \(p\.portName \?\? null\)/,
  'raw undefined-vs-null portName comparison reintroduced — phantom "changed" returns'
);

console.log('print-agent-reconcile-noop.test.mjs ok');
