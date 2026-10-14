import assert from 'node:assert/strict';
import {
  parseSupportTicketIdFromPath,
  staffCanSeeSupportAlerts,
  supportTicketAlertPath,
} from './support-ticket-alert.ts';

assert.equal(supportTicketAlertPath('t1'), '/merchant/support?ticket=t1');
assert.equal(parseSupportTicketIdFromPath('/merchant/support?ticket=t1'), 't1');
assert.equal(staffCanSeeSupportAlerts(['USE_POS']), false);
assert.equal(staffCanSeeSupportAlerts(['ACCESS_PANEL', 'USE_POS']), true);
assert.equal(staffCanSeeSupportAlerts(null), false);

console.log('support-ticket-alert.test.ts: ok');
