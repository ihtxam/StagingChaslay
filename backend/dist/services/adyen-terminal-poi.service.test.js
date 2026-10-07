"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Adyen terminal POI helpers — run: cd backend && npx tsx src/services/adyen-terminal-poi.service.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const adyen_terminal_poi_service_ts_1 = require("./adyen-terminal-poi.service.ts");
strict_1.default.equal((0, adyen_terminal_poi_service_ts_1.buildTerminalSaleToAcquirerData)({ askGratuity: true }), "tenderOption=ReceiptHandler,AskGratuity");
strict_1.default.equal((0, adyen_terminal_poi_service_ts_1.buildTerminalSaleToAcquirerData)(), "tenderOption=ReceiptHandler");
const fromAmounts = (0, adyen_terminal_poi_service_ts_1.parseTerminalTipFromPaymentResponse)({
    PaymentResult: {
        AmountsResp: {
            TipAmount: 2.5,
            AuthorizedAmount: 22.5,
        },
    },
});
strict_1.default.equal(fromAmounts.tipAmount, 2.5);
strict_1.default.equal(fromAmounts.authorizedAmount, 22.5);
const fromAdditional = (0, adyen_terminal_poi_service_ts_1.parseTerminalTipFromPaymentResponse)({}, "posAmountGratuityValue=350&authorisedAmountValue=2350");
strict_1.default.equal(fromAdditional.tipAmount, 3.5);
strict_1.default.equal(fromAdditional.authorizedAmount, 23.5);
console.log("adyen-terminal-poi.service.test.ts OK");
//# sourceMappingURL=adyen-terminal-poi.service.test.js.map