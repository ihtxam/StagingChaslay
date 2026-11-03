import assert from 'node:assert/strict';
import {
  agentPrintValidationErrorMessage,
  classifyAgentPrintBase64,
  isDrawerKickBase64,
  isEscPosBase64,
  isEscPosCutTrailerBase64,
  isTsplRawBase64,
  isValidAgentRawPrintBase64,
  normalizeAgentPrintBase64,
} from './escpos-payload.ts';

const escInit = Buffer.from([0x1b, 0x40, 0x1b, 0x61, 0x01]).toString('base64');
assert.equal(isEscPosBase64(escInit), true);
assert.equal(isValidAgentRawPrintBase64(escInit), true);

assert.equal(isDrawerKickBase64('G3AAGfo='), true);
assert.equal(isEscPosBase64('G3AAGfo='), false);
assert.equal(isValidAgentRawPrintBase64('G3AAGfo='), true);

const pin5 = Buffer.from([0x1b, 0x70, 0x01, 0x19, 0xfa]).toString('base64');
assert.equal(isDrawerKickBase64(pin5), true);
assert.equal(isValidAgentRawPrintBase64(pin5), true);

const tspl = Buffer.from('SIZE 40 mm,30 mm\r\nGAP 2 mm,0 mm\r\n', 'ascii').toString('base64');
assert.equal(isTsplRawBase64(tspl), true);
assert.equal(isEscPosBase64(tspl), false);
assert.equal(isValidAgentRawPrintBase64(tspl), true);

const cutOnly = Buffer.from([0x1d, 0x56, 0x00]).toString('base64');
assert.equal(isEscPosCutTrailerBase64(cutOnly), true);
assert.equal(isValidAgentRawPrintBase64(cutOnly), true);

const shortInit = Buffer.from([0x1b, 0x40]).toString('base64');
assert.equal(shortInit.length, 4);
assert.equal(isEscPosBase64(shortInit), true);

const wrapped = normalizeAgentPrintBase64(`${escInit.slice(0, 4)}\n${escInit.slice(4)}`);
assert.equal(isValidAgentRawPrintBase64(wrapped), true);

assert.equal(isValidAgentRawPrintBase64(''), false);
assert.equal(classifyAgentPrintBase64(''), 'empty');
assert.equal(isValidAgentRawPrintBase64('not-valid!!!'), false);
assert.equal(classifyAgentPrintBase64('not-valid!!!'), 'invalid_base64');
assert.match(agentPrintValidationErrorMessage('empty'), /empty/i);

console.log('escpos-payload.test.mjs ok');
