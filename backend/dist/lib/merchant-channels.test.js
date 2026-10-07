"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const merchant_channels_1 = require("./merchant-channels");
(0, vitest_1.describe)("merchant-channels", () => {
    (0, vitest_1.it)("defaults channels to enabled", () => {
        (0, vitest_1.expect)((0, merchant_channels_1.isMerchantFulfillmentChannelEnabled)({}, "takeaway")).toBe(true);
        (0, vitest_1.expect)((0, merchant_channels_1.isMerchantFulfillmentChannelEnabled)({}, "delivery")).toBe(true);
        (0, vitest_1.expect)((0, merchant_channels_1.isMerchantFulfillmentChannelEnabled)({}, "dine_in")).toBe(true);
    });
    (0, vitest_1.it)("respects disabled flags", () => {
        (0, vitest_1.expect)((0, merchant_channels_1.isMerchantFulfillmentChannelEnabled)({ pickupEnabled: false, deliveryEnabled: true }, "takeaway")).toBe(false);
        (0, vitest_1.expect)((0, merchant_channels_1.isMerchantFulfillmentChannelEnabled)({ pickupEnabled: true, deliveryEnabled: false }, "delivery")).toBe(false);
    });
});
//# sourceMappingURL=merchant-channels.test.js.map