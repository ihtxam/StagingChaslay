import assert from 'node:assert/strict';
import { isResellerOwnedTicket, supportTicketOwnerTitle } from './support-ticket-owner';

assert.equal(isResellerOwnedTicket({ requesterRole: 'reseller', merchantId: null }), true);
assert.equal(isResellerOwnedTicket({ requesterRole: 'merchant', merchantId: 'm1' }), false);
assert.equal(
  supportTicketOwnerTitle({
    requesterRole: 'reseller',
    reseller: { name: 'Chaslay' },
    subject: 'Printer down',
  }),
  'Chaslay'
);
assert.equal(
  supportTicketOwnerTitle({
    requesterRole: 'merchant',
    merchant: { name: 'Brazza' },
    subject: 'Printer down',
  }),
  'Brazza'
);

console.log('support-ticket-owner.test.ts: ok');
