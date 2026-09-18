"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureSubscriptionSchemaAtStartup = ensureSubscriptionSchemaAtStartup;
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
let startupPatchPromise = null;
/** Apply editions + subscription_plans column patches via raw pg (Drizzle execute often no-ops). */
function ensureSubscriptionSchemaAtStartup() {
    if (startupPatchPromise)
        return;
    startupPatchPromise = (0, ensure_merchant_schema_1.ensureSubscriptionPlansSchema)().catch((err) => {
        console.warn("[schema] subscription startup patch failed:", err);
        startupPatchPromise = null;
    });
}
//# sourceMappingURL=ensure-subscription-schema.js.map