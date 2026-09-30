/**
 * Adyen terminal POI helpers — run: cd backend && npx tsx src/services/adyen-terminal-poi.service.test.ts
 */
import assert from "node:assert/strict";
import {
  buildTerminalSaleToAcquirerData,
  parseTerminalTipFromPaymentResponse,
} from "./adyen-terminal-poi.service.ts";

assert.equal(
  buildTerminalSaleToAcquirerData({ askGratuity: true }),
  "tenderOption=ReceiptHandler,AskGratuity"
);
assert.equal(buildTerminalSaleToAcquirerData(), "tenderOption=ReceiptHandler");

const fromAmounts = parseTerminalTipFromPaymentResponse({
  PaymentResult: {
    AmountsResp: {
      TipAmount: 2.5,
      AuthorizedAmount: 22.5,
    },
  },
});
assert.equal(fromAmounts.tipAmount, 2.5);
assert.equal(fromAmounts.authorizedAmount, 22.5);

const fromAdditional = parseTerminalTipFromPaymentResponse(
  {},
  "posAmountGratuityValue=350&authorisedAmountValue=2350"
);
assert.equal(fromAdditional.tipAmount, 3.5);
assert.equal(fromAdditional.authorizedAmount, 23.5);

console.log("adyen-terminal-poi.service.test.ts OK");
