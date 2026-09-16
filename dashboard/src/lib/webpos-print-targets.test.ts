/**
 * Skip-print when no printer is configured — run:
 * npx tsx dashboard/src/lib/webpos-print-targets.test.ts
 */
import assert from 'node:assert/strict';
import { resolvePrintAttempt, shouldSkipAutoPrint } from './webpos-print-targets';

assert.deepEqual(
  resolvePrintAttempt({ roleTargets: [], fallbackName: '' }),
  { skip: true, names: [] },
  'no configured names → skip'
);

assert.deepEqual(
  resolvePrintAttempt({
    roleTargets: [{ name: 'POS-80' }],
    fallbackName: '',
    printersReady: true,
    livePrinters: [],
  }),
  { skip: true, names: [] },
  'stale Settings name + empty live list → skip'
);

assert.deepEqual(
  resolvePrintAttempt({
    roleTargets: [],
    fallbackName: 'POS-80',
    printersReady: true,
    livePrinters: [],
  }),
  { skip: true, names: [] },
  'leftover localStorage name + empty live list → skip'
);

assert.deepEqual(
  resolvePrintAttempt({
    roleTargets: [{ name: 'POS-80' }],
    fallbackName: '',
    printersReady: false,
    livePrinters: [],
  }),
  { skip: false, names: ['POS-80'] },
  'discovery not finished → still allow named print'
);

assert.deepEqual(
  resolvePrintAttempt({
    roleTargets: [{ name: '  Kitchen  ' }, { name: '' }],
    fallbackName: 'ignored',
    printersReady: true,
    livePrinters: [{ name: 'Kitchen' }],
  }),
  { skip: false, names: ['Kitchen'] },
  'role targets win over fallback and trim'
);

assert.equal(
  shouldSkipAutoPrint({ roleTargets: [], fallbackName: null, printersReady: true, livePrinters: [] }),
  true
);

assert.equal(
  shouldSkipAutoPrint({
    roleTargets: [{ name: 'BT-80' }],
    printersReady: true,
    livePrinters: [{ name: 'BT-80' }],
  }),
  false
);

assert.equal(
  shouldSkipAutoPrint({
    roleTargets: [{ name: 'POS-80' }],
    fallbackName: 'POS-80',
    printersReady: false,
    livePrinters: [],
    agentOk: false,
  }),
  true,
  'agent down → skip without another probe'
);

console.log('webpos-print-targets.test.ts: ok');
