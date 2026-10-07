"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADYEN_SUCCESS_RESULT_CODES = void 0;
exports.isAdyenPaymentSuccess = isAdyenPaymentSuccess;
exports.ADYEN_SUCCESS_RESULT_CODES = [
    "Authorised",
    "Received",
    "Pending",
    "PresentToShopper",
];
function isAdyenPaymentSuccess(resultCode) {
    const code = String(resultCode || "").trim();
    return exports.ADYEN_SUCCESS_RESULT_CODES.includes(code);
}
//# sourceMappingURL=adyen-result-codes.js.map