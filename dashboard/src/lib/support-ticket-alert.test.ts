import assert from 'node:assert/strict';
import {
  isInternalPanelPath,
  parseSupportTicketIdFromPath,
  supportTicketAlertPath,
} from './support-ticket-alert.ts';

assert.equal(supportTicketAlertPath('abc-1'), '/merchant/support?ticket=abc-1');
assert.equal(parseSupportTicketIdFromPath('/merchant/support?ticket=abc-1'), 'abc-1');
assert.equal(parseSupportTicketIdFromPath('/merchant/support?ticket=abc-1&x=1'), 'abc-1');
assert.equal(parseSupportTicketIdFromPath('/merchant/guides'), null);
assert.equal(parseSupportTicketIdFromPath('/merchant/support'), null);
assert.equal(parseSupportTicketIdFromPath('https://app.example/merchant/support?ticket=z'), 'z');
assert.equal(isInternalPanelPath('/merchant/support?ticket=abc-1'), true);
assert.equal(isInternalPanelPath('https://status.rebornsense.com/'), false);

console.log('support-ticket-alert.test.ts: ok');
