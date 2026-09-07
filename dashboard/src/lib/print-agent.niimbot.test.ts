/**
 * Niimbot dashboard wiring — run:
 * npx tsx --test dashboard/src/lib/print-agent.niimbot.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  formatNiimbotLabelError,
  MIN_NIIMBOT_AGENT_VERSION,
  printNiimbotLabelViaAgent,
} from './print-agent';
import {
  niimbotTransportLabel,
  renderNiimbotBarsToast,
  NIIMBOT_NOT_REPORTED,
} from './niimbot-label';
import { translate, type Locale } from './i18n';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => fs.readFileSync(path.join(here, rel), 'utf8');

test('the dashboard requires the agent build that can diagnose a blank label', () => {
  assert.equal(MIN_NIIMBOT_AGENT_VERSION, '1.10.14');
  const src = read('print-agent.ts');
  assert.match(src, /profile: opts\.profile \|\| undefined/);
  assert.match(src, /invertBitmap: opts\.invertBitmap === true/);
  assert.match(src, /export function printerSelectValue/);
  assert.match(src, /export function findPrinterBySelectValue/);
  assert.match(src, /export async function probeNiimbotComPorts/);
  assert.match(src, /niimbot-label\/com-probe/);
});

/*
 * The merchant's toast read
 *   `Barres envoyées à NIIMBOT K3 via ? · profil=b21 · inkBytes=? · rowBytes=? · dim=?`
 * for a week. The placeholders were substituted correctly; the values were
 * missing, because printNiimbotLabelViaAgent returned four fields out of the
 * dozen the agent reports. Both halves are locked down here.
 */

const AGENT_REPLY = {
  ok: true,
  version: '1.10.14',
  printer: 'COM8',
  path: 'com',
  portSource: 'queue',
  baud: 115200,
  profile: 'b21',
  packetCount: 177,
  rasterLines: 160,
  bitmapNonZeroBytes: 3200,
  rasterRowBytes: 40,
  dimensionHex: '00a001400001',
  confirmed: true,
  answered: true,
};

const BARS_TEMPLATE =
  'Bars sent to {name} via {path} · profile={profile} · inkBytes={ink} · rowBytes={row} · dim={dim}';

test('the Test bars headline never renders a bare ? or an unsubstituted token', () => {
  const filled = renderNiimbotBarsToast(BARS_TEMPLATE, {
    name: 'NIIMBOT K3',
    result: AGENT_REPLY,
    protocol: 'b21',
  });
  assert.equal(filled.includes('?'), false, filled);
  assert.equal(/\{[a-zA-Z0-9_]+\}/.test(filled), false, filled);
  assert.match(filled, /inkBytes=3200/);
  assert.match(filled, /rowBytes=40/);
  assert.match(filled, /dim=00a001400001/);
  assert.match(filled, /via com COM8 @ 115200 baud/);

  // An agent that reports nothing must still not produce '?' or raw braces.
  const empty = renderNiimbotBarsToast(BARS_TEMPLATE, {
    name: 'NIIMBOT K3',
    result: {},
    protocol: 'b21',
    invert: true,
  });
  assert.equal(empty.includes('?'), false, empty);
  assert.equal(/\{[a-zA-Z0-9_]+\}/.test(empty), false, empty);
  assert.match(empty, /profile=b21\+invert/);
  assert.match(empty, new RegExp(`inkBytes=${NIIMBOT_NOT_REPORTED}`));

  // A template with a placeholder nobody fills is a bug, not a brace on screen.
  const stray = renderNiimbotBarsToast('{name} → {somethingNew}', {
    name: 'NIIMBOT K3',
    result: AGENT_REPLY,
    protocol: 'b21',
  });
  assert.equal(stray, `NIIMBOT K3 → ${NIIMBOT_NOT_REPORTED}`);
});

test('the agent profile wins over the local guess, so headline and fingerprint agree', () => {
  // The agent labels an inverted job 'b21+invert' itself; the headline must not
  // re-append the suffix, and must not disagree with the fingerprint text.
  const filled = renderNiimbotBarsToast(BARS_TEMPLATE, {
    name: 'NIIMBOT K3',
    result: { ...AGENT_REPLY, profile: 'b21+invert' },
    protocol: 'b21',
    invert: true,
  });
  assert.match(filled, /profile=b21\+invert /);
  assert.equal(filled.includes('b21+invert+invert'), false);
});

test('every Niimbot string uses the same placeholders in EN, FR and DE', () => {
  // A key whose translations disagree on placeholder names renders half a
  // sentence and half a template, which is how the FR toast came to say
  // `profil=b21` next to four unfilled values.
  const keys = [
    'testNiimbotBars',
    'testNiimbotBarsInvert',
    'testNiimbotBarsOk',
    'testNiimbotBarsUnconfirmed',
    'testNiimbotBarsConfirmed',
    'testNiimbotBarsFailed',
    'niimbotProbeTitle',
    'niimbotProbeHint',
    'niimbotProbeRun',
    'niimbotProbeRunning',
    'niimbotProbeCopy',
    'niimbotProbeCopyFailed',
  ];
  const locales: Locale[] = ['en', 'fr', 'de'];
  const placeholders = (text: string) => (text.match(/\{[a-zA-Z0-9_]+\}/g) || []).sort().join(',');
  for (const key of keys) {
    const en = translate('en', key);
    assert.notEqual(en, key, `${key} is missing from the English dictionary`);
    for (const locale of locales) {
      const text = translate(locale, key);
      assert.notEqual(text, key, `${key} is missing from the ${locale} dictionary`);
      assert.equal(
        placeholders(text),
        placeholders(en),
        `${key} in ${locale} does not use the same placeholders as English`
      );
    }
  }

  // And the call site fills exactly the placeholders the template declares.
  const template = translate('fr', 'testNiimbotBarsOk');
  const filled = renderNiimbotBarsToast(template, {
    name: 'NIIMBOT K3',
    result: AGENT_REPLY,
    protocol: 'b21',
  });
  assert.equal(filled.includes('?'), false, filled);
  assert.equal(/\{[a-zA-Z0-9_]+\}/.test(filled), false, filled);
  assert.match(filled, /NIIMBOT K3/);
});

test('the transport label names the port and where it came from', () => {
  assert.equal(
    niimbotTransportLabel({ path: 'com', printer: 'COM8', baud: 115200, portSource: 'queue' }),
    'com COM8 @ 115200 baud (port=queue-bound)'
  );
  assert.equal(niimbotTransportLabel({ path: 'usb:USB005' }), 'usb:USB005');
  assert.equal(niimbotTransportLabel({}), NIIMBOT_NOT_REPORTED);
});

test('the toast stays in one language whichever locale renders it', () => {
  // A clause of English inside a French sentence looks like a broken template,
  // which is exactly what this whole change set exists to stop.
  for (const locale of ['fr', 'de'] as Locale[]) {
    const rendered = renderNiimbotBarsToast(translate(locale, 'testNiimbotBarsOk'), {
      name: 'NIIMBOT K3',
      result: { path: 'com', printer: 'COM8', baud: 115200, portSource: 'queue' },
      protocol: 'b21',
    });
    assert.equal(/[a-z] the [a-z]/.test(rendered), false, rendered);
    assert.match(rendered, /port=queue-bound/);
  }
});

test('every field the agent reports reaches the caller', async () => {
  const globals = globalThis as unknown as {
    window?: unknown;
    fetch?: unknown;
  };
  const priorWindow = globals.window;
  const priorFetch = globals.fetch;
  globals.window = { setTimeout, clearTimeout };
  globals.fetch = async () =>
    ({
      ok: true,
      status: 200,
      json: async () => AGENT_REPLY,
    }) as unknown as Response;
  try {
    const result = await printNiimbotLabelViaAgent({
      printerName: 'NIIMBOT K3',
      widthPx: 320,
      heightPx: 160,
      testPattern: true,
    });
    assert.equal(result.path, 'com');
    assert.equal(result.baud, 115200);
    assert.equal(result.portSource, 'queue');
    assert.equal(result.bitmapNonZeroBytes, 3200);
    assert.equal(result.rasterRowBytes, 40);
    assert.equal(result.dimensionHex, '00a001400001');
    assert.equal(result.confirmed, true);
    assert.equal(result.unconfirmed, false);
  } finally {
    globals.window = priorWindow;
    globals.fetch = priorFetch;
  }
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
      health: { ok: true, version: '1.10.14', features: ['niimbot-label'] },
    }),
    "WritePrinter failed for 'NIIMBOT K3' (Win32=5)"
  );
  assert.match(
    formatNiimbotLabelError({
      agentMessage:
        "Niimbot COM3 is already open at 115200 baud. Close NIIMBOT.exe (and any other app holding the port), then retry. — Access to the port 'COM3' is denied.",
      printerName: 'NIIMBOT K3',
      httpStatus: 500,
      health: { ok: true, version: '1.10.14', features: ['niimbot-label'] },
    }),
    /Access to the port 'COM3' is denied\./
  );
  assert.match(
    formatNiimbotLabelError({
      agentMessage:
        'Niimbot COM6 did not answer at 115200 baud. This is what a Bluetooth incoming/unconnected port does — connect the printer in Windows Bluetooth settings and use its outgoing port. — The semaphore timeout period has expired.',
      printerName: 'NIIMBOT K3',
      httpStatus: 500,
      health: { ok: true, version: '1.10.14', features: ['niimbot-label'] },
    }),
    /The semaphore timeout period has expired\./
  );
});

test('printer select values distinguish USB005 from COM6', () => {
  const src = read('print-agent.ts');
  assert.match(src, /port \? `\$\{name\}\|\|\|\$\{port\}` : name/);
  assert.match(src, /seen\.has\(key\)/);
});

test('Test bars keeps the selected USB005 and never rewrites it to COM6', () => {
  const src = read('niimbot-label.ts');
  assert.match(src, /export function resolveNiimbotTestPortName/);
  assert.match(src, /export function extractNiimbotUsbPort/);
  assert.match(src, /savedUsb/);
  assert.equal(src.includes("extractNiimbotComPort(ap.portName, ap.name) === 'COM6'"), false);
});

test('the canvas is clamped to the printhead of the model in use', () => {
  const src = read('niimbot-label.ts');
  // The K3 prints 80 mm at 203 dpi; clamping it to the B21's 384 throws away
  // almost half the label width.
  assert.match(src, /NIIMBOT_K3_PRINTHEAD_PX = 640/);
  assert.match(src, /NIIMBOT_PRINTHEAD_PX = 384/);
  assert.match(src, /export function niimbotPrintheadPx/);
});
