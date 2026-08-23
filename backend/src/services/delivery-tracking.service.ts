import { and, asc, desc, eq, gte, inArray, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ensureMerchantTables } from "@/lib/ensure-merchant-schema";

const STALE_MS = 3 * 60 * 1000;

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function clampCoord(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Math.max(-90, Math.min(90, lat)),
    lng: Math.max(-180, Math.min(180, lng)),
  };
}

export type DeliveryDriverLive = {
  staffId: string;
  staffName: string;
  roleName: string | null;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  heading: number | null;
  speedMps: number | null;
  recordedAt: string;
  stale: boolean;
  activeOrderCount: number;
};

export type DeliveryOrderOnMap = {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string | null;
  customerPhone: string | null;
  shippingAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  assignedDeliveryStaffId: string | null;
  assignedDriverName: string | null;
  total: number;
  createdAt: string | null;
  orderSource: string | null;
  orderType: string | null;
  paymentStatus: string | null;
  paymentMethod: string | null;
  printCount: number;
  deliveryTrackingToken: string | null;
};

export class DeliveryTrackingService {
  static async ensureSchema() {
    await ensureMerchantTables();
  }

  /** Upsert latest driver position (one row per staff). */
  static async postLocation(
    merchantId: string,
    staffId: string,
    input: {
      latitude: number;
      longitude: number;
      accuracyM?: number | null;
      heading?: number | null;
      speedMps?: number | null;
    }
  ) {
    await this.ensureSchema();
    const lat = num(input.latitude);
    const lng = num(input.longitude);
    if (lat == null || lng == null) throw new Error("latitude and longitude are required");
    const { lat: safeLat, lng: safeLng } = clampCoord(lat, lng);

    const db = getDb();
    const now = new Date();
    const existing = await db.query.deliveryDriverLocations.findFirst({
      where: and(
        eq(schema.deliveryDriverLocations.merchantId, merchantId),
        eq(schema.deliveryDriverLocations.staffId, staffId)
      ),
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
        .update(schema.deliveryDriverLocations)
        .set(values)
        .where(eq(schema.deliveryDriverLocations.id, existing.id));
    } else {
      await db.insert(schema.deliveryDriverLocations).values(values);
    }

    return { success: true as const, recordedAt: now.toISOString() };
  }

  static async listLiveDrivers(merchantId: string): Promise<DeliveryDriverLive[]> {
    await this.ensureSchema();
    const db = getDb();
    const cutoff = new Date(Date.now() - STALE_MS);

    const pings = await db.query.deliveryDriverLocations.findMany({
      where: and(
        eq(schema.deliveryDriverLocations.merchantId, merchantId),
        gte(schema.deliveryDriverLocations.recordedAt, cutoff)
      ),
      orderBy: [desc(schema.deliveryDriverLocations.recordedAt)],
    });

    if (!pings.length) return [];

    const staffIds = pings.map((p) => p.staffId);
    const staffRows = await db.query.merchantStaff.findMany({
      where: and(
        eq(schema.merchantStaff.merchantId, merchantId),
        inArray(schema.merchantStaff.id, staffIds)
      ),
    });
    const roleIds = [...new Set(staffRows.map((s) => s.roleId))];
    const roles =
      roleIds.length > 0
        ? await db.query.merchantRoles.findMany({
            where: inArray(schema.merchantRoles.id, roleIds),
          })
        : [];
    const roleNameById = new Map(roles.map((r) => [r.id, r.name]));
    const staffById = new Map(staffRows.map((s) => [s.id, s]));

    const activeOrders = await db.query.orders.findMany({
      where: and(
        eq(schema.orders.merchantId, merchantId),
        eq(schema.orders.fulfillmentChannel, "delivery"),
        inArray(schema.orders.status, ["ready", "out_for_delivery"]),
        inArray(schema.orders.assignedDeliveryStaffId, staffIds)
      ),
      columns: { assignedDeliveryStaffId: true },
    });
    const orderCountByStaff = new Map<string, number>();
    for (const o of activeOrders) {
      if (!o.assignedDeliveryStaffId) continue;
      orderCountByStaff.set(
        o.assignedDeliveryStaffId,
        (orderCountByStaff.get(o.assignedDeliveryStaffId) || 0) + 1
      );
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

  static async listActiveDeliveryOrders(merchantId: string): Promise<DeliveryOrderOnMap[]> {
    await this.ensureSchema();
    const db = getDb();
    const rows = await db.query.orders.findMany({
      where: and(
        eq(schema.orders.merchantId, merchantId),
        eq(schema.orders.fulfillmentChannel, "delivery"),
        or(
          eq(schema.orders.status, "ready"),
          eq(schema.orders.status, "out_for_delivery"),
          eq(schema.orders.status, "preparing"),
          eq(schema.orders.status, "accepted"),
          eq(schema.orders.status, "pending_approval")
        )
      ),
      orderBy: [desc(schema.orders.createdAt)],
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
      ...new Set(rows.map((r) => r.assignedDeliveryStaffId).filter(Boolean) as string[]),
    ];
    const drivers =
      assignedIds.length > 0
        ? await db.query.merchantStaff.findMany({
            where: and(
              eq(schema.merchantStaff.merchantId, merchantId),
              inArray(schema.merchantStaff.id, assignedIds)
            ),
            columns: { id: true, name: true },
          })
        : [];
    const driverName = new Map(drivers.map((d) => [d.id, d.name]));

    return rows.map((r) => ({
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
    }));
  }

  /** Ensure delivery orders have a tracking / driver-scan token. */
  static async ensureDeliveryTrackingToken(merchantId: string, orderId: string): Promise<string> {
    await this.ensureSchema();
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
      columns: { deliveryTrackingToken: true, fulfillmentChannel: true },
    });
    if (!order) throw new Error("Order not found");
    if (order.fulfillmentChannel !== "delivery") {
      throw new Error("Not a delivery order");
    }
    if (order.deliveryTrackingToken) return order.deliveryTrackingToken;
    const { generateDeliveryTrackingToken } = await import("@/lib/delivery-tracking-url");
    const token = generateDeliveryTrackingToken();
    await db
      .update(schema.orders)
      .set({ deliveryTrackingToken: token })
      .where(eq(schema.orders.id, orderId));
    return token;
  }

  static async assignDriver(merchantId: string, orderId: string, staffId: string | null) {
    await this.ensureSchema();
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
    });
    if (!order) throw new Error("Order not found");
    if (order.fulfillmentChannel !== "delivery") {
      throw new Error("Only delivery orders can be assigned to a driver");
    }

    if (staffId) {
      const staff = await db.query.merchantStaff.findFirst({
        where: and(
          eq(schema.merchantStaff.id, staffId),
          eq(schema.merchantStaff.merchantId, merchantId),
          eq(schema.merchantStaff.isActive, true)
        ),
      });
      if (!staff) throw new Error("Staff member not found");
    }

    await db
      .update(schema.orders)
      .set({ assignedDeliveryStaffId: staffId })
      .where(eq(schema.orders.id, orderId));

    await this.ensureDeliveryTrackingToken(merchantId, orderId);

    return { success: true as const, orderId, assignedDeliveryStaffId: staffId };
  }

  /** Driver scans delivery slip QR — assigns order to clocked-in driver. */
  static async claimOrderAsDriver(
    merchantId: string,
    staffId: string,
    orderId: string,
    token: string
  ) {
    await this.ensureSchema();
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
    });
    if (!order) throw new Error("Order not found");
    if (order.fulfillmentChannel !== "delivery") {
      throw new Error("Not a delivery order");
    }
    const expected = order.deliveryTrackingToken || (await this.ensureDeliveryTrackingToken(merchantId, orderId));
    if (expected !== token) throw new Error("Invalid delivery scan code");
    if (["cancelled", "refunded", "completed"].includes(String(order.status))) {
      throw new Error("Order is no longer active");
    }

    await db
      .update(schema.orders)
      .set({ assignedDeliveryStaffId: staffId })
      .where(eq(schema.orders.id, orderId));

    if (order.status === "ready") {
      const { OrderService } = await import("@/services/order.service");
      await OrderService.applyOrderAction(merchantId, orderId, "out_for_delivery", {});
    }

    const staff = await db.query.merchantStaff.findFirst({
      where: eq(schema.merchantStaff.id, staffId),
      columns: { id: true, name: true },
    });

    return {
      success: true as const,
      orderId,
      assignedDeliveryStaffId: staffId,
      assignedDriverName: staff?.name || null,
    };
  }

  /** List delivery-role staff for assign dropdown. */
  static async listDeliveryStaff(merchantId: string) {
    await this.ensureSchema();
    const db = getDb();
    const roles = await db.query.merchantRoles.findMany({
      where: eq(schema.merchantRoles.merchantId, merchantId),
    });
    const deliveryRoleIds = roles
      .filter((r) => {
        const perms = (r.permissions || "").split(",").map((s) => s.trim());
        return perms.includes("DELIVERY_ORDERS");
      })
      .map((r) => r.id);

    if (!deliveryRoleIds.length) return [];

    return db.query.merchantStaff.findMany({
      where: and(
        eq(schema.merchantStaff.merchantId, merchantId),
        eq(schema.merchantStaff.isActive, true),
        inArray(schema.merchantStaff.roleId, deliveryRoleIds)
      ),
      columns: { id: true, name: true, roleId: true },
      orderBy: [asc(schema.merchantStaff.name)],
    });
  }

  /** Guest tracking payload (token required). */
  static async getPublicTracking(
    merchantId: string,
    orderId: string,
    token: string
  ) {
    await this.ensureSchema();
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
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

    let driver: {
      name: string;
      latitude: number;
      longitude: number;
      recordedAt: string;
      stale: boolean;
    } | null = null;

    if (
      order.assignedDeliveryStaffId &&
      (order.status === "out_for_delivery" || order.status === "ready")
    ) {
      const [staff, ping] = await Promise.all([
        db.query.merchantStaff.findFirst({
          where: eq(schema.merchantStaff.id, order.assignedDeliveryStaffId),
          columns: { name: true },
        }),
        db.query.deliveryDriverLocations.findFirst({
          where: and(
            eq(schema.deliveryDriverLocations.merchantId, merchantId),
            eq(schema.deliveryDriverLocations.staffId, order.assignedDeliveryStaffId)
          ),
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
      where: eq(schema.merchants.id, merchantId),
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
  static async completeDeliveryAsDriver(merchantId: string, staffId: string, orderId: string) {
    await this.ensureSchema();
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
    });
    if (!order) throw new Error("Order not found");
    if (order.assignedDeliveryStaffId !== staffId) {
      throw new Error("This delivery is not assigned to you");
    }
    if (order.fulfillmentChannel !== "delivery") {
      throw new Error("Not a delivery order");
    }
    if (order.status !== "ready" && order.status !== "out_for_delivery") {
      throw new Error("Order cannot be marked delivered in current status");
    }
    const { OrderService } = await import("@/services/order.service");
    return OrderService.applyOrderAction(merchantId, orderId, "complete", {});
  }

  /** Latest driver ping for an order (merchant orders board). */
  static async getDriverPingForOrder(merchantId: string, orderId: string) {
    await this.ensureSchema();
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
      columns: { assignedDeliveryStaffId: true },
    });
    if (!order?.assignedDeliveryStaffId) return null;
    const staff = await db.query.merchantStaff.findFirst({
      where: eq(schema.merchantStaff.id, order.assignedDeliveryStaffId),
      columns: { id: true, name: true },
    });
    const ping = await db.query.deliveryDriverLocations.findFirst({
      where: and(
        eq(schema.deliveryDriverLocations.merchantId, merchantId),
        eq(schema.deliveryDriverLocations.staffId, order.assignedDeliveryStaffId)
      ),
    });
    if (!staff) return null;
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
  static async listCompletedForDriver(merchantId: string, staffId: string, dateYmd?: string) {
    const { DeliveryDriverPayService } = await import("@/services/delivery-driver-pay.service");
    const summary = await DeliveryDriverPayService.getDailySummary(merchantId, staffId, dateYmd);
    return summary.completedOrders;
  }

  /** Seed demo driver positions around merchant HQ (for demo merchant). */
  static async seedDemoDriverLocations(
    merchantId: string,
    drivers: Array<{ staffId: string; lat: number; lng: number }>
  ) {
    for (const d of drivers) {
      await this.postLocation(merchantId, d.staffId, {
        latitude: d.lat,
        longitude: d.lng,
        accuracyM: 12,
      });
    }
  }
}
