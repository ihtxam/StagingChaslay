"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const license_routes_1 = __importDefault(require("./license.routes"));
const pos_auth_routes_1 = __importDefault(require("./pos-auth.routes"));
const sync_routes_1 = __importDefault(require("./sync.routes"));
const orders_routes_1 = __importDefault(require("./orders.routes"));
const receipts_routes_1 = __importDefault(require("./receipts.routes"));
const floor_routes_1 = __importDefault(require("./floor.routes"));
const pos_sessions_routes_1 = __importDefault(require("./pos-sessions.routes"));
const invoice_routes_1 = require("@/routes/invoice.routes");
const chaslay_api_key_middleware_1 = require("@/middleware/chaslay-api-key.middleware");
/**
 * Chaslay / FoodTruck Android POS compatibility routes.
 * Mounted at /v1/* to match Retrofit interfaces in the Android app.
 */
const router = (0, express_1.Router)();
router.use("/license", license_routes_1.default);
router.use("/pos/auth", pos_auth_routes_1.default);
router.use("/sync", sync_routes_1.default);
router.use("/orders", orders_routes_1.default);
router.use("/receipts", receipts_routes_1.default);
router.use("/invoices", chaslay_api_key_middleware_1.requireChaslayApiKey, (0, invoice_routes_1.chaslayInvoiceRouter)());
router.use("/floor", floor_routes_1.default);
router.use("/pos/sessions", pos_sessions_routes_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map