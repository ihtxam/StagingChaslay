"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrintJobExpandService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const pos_print_settings_1 = require("@/lib/pos-print-settings");
const escpos_tickets_1 = require("@/lib/escpos-tickets");
const chaslay_floor_service_1 = require("@/services/chaslay-floor.service");
function looksLikeLabelPrinterName(name) {
    const n = String(name || "").toLowerCase();
    if (!n.trim())
        return false;
    if (/niimbot|\bk3\b|\bb21\b|\bd11\b|\bb1\b|\bd110\b|\bb3s\b/.test(n))
        return true;
    return /eml-?\d|emlabel|luckydoor|lucky\s*door|\btspl\b|gprinter|\btsc[-\s]|zd\d{3}|4inch|4-inch|4 inch|lp-80[hn]|lp-400|xp-?3[5-9]\d|xp-?4[0-2]\d|hprt|godex|argox|\blabel\b|\bsticker\b|barcode\s*printer/.test(n);
}
function printersForRole(printers, role, fallbackPaper) {
    const list = (printers || []).filter((p) => p.enabled !== false && p.name && !looksLikeLabelPrinterName(p.name));
    const matched = list.filter((p) => role === "kitchen" ? !!p.printKitchenTickets : !!p.printReceipts);
    if (matched.length) {
        return matched.map((p) => ({
            name: p.name,
            paperWidthMm: (p.paperWidthMm === 58 ? 58 : fallbackPaper),
        }));
    }
    if (role === "kitchen") {
        const receipt = list.filter((p) => p.printReceipts);
        if (receipt.length) {
            return receipt.map((p) => ({
                name: p.name,
                paperWidthMm: (p.paperWidthMm === 58 ? 58 : fallbackPaper),
            }));
        }
    }
    const named = list[0];
    return named
        ? [{ name: named.name, paperWidthMm: fallbackPaper }]
        : [{ name: "", paperWidthMm: fallbackPaper }];
}
function itemExtras(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw
        .map((e) => {
        if (!e)
            return "";
        if (typeof e === "string")
            return e;
        const o = e;
        return String(o.name || "").trim();
    })
        .filter(Boolean);
}
class PrintJobExpandService {
    static async enqueueReservationPrint(merchantId, reservationId) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { posPrintSettings: true, name: true, reservationSettings: true },
        });
        const reservation = await db.query.reservations.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.reservations.id, reservationId), (0, drizzle_orm_1.eq)(db_1.schema.reservations.merchantId, merchantId)),
        });
        if (!merchant || !reservation)
            return;
        const printSettings = (0, pos_print_settings_1.normalizePosPrintSettings)(merchant.posPrintSettings);
        const resSettings = merchant.reservationSettings;
        if (printSettings.autoPrintReservations === false || resSettings?.autoPrintReservations === false) {
            return;
        }
        const paper = printSettings.paperWidthMm === 58 ? 58 : 80;
        const targets = printersForRole(printSettings.printers, "kitchen", paper);
        for (const printer of targets) {
            const bytes = (0, escpos_tickets_1.reservationTicketEscPos)({
                code: reservation.code,
                guestName: reservation.guestName,
                guestPhone: reservation.guestPhone,
                partySize: Number(reservation.partySize) || 1,
                reservedAt: reservation.reservedAt,
                status: reservation.status,
                tableLabel: reservation.tableLabel,
                notes: reservation.notes,
                businessName: merchant.name,
                paperWidthMm: printer.paperWidthMm,
            });
            await chaslay_floor_service_1.ChaslayFloorService.createPrintJob(merchantId, {
                jobType: "ESCPOS",
                payload: {
                    kind: "escpos",
                    dataBase64: bytes.toString("base64"),
                    printerName: printer.name || undefined,
                    jobKind: "kitchen",
                    alertKind: "reservation",
                    reservationId,
                },
                sourceDeviceId: "reservation",
            });
        }
    }
    static async enqueueOrderPrint(merchantId, orderId, opts) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { posPrintSettings: true, name: true },
        });
        const order = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
            with: { items: true },
        });
        if (!merchant || !order)
            return;
        const printSettings = (0, pos_print_settings_1.normalizePosPrintSettings)(merchant.posPrintSettings);
        const paper = printSettings.paperWidthMm === 58 ? 58 : 80;
        const source = String(opts.orderSource || order.orderSource || "online_shop");
        const bypass = opts.independentOfMasterAutoPrint === true;
        const items = (order.items || []).map((i) => ({
            name: String(i.productName || "Item"),
            quantity: Number(i.quantity) || 1,
            extras: itemExtras(i.selectedExtras),
        }));
        const jobs = [];
        if (opts.printKitchen && (bypass || printSettings.autoPrintKitchen !== false)) {
            for (const printer of printersForRole(printSettings.printers, "kitchen", paper)) {
                jobs.push({
                    target: printer,
                    jobKind: "kitchen",
                    alertKind: "online_order",
                    bytes: (0, escpos_tickets_1.kitchenTicketEscPos)({
                        orderNumber: order.orderNumber,
                        orderSource: source,
                        customerName: order.customerName,
                        customerPhone: order.customerPhone,
                        shippingAddress: order.shippingAddress,
                        channel: order.fulfillmentChannel,
                        scheduledFor: order.scheduledFor,
                        notes: order.notes,
                        items,
                        paperWidthMm: printer.paperWidthMm,
                    }),
                });
            }
        }
        if (opts.printNotification && (bypass || printSettings.autoPrintReceipt !== false)) {
            for (const printer of printersForRole(printSettings.printers, "receipt", paper)) {
                jobs.push({
                    target: printer,
                    jobKind: "receipt",
                    alertKind: "online_order",
                    bytes: (0, escpos_tickets_1.orderNotificationTicketEscPos)({
                        orderNumber: order.orderNumber,
                        orderSource: source,
                        customerName: order.customerName,
                        customerPhone: order.customerPhone,
                        shippingAddress: order.shippingAddress,
                        channel: order.fulfillmentChannel,
                        total: Number(order.total) || 0,
                        items,
                        paperWidthMm: printer.paperWidthMm,
                        businessName: merchant.name,
                    }),
                });
            }
        }
        if (opts.printDeliveryReceipt && (bypass || printSettings.autoPrintReceipt !== false)) {
            for (const printer of printersForRole(printSettings.printers, "receipt", paper)) {
                jobs.push({
                    target: printer,
                    jobKind: "receipt",
                    alertKind: "online_order",
                    bytes: (0, escpos_tickets_1.deliverySlipEscPos)({
                        orderNumber: order.orderNumber,
                        customerName: order.customerName,
                        customerPhone: order.customerPhone,
                        shippingAddress: order.shippingAddress,
                        total: Number(order.total) || 0,
                        items,
                        paperWidthMm: printer.paperWidthMm,
                        businessName: merchant.name,
                    }),
                });
            }
        }
        for (const job of jobs) {
            await chaslay_floor_service_1.ChaslayFloorService.createPrintJob(merchantId, {
                jobType: "ESCPOS",
                payload: {
                    kind: "escpos",
                    dataBase64: job.bytes.toString("base64"),
                    printerName: job.target.name || undefined,
                    jobKind: job.jobKind,
                    alertKind: job.alertKind,
                    orderId,
                },
                orderId,
                sourceDeviceId: "online-order",
            });
        }
    }
    /** Turn a claimed recipe job into printable ESC/POS (Print Agent + browser). */
    static async materializeRecipePayload(merchantId, payload) {
        if (!payload || typeof payload !== "object")
            return payload;
        const kind = String(payload.kind || "");
        if (kind === "escpos" && payload.dataBase64)
            return payload;
        try {
            if (kind === "auto_print_reservation" && payload.reservationId) {
                const db = (0, db_1.getDb)();
                const merchant = await db.query.merchants.findFirst({
                    where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
                    columns: { posPrintSettings: true, name: true },
                });
                const reservation = await db.query.reservations.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.reservations.id, String(payload.reservationId)), (0, drizzle_orm_1.eq)(db_1.schema.reservations.merchantId, merchantId)),
                });
                if (!merchant || !reservation)
                    return payload;
                const printSettings = (0, pos_print_settings_1.normalizePosPrintSettings)(merchant.posPrintSettings);
                const paper = printSettings.paperWidthMm === 58 ? 58 : 80;
                const printer = printersForRole(printSettings.printers, "kitchen", paper)[0];
                const bytes = (0, escpos_tickets_1.reservationTicketEscPos)({
                    code: reservation.code,
                    guestName: reservation.guestName,
                    guestPhone: reservation.guestPhone,
                    partySize: Number(reservation.partySize) || 1,
                    reservedAt: reservation.reservedAt,
                    status: reservation.status,
                    tableLabel: reservation.tableLabel,
                    notes: reservation.notes,
                    businessName: merchant.name,
                    paperWidthMm: printer.paperWidthMm,
                });
                return {
                    kind: "escpos",
                    dataBase64: bytes.toString("base64"),
                    printerName: printer.name || undefined,
                    jobKind: "kitchen",
                    alertKind: "reservation",
                    reservationId: payload.reservationId,
                };
            }
            if (kind === "auto_print_order" && payload.orderId) {
                const db = (0, db_1.getDb)();
                const merchant = await db.query.merchants.findFirst({
                    where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
                    columns: { posPrintSettings: true, name: true },
                });
                const order = await db.query.orders.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, String(payload.orderId)), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
                    with: { items: true },
                });
                if (!merchant || !order)
                    return payload;
                const printSettings = (0, pos_print_settings_1.normalizePosPrintSettings)(merchant.posPrintSettings);
                const paper = printSettings.paperWidthMm === 58 ? 58 : 80;
                const items = (order.items || []).map((i) => ({
                    name: String(i.productName || "Item"),
                    quantity: Number(i.quantity) || 1,
                    extras: itemExtras(i.selectedExtras),
                }));
                const source = String(payload.orderSource || order.orderSource || "online_shop");
                if (payload.printKitchen === true) {
                    const printer = printersForRole(printSettings.printers, "kitchen", paper)[0];
                    const bytes = (0, escpos_tickets_1.kitchenTicketEscPos)({
                        orderNumber: order.orderNumber,
                        orderSource: source,
                        customerName: order.customerName,
                        customerPhone: order.customerPhone,
                        shippingAddress: order.shippingAddress,
                        channel: order.fulfillmentChannel,
                        scheduledFor: order.scheduledFor,
                        notes: order.notes,
                        items,
                        paperWidthMm: printer.paperWidthMm,
                    });
                    return {
                        kind: "escpos",
                        dataBase64: bytes.toString("base64"),
                        printerName: printer.name || undefined,
                        jobKind: "kitchen",
                        alertKind: "online_order",
                        orderId: payload.orderId,
                    };
                }
                if (payload.printNotification === true) {
                    const printer = printersForRole(printSettings.printers, "receipt", paper)[0];
                    const bytes = (0, escpos_tickets_1.orderNotificationTicketEscPos)({
                        orderNumber: order.orderNumber,
                        orderSource: source,
                        customerName: order.customerName,
                        customerPhone: order.customerPhone,
                        shippingAddress: order.shippingAddress,
                        channel: order.fulfillmentChannel,
                        total: Number(order.total) || 0,
                        items,
                        paperWidthMm: printer.paperWidthMm,
                        businessName: merchant.name,
                    });
                    return {
                        kind: "escpos",
                        dataBase64: bytes.toString("base64"),
                        printerName: printer.name || undefined,
                        jobKind: "receipt",
                        alertKind: "online_order",
                        orderId: payload.orderId,
                    };
                }
                if (payload.printDeliveryReceipt === true) {
                    const printer = printersForRole(printSettings.printers, "receipt", paper)[0];
                    const bytes = (0, escpos_tickets_1.deliverySlipEscPos)({
                        orderNumber: order.orderNumber,
                        customerName: order.customerName,
                        customerPhone: order.customerPhone,
                        shippingAddress: order.shippingAddress,
                        total: Number(order.total) || 0,
                        items,
                        paperWidthMm: printer.paperWidthMm,
                        businessName: merchant.name,
                    });
                    return {
                        kind: "escpos",
                        dataBase64: bytes.toString("base64"),
                        printerName: printer.name || undefined,
                        jobKind: "receipt",
                        alertKind: "online_order",
                        orderId: payload.orderId,
                    };
                }
            }
        }
        catch (err) {
            console.warn("Print job materialize failed:", err);
        }
        return payload;
    }
}
exports.PrintJobExpandService = PrintJobExpandService;
//# sourceMappingURL=print-job-expand.service.js.map