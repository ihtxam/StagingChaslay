/**
 * Phone-ordering webhook parse — run: npx tsx backend/src/lib/phone-ordering-webhook.test.ts
 */
import assert from "node:assert/strict";
import {
  extractWebhookSecret,
  isPhoneOrderSource,
  parsePhoneInbound,
  phoneCreateAllowsEmptyItems,
  phoneTicketNotes,
  PHONE_ORDER_SOURCE,
} from "./phone-ordering-webhook.ts";

const twilioSms = parsePhoneInbound({
  From: "+41791234567",
  To: "+41215550101",
  Body: "2 pizzas for 19:30",
  MessageSid: "SM123",
});
assert.equal(twilioSms.kind, "sms");
assert.equal(twilioSms.from, "+41791234567");
assert.equal(twilioSms.body, "2 pizzas for 19:30");
assert.match(phoneTicketNotes(twilioSms), /Inbound SMS/);

const twilioVoice = parsePhoneInbound({
  From: "+41790000000",
  CallSid: "CA999",
  CallStatus: "completed",
  CallerName: "Ada",
});
assert.equal(twilioVoice.kind, "voice");
assert.equal(twilioVoice.customerName, "Ada");

const generic = parsePhoneInbound({
  from: "+41791111111",
  message: "Please call back",
  customerName: "Sam",
});
assert.equal(generic.kind, "generic");
assert.equal(generic.from, "+41791111111");

assert.equal(
  extractWebhookSecret({
    headers: { "X-Webhook-Secret": "abc" },
    query: {},
    body: {},
  }),
  "abc"
);
assert.equal(
  extractWebhookSecret({
    headers: { authorization: "Bearer tok" },
    query: {},
    body: {},
  }),
  "tok"
);
assert.equal(
  extractWebhookSecret({
    headers: {},
    query: { secret: "q" },
    body: {},
  }),
  "q"
);

assert.equal(isPhoneOrderSource("phone"), true);
assert.equal(isPhoneOrderSource("PHONE"), true);
assert.equal(isPhoneOrderSource("online_shop"), false);
assert.equal(phoneCreateAllowsEmptyItems(PHONE_ORDER_SOURCE, 0), true);
assert.equal(phoneCreateAllowsEmptyItems("pos", 0), false);
assert.equal(phoneCreateAllowsEmptyItems("pos", 2), true);

console.log("phone-ordering-webhook.test.ts: ok");
