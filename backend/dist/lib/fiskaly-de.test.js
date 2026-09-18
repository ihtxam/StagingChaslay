"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Fiskaly DE helpers — run: npx tsx backend/src/lib/fiskaly-de.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const fiskaly_settings_ts_1 = require("./fiskaly-settings.ts");
const fiskaly_de_service_ts_1 = require("../services/fiskaly-de.service.ts");
strict_1.default.equal((0, fiskaly_settings_ts_1.normalizeCountry)("DE"), "DE");
strict_1.default.equal((0, fiskaly_settings_ts_1.normalizeCountry)("Germany"), "DE");
strict_1.default.equal((0, fiskaly_settings_ts_1.normalizeCountry)("FR"), "FR");
strict_1.default.equal((0, fiskaly_settings_ts_1.normalizeCountry)("France"), "FR");
strict_1.default.equal((0, fiskaly_settings_ts_1.normalizeCountry)("CH"), null);
strict_1.default.equal((0, fiskaly_settings_ts_1.normalizeCountry)("Switzerland"), null);
strict_1.default.equal((0, fiskaly_de_service_ts_1.mapVatRateToFiskalyDe)(19), "NORMAL");
strict_1.default.equal((0, fiskaly_de_service_ts_1.mapVatRateToFiskalyDe)(19.0), "NORMAL");
strict_1.default.equal((0, fiskaly_de_service_ts_1.mapVatRateToFiskalyDe)(7), "REDUCED_1");
strict_1.default.equal((0, fiskaly_de_service_ts_1.mapVatRateToFiskalyDe)(7.0), "REDUCED_1");
strict_1.default.equal((0, fiskaly_de_service_ts_1.mapVatRateToFiskalyDe)(0), "NULL");
strict_1.default.equal((0, fiskaly_de_service_ts_1.mapPaymentMethodToFiskalyDe)("cash"), "CASH");
strict_1.default.equal((0, fiskaly_de_service_ts_1.mapPaymentMethodToFiskalyDe)("card"), "CARD");
strict_1.default.equal((0, fiskaly_de_service_ts_1.mapPaymentMethodToFiskalyDe)("terminal"), "CARD");
strict_1.default.equal((0, fiskaly_de_service_ts_1.mapPaymentMethodToFiskalyDe)("gift_card"), "NON_CASH");
strict_1.default.equal((0, fiskaly_de_service_ts_1.mapPaymentMethodToFiskalyDe)("invoice"), "NON_CASH");
console.log("fiskaly-de.test.ts: ok");
//# sourceMappingURL=fiskaly-de.test.js.map