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
exports.SyncService = void 0;
const text_encoding_1 = require("@/lib/text-encoding");
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const floor_plan_service_1 = require("@/services/floor-plan.service");
const money_1 = require("@/lib/money");
const pos_print_settings_1 = require("@/lib/pos-print-settings");
const order_item_name_1 = require("@/lib/order-item-name");
const payment_breakdown_1 = require("@/lib/payment-breakdown");
const TICKET_NOTE_RE = /\[ticket:([^\]]+)\]/i;
const TAB_NOTE_RE = /\[tab:([^\]]+)\]/i;
function encodeOrderMetaNotes(opts) {
    let base = String(opts.existing || "")
        .replace(TICKET_NOTE_RE, "")
        .replace(TAB_NOTE_RE, "")
        .replace(/\s{2,}/g, " ")
        .replace(/^[·\s]+|[·\s]+$/g, "")
        .trim();
    const tags = [];
    const ticket = opts.ticketDisplay?.trim();
    const tab = opts.tabNumber != null ? String(opts.tabNumber).trim() : "";
    if (ticket)
        tags.push(`[ticket:${ticket.replace(/[\[\]]/g, "")}]`);
    if (tab)
        tags.push(`[tab:${tab.replace(/[\[\]]/g, "")}]`);
    const joined = [...tags, base].filter(Boolean).join(" ").trim();
    return joined || null;
}
function normalizeFulfillmentChannel(sale) {
    const raw = String(sale.fulfillmentChannel || sale.channel || sale.fulfillment_type || sale.fulfillmentType || "")
        .toLowerCase()
        .replace(/-/g, "_");
    if (raw === "dine_in" || raw === "dinein")
        return "dine_in";
    if (raw === "delivery")
        return "delivery";
    if (raw === "pickup" || raw === "takeaway" || raw === "walk_in" || raw === "walkin") {
        return "takeaway";
    }
    return "takeaway";
}
function parseScheduledFor(sale) {
    if (sale.scheduledFor != null && sale.scheduledFor !== "") {
        const d = new Date(sale.scheduledFor);
        if (!Number.isNaN(d.getTime()))
            return d;
    }
    const ms = Number(sale.pickup_time_ms ?? sale.pickupTimeMs);
    if (Number.isFinite(ms) && ms > 1000000)
        return new Date(ms);
    return null;
}
function asUuidOrNull(v) {
    if (v == null || v === "")
        return null;
    const s = String(v).trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
        return null;
    }
    return s;
}
function isUniqueViolation(err) {
    const e = err;
    return (e?.code === "23505" ||
        e?.cause?.code === "23505" ||
        /duplicate key|unique constraint/i.test(String(e?.message || err || "")));
}
class SyncService {
    /**
     * Pull catalog changes for offline POS devices.
     */
    static async pullCatalog(merchantId, since) {
        const db = (0, db_1.getDb)();
        const sinceDate = since || new Date(0);
        const [categories, products, terminals, readers, merchant, onlineOrders] = await Promise.all([
            db.query.categories.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId), (0, drizzle_orm_1.gt)(db_1.schema.categories.updatedAt, sinceDate)),
            }),
            db.query.products.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.gt)(db_1.schema.products.updatedAt, sinceDate)),
            }),
            db.query.paymentTerminals.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.paymentTerminals.merchantId, merchantId),
            }),
            db.query.rfidReaders.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.rfidReaders.merchantId, merchantId),
            }),
            db.query.merchants.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            }),
            // Online shop orders for POS ongoing board (new + kitchen + ready/delivery)
            db.query.orders.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.orders.orderType, "web_shop"), (0, drizzle_orm_1.inArray)(db_1.schema.orders.status, [
                    "pending",
                    "pending_approval",
                    "accepted",
                    "preparing",
                    "ready",
                    "out_for_delivery",
                ])),
                with: { items: true, customer: true },
                limit: 100,
                orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.orders.createdAt)],
            }),
        ]);
        const diningTables = await floor_plan_service_1.FloorPlanService.listTablesForSync(merchantId);
        const { ReservationService } = await Promise.resolve().then(() => __importStar(require("@/services/reservation.service")));
        const reservations = merchant?.reservationsEnabled
            ? await ReservationService.listForSync(merchantId)
            : [];
        return {
            serverTime: new Date().toISOString(),
            categories,
            products,
            terminals: terminals.map((t) => ({
                id: t.id,
                terminalId: t.terminalId,
                terminalName: t.terminalName,
                serialNumber: t.serialNumber,
                status: t.status,
                adyenMerchantAccount: t.adyenMerchantAccount,
                adyenClientId: t.adyenClientId,
            })),
            rfidReaders: readers,
            onlineOrders,
            diningTables,
            reservations,
            merchantSettings: merchant
                ? {
                    taxTakeawayRate: merchant.taxTakeawayRate,
                    taxDineInRate: merchant.taxDineInRate,
                    taxDeliveryRate: merchant.taxDeliveryRate,
                    vatRate: merchant.vatRate,
                    slug: merchant.slug,
                    subdomain: merchant.subdomain,
                    shopEnabled: merchant.shopEnabled,
                    floorPlanEnabled: merchant.floorPlanEnabled,
                    paxOrderingEnabled: merchant.paxOrderingEnabled,
                    reservationsEnabled: merchant.reservationsEnabled,
                    adyenMerchantAccount: merchant.adyenMerchantAccount,
                    adyenClientId: merchant.adyenClientId,
                    panelLanguage: merchant.panelLanguage,
                }
                : null,
        };
    }
    /**
     * Upsert categories/products created offline on the device.
     */
    static async pushCatalog(merchantId, payload) {
        const db = (0, db_1.getDb)();
        const categoryMap = new Map();
        const productMap = new Map();
        for (const cat of payload.categories || []) {
            const existing = await db.query.categories.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.categories.clientId, cat.clientId)),
            });
            if (existing) {
                await db
                    .update(db_1.schema.categories)
                    .set({
                    name: (0, text_encoding_1.repairCatalogText)(cat.name),
                    description: cat.description,
                    sortOrder: cat.sortOrder || 0,
                    color: cat.color,
                    updatedAt: new Date(),
                })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.categories.id, existing.id));
                categoryMap.set(cat.clientId, existing.id);
            }
            else {
                const [created] = await db
                    .insert(db_1.schema.categories)
                    .values({
                    merchantId,
                    clientId: cat.clientId,
                    name: (0, text_encoding_1.repairCatalogText)(cat.name),
                    description: cat.description,
                    sortOrder: cat.sortOrder || 0,
                    color: cat.color,
                })
                    .returning();
                categoryMap.set(cat.clientId, created.id);
            }
        }
        for (const product of payload.products || []) {
            let categoryId = product.categoryId;
            if (!categoryId && product.categoryClientId) {
                categoryId = categoryMap.get(product.categoryClientId);
                if (!categoryId) {
                    const linked = await db.query.categories.findFirst({
                        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.categories.clientId, product.categoryClientId)),
                    });
                    categoryId = linked?.id;
                }
            }
            const existing = await db.query.products.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.products.clientId, product.clientId)),
            });
            const values = {
                merchantId,
                clientId: product.clientId,
                name: (0, text_encoding_1.repairCatalogText)(product.name),
                price: product.price.toString(),
                categoryId,
                sku: product.sku,
                barcode: product.barcode,
                stock: product.stock ?? 0,
                isTaxable: product.isTaxable !== false,
                description: product.description,
                productType: product.productType || "standard",
                isOpenPrice: !!product.isOpenPrice,
                soldByWeight: !!product.soldByWeight,
                weightUnit: product.weightUnit || "kg",
                bulkPricing: product.bulkPricing || [],
                extras: product.extras || [],
                comboItems: product.comboItems || [],
                allowExtras: !!product.allowExtras,
                sortOrder: product.sortOrder ?? 0,
                updatedAt: new Date(),
            };
            if (existing) {
                await db.update(db_1.schema.products).set(values).where((0, drizzle_orm_1.eq)(db_1.schema.products.id, existing.id));
                productMap.set(product.clientId, existing.id);
            }
            else {
                const [created] = await db.insert(db_1.schema.products).values(values).returning();
                productMap.set(product.clientId, created.id);
            }
        }
        return { categoryMap: Object.fromEntries(categoryMap), productMap: Object.fromEntries(productMap) };
    }
    /**
     * Idempotent push of offline sales/orders.
     */
    static async pushSales(merchantId, sales) {
        const db = (0, db_1.getDb)();
        const results = [];
        for (const sale of sales) {
            const existing = await db.query.orders.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.orders.clientId, sale.clientId)),
            });
            if (existing) {
                results.push({ clientId: sale.clientId, orderId: existing.id, created: false });
                continue;
            }
            // Reject empty / zero-total pushes (e.g. re-confirm after pay-later cleared the cart).
            const isCancelledEarly = String(sale.status || "").toLowerCase() === "cancelled";
            const earlyTotal = (0, money_1.roundTo005)(Number(sale.total) || 0);
            const itemCount = Array.isArray(sale.items) ? sale.items.length : 0;
            if (!isCancelledEarly && (itemCount === 0 || earlyTotal <= 0.001)) {
                // Do not return a phantom orderId — callers must not build QR URLs for skipped sales.
                results.push({ clientId: sale.clientId, orderId: "", created: false, skipped: true });
                continue;
            }
            const baseOrderNumber = String(sale.orderNumber || `POS-${sale.clientId}`).slice(0, 40);
            const subtotal = (0, money_1.roundMoney2)(Number(sale.subtotal) || 0);
            const taxAmount = (0, money_1.roundMoney2)(Number(sale.taxAmount) || 0);
            const discountAmount = (0, money_1.roundMoney2)(Number(sale.discountAmount) || 0);
            const tipAmount = (0, money_1.roundMoney2)(Math.max(0, Number(sale.tipAmount) || 0));
            const roundingAmount = (0, money_1.roundMoney2)(Number(sale.roundingAmount) || 0);
            // Prefer client total (already rounded on POS); otherwise compute
            const total = (0, money_1.roundTo005)(sale.total != null
                ? Number(sale.total)
                : subtotal + taxAmount - discountAmount + tipAmount + roundingAmount);
            const isCancelled = String(sale.status || "").toLowerCase() === "cancelled";
            const cancelReason = isCancelled
                ? (0, pos_print_settings_1.resolvePosCancelReason)(String(sale.cancelReason || ""))
                : null;
            if (isCancelled && !cancelReason) {
                throw new Error("Cancel reason is required for cancelled sales");
            }
            let cancelledAt = null;
            if (isCancelled) {
                cancelledAt =
                    sale.cancelledAt != null && sale.cancelledAt !== ""
                        ? new Date(sale.cancelledAt)
                        : new Date();
                if (Number.isNaN(cancelledAt.getTime())) {
                    throw new Error("Invalid cancelledAt on sale");
                }
            }
            const payStatus = isCancelled
                ? "cancelled"
                : sale.paymentStatus || "completed";
            const isInvoice = !isCancelled &&
                (String(sale.paymentMethod || "").toLowerCase().replace(/-/g, "_") === "invoice");
            const payLater = !isCancelled &&
                (payStatus === "awaiting_payment" ||
                    sale.paymentMethod === "pay_later" ||
                    sale.paymentMethod === "pay-later" ||
                    isInvoice);
            const scheduledFor = parseScheduledFor(sale);
            const channel = normalizeFulfillmentChannel(sale);
            const status = sale.status ||
                (payLater ? (scheduledFor ? "accepted" : "preparing") : "completed");
            const fulfillmentOpen = [
                "accepted",
                "preparing",
                "ready",
                "out_for_delivery",
                "pending",
                "pending_approval",
            ].includes(String(status).toLowerCase());
            const completedAt = isCancelled || payLater || fulfillmentOpen
                ? null
                : sale.completedAt
                    ? new Date(sale.completedAt)
                    : new Date();
            if (completedAt && Number.isNaN(completedAt.getTime())) {
                throw new Error("Invalid completedAt on sale");
            }
            const orderValuesBase = {
                merchantId,
                orderType: "pos",
                fulfillmentChannel: channel,
                status,
                subtotal: subtotal.toFixed(2),
                taxAmount: taxAmount.toFixed(2),
                discountAmount: discountAmount.toFixed(2),
                tipAmount: tipAmount.toFixed(2),
                roundingAmount: roundingAmount.toFixed(2),
                amountTendered: sale.amountTendered != null && Number.isFinite(Number(sale.amountTendered))
                    ? (0, money_1.roundMoney2)(Number(sale.amountTendered)).toFixed(2)
                    : null,
                changeDue: sale.changeDue != null && Number.isFinite(Number(sale.changeDue))
                    ? (0, money_1.roundMoney2)(Number(sale.changeDue)).toFixed(2)
                    : null,
                staffName: sale.staffName ? String(sale.staffName).trim().slice(0, 255) : null,
                staffId: asUuidOrNull(sale.staffId),
                total: total.toFixed(2),
                pointsEarned: sale.pointsEarned != null && Number.isFinite(Number(sale.pointsEarned))
                    ? Math.max(0, Math.floor(Number(sale.pointsEarned)))
                    : 0,
                pointsRedeemed: sale.pointsRedeemed != null && Number.isFinite(Number(sale.pointsRedeemed))
                    ? Math.max(0, Math.floor(Number(sale.pointsRedeemed)))
                    : 0,
                pointsDiscount: sale.pointsDiscount != null && Number.isFinite(Number(sale.pointsDiscount))
                    ? (0, money_1.roundMoney2)(Number(sale.pointsDiscount)).toFixed(2)
                    : "0",
                paymentBreakdown: sale.paymentBreakdown?.length ? sale.paymentBreakdown : null,
                paymentMethod: isCancelled
                    ? sale.paymentMethod || null
                    : (0, payment_breakdown_1.resolveSalePaymentMethod)(sale.paymentBreakdown || [], sale.paymentMethod),
                paymentStatus: isInvoice ? "awaiting_payment" : payStatus,
                adyenReference: sale.adyenReference ? String(sale.adyenReference).trim() : null,
                adyenPoiTransactionTs: (() => {
                    if (sale.adyenPoiTransactionTimestamp == null ||
                        !String(sale.adyenPoiTransactionTimestamp).trim()) {
                        return null;
                    }
                    const d = new Date(String(sale.adyenPoiTransactionTimestamp));
                    return Number.isNaN(d.getTime()) ? null : d;
                })(),
                adyenCustomerReceiptJson: sale.adyenCustomerReceiptJson || null,
                adyenCashierReceiptJson: sale.adyenCashierReceiptJson || null,
                notes: encodeOrderMetaNotes({
                    existing: sale.notes,
                    ticketDisplay: sale.ticketDisplay,
                    tabNumber: sale.tabNumber != null && String(sale.tabNumber).trim()
                        ? String(sale.tabNumber).trim()
                        : sale.guestCount != null && Number.isFinite(Number(sale.guestCount))
                            ? String(Math.floor(Number(sale.guestCount)))
                            : null,
                }),
                scheduledFor,
                customerId: asUuidOrNull(sale.customerId),
                customerName: sale.customerName || null,
                customerPhone: sale.customerPhone || null,
                customerEmail: sale.customerEmail || null,
                shippingAddress: sale.shippingAddress || null,
                tableId: asUuidOrNull(sale.tableId),
                tableLabel: sale.tableLabel || null,
                guestCount: sale.guestCount != null && Number.isFinite(Number(sale.guestCount))
                    ? Number(sale.guestCount)
                    : null,
                billSplits: sale.billSplits || [],
                masterOrderId: sale.masterOrderId ? String(sale.masterOrderId).trim().slice(0, 64) : null,
                splitCheckNumber: sale.splitCheckNumber != null && Number.isFinite(Number(sale.splitCheckNumber))
                    ? Number(sale.splitCheckNumber)
                    : null,
                clientId: sale.clientId,
                deviceId: sale.deviceId || null,
                syncedAt: new Date(),
                completedAt,
                cancelReason,
                cancelledAt,
            };
            let order;
            let orderNumber = baseOrderNumber;
            for (let attempt = 0; attempt < 6; attempt++) {
                try {
                    const [row] = await db
                        .insert(db_1.schema.orders)
                        .values({ ...orderValuesBase, orderNumber })
                        .returning();
                    order = row;
                    break;
                }
                catch (err) {
                    if (isUniqueViolation(err) && attempt < 5) {
                        orderNumber = `${baseOrderNumber}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 50);
                        continue;
                    }
                    const cause = err?.cause;
                    const detail = cause?.message ||
                        err?.message ||
                        String(err);
                    throw new Error(`Failed to insert sale order: ${detail}`);
                }
            }
            if (!order)
                throw new Error("Failed to insert sale order");
            for (const item of sale.items) {
                let productId = asUuidOrNull(item.productId);
                let catalogName = null;
                const incomingName = (0, order_item_name_1.isUsableProductName)(item.productName)
                    ? String(item.productName).trim()
                    : null;
                if (!productId && item.productClientId) {
                    const linked = await db.query.products.findFirst({
                        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.products.clientId, item.productClientId)),
                    });
                    productId = linked?.id ?? null;
                    catalogName = linked?.name ?? null;
                }
                else if (productId) {
                    const linked = await db.query.products.findFirst({
                        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.id, productId), (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId)),
                    });
                    if (!linked) {
                        productId = null;
                    }
                    else {
                        catalogName = linked.name ?? null;
                    }
                }
                const resolvedName = (0, order_item_name_1.resolveOrderItemName)(incomingName, catalogName);
                const weightRaw = item.weightKg;
                const weightKg = weightRaw != null && String(weightRaw).trim() !== "" && Number.isFinite(Number(weightRaw))
                    ? String(weightRaw)
                    : null;
                const seatRaw = item.seatNumber;
                const seatNumber = seatRaw != null && String(searRaw).trim() !== "" && Number.isFinite(Number(seatRaw))
                    ? Math.floor(Number(seatRaw))
                    : null;
                await db.insert(db_1.schema.orderItems).values({
                    orderId: order.id,
                    productId,
                    productName: resolvedName,
                    quantity: String(item.quantity ?? 1),
                    unitPrice: String(item.unitPrice ?? 0),
                    totalPrice: String(item.totalPrice ?? 0),
                    taxAmount: String(item.taxAmount ?? 0),
                    weightKg,
                    selectedExtras: Array.isArray(item.selectedExtras) ? item.selectedExtras : [],
                    comboSelections: Array.isArray(item.comboSelections) ? item.comboSelections : [],
                    isOpenPrice: !!item.isOpenPrice,
                    seatNumber,
                });
            }
            if (sale.tableId) {
                try {
                    await floor_plan_service_1.FloorPlanService.setTableStatus(merchantId, sale.tableId, "available", null);
                }
                catch {
                    // Table may have been deleted from designer; ignore
                }
            }
            let invoiceNumber = null;
            if (isInvoice) {
                try {
                    const { InvoiceService } = await Promise.resolve().then(() => __importStar(require("@/services/invoice.service")));
                    invoiceNumber = await InvoiceService.ensureInvoiceNumber(merchantId, order.id);
                }
                catch (err) {
                    console.warn("[sync] invoice number assign failed:", err);
                }
            }
            const paid = !isCancelled &&
                !payLater &&
                (String(orderValuesBase.paymentStatus || "").toLowerCase() === "completed" ||
                    String(orderValuesBase.paymentStatus || "").toLowerCase() === "paid");
            if (paid) {
                try {
                    const { InventoryService } = await Promise.resolve().then(() => __importStar(require("@/services/inventory.service")));
                    await InventoryService.deductForPaidOrder(merchantId, order.id);
                }
                catch (invErr) {
                    console.warn("[sync] inventory deduct failed:", invErr);
                }
            }
            results.push({ clientId: sale.clientId, orderId: order.id, created: true, invoiceNumber });
        }
        return { results };
    }
}
exports.SyncService = SyncService;
//# sourceMappingURL=sync.service.js.map