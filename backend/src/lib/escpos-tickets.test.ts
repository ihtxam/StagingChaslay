import assert from "node:assert/strict";
import {
  buildKitchenTicketLines,
  kitchenNotesForTicket,
  kitchenTicketEscPos,
  resolveKitchenTicketLang,
} from "./escpos-tickets";

assert.equal(resolveKitchenTicketLang("fr-CH"), "fr");
assert.equal(resolveKitchenTicketLang("de"), "de");
assert.equal(resolveKitchenTicketLang("en"), "en");

assert.equal(kitchenNotesForTicket("[Rounding +0.02]\nNo onions"), "No onions");
assert.equal(kitchenNotesForTicket("[Rounding -0.03]"), "");

const fr = buildKitchenTicketLines({
  orderNumber: "WEB-E348-1BLJ",
  orderSource: "online_shop",
  customerName: "Muhammad Ihtesham Asmat Hashmi",
  channel: "takeaway",
  scheduledFor: "2026-10-14T09:15:00.000Z",
  notes: "[Rounding +0.02]",
  language: "fr",
  kitchenPrepOnly: true,
  items: [
    { name: "Cappuccino", quantity: 1, extras: ["Oat milk"] },
    { name: "Club Sandwich", quantity: 1, extras: ["Whitebread", "Bacon"] },
  ],
  width: 42,
});

assert.equal(fr.header, "CUISINE");
assert.match(fr.lines[0] || "", /EMPORTER/);
assert.match(fr.lines[0] || "", /WEB-E348-1BLJ/);
assert.ok(fr.lines.some((l) => l.includes("Muhammad Ihtesham Asmat Hashmi")));
assert.ok(fr.lines.some((l) => l.startsWith("1 x Cappuccino")));
assert.ok(fr.lines.some((l) => l === "- Oat milk"));
assert.ok(fr.lines.some((l) => l === "Articles: 2"));
assert.ok(fr.lines.some((l) => /ONLINE SHOP/.test(l)));
assert.ok(!fr.lines.some((l) => /Rounding/.test(l)));
assert.ok(!fr.lines.some((l) => /^\d+x /.test(l)));
assert.ok(!fr.lines.some((l) => l.includes("+ Oat")));

const en = buildKitchenTicketLines({
  orderNumber: "WEB-1",
  orderSource: "online_shop",
  channel: "takeaway",
  language: "en",
  kitchenPrepOnly: true,
  items: [{ name: "Tea", quantity: 2 }],
  width: 42,
});
assert.equal(en.header, "KITCHEN");
assert.match(en.lines[0] || "", /TAKEAWAY/);
assert.ok(en.lines.some((l) => l === "Items: 2"));

const bytes = kitchenTicketEscPos({
  orderNumber: "WEB-1",
  language: "fr",
  kitchenPrepOnly: true,
  items: [{ name: "Tea", quantity: 1 }],
});
assert.ok(bytes.includes(Buffer.from("CUISINE")));
assert.ok(!bytes.includes(Buffer.from("KITCHEN")));

console.log("escpos-tickets.test.ts OK");
