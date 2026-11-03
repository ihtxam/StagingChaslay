/**
 * Run: cd dashboard && npx tsx src/lib/login-form-credentials.test.ts
 */
import assert from 'node:assert/strict';
import { readLoginFormCredentials } from './login-form-credentials.ts';

assert.deepEqual(
  readLoginFormCredentials({ email: ' Info@Melimelo.ch ', password: 'secret' }),
  { email: 'info@melimelo.ch', password: 'secret' }
);

console.log('login-form-credentials.test.ts: ok');
