"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * mailco attachment payload — run: npx tsx backend/src/lib/mailco-payload.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const mailco_payload_1 = require("./mailco-payload");
const pdfBytes = Buffer.from("%PDF-1.4\n%EOF");
const xlsxBytes = Buffer.from("PK\x03\x04");
strict_1.default.deepEqual((0, mailco_payload_1.buildMailcoAttachments)([]), []);
strict_1.default.deepEqual((0, mailco_payload_1.buildMailcoAttachments)(undefined), []);
const one = (0, mailco_payload_1.buildMailcoAttachments)([
    { filename: "INV-2026-00001.pdf", content: pdfBytes, contentType: "application/pdf" },
]);
strict_1.default.equal(one.length, 1);
strict_1.default.equal(one[0].name, "INV-2026-00001.pdf");
strict_1.default.equal(one[0].content_type, "application/pdf");
strict_1.default.equal(one[0].content, pdfBytes.toString("base64"));
const guessed = (0, mailco_payload_1.buildMailcoAttachments)([
    {
        filename: "sales-report.xlsx",
        content: xlsxBytes,
    },
])[0];
strict_1.default.equal(guessed.content_type, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
strict_1.default.equal(guessed.content, xlsxBytes.toString("base64"));
const payload = (0, mailco_payload_1.buildMailcoRawMessagePayload)({
    fromEmail: "noreply@rebornsense.com",
    fromName: "Reborn",
    to: "customer@example.com",
    replyToEmail: "shop@example.com",
    replyToName: "Shop",
    subject: "Invoice INV-1",
    html: "<p>Please see attached.</p>",
    text: "Please see attached.",
    emailType: "invoice",
    merchantId: "m-123",
    attachments: [{ filename: "INV-1.pdf", content: pdfBytes, contentType: "application/pdf" }],
});
strict_1.default.equal(payload.from.email, "noreply@rebornsense.com");
strict_1.default.equal(payload.from.name, "Reborn");
strict_1.default.equal(payload.to[0].email, "customer@example.com");
strict_1.default.equal(payload.reply_to?.email, "shop@example.com");
strict_1.default.equal(payload.reply_to?.name, "Shop");
strict_1.default.equal(payload.headers?.["Reply-To"], '"Shop" <shop@example.com>');
strict_1.default.equal(payload.subject, "Invoice INV-1");
strict_1.default.equal(payload.metadata.email_type, "invoice");
strict_1.default.equal(payload.metadata.merchant_id, "m-123");
strict_1.default.ok(payload.attachments?.length === 1);
strict_1.default.equal(payload.attachments?.[0].name, "INV-1.pdf");
const noAttach = (0, mailco_payload_1.buildMailcoRawMessagePayload)({
    fromEmail: "noreply@rebornsense.com",
    to: "a@b.com",
    subject: "Hi",
    html: "<p>Hi</p>",
});
strict_1.default.equal(noAttach.attachments, undefined);
strict_1.default.equal(noAttach.from.name, "Reborn");
strict_1.default.equal(noAttach.reply_to, undefined);
strict_1.default.equal(noAttach.headers, undefined);
const merchantOrder = (0, mailco_payload_1.buildMailcoRawMessagePayload)({
    fromEmail: "hello@rebornsense.com",
    fromName: "Pola Cafe",
    to: "guest@example.com",
    replyToEmail: "owner@polacafe.ch",
    replyToName: "Pola Cafe",
    subject: "Order confirmed",
    html: "<p>Thanks</p>",
    emailType: "shop_order",
    merchantId: "m-99",
});
strict_1.default.equal(merchantOrder.from.name, "Pola Cafe");
strict_1.default.equal(merchantOrder.reply_to?.email, "owner@polacafe.ch");
strict_1.default.equal(merchantOrder.reply_to?.name, "Pola Cafe");
strict_1.default.equal(merchantOrder.headers?.["Reply-To"], '"Pola Cafe" <owner@polacafe.ch>');
console.log("mailco-payload.test.ts: ok");
//# sourceMappingURL=mailco-payload.test.js.map