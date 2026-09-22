/**
 * mailco attachment payload — run: npx tsx backend/src/lib/mailco-payload.test.ts
 */
import assert from "node:assert/strict";
import { buildMailcoAttachments, buildMailcoRawMessagePayload } from "./mailco-payload";

const pdfBytes = Buffer.from("%PDF-1.4\n%EOF");
const xlsxBytes = Buffer.from("PK\x03\x04");

assert.deepEqual(buildMailcoAttachments([]), []);
assert.deepEqual(buildMailcoAttachments(undefined), []);

const one = buildMailcoAttachments([
  { filename: "INV-2026-00001.pdf", content: pdfBytes, contentType: "application/pdf" },
]);
assert.equal(one.length, 1);
assert.equal(one[0].name, "INV-2026-00001.pdf");
assert.equal(one[0].content_type, "application/pdf");
assert.equal(one[0].content, pdfBytes.toString("base64"));

const guessed = buildMailcoAttachments([
  {
    filename: "sales-report.xlsx",
    content: xlsxBytes,
  },
])[0];
assert.equal(guessed.content_type, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
assert.equal(guessed.content, xlsxBytes.toString("base64"));

const payload = buildMailcoRawMessagePayload({
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

assert.equal(payload.from.email, "noreply@rebornsense.com");
assert.equal(payload.to[0].email, "customer@example.com");
assert.equal(payload.reply_to?.[0].email, "shop@example.com");
assert.equal(payload.subject, "Invoice INV-1");
assert.equal(payload.metadata.email_type, "invoice");
assert.equal(payload.metadata.merchant_id, "m-123");
assert.ok(payload.attachments?.length === 1);
assert.equal(payload.attachments?.[0].name, "INV-1.pdf");

const noAttach = buildMailcoRawMessagePayload({
  fromEmail: "noreply@rebornsense.com",
  to: "a@b.com",
  subject: "Hi",
  html: "<p>Hi</p>",
});
assert.equal(noAttach.attachments, undefined);

console.log("mailco-payload.test.ts: ok");
