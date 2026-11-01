import assert from 'node:assert/strict';
import {
  isDrawerKickBase64,
  isEscPosBase64,
  isTsplRawBase64,
  isValidAgentRawPrintBase64,
} from './escpos-payload.ts';

const escInit = Buffer.from([0x1b, 0x40, 0x1b, 0x61, 0x01]).toString('base64');
assert.equal(isEscPosBase64(escInit), true);
assert.equal(isValidAgentRawPrintBase64(escInit), true);

assert.equal(isDrawerKickBase64('G3AAGfo='), true);
assert.equal(isEscPosBase64('G3AAGfo='), false);
assert.equal(isValidAgentRawPrintBase64('G3AAGfo='), true);

const tspl = Buffer.from('SIZE 40 mm,30 mm\r\nGAP 2 mm,0 mm\r\n', 'ascii').toString('base64');
assert.equal(isTsplRawBase64(tspl), true);
assert.equal(isEscPosBase64(tspl), false);
assert.equal(isValidAgentRawPrintBase64(tspl), true);

assert.equal(isValidAgentRawPrintBase64(''), false);
assert.equal(isValidAgentRawPrintBase64('not-valid!!!'), false);

console.log('escpos-payload.test.mjs ok');
