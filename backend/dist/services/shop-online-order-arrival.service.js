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
exports.resolvePaidOnlineShopOrderStatus = resolvePaidOnlineShopOrderStatus;
exports.runOnlineShopOrderArrivalSideEffects = runOnlineShopOrderArrivalSideEffects;
exports.finalizePaidOnlineShopCardOrder = finalizePaidOnlineShopCardOrder;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const pos_print_settings_1 = require("@/lib/pos-print-settings");
const online_shop_auto_accept_1 = require("@/lib/online-shop-auto-accept");
const shop_adyen_session_1 = require("@/lib/shop-adyen-session");
const shop_loyalty_service_1 = require("@/services/shop-loyalty.service");
/** Status after card payment is confirmed for an online shop order. */
function resolvePaidOnlineShopOrderStatus(merchant, order) {
    const shopAutoAccept = (0, online_shop_auto_accept_1.shouldAutoAcceptOnlineShopOrder)(merchant, order);
    return shopAutoAccept ? "preparing" : "pending_approval";
}
/**
 * POS notification, kitchen ingress, guest emails — run when a paid online shop order
 * should appear in the merchant workflow (on create for cash, or after card confirm).
 */
async function runOnlineShopOrderArrivalSideEffects(merchant, order, opts) {
    if (order.orderType !== "web_shop")
        return;
    const shopAutoAccept = (0, online_shop_auto_accept_1.shouldAutoAcceptOnlineShopOrder)(merchant, order);
    const arrivalPrint = (0, pos_print_settings_1.normalizePosPrintSettings)(merchant.posPrintSettings);
    const kitchenOnArrival = !shopAutoAccept && arrivalPrint.autoPrintOnlineOrdersOnArrival === true;
    if (shopAutoAccept) {
        const { enterKitchenFromOrder } = await Promise.resolve().then(() => __importStar(require("@/services/kitchen-ingress.service")));
        void enterKitchenFromOrder(merchant.id, order.id, {
            printKitchen: true,
            orderSource: "online_shop",
        });
    }
    try {
        const { DeliveryPlatformService } = await Promise.resolve().then(() => __importStar(require("@/services/delivery-platform.service")));
        await DeliveryPlatformService.enqueueAutoPrint(merchant.id, order.id, "online_shop", {
            // Kitchen / delivery slips print on staff accept — not a separate arrival alert ticket.
            printDeliveryReceipt: false,
            printNotification: false,
            printKitchen: kitchenOnArrival,
            printReceipt: opts?.printGuestReceipt === true && order.fulfillmentChannel !== "delivery",
            independentOfMasterAutoPrint: kitchenOnArrival,
        });
    }
    catch (printErr) {
        console.warn("Shop order arrival print enqueue failed:", printErr);
    }
    try {
        const { ShopOrderEmailService } = await Promise.resolve().then(() => __importStar(require("@/services/shop-order-email.service")));
        await ShopOrderEmailService.sendGuestOrderEmail(merchant.id, order.id, "received", {
            guestLocale: opts?.guestLocale || null,
        });
        if (shopAutoAccept) {
            await ShopOrderEmailService.sendGuestOrderEmail(merchant.id, order.id, "confirmed", {
                guestLocale: opts?.guestLocale || null,
            });
        }
    }
    catch (mailErr) {
        console.warn("Shop order confirmation email failed:", mailErr);
    }
}
/**
 * After Adyen card payment: move order out of awaiting_payment and notify merchant workflow.
 * Idempotent when status is no longer awaiting_payment.
 */
async function finalizePaidOnlineShopCardOrder(merchant, order, opts) {
    const db = (0, db_1.getDb)();
    const unpaidShopCard = order.orderType === "web_shop" &&
        order.paymentStatus === "awaiting_payment" &&
        String(order.paymentMethod || "").toLowerCase() === "card";
    if (!unpaidShopCard) {
        try {
            return await shop_loyalty_service_1.ShopLoyaltyService.earnForPaidOrder(merchant, order);
        }
        catch (earnErr) {
            console.error("Loyalty earn on already-paid shop order failed:", earnErr);
            return order;
        }
    }
    const needsArrival = order.status === "awaiting_payment" ||
        order.status === "pending" ||
        order.status === "pending_approval";
    const tender = (0, shop_adyen_session_1.normalizeAdyenEcommerceTender)(opts?.adyenPaymentMethod);
    const patch = {
        paymentStatus: "completed",
        // Keep workflow key `card` (Adyen ecommerce). Surface TWINT via breakdown.
        paymentMethod: "card",
    };
    if (tender && tender !== "card") {
        const amount = parseFloat(order.total?.toString() || "0") || 0;
        patch.paymentBreakdown = [{ method: tender, amount }];
    }
    if (opts?.pspReference) {
        patch.adyenReference = opts.pspReference;
    }
    if (needsArrival) {
        patch.status = resolvePaidOnlineShopOrderStatus(merchant, order);
    }
    const [updated] = await db
        .update(db_1.schema.orders)
        .set(patch)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, order.id), (0, drizzle_orm_1.eq)(db_1.schema.orders.paymentStatus, "awaiting_payment")))
        .returning();
    if (!updated) {
        const current = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.orders.id, order.id),
        });
        const latest = current || order;
        try {
            return await shop_loyalty_service_1.ShopLoyaltyService.earnForPaidOrder(merchant, latest);
        }
        catch (earnErr) {
            console.error("Loyalty earn on paid shop order failed:", earnErr);
            return latest;
        }
    }
    if (needsArrival) {
        await runOnlineShopOrderArrivalSideEffects(merchant, updated, {
            guestLocale: opts?.guestLocale,
            printGuestReceipt: true,
        });
    }
    try {
        return await shop_loyalty_service_1.ShopLoyaltyService.earnForPaidOrder(merchant, updated);
    }
    catch (earnErr) {
        console.error("Loyalty earn on paid shop order failed:", earnErr);
        return updated;
    }
}
//# sourceMappingURL=shop-online-order-arrival.service.js.map