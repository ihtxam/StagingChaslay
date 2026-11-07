import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { roundMoney2 } from "@/lib/money";
import { enterKitchenFromOrder } from "@/services/kitchen-ingress.service";

type ShopLineItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxAmount: number;
  selectedExtras?: unknown;
  comboSelections?: unknown;
  cateringGuestCount?: number | null;
};

const OPEN_QR_STATUSES = new Set([
  "pending",
  "pending_approval",
  "accepted",
  "preparing",
  "ready",
]);

export class QrTableOrderService {
  static async findOpenTabOrder(merchantId: string, tableSessionId: string) {
    const db = getDb();
    const orders = await db.query.orders.findMany({
      where: and(
        eq(schema.orders.merchantId, merchantId),
        eq(schema.orders.tableSessionId, tableSessionId),
        eq(schema.orders.orderSource, "qr_table"),
        ne(schema.orders.status, "cancelled"),
        inArray(schema.orders.paymentStatus, ["cash", "pay_later", "awaiting_payment"])
      ),
      orderBy: [desc(schema.orders.createdAt)],
      limit: 5,
    });
    return orders.find((o) => OPEN_QR_STATUSES.has(String(o.status || ""))) ?? null;
  }

  static async appendRound(
    merchantId: string,
    orderId: string,
    opts: {
      lineItems: ShopLineItem[];
      subtotalDelta: number;
      taxDelta: number;
      totalDelta: number;
      guestNotes?: string | null;
      autoKitchen: boolean;
    }
  ) {
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
    });
    if (!order) throw new Error("Order not found");

    const roundLabel = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Zurich",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());

    for (const line of opts.lineItems) {
      await db.insert(schema.orderItems).values({
        orderId,
        productId: line.productId,
        productName: line.productName,
        quantity: line.quantity.toString(),
        unitPrice: line.unitPrice.toFixed(2),
        totalPrice: line.totalPrice.toFixed(2),
        taxAmount: line.taxAmount.toFixed(2),
        selectedExtras: line.selectedExtras,
        comboSelections: line.comboSelections,
        cateringGuestCount: line.cateringGuestCount ?? null,
      });
    }

    const nextSub = roundMoney2(Number(order.subtotal || 0) + opts.subtotalDelta);
    const nextTax = roundMoney2(Number(order.taxAmount || 0) + opts.taxDelta);
    const nextTotal = roundMoney2(Number(order.total || 0) + opts.totalDelta);

    const roundNote = `[QR round ${roundLabel}]${opts.guestNotes?.trim() ? ` ${opts.guestNotes.trim()}` : ""}`;
    const notes = [order.notes || "", roundNote].filter(Boolean).join("\n");

    const [updated] = await db
      .update(schema.orders)
      .set({
        subtotal: nextSub.toFixed(2),
        taxAmount: nextTax.toFixed(2),
        total: nextTotal.toFixed(2),
        notes,
        status: order.status === "pending_approval" ? "pending_approval" : "preparing",
        updatedAt: new Date(),
      })
      .where(and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)))
      .returning();

    void import("@/services/ods.service")
      .then(({ OdsService }) => OdsService.syncFromOrder(merchantId, updated))
      .catch(() => {});

    if (opts.autoKitchen) {
      void enterKitchenFromOrder(merchantId, orderId, {
        printKitchen: true,
        orderSource: "qr_table",
      });
      await db
        .update(schema.orders)
        .set({ printCount: sql`COALESCE(${schema.orders.printCount}, 0) + 1` })
        .where(eq(schema.orders.id, orderId));
    }

    return updated;
  }
}
