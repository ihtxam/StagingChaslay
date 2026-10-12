import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isResellerOwnedTicket,
  parseResellerTicketIdFromPath,
  resellerTicketAlertPath,
  supportAttachmentOwnerKey,
  supportTicketStatusAfterReply,
} from './support-ticket-reseller';

describe('support-ticket-reseller', () => {
  it('treats requesterRole=reseller as agency-owned', () => {
    assert.equal(isResellerOwnedTicket({ requesterRole: 'reseller', merchantId: null }), true);
    assert.equal(isResellerOwnedTicket({ requesterRole: 'merchant', merchantId: 'm1' }), false);
    assert.equal(isResellerOwnedTicket({ requesterRole: null, merchantId: null }), true);
    assert.equal(isResellerOwnedTicket({ requesterRole: null, merchantId: 'm1' }), false);
  });

  it('reopens when the reseller replies on their own ticket', () => {
    assert.equal(
      supportTicketStatusAfterReply({
        authorRole: 'reseller',
        requesterRole: 'reseller',
        merchantId: null,
      }),
      'open'
    );
    assert.equal(
      supportTicketStatusAfterReply({
        authorRole: 'superadmin',
        requesterRole: 'reseller',
        merchantId: null,
      }),
      'answered'
    );
    assert.equal(
      supportTicketStatusAfterReply({
        authorRole: 'reseller',
        requesterRole: 'merchant',
        merchantId: 'm1',
      }),
      'answered'
    );
    assert.equal(
      supportTicketStatusAfterReply({
        authorRole: 'merchant',
        requesterRole: 'merchant',
        merchantId: 'm1',
      }),
      'open'
    );
    assert.equal(
      supportTicketStatusAfterReply({
        closeTicket: true,
        authorRole: 'reseller',
        requesterRole: 'reseller',
      }),
      'closed'
    );
  });

  it('stores reseller attachments under reseller/{id}', () => {
    assert.equal(supportAttachmentOwnerKey({ merchantId: 'm1' }), 'm1');
    assert.equal(supportAttachmentOwnerKey({ resellerId: 'r1' }), 'reseller/r1');
  });

  it('builds and parses the reseller inbox deep link', () => {
    assert.equal(resellerTicketAlertPath('t1'), '/reseller/support?ticket=t1');
    assert.equal(parseResellerTicketIdFromPath('/reseller/support?ticket=t1'), 't1');
    assert.equal(parseResellerTicketIdFromPath('/merchant/support?ticket=t1'), null);
  });
});
