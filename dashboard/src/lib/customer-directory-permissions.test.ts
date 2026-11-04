import assert from 'node:assert/strict';
import { canAccessRoute } from './permissions';

const posStaff = ['USE_POS', 'USE_WEBPOS', 'PROCESS_PAYMENTS'] as const;

assert.equal(canAccessRoute('/merchant/customers', [...posStaff], false), true);
assert.equal(canAccessRoute('/merchant/customers', ['PROCESS_PAYMENTS'], false), false);
assert.equal(canAccessRoute('/merchant/customers', [], true), true);

console.log('customer-directory-permissions.test.ts ok');
