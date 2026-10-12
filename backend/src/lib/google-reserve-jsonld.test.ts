import assert from "node:assert/strict";
import { buildGoogleReserveJsonLd, shopReservationsUrl } from "./google-reserve-jsonld";

assert.equal(
  shopReservationsUrl({ shopUrl: "https://brazza.example", publish: true }),
  "https://brazza.example/reservations"
);
assert.equal(
  shopReservationsUrl({
    shopUrl: "https://brazza.example",
    explicitReserveUrl: "https://reserve.google.com/brazza",
  }),
  "https://reserve.google.com/brazza"
);

const ld = buildGoogleReserveJsonLd({
  name: "Brazza Pizza",
  city: "Zürich",
  reserveUrl: "https://brazza.example/reservations",
});
assert.equal(ld["@type"], "FoodEstablishment");
assert.equal(ld.acceptsReservations, true);
assert.equal((ld.potentialAction as { target: string }).target, "https://brazza.example/reservations");

console.log("google-reserve-jsonld.test.ts ok");
