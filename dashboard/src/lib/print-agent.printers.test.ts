/**
 * Saved receipt/kitchen printers must not be replaced after a PC restart.
 * Run: npx tsx --tsconfig tsconfig.json src/lib/print-agent.printers.test.ts
 * (also: node --test with source contracts below)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const printAgent = fs.readFileSync(path.join(dir, 'print-agent.ts'), 'utf8');
const webPos = fs.readFileSync(path.join(dir, '../pages/merchant/WebPos.tsx'), 'utf8');
const settings = fs.readFileSync(path.join(dir, '../pages/merchant/Settings.tsx'), 'utf8');
const agentServer = fs.readFileSync(path.join(dir, '../../../print-agent/server.js'), 'utf8');

assert.match(printAgent, /export function matchLivePrinterName/);
assert.match(printAgent, /Does not pick Windows default \/ first thermal \/ similar names/);
assert.match(printAgent, /Never drop a saved receipt\/kitchen printer/);
assert.match(printAgent, /if \(!resolved\) return p;/);
assert.match(printAgent, /\.filter\(\(x\) => x\.score >= 20\)/);

const resolveFn = printAgent.slice(
  printAgent.indexOf('export function resolveLivePrinterName'),
  printAgent.indexOf('const WEBPOS_PRINTER_STORAGE_KEY')
);
assert.match(resolveFn, /allowAutoHeal/);
assert.match(resolveFn, /return want \|\| null;/);
assert.ok(
  resolveFn.indexOf('defaultLivePrinter') < 0 || resolveFn.indexOf('allowAutoHeal') < resolveFn.indexOf('defaultLivePrinter'),
  'default printer fallback must stay behind allowAutoHeal'
);

assert.doesNotMatch(
  webPos.slice(webPos.indexOf('const healedLocal'), webPos.indexOf('setPrintSettings((ps)') + 400),
  /api\.put\('\/merchant\/settings'/
);
assert.match(webPos, /return resolveLivePrinterName\(trimmed, list\) \|\| trimmed;/);
assert.doesNotMatch(webPos, /suggestPrinterAutoHeal/);

assert.match(settings, /webPosPrinterSavedOffline/);
assert.doesNotMatch(
  settings.slice(settings.indexOf('const list = await listAgentPrinters()'), settings.indexOf('} catch {')),
  /api[\s\S]{0,80}put\('\/merchant\/settings'/
);

assert.match(agentServer, /\[int\]\$_\.PrinterStatus -ne 7/);
assert.doesNotMatch(agentServer, /PrinterStatus -ne 2/);

console.log('print-agent.printers.test.ts: ok');
