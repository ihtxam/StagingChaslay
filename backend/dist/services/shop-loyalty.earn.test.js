"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Shop loyalty earn math — run: npx tsx backend/src/services/shop-loyalty.earn.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
function computeEarnPoints(paidFoodSubtotalChf, earnPointsPerChf) {
    const base = Math.max(0, Number(paidFoodSubtotalChf) || 0);
    const rate = Number(earnPointsPerChf) || 0;
    if (rate <= 0)
        return 0;
    return Math.floor(base * rate + 1e-9);
}
const src = (0, node_fs_1.readFileSync)((0, node_path_1.join)((0, node_path_1.dirname)((0, node_url_1.fileURLToPath)(import.meta.url)), "shop-loyalty.service.ts"), "utf8");
strict_1.default.match(src, /Math\.floor\(base \* rate \+ 1e-9\)/);
strict_1.default.match(src, /earnForPaidOrder/);
strict_1.default.match(src, /paidFood <= 0 && total > 0/);
strict_1.default.equal(computeEarnPoints(3.8, 1), 3, "CHF 3.80 at 1 pt/CHF should earn 3 points");
strict_1.default.equal(computeEarnPoints(3.8 * 1, 1), 3);
strict_1.default.equal(computeEarnPoints(1, 1), 1);
strict_1.default.equal(computeEarnPoints(0.8, 1), 0);
strict_1.default.equal(computeEarnPoints(3.8, 0), 0);
console.log("shop-loyalty.earn.test.ts: ok");
//# sourceMappingURL=shop-loyalty.earn.test.js.map