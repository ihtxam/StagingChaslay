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
exports.DeliveryTrackingService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const STALE_MS = 3 * 60 * 1000;
function num(v) {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
}
function clampCoord(lat, lng) {
    return {
        lat: Math.max(-90, Math.min(90, lat)),
        lng: Math.max(-180, Math.min(180, lng)),
    };
}
class DeliveryTrackingService {
    static async ensureSchema() {
        await (0, ensure_merchant_schema_1.ensureMerchantTables)();
    }
    /** Upsert latest driver position (one row per staff). */
    static async postLocation(merchantId, staffId, input) {
        await this.ensureSchema();
        const lat = num(input.latitude);
        const lng = num(input.longitude);
        if (lat == null || lng == null)
            throw new Error("latitude and longitude are required");
        const { lat: safeLat, lng: safeLng } = clampCoord(lat, lng);
        const db = (0, db_1.getDb)();
        const now = new Date();
        const existing = await db.query.deliveryDriverLocations.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.deliveryDriverLocations.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.deliveryDriverLocations.staffId, staffId)),
        });
        const values = {
            merchantId,
            staffId,
            latitude: String(safeLat),
            longitude: String(safeLng),
            accuracyM: input.accuracyM != null ? String(input.accuracyM) : null,
            heading: input.heading != null ? String(input.heading) : null,
            speedMps: input.speedMps != null ? String(input.speedMps) : null,
            recordedAt: now,
            updatedAt: now,
        };
        if (existing) {
            await db
                .update(db_1.schema.deliveryDriverLocations)
                .set(values)
                .where((0, drizzle_orm_1.eq)(db_1.schema.deliveryDriverLocations.id, existing.id));
        }
        else {
            await db.insert(db_1.schema.deliveryDriverLocations).values(values);
        }
        return { success: true, recordedAt: now.toISOString() };
    }
    static async listLiveDrivers(merchantId) {
        await this.ensureSchema();
        const db = (0, db_1.getDb)();
        const cutoff = new Date(Date.now() - STALE_MS);
        const pings = await db.query.deliveryDriverLocations.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.deliveryDriverLocations.merchantId, merchantId), (0, drizzle_orm_1.gte)(db_1.schema.deliveryDriverLocations.recordedAt, cutoff)),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.deliveryDriverLocations.recordedAt)],
        });
        if (!pings.length)
            return [];
        const staffIds = pings.map((p) => p.staffId);
        const staffRows = await db.query.merchantStaff.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.merchantStaff.id, staffIds)),
        });
        const roleIds = [...new Set(staffRows.map((s) => s.roleId))];
        const roles = roleIds.length > 0
            ? await db.query.merchantRoles.findMany({
                where: (0, drizzle_orm_1.inArray)(db_1.schema.merchantRoles.id, roleIds),
            })
            : [];
        const roleNameById = new Map(roles.map((r) => [r.id, r.name]));
        const staffById = new Map(staffRows.map((s) => [s.id, s]));
        const activeOrders = await db.query.orders.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.orders.fulfillmentChannel, "delivery"), (0, drizzle_orm_1.inArray)(db_1.schema.orders.status, ["ready", "out_for_delivery"]), (0, drizzle_orm_1.inArray)(db_1.schema.orders.assignedDeliveryStaffId, staffIds)),
            columns: { assignedDeliveryStaffId: true },
        });
        const orderCountByStaff = new Map();
        for (const o of activeOrders) {
            if (!o.assignedDeliveryStaffId)
                continue;
            orderCountByStaff.set(o.assignedDeliveryStaffId, (orderCountByStaff.get(o.assignedDeliveryStaffId) || 0) + 1);
        }
        return pings
            .map((p) => {
            const staff = staffById.get(p.staffId);
            const recordedAt = p.recordedAt ? new Date(p.recordedAt) : new Date(0);
            return {
                staffId: p.staffId,
                staffName: staff?.name || "Driver",
                roleName: staff ? roleNameById.get(staff.roleId) || null : null,
                latitude: num(p.latitude) ?? 0,
                longitude: num(p.longitude) ?? 0,
                accuracyM: num(p.accuracyM),
                heading: num(p.heading),
                speedMps: num(p.speedMps),
                recordedAt: recordedAt.toISOString(),
                stale: recordedAt.getTime() < cutoff.getTime(),
                activeOrderCount: orderCountByStaff.get(p.staffId) || 0,
            };
        })
            .filter((d) => !d.stale);
    }
    static async listActiveDeliveryOrders(merchantId) {
        await this.ensureSchema();
        const db = (0, db_1.getDb)();
        const rows = await db.query.orders.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.orders.fulfillmentChannel, "delivery"), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(db_1.schema.orders.status, "ready"), (0, drizzle_orm_1.eq)(db_1.schema.orders.status, "out_for_delivery"), (0, drizzle_orm_1.eq)(db_1.schema.orders.status, "preparing"), (0, drizzle_orm_1.eq)(db_1.schema.orders.status, "accepted"), (0, drizzle_orm_1.eq)(db_1.schema.orders.status, "pending_approval"))),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.orders.createdAt)],
            limit: 80,
            columns: {
                id: true,
                orderNumber: true,
                status: true,
                customerName: true,
                customerPhone: true,
                shippingAddress: true,
                deliveryLatitude: true,
                deliveryLongitude: true,
                assignedDeliveryStaffId: true,
                total: true,
                createdAt: true,
                orderSource: true,
                orderType: true,
                paymentStatus: true,
                paymentMethod: true,
                printCount: true,
                deliveryTrackingToken: true,
            },
        });
        const assignedIds = [
            ...new Set(rows.map((r) => r.assignedDeliveryStaffId).filter(Boolean)),
        ];
        const drivers = assignedIds.length > 0
            ? await db.query.merchantStaff.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.merchantStaff.id, assignedIds)),
                columns: { id: true, name: true },
            })
            : [];
        const driverName = new Map(drivers.map((d) => [d.id, d.name]));
        const orderIds = rows.map((r) => r.id);
        const itemRows = orderIds.length > 0
            ? await db.query.orderItems.findMany({
                where: (0, drizzle_orm_1.inArray)(db_1.schema.orderItems.orderId, orderIds),
                columns: { orderId: true, productName: true, quantity: true },
                orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.orderItems.id)],
            })
            : [];
        const itemsByOrder = new Map();
        for (const item of itemRows) {
            const list = itemsByOrder.get(item.orderId) || [];
            list.push({
                name: String(item.productName || "Item").trim() || "Item",
                qty: Math.max(1, Number(item.quantity) || 1),
            });
            itemsByOrder.set(item.orderId, list);
        }
        return rows.map((r) => {
            const items = itemsByOrder.get(r.id) || [];
            const itemsPreview = items.length > 0
                ? items.map((i) => `${i.qty}× ${i.name}`).join(", ")
                : null;
            return {
                id: r.id,
                orderNumber: r.orderNumber,
                status: r.status,
                customerName: r.customerName,
                customerPhone: r.customerPhone,
                shippingAddress: r.shippingAddress,
                latitude: num(r.deliveryLatitude),
                longitude: num(r.deliveryLongitude),
                assignedDeliveryStaffId: r.assignedDeliveryStaffId,
                assignedDriverName: r.assignedDeliveryStaffId
                    ? driverName.get(r.assignedDeliveryStaffId) || null
                    : null,
                total: num(r.total) ?? 0,
                createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
                orderSource: r.orderSource,
                orderType: r.orderType,
                paymentStatus: r.paymentStatus,
                paymentMethod: r.paymentMethod,
                printCount: Number(r.printCount || 0),
                deliveryTrackingToken: r.deliveryTrackingToken,
                itemsPreview,
                itemCount: items.length,
            };
        });
    }
    /** Ensure delivery orders have a tracking / driver-scan token. */
    static async ensureDeliveryTrackingToken(merchantId, orderId) {
        await this.ensureSchema();
        const db = (0, db_1.getDb)();
        const order = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
            columns: { deliveryTrackingToken: true, fulfillmentChannel: true },
        });
        if (!order)
            throw new Error("Order not found");
        if (order.fulfillmentChannel !== "delivery") {
            throw new Error("Not a delivery order");
        }
        if (order.deliveryTrackingToken)
            return order.deliveryTrackingToken;
        const { generateDeliveryTrackingToken } = await Promise.resolve().then(() => __importStar(require("@/lib/delivery-tracking-url")));
        const token = generateDeliveryTrackingToken();
        await db
            .update(db_1.schema.orders)
            .set({ deliveryTrackingToken: token })
            .where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId));
        return token;
    }
    static async assignDriver(merchantId, orderId, staffId) {
        await this.ensureSchema();
        const db = (0, db_1.getDb)();
        const order = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
        });
        if (!order)
            throw new Error("Order not found");
        if (order.fulfillmentChannel !== "delivery") {
            throw new Error("Only delivery orders can be assigned to a driver");
        }
        if (staffId) {
            const staff = await db.query.merchantStaff.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.id, staffId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.isActive, true)),
            });
            if (!staff)
                throw new Error("Staff member not found");
        }
        await db
            .update(db_1.schema.orders)
            .set({ assignedDeliveryStaffId: staffId })
            .where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId));
        await this.ensureDeliveryTrackingToken(merchantId, orderId);
        return { success: true, orderId, assignedDeliveryStaffId: staffId };
    }
    /** Driver scans delivery slip QR — assigns order to clocked-in driver. */
    static async claimOrderAsDriver(merchantId, staffId, orderId, token) {
        await this.ensureSchema();
        const db = (0, db_1.getDb)();
        const order = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
        });
        if (!order)
            throw new Error("Order not found");
        if (order.fulfillmentChannel !== "delivery") {
            throw new Error("Not a delivery order");
        }
        const expected = order.deliveryTrackingToken || (await this.ensureDeliveryTrackingToken(merchantId, orderId));
        if (expected !== token)
            throw new Error("Invalid delivery scan code");
        if (["cancelled", "refunded", "completed"].includes(String(order.status))) {
            throw new Error("Order is no longer active");
        }
        await db
            .update(db_1.schema.orders)
            .set({ assignedDeliveryStaffId: staffId })
            .where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId));
        await this.advanceDeliveryForDriver(merchantId, orderId);
        const staff = await db.query.merchantStaff.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.id, staffId),
            columns: { id: true, name: true },
        });
        return {
            success: true,
            orderId,
            assignedDeliveryStaffId: staffId,
            assignedDriverName: staff?.name || null,
        };
    }
    /** List delivery-role staff for assign dropdown. */
    static async listDeliveryStaff(merchantId) {
        await this.ensureSchema();
        const db = (0, db_1.getDb)();
        const roles = await db.query.merchantRoles.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantRoles.merchantId, merchantId),
        });
        const deliveryRoleIds = roles
            .filter((r) => {
            const perms = (r.permissions || "").split(",").map((s) => s.trim());
            return perms.includes("DELIVERY_ORDERS");
        })
            .map((r) => r.id);
        if (!deliveryRoleIds.length)
            return [];
        return db.query.merchantStaff.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.isActive, true), (0, drizzle_orm_1.inArray)(db_1.schema.merchantStaff.roleId, deliveryRoleIds)),
            columns: { id: true, name: true, roleId: true },
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.merchantStaff.name)],
        });
    }
    /** Guest tracking payload (token required). */
    static async getPublicTracking(merchantId, orderId, token) {
        await this.ensureSchema();
        const db = (0, db_1.getDb)();
        const order = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
            columns: {
                id: true,
                orderNumber: true,
                status: true,
                fulfillmentChannel: true,
                shippingAddress: true,
                deliveryLatitude: true,
                deliveryLongitude: true,
                deliveryTrackingToken: true,
                assignedDeliveryStaffId: true,
                estimatedReadyAt: true,
            },
        });
        if (!order || order.fulfillmentChannel !== "delivery") {
            throw new Error("Order not found");
        }
        if (!order.deliveryTrackingToken || order.deliveryTrackingToken !== token) {
            throw new Error("Invalid tracking link");
        }
        let driver = null;
        if (order.assignedDeliveryStaffId &&
            (order.status === "out_for_delivery" || order.status === "ready")) {
            const [staff, ping] = await Promise.all([
                db.query.merchantStaff.findFirst({
                    where: (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.id, order.assignedDeliveryStaffId),
                    columns: { name: true },
                }),
                db.query.deliveryDriverLocations.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.deliveryDriverLocations.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.deliveryDriverLocations.staffId, order.assignedDeliveryStaffId)),
                }),
            ]);
            if (ping && staff) {
                const recordedAt = ping.recordedAt ? new Date(ping.recordedAt) : new Date(0);
                const stale = Date.now() - recordedAt.getTime() > STALE_MS;
                driver = {
                    name: staff.name.split(" ")[0] || staff.name,
                    latitude: num(ping.latitude) ?? 0,
                    longitude: num(ping.longitude) ?? 0,
                    recordedAt: recordedAt.toISOString(),
                    stale,
                };
            }
        }
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { name: true, latitude: true, longitude: true },
        });
        return {
            order: {
                id: order.id,
                orderNumber: order.orderNumber,
                status: order.status,
                shippingAddress: order.shippingAddress,
                destination: {
                    latitude: num(order.deliveryLatitude),
                    longitude: num(order.deliveryLongitude),
                },
                estimatedReadyAt: order.estimatedReadyAt
                    ? new Date(order.estimatedReadyAt).toISOString()
                    : null,
            },
            store: {
                name: merchant?.name || "Store",
                latitude: num(merchant?.latitude),
                longitude: num(merchant?.longitude),
            },
            driver,
        };
    }
    /** Driver marks assigned delivery complete. */
    static async completeDeliveryAsDriver(merchantId, staffId, orderId) {
        await this.ensureSchema();
        const db = (0, db_1.getDb)();
        const order = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
        });
        if (!order)
            throw new Error("Order not found");
        if (order.assignedDeliveryStaffId !== staffId) {
            throw new Error("This delivery is not assigned to you");
        }
        if (order.fulfillmentChannel !== "delivery") {
            throw new Error("Not a delivery order");
        }
        await this.advanceDeliveryForDriver(merchantId, orderId);
        const refreshed = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
        });
        const status = String(refreshed?.status || "");
        if (status !== "ready" && status !== "out_for_delivery") {
            throw new Error("Order cannot be marked delivered in current status");
        }
        const { OrderService } = await Promise.resolve().then(() => __importStar(require("@/services/order.service")));
        return OrderService.applyOrderAction(merchantId, orderId, "complete", {});
    }
    /** Driver starts delivery — mark ready (if needed) and out for delivery. */
    static async startDeliveryAsDriver(merchantId, staffId, orderId) {
        await this.ensureSchema();
        const db = (0, db_1.getDb)();
        const order = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
        });
        if (!order)
            throw new Error("Order not found");
        if (order.assignedDeliveryStaffId !== staffId) {
            throw new Error("This delivery is not assigned to you");
        }
        if (order.fulfillmentChannel !== "delivery") {
            throw new Error("Not a delivery order");
        }
        if (["cancelled", "refunded", "completed"].includes(String(order.status))) {
            throw new Error("Order is no longer active");
        }
        return this.advanceDeliveryForDriver(merchantId, orderId);
    }
    /**
     * Kitchen → delivery transitions for an assigned driver order:
     * preparing/accepted → ready → out_for_delivery.
     * Pending orders must be accepted at the till first (unless auto-accepted).
     */
    static async advanceDeliveryForDriver(merchantId, orderId) {
        await this.ensureSchema();
        const db = (0, db_1.getDb)();
        const { OrderService } = await Promise.resolve().then(() => __importStar(require("@/services/order.service")));
        const read = async () => db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
        });
        let order = await read();
        if (!order)
            throw new Error("Order not found");
        if (order.fulfillmentChannel !== "delivery") {
            throw new Error("Not a delivery order");
        }
        let status = String(order.status || "");
        if (status === "pending_approval" || status === "pending") {
            throw new Error("Order must be accepted at the till before delivery can start");
        }
        if (status === "completed" || status === "cancelled" || status === "refunded") {
            return order;
        }
        if (status === "preparing" || status === "accepted") {
            await OrderService.applyOrderAction(merchantId, orderId, "mark_ready", {});
            order = (await read()) || order;
            status = String(order.status || "");
        }
        if (status === "ready") {
            await OrderService.applyOrderAction(merchantId, orderId, "out_for_delivery", {});
            order = (await read()) || order;
        }
        return order;
    }
    /** Latest driver ping for an order (merchant orders board). */
    static async getDriverPingForOrder(merchantId, orderId) {
        await this.ensureSchema();
        const db = (0, db_1.getDb)();
        const order = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
            columns: { assignedDeliveryStaffId: true },
        });
        if (!order?.assignedDeliveryStaffId)
            return null;
        const staff = await db.query.merchantStaff.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.id, order.assignedDeliveryStaffId),
            columns: { id: true, name: true },
        });
        const ping = await db.query.deliveryDriverLocations.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.deliveryDriverLocations.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.deliveryDriverLocations.staffId, order.assignedDeliveryStaffId)),
        });
        if (!staff)
            return null;
        if (!ping) {
            return {
                staffId: staff.id,
                staffName: staff.name,
                latitude: null,
                longitude: null,
                stale: true,
            };
        }
        const recordedAt = ping.recordedAt ? new Date(ping.recordedAt) : new Date(0);
        return {
            staffId: staff.id,
            staffName: staff.name,
            latitude: num(ping.latitude),
            longitude: num(ping.longitude),
            recordedAt: recordedAt.toISOString(),
            stale: Date.now() - recordedAt.getTime() > STALE_MS,
        };
    }
    /** Completed deliveries for driver (today by default). */
    static async listCompletedForDriver(merchantId, staffId, dateYmd) {
        const { DeliveryDriverPayService } = await Promise.resolve().then(() => __importStar(require("@/services/delivery-driver-pay.service")));
        const summary = await DeliveryDriverPayService.getDailySummary(merchantId, staffId, dateYmd);
        return summary.completedOrders;
    }
    /** Seed demo driver positions around merchant HQ (for demo merchant). */
    static async seedDemoDriverLocations(merchantId, drivers) {
        for (const d of drivers) {
            await this.postLocation(merchantId, d.staffId, {
                latitude: d.lat,
                longitude: d.lng,
                accuracyM: 12,
            });
        }
    }
}
exports.DeliveryTrackingService = DeliveryTrackingService;
//# sourceMappingURL=delivery-tracking.service.js.map