"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
dotenv_1.default.config();
async function main() {
    const result = await (0, ensure_merchant_schema_1.ensureAllMerchantSchema)();
    const stillMissing = [
        ...result.missingAfter,
        ...result.ordersMissing.map((c) => `orders.${c}`),
        ...result.orderItemsMissing.map((c) => `order_items.${c}`),
    ];
    if (stillMissing.length) {
        console.error("[schema-patches] still missing after repair:", stillMissing);
        process.exit(1);
    }
    console.log("[schema-patches] all required columns present");
}
main().catch((err) => {
    console.error("[schema-patches] failed:", err);
    process.exit(1);
});
//# sourceMappingURL=run-schema-patches.js.map