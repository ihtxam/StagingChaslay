import { repairCatalogText } from "@/lib/text-encoding";
import { getDb, schema } from "@/db";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { FloorPlanService } from "@/services/floor-plan.service";
import { roundMoney2, roundTo005 } from "@/lib/money";
import { resolvePosCancelReason } from "@/lib/pos-print-settings";
import { isUsableProductName, resolveOrderItemName } from "@/lib/order-item-name";
import { resolveSalePaymentMethod } from "@/lib/payment-breakdown";

const TICKET_NOTE_RE = /\[ticket:([^\]]+)\]/i;
const TAB_NOTE_RE = /\[tab:([^\]]+)\]/i;

function encodeOrderMetaNotes(opts: {
  existing?: string | null;
  ticketDisplay?: string | null;
  tabNumber?: string | null;
}): string | null {
  let base = String(opts.existing || "")
    .replace(TICKET_NOTE_RE, "")
    .replace(TAB_NOTE_RE, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[·\s]+|[·\s]+$/g, "")
    .trim();
  const tags: string[] = [];
  const ticket = opts.ticketDisplay?.trim();
  const tab = opts.tabNumber != null ? String(opts.tabNumber).trim() : "";
  if (ticket) tags.push(`[ticket:${ticket.replace(/[\[\]]/g, "")}]`);
  if (tab) tags.push(`[tab:${tab.replace(/[\[\]]/g, "")}]`);
  const joined = [...tags, base].filter(Boolean).join(" ").trim();
  return joined || null;
}

function parseTicketFromNotes(notes?: string | null): string | null {
  const m = String(notes || "").match(TICKET_NOTE_RE);
  return m?.[1]?.trim() || null;
}

function parseTabFromNotes(notes?: string | null): string | null {
  const m = String(notes || "").match(TAB_NOTE_RE);
  return m?.[1]?.trim() || null;
}

function normTicketKey(value?: string | null): string {
  const raw = String(value || "")
    .trim()
    .replace(/^#/, "");
  return raw ? `#${raw}` : "";
}

async function findRecentPaidDuplicateOrder(
  db: ReturnType<typeof getDb>,
  merchantId: string,
  opts: { ticketDisplay?: string | null; tabNumber?: string | null; tableId?: string | null }
): Promise<{ id: string } | null> {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const rows = await db.query.orders.findMany({
    where: and(
      eq(schema.orders.merchantId, merchantId),
      gt(schema.orders.createdAt, since),
      inArray(schema.orders.paymentStatus, ["completed", "paid"])
    ),
    orderBy: [desc(schema.orders.createdAt)],
    limit: 150,
    columns: { id: true, notes: true, tableId: true, status: true },
  });
  const ticket = normTicketKey(opts.ticketDisplay);
  const tab = String(opts.tabNumber || "")
    .trim()
    .replace(/^#/, "");
  for (const row of rows) {
    if (String(row.status || "").toLowerCase() === "cancelled") continue;
    const rowTicket = normTicketKey(parseTicketFromNotes(row.notes));
    const rowTab = String(parseTabFromNotes(row.notes) || "")
      .trim()
      .replace(/^#/, "");
    if (ticket && rowTicket && ticket === rowTicket) return row;
    if (tab && rowTab && tab === rowTab) return row;
    if (opts.tableId && row.tableId === opts.tableId) return row;
  }
  return null;
}

export interface SyncSaleItem {
  productClientId?: string;
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxAmount?: number;
  weightKg?: number;
  selectedExtras?: Array<{ id: string; name: string; price: number }>;
  comboSelections?: Array<{
    slotId: string;
    slotName: string;
    productId: string;
    productName: string;
    extraPrice: number;
    selectedExtras?: Array<{ id: string; name: string; price: number }>;
  }>;
  isOpenPrice?: boolean;
  seatNumber?: number | null;
}

export interface SyncSalePayload {
  clientId: string;
  deviceId?: string;
  orderNumber?: string;
  /** Kitchen / takeaway shout number shown to staff & customers, e.g. #4821 */
  ticketDisplay?: string | null;
  /** Staff-assigned tab / takeaway label (may be non-numeric) */
  tabNumber?: string | null;
  paymentMethod: string;
  paymentStatus?: string;
  /** Order lifecycle status; defaults completed for paid sales, accepted for pay-later */
  status?: string;
  /** Required when status is cancelled — stored on the order for EOD/sales reports */
  cancelReason?: string | null;
  cancelledAt?: string | number | null;
  subtotal: number;
  taxAmount: number;
  discountAmount?: number;
  tipAmount?: number;
  roundingAmount?: number;
  amountTendered?: number | null;
  changeDue?: number | null;
  staffName?: string | null;
  staffId?: string | null;
  total: number;
  notes?: string;
  fulfillmentChannel?: "takeaway" | "dine_in" | "delivery";
  /** Alias used by WebPOS / Android receipt publish */
  channel?: string;
  fulfillment_type?: string;
  fulfillmentType?: string;
  completedAt?: string | number;
  /** ISO / epoch — pickup or delivery time (null/omit = ASAP) */
  scheduledFor?: string | number | null;
  pickup_time_ms?: number | string | null;
  pickupTimeMs?: number | string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  shippingAddress?: string | null;
  deliveryLatitude?: number | string | null;
  deliveryLongitude?: number | string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  tableId?: string | null;
  tableLabel?: string | null;
  guestCount?: number | null;
  billSplits?: Array<{
    id: string;
    label: string;
    seatNumber?: number | null;
    amount: number;
    paymentMethod?: string;
    paymentStatus: string;
    paidAt?: string | null;
  }>;
  /** Shared id for split-bill sibling orders */
  masterOrderId?: string | null;
  /** 1-based split check number */
  splitCheckNumber?: number | null;
  /** Adyen POI transaction id from terminal payment */
  adyenReference?: string | null;
  adyenPoiTransactionTimestamp?: string | null;
  adyenCustomerReceiptJson?: string | null;
  adyenCashierReceiptJson?: string | null;
  /** Split tenders for mixed payments */
  paymentBreakdown?: Array<{ method: string; amount: number }> | null;
  pointsEarned?: number | null;
  pointsRedeemed?: number | null;
  pointsDiscount?: number | null;
  items: SyncSaleItem[];
}

function normalizeFulfillmentChannel(
  sale: Pick<
    SyncSalePayload,
    "fulfillmentChannel" | "channel" | "fulfillment_type" | "fulfillmentType"
  >
): "takeaway" | "dine_in" | "delivery" {
  const raw = String(
    sale.fulfillmentChannel || sale.channel || sale.fulfillment_type || sale.fulfillmentType || ""
  )
    .toLowerCase()
    .replace(/-/g, "_");
  if (raw === "dine_in" || raw === "dinein") return "dine_in";
  if (raw === "delivery") return "delivery";
  if (raw === "pickup" || raw === "takeaway" || raw === "walk_in" || raw === "walkin") {
    return "takeaway";
  }
  return "takeaway";
}

function parseScheduledFor(sale: SyncSalePayload): Date | null {
  if (sale.scheduledFor != null && sale.scheduledFor !== "") {
    const d = new Date(sale.scheduledFor);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const ms = Number(sale.pickup_time_ms ?? sale.pickupTimeMs);
  if (Number.isFinite(ms) && ms > 1_000_000) return new Date(ms);
  return null;
}

function asUuidOrNull(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    return null;
  }
  return s;
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string }; message?: string };
  return (
    e?.code === "23505" ||
    e?.cause?.code === "23505" ||
    /duplicate key|unique constraint/i.test(String(e?.message || err || ""))
  );
}

export class SyncService {
  /**
   * Pull catalog changes for offline POS devices.
   */
  static async pullCatalog(merchantId: string, since?: Date) {
    const db = getDb();
    const sinceDate = since || new Date(0);

    const [categories, products, terminals, readers, merchant, onlineOrders] = await Promise.all([
      db.query.categories.findMany({
        where: and(eq(schema.categories.merchantId, merchantId), gt(schema.categories.updatedAt, sinceDate)),
      }),
      db.query.products.findMany({
        where: and(eq(schema.products.merchantId, merchantId), gt(schema.products.updatedAt, sinceDate)),
      }),
      db.query.paymentTerminals.findMany({
        where: eq(schema.paymentTerminals.merchantId, merchantId),
      }),
      db.query.rfidReaders.findMany({
        where: eq(schema.rfidReaders.merchantId, merchantId),
      }),
      db.query.merchants.findFirst({
        where: eq(schema.merchants.id, merchantId),
      }),
      // Online shop orders for POS ongoing board (new + kitchen + ready/delivery)
      db.query.orders.findMany({
        where: and(
          eq(schema.orders.merchantId, merchantId),
          eq(schema.orders.orderType, "web_shop"),
          inArray(schema.orders.status, [
            "pending",
            "pending_approval",
            "accepted",
            "preparing",
            "ready",
            "out_for_delivery",
          ])
        ),
        with: { items: true, customer: true },
        limit: 100,
        orderBy: [desc(schema.orders.createdAt)],
      }),
    ]);

    const diningTables = await FloorPlanService.listTablesForSync(merchantId);
    const { ReservationService } = await import("@/services/reservation.service");
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
  static async pushCatalog(
    merchantId: string,
    payload: {
      categories?: Array<{
        clientId: string;
        name: string;
        description?: string;
        sortOrder?: number;
        color?: string;
      }>;
      products?: Array<{
        clientId: string;
        name: string;
        price: number;
        categoryClientId?: string;
        categoryId?: string;
        sku?: string;
        barcode?: string;
        stock?: number;
        isTaxable?: boolean;
        description?: string;
        productType?: string;
        isOpenPrice?: boolean;
        soldByWeight?: boolean;
        weightUnit?: string;
        bulkPricing?: Array<{ minQty: number; price: number }>;
        extras?: Array<{ id: string; name: string; price: number }>;
        comboItems?: Array<{
          id?: string;
          name?: string;
          minPick?: number;
          maxPick?: number;
          options?: Array<{ productId: string; extraPrice?: number }>;
          productId?: string;
          quantity?: number;
        }>;
        allowExtras?: boolean;
        sortOrder?: number;
      }>;
    }
  ) {
    const db = getDb();
    const categoryMap = new Map<string, string>();
    const productMap = new Map<string, string>();

    for (const cat of payload.categories || []) {
      const existing = await db.query.categories.findFirst({
        where: and(
          eq(schema.categories.merchantId, merchantId),
          eq(schema.categories.clientId, cat.clientId)
        ),
      });
      if (existing) {
        await db
          .update(schema.categories)
          .set({
            name: repairCatalogText(cat.name),
            description: cat.description,
            sortOrder: cat.sortOrder || 0,
            color: cat.color,
            updatedAt: new Date(),
          })
          .where(eq(schema.categories.id, existing.id));
        categoryMap.set(cat.clientId, existing.id);
      } else {
        const [created] = await db
          .insert(schema.categories)
          .values({
            merchantId,
            clientId: cat.clientId,
            name: repairCatalogText(cat.name),
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
            where: and(
              eq(schema.categories.merchantId, merchantId),
              eq(schema.categories.clientId, product.categoryClientId)
            ),
          });
          categoryId = linked?.id;
        }
      }

      const existing = await db.query.products.findFirst({
        where: and(
          eq(schema.products.merchantId, merchantId),
          eq(schema.products.clientId, product.clientId)
        ),
      });

      const values = {
        merchantId,
        clientId: product.clientId,
        name: repairCatalogText(product.name),
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
        await db.update(schema.products).set(values).where(eq(schema.products.id, existing.id));
        productMap.set(product.clientId, existing.id);
      } else {
        const [created] = await db.insert(schema.products).values(values).returning();
        productMap.set(product.clientId, created.id);
      }
    }

    return { categoryMap: Object.fromEntries(categoryMap), productMap: Object.fromEntries(productMap) };
  }

  /**
   * Idempotent push of offline sales/orders.
   */
  static async pushSales(merchantId: string, sales: SyncSalePayload[]) {
    const db = getDb();
    const results: Array<{
      clientId: string;
      orderId: string;
      created: boolean;
      skipped?: boolean;
      invoiceNumber?: string | null;
    }> = [];

    for (const sale of sales) {
      const existing = await db.query.orders.findFirst({
        where: and(eq(schema.orders.merchantId, merchantId), eq(schema.orders.clientId, sale.clientId)),
      });
      if (existing) {
        results.push({ clientId: sale.clientId, orderId: existing.id, created: false });
        continue;
      }

      // Reject empty / zero-total pushes (e.g. re-confirm after pay-later cleared the cart).
      const isCancelledEarly = String(sale.status || "").toLowerCase() === "cancelled";
      const earlyTotal = roundTo005(Number(sale.total) || 0);
      const itemCount = Array.isArray(sale.items) ? sale.items.length : 0;
      if (!isCancelledEarly && (itemCount === 0 || earlyTotal <= 0.001)) {
        // Do not return a phantom orderId — callers must not build QR URLs for skipped sales.
        results.push({ clientId: sale.clientId, orderId: "", created: false, skipped: true });
        continue;
      }

      const payLaterEarly =
        String(sale.paymentStatus || "").toLowerCase() === "awaiting_payment" ||
        sale.paymentMethod === "pay_later" ||
        sale.paymentMethod === "pay-later" ||
        String(sale.paymentMethod || "").toLowerCase() === "invoice";
      if (!isCancelledEarly && !payLaterEarly) {
        const dup = await findRecentPaidDuplicateOrder(db, merchantId, {
          ticketDisplay: sale.ticketDisplay,
          tabNumber: sale.tabNumber,
          tableId: sale.tableId,
        });
        if (dup) {
          throw new Error(
            `Ticket ${sale.ticketDisplay || sale.tabNumber || "unknown"} was already paid`
          );
        }
      }

      const baseOrderNumber = String(sale.orderNumber || `POS-${sale.clientId}`).slice(0, 40);
      const subtotal = roundMoney2(Number(sale.subtotal) || 0);
      const taxAmount = roundMoney2(Number(sale.taxAmount) || 0);
      const discountAmount = roundMoney2(Number(sale.discountAmount) || 0);
      const tipAmount = roundMoney2(Math.max(0, Number(sale.tipAmount) || 0));
      const roundingAmount = roundMoney2(Number(sale.roundingAmount) || 0);
      // Prefer client total (already rounded on POS); otherwise compute
      const total = roundTo005(
        sale.total != null
          ? Number(sale.total)
          : subtotal + taxAmount - discountAmount + tipAmount + roundingAmount
      );
      const isCancelled = String(sale.status || "").toLowerCase() === "cancelled";
      const cancelReason = isCancelled
        ? resolvePosCancelReason(String(sale.cancelReason || ""))
        : null;
      if (isCancelled && !cancelReason) {
        throw new Error("Cancel reason is required for cancelled sales");
      }
      let cancelledAt: Date | null = null;
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
      const isInvoice =
        !isCancelled &&
        (String(sale.paymentMethod || "").toLowerCase().replace(/-/g, "_") === "invoice");
      const payLater =
        !isCancelled &&
        (payStatus === "awaiting_payment" ||
          sale.paymentMethod === "pay_later" ||
          sale.paymentMethod === "pay-later" ||
          isInvoice);
      const scheduledFor = parseScheduledFor(sale);
      const channel = normalizeFulfillmentChannel(sale);
      const status =
        sale.status ||
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

      let deliveryLat: string | null = null;
      let deliveryLng: string | null = null;
      let deliveryTrackingToken: string | null = null;
      if (channel === "delivery") {
        const { generateDeliveryTrackingToken } = await import("@/lib/delivery-tracking-url");
        deliveryTrackingToken = generateDeliveryTrackingToken();
        const latRaw = sale.deliveryLatitude ?? sale.lat;
        const lngRaw = sale.deliveryLongitude ?? sale.lng;
        const latNum = latRaw != null ? Number(latRaw) : NaN;
        const lngNum = lngRaw != null ? Number(lngRaw) : NaN;
        if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
          deliveryLat = String(latNum);
          deliveryLng = String(lngNum);
        } else if (sale.shippingAddress?.trim()) {
          try {
            const { geocodeQuery } = await import("@/lib/geocode");
            const geo = await geocodeQuery(sale.shippingAddress.trim());
            if (geo.found) {
              deliveryLat = String(geo.lat);
              deliveryLng = String(geo.lng);
            }
          } catch {
            /* geocode optional */
          }
        }
      }

      const orderValuesBase = {
        merchantId,
        orderType: "pos" as const,
        fulfillmentChannel: channel,
        status,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        tipAmount: tipAmount.toFixed(2),
        roundingAmount: roundingAmount.toFixed(2),
        amountTendered:
          sale.amountTendered != null && Number.isFinite(Number(sale.amountTendered))
            ? roundMoney2(Number(sale.amountTendered)).toFixed(2)
            : null,
        changeDue:
          sale.changeDue != null && Number.isFinite(Number(sale.changeDue))
            ? roundMoney2(Number(sale.changeDue)).toFixed(2)
            : null,
        staffName: sale.staffName ? String(sale.staffName).trim().slice(0, 255) : null,
        staffId: asUuidOrNull(sale.staffId),
        total: total.toFixed(2),
        pointsEarned:
          sale.pointsEarned != null && Number.isFinite(Number(sale.pointsEarned))
            ? Math.max(0, Math.floor(Number(sale.pointsEarned)))
            : 0,
        pointsRedeemed:
          sale.pointsRedeemed != null && Number.isFinite(Number(sale.pointsRedeemed))
            ? Math.max(0, Math.floor(Number(sale.pointsRedeemed)))
            : 0,
        pointsDiscount:
          sale.pointsDiscount != null && Number.isFinite(Number(sale.pointsDiscount))
            ? roundMoney2(Number(sale.pointsDiscount)).toFixed(2)
            : "0",
        paymentBreakdown: sale.paymentBreakdown?.length ? sale.paymentBreakdown : null,
        paymentMethod: isCancelled
          ? sale.paymentMethod || null
          : resolveSalePaymentMethod(sale.paymentBreakdown || [], sale.paymentMethod),
        paymentStatus: isInvoice ? "awaiting_payment" : payStatus,
        adyenReference: sale.adyenReference ? String(sale.adyenReference).trim() : null,
        adyenPoiTransactionTs: (() => {
          if (
            sale.adyenPoiTransactionTimestamp == null ||
            !String(sale.adyenPoiTransactionTimestamp).trim()
          ) {
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
          tabNumber:
            sale.tabNumber != null && String(sale.tabNumber).trim()
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
        deliveryLatitude: deliveryLat,
        deliveryLongitude: deliveryLng,
        deliveryTrackingToken,
        tableId: asUuidOrNull(sale.tableId),
        tableLabel: sale.tableLabel || null,
        guestCount:
          sale.guestCount != null && Number.isFinite(Number(sale.guestCount))
            ? Number(sale.guestCount)
            : null,
        billSplits: sale.billSplits || [],
        masterOrderId: sale.masterOrderId ? String(sale.masterOrderId).trim().slice(0, 64) : null,
        splitCheckNumber:
          sale.splitCheckNumber != null && Number.isFinite(Number(sale.splitCheckNumber))
            ? Number(sale.splitCheckNumber)
            : null,
        clientId: sale.clientId,
        deviceId: sale.deviceId || null,
        syncedAt: new Date(),
        completedAt,
        cancelReason,
        cancelledAt,
      };

      let order: { id: string } | undefined;
      let orderNumber = baseOrderNumber;
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          const [row] = await db
            .insert(schema.orders)
            .values({ ...orderValuesBase, orderNumber })
            .returning();
          order = row;
          break;
        } catch (err) {
          if (isUniqueViolation(err) && attempt < 5) {
            orderNumber = `${baseOrderNumber}-${Math.random().toString(36).slice(2, 6)}`.slice(
              0,
              50
            );
            continue;
          }
          const cause = (err as { cause?: unknown })?.cause;
          const detail =
            (cause as { message?: string })?.message ||
            (err as Error)?.message ||
            String(err);
          throw new Error(`Failed to insert sale order: ${detail}`);
        }
      }
      if (!order) throw new Error("Failed to insert sale order");

      for (const item of sale.items) {
        let productId = asUuidOrNull(item.productId);
        let catalogName: string | null = null;
        const incomingName = isUsableProductName(item.productName)
          ? String(item.productName).trim()
          : null;

        if (!productId && item.productClientId) {
          const linked = await db.query.products.findFirst({
            where: and(
              eq(schema.products.merchantId, merchantId),
              eq(schema.products.clientId, item.productClientId)
            ),
          });
          productId = linked?.id ?? null;
          catalogName = linked?.name ?? null;
        } else if (productId) {
          const linked = await db.query.products.findFirst({
            where: and(
              eq(schema.products.id, productId),
              eq(schema.products.merchantId, merchantId)
            ),
          });
          if (!linked) {
            productId = null;
          } else {
            catalogName = linked.name ?? null;
          }
        }

        const resolvedName = resolveOrderItemName(incomingName, catalogName);
        const weightRaw = item.weightKg;
        const weightKg =
          weightRaw != null && String(weightRaw).trim() !== "" && Number.isFinite(Number(weightRaw))
            ? String(weightRaw)
            : null;
        const seatRaw = item.seatNumber;
        const seatNumber =
          seatRaw != null && String(searRaw).trim() !== "" && Number.isFinite(Number(seatRaw))
            ? Math.floor(Number(seatRaw))
            : null;

        await db.insert(schema.orderItems).values({
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
          await FloorPlanService.setTableStatus(merchantId, sale.tableId, "available", null);
        } catch {
          // Table may have been deleted from designer; ignore
        }
      }

      let invoiceNumber: string | null = null;
      if (isInvoice) {
        try {
          const { InvoiceService } = await import("@/services/invoice.service");
          invoiceNumber = await InvoiceService.ensureInvoiceNumber(merchantId, order.id);
          const customerEmail = String(sale.customerEmail || "").trim();
          if (customerEmail) {
            void InvoiceService.sendEmail(merchantId, order.id, { to: customerEmail }).catch(
              (err) => console.warn("[sync] invoice email failed:", err)
            );
          }
        } catch (err) {
          console.warn("[sync] invoice number assign failed:", err);
        }
      }

      const paid =
        !isCancelled &&
        !payLater &&
        (String(orderValuesBase.paymentStatus || "").toLowerCase() === "completed" ||
          String(orderValuesBase.paymentStatus || "").toLowerCase() === "paid");
      if (paid) {
        try {
          const { InventoryService } = await import("@/services/inventory.service");
          await InventoryService.deductForPaidOrder(merchantId, order.id);
        } catch (invErr) {
          console.warn("[sync] inventory deduct failed:", invErr);
        }
      }

      if (!isCancelled) {
        void import("@/services/ods.service")
          .then(({ OdsService }) =>
            OdsService.syncFromOrder(merchantId, {
              orderNumber,
              notes: orderValuesBase.notes,
              status: orderValuesBase.status,
            })
          )
          .catch(() => {});
      }

      results.push({ clientId: sale.clientId, orderId: order.id, created: true, invoiceNumber });
    }

    return { results };
  }
}
