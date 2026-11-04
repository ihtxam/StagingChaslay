/**
 * Run: cd dashboard && npx tsx src/lib/terminal-register-error.test.ts
 */
import assert from 'node:assert/strict';
import {
  terminalDuplicateDetailSuffix,
  terminalRegisterErrorMessage,
} from './terminal-register-error.ts';

{
  assert.equal(
    terminalDuplicateDetailSuffix({ name: 'X', slug: 'brazza', supportCode: 'CH-1' }),
    ' (brazza, CH-1)'
  );
  assert.equal(terminalDuplicateDetailSuffix({ name: 'X', slug: null, supportCode: null }), '');
}

{
  const msg = terminalRegisterErrorMessage(
    {
      response: {
        data: {
          registeredToMerchant: { name: 'Brazza Cafe', slug: 'brazza-cafe' },
        },
      },
    },
    (key, params) => `${key}:${params?.name}${params?.detail ?? ''}`,
    'failedAddTerminal'
  );
  assert.match(msg, /Brazza Cafe/);
  assert.match(msg, /brazza-cafe/);
}

console.log('terminal-register-error.test.ts: ok');
