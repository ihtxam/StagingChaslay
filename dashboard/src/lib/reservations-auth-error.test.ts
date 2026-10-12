/**
 * Run: npx tsx dashboard/src/lib/reservations-auth-error.test.ts
 */
import assert from 'node:assert/strict';
import { isMissingAuthorizationError } from './reservations-auth-error.ts';

assert.equal(
  isMissingAuthorizationError({
    response: { status: 401, data: { error: 'Missing or invalid authorization header' } },
  }),
  true
);
assert.equal(isMissingAuthorizationError({ response: { status: 401, data: {} } }), true);
assert.equal(
  isMissingAuthorizationError({
    response: { status: 400, data: { error: 'Missing or invalid authorization header' } },
  }),
  true
);
assert.equal(
  isMissingAuthorizationError({ response: { status: 500, data: { error: 'Failed to list' } } }),
  false
);
assert.equal(isMissingAuthorizationError(new Error('network')), false);

console.log('reservations-auth-error.test.ts: ok');
