/**
 * SMS templates — run: npx tsx backend/src/lib/sms-templates.test.ts
 */
import assert from "node:assert/strict";
import {
  gsmSegmentCount,
  normalizeSmsSettings,
  renderSmsTemplate,
  sanitizeSmsTemplate,
} from "./sms-templates";

assert.equal(sanitizeSmsTemplate("<b>Hi</b> {firstName}"), "Hi {firstName}");
assert.equal(
  renderSmsTemplate("{shopName}: order {orderNumber} ready{pickupTime}", {
    shopName: "Brazza",
    orderNumber: "A12",
    pickupTime: " at 18:00",
  }),
  "Brazza: order A12 ready at 18:00"
);
assert.equal(renderSmsTemplate("Hello {script}", { firstName: "Ada" }), "Hello");
assert.equal(
  renderSmsTemplate("Hi {firstName} <img src=x>", { firstName: "Ada" }),
  "Hi Ada"
);
assert.equal(gsmSegmentCount("a".repeat(160)), 1);
assert.equal(gsmSegmentCount("a".repeat(161)), 2);

const settings = normalizeSmsSettings({
  senderName: "My Shop!!",
  events: { orderPlaced: false },
  templates: { orderReady: "Ready {orderNumber}" },
});
assert.equal(settings.senderName, "My Shop");
assert.equal(settings.events.orderPlaced, false);
assert.equal(settings.events.orderReady, true);
assert.equal(settings.templates.orderReady, "Ready {orderNumber}");

console.log("sms-templates.test.ts: ok");
