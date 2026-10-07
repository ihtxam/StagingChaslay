"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const shop_request_host_1 = require("./shop-request-host");
(0, vitest_1.describe)("shop-request-host", () => {
    (0, vitest_1.it)("detects shop path hub hosts", () => {
        (0, vitest_1.expect)((0, shop_request_host_1.isShopPathHubHost)("order.rebornsense.com")).toBe(true);
        (0, vitest_1.expect)((0, shop_request_host_1.isShopPathHubHost)("shop.chaslay.com")).toBe(true);
        (0, vitest_1.expect)((0, shop_request_host_1.isShopPathHubHost)("app.rebornsense.com")).toBe(false);
    });
    (0, vitest_1.it)("extracts slug from path hub URLs", () => {
        (0, vitest_1.expect)((0, shop_request_host_1.shopSlugFromPath)("/brazza-pizza/menu")).toBe("brazza-pizza");
        (0, vitest_1.expect)((0, shop_request_host_1.shopSlugFromPath)("/api/shop/demo")).toBeNull();
    });
    (0, vitest_1.it)("treats custom domains as shop hosts", () => {
        (0, vitest_1.expect)((0, shop_request_host_1.isShopRequestHost)({
            host: "www.brazzapizza.ch",
        })).toBe(true);
        (0, vitest_1.expect)((0, shop_request_host_1.isShopRequestHost)({
            host: "app.rebornsense.com",
        })).toBe(false);
    });
});
//# sourceMappingURL=shop-request-host.test.js.map