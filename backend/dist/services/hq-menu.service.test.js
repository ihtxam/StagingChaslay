"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
/** Mirrors hq-menu.service selection parsing. */
function readMenuSelection(input) {
    const stringArray = (raw) => Array.isArray(raw) ? raw.map((x) => String(x || "").trim()).filter(Boolean) : [];
    return {
        productIds: stringArray(input.productIds ?? input.product_ids),
        categoryIds: stringArray(input.categoryIds ?? input.category_ids),
    };
}
(0, vitest_1.describe)("HQ menu selection payload", () => {
    (0, vitest_1.it)("accepts camelCase and snake_case", () => {
        (0, vitest_1.expect)(readMenuSelection({
            product_ids: ["p1"],
            category_ids: ["c1", "c2"],
        })).toEqual({ productIds: ["p1"], categoryIds: ["c1", "c2"] });
    });
    (0, vitest_1.it)("prefers explicit camelCase when both sent", () => {
        (0, vitest_1.expect)(readMenuSelection({
            productIds: ["a"],
            product_ids: ["b"],
            categoryIds: ["x"],
            category_ids: ["y"],
        })).toEqual({ productIds: ["a"], categoryIds: ["x"] });
    });
});
//# sourceMappingURL=hq-menu.service.test.js.map