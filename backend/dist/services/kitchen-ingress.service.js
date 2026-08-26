"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.enterKitchenFromOrder = enterKitchenFromOrder;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
/** Push a persisted order to KDS + ODS (idempotent). Optional kitchen print enqueue. */
async function enterKitchenFromOrder(merchantId, orderId, opts) {
    const db = (0, db_1.getDb)();
    const order = await db.query.orders.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
        columns: {
            id: true,
            orderNumber: true,
            notes: true,
            status: true,
            orderSource: true,
            fulfillmentChannel: true,
        },
    });
    if (!order)
        return;
    void Promise.resolve().then(() => __importStar(require("@/services/kds.service"))).then(({ KdsService, KdsLicenseError }) => KdsService.pushOrderToKitchen(merchantId, orderId).catch((err) => {
        if (err instanceof KdsLicenseError)
            return;
        console.warn("Kitchen ingress KDS push failed:", err);
    }))
        .catch(() => { });
    void Promise.resolve().then(() => __importStar(require("@/services/ods.service"))).then(({ OdsService }) => OdsService.syncFromOrder(merchantId, order).catch(() => { }))
        .catch(() => { });
    if (opts?.printKitchen) {
        const src = opts.orderSource ||
            (order.orderSource === "justeat" || order.orderSource === "ubereats"
                ? order.orderSource
                : "online_shop");
        void Promise.resolve().then(() => __importStar(require("@/services/delivery-platform.service"))).then(({ DeliveryPlatformService }) => DeliveryPlatformService.enqueueAutoPrint(merchantId, orderId, src, {
            printKitchen: true,
            printDeliveryReceipt: false,
            printReceipt: false,
            printNotification: false,
        }).catch((err) => console.warn("Kitchen ingress print enqueue failed:", err)))
            .catch(() => { });
    }
}
//# sourceMappingURL=kitchen-ingress.service.js.map