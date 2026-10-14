import assert from "node:assert/strict";
import { buildReservationSms } from "./reservation-guest-sms";

const wait = buildReservationSms({
  kind: "waitlist",
  locale: "fr",
  shopName: "Brazza",
  guestName: "Ada",
  when: "14.10.2026 19:00",
  partySize: 4,
  quotedWaitMinutes: 25,
});
assert.equal(wait.locale, "fr");
assert.match(wait.body, /liste d'attente/);
assert.match(wait.body, /25/);

const ready = buildReservationSms({
  kind: "table_ready",
  locale: "de",
  shopName: "Brazza",
  guestName: "Ada",
  when: "heute 19:00",
  partySize: 2,
});
assert.match(ready.body, /Tisch ist bereit/);

console.log("reservation-guest-sms.test.ts ok");
