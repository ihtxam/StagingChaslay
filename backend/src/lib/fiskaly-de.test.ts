/**
 * Fiskaly DE helpers — run: npx tsx backend/src/lib/fiskaly-de.test.ts
 */
import assert from "node:assert/strict";
import { normalizeCountry } from "./fiskaly-settings.ts";
import {
  mapPaymentMethodToFiskalyDe,
  mapVatRateToFiskalyDe,
} from "../services/fiskaly-de.service.ts";

assert.equal(normalizeCountry("DE"), "DE");
assert.equal(normalizeCountry("Germany"), "DE");
assert.equal(normalizeCountry("FR"), "FR");
assert.equal(normalizeCountry("France"), "FR");
assert.equal(normalizeCountry("CH"), null);
assert.equal(normalizeCountry("Switzerland"), null);

assert.equal(mapVatRateToFiskalyDe(19), "NORMAL");
assert.equal(mapVatRateToFiskalyDe(19.0), "NORMAL");
assert.equal(mapVatRateToFiskalyDe(7), "REDUCED_1");
assert.equal(mapVatRateToFiskalyDe(7.0), "REDUCED_1");
assert.equal(mapVatRateToFiskalyDe(0), "NULL");

assert.equal(mapPaymentMethodToFiskalyDe("cash"), "CASH");
assert.equal(mapPaymentMethodToFiskalyDe("card"), "CARD");
assert.equal(mapPaymentMethodToFiskalyDe("terminal"), "CARD");
assert.equal(mapPaymentMethodToFiskalyDe("gift_card"), "NON_CASH");
assert.equal(mapPaymentMethodToFiskalyDe("invoice"), "NON_CASH");

console.log("fiskaly-de.test.ts: ok");
