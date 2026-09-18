"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Shop order email copy — run: npx tsx backend/src/lib/transactional-email-labels.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const transactional_email_labels_1 = require("./transactional-email-labels");
const confirmed = (0, transactional_email_labels_1.shopOrderEmailCopy)('confirmed', 'Cafe Gandhi', 'WEB-FD09-12', 'en');
strict_1.default.match(confirmed.subject, /WEB-FD09-12/);
strict_1.default.match(confirmed.body.toLowerCase(), /accepted/);
const merchant = (0, transactional_email_labels_1.merchantNewOrderEmailCopy)('Cafe Gandhi', 'WEB-FD09-12', 'en');
strict_1.default.match(merchant.subject, /WEB-FD09-12/);
strict_1.default.match(merchant.body.toLowerCase(), /order/);
strict_1.default.equal((0, transactional_email_labels_1.shopOrderTrackLabel)('en'), 'Track your order');
strict_1.default.equal((0, transactional_email_labels_1.shopOrderReadyLabel)('en'), 'Estimated time');
console.log('transactional-email-labels.test.ts ok');
//# sourceMappingURL=transactional-email-labels.test.js.map