import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { normalizePosPrintSettings, type PosPrinterProfile } from "@/lib/pos-print-settings";
import {
  deliverySlipEscPos,
  kitchenTicketEscPos,
  orderNotificationTicketEscPos,
  reservationTicketEscPos,
} from "@/lib/escpos-tickets";
import { ChaslayFloorService } from "@/services/chaslay-floor.service";

type EscPosTarget = { name: string; paperWidthMm: 58 | 80 };

function printersForRole(
  printers: PosPrinterProfile[] | undefined,
  role: "kitchen" | "receipt",
  fallbackPaper: 58 | 80
): EscPosTarget[] {
  const list = (printers || []).filter((p) => p.enabled !== false && p.name);
  const matched = list.filter((p) =>
    role === "kitchen" ? !!p.printKitchenTickets : !!p.printReceipts
  );
  if (matched.length) {
    return matched.map((p) => ({
      name: p.name,
      paperWidthMm: (p.paperWidthMm === 58 ? 58 : fallbackPaper) as 58 | 80,
    }));
  }
  return [{ name: "", paperWidthMm: fallbackPaper }];
}

function itemExtras(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((e) => {
      if (!e) return "";
      if (typeof e === "string") return e;
      const o = e as { name?: string };
      return String(o.name || "").trim();
    })
    .filter(Boolean);
}

export class PrintJobExpandService {
  static async enqueueReservationPrint(merchantId: string, reservationId: string) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { posPrintSettings: true, name: true, reservationSettings: true },
    });
    const reservation = await db.query.reservations.findFirst({
      where: and(
        eq(schema.reservations.id, reservationId),
        eq(schema.reservations.merchantId, merchantId)
      ),
    });
    if (!merchant || !reservation) return;

    const printSettings = normalizePosPrintSettings(merchant.posPrintSettings);
    const resSettings = merchant.reservationSettings as { autoPrintReservations?: boolean } | null;
    if (printSettings.autoPrintReservations === false || resSettings?.autoPrintReservations === false) {
      return;
    }

    const paper = printSettings.paperWidthMm === 58 ? 58 : 80;
    const targets = printersForRole(printSettings.printers, "kitchen", paper);
    for (const printer of targets) {
      const bytes = reservationTicketEscPos({
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
      await ChaslayFloorService.createPrintJob(merchantId, {
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

  static async enqueueOrderPrint(
    merchantId: string,
    orderId: string,
    opts: {
      printKitchen?: boolean;
      printNotification?: boolean;
      printDeliveryReceipt?: boolean;
      orderSource?: string;
    }
  ) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { posPrintSettings: true, name: true },
    });
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
      with: { items: true },
    });
    if (!merchant || !order) return;

    const printSettings = normalizePosPrintSettings(merchant.posPrintSettings);
    const paper = printSettings.paperWidthMm === 58 ? 58 : 80;
    const source = String(opts.orderSource || order.orderSource || "online_shop");
    const items = (order.items || []).map((i) => ({
      name: String(i.productName || "Item"),
      quantity: Number(i.quantity) || 1,
      extras: itemExtras(i.selectedExtras),
    }));

    const jobs: Array<{ target: EscPosTarget; bytes: Buffer; jobKind: "kitchen" | "receipt"; alertKind: string }> =
      [];

    if (opts.printKitchen && printSettings.autoPrintKitchen !== false) {
      for (const printer of printersForRole(printSettings.printers, "kitchen", paper)) {
        jobs.push({
          target: printer,
          jobKind: "kitchen",
          alertKind: "online_order",
          bytes: kitchenTicketEscPos({
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

    if (opts.printNotification && printSettings.autoPrintReceipt !== false) {
      for (const printer of printersForRole(printSettings.printers, "receipt", paper)) {
        jobs.push({
          target: printer,
          jobKind: "receipt",
          alertKind: "online_order",
          bytes: orderNotificationTicketEscPos({
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

    if (opts.printDeliveryReceipt && printSettings.autoPrintReceipt !== false) {
      for (const printer of printersForRole(printSettings.printers, "receipt", paper)) {
        jobs.push({
          target: printer,
          jobKind: "receipt",
          alertKind: "online_order",
          bytes: deliverySlipEscPos({
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
      await ChaslayFloorService.createPrintJob(merchantId, {
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
  static async materializeRecipePayload(
    merchantId: string,
    payload: Record<string, unknown> | null | undefined
  ): Promise<Record<string, unknown> | null | undefined> {
    if (!payload || typeof payload !== "object") return payload;
    const kind = String(payload.kind || "");
    if (kind === "escpos" && payload.dataBase64) return payload;
    try {
      if (kind === "auto_print_reservation" && payload.reservationId) {
        const db = getDb();
        const merchant = await db.query.merchants.findFirst({
          where: eq(schema.merchants.id, merchantId),
          columns: { posPrintSettings: true, name: true },
        });
        const reservation = await db.query.reservations.findFirst({
          where: and(
            eq(schema.reservations.id, String(payload.reservationId)),
            eq(schema.reservations.merchantId, merchantId)
          ),
        });
        if (!merchant || !reservation) return payload;
        const printSettings = normalizePosPrintSettings(merchant.posPrintSettings);
        const paper = printSettings.paperWidthMm === 58 ? 58 : 80;
        const printer = printersForRole(printSettings.printers, "kitchen", paper)[0];
        const bytes = reservationTicketEscPos({
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
        const db = getDb();
        const merchant = await db.query.merchants.findFirst({
          where: eq(schema.merchants.id, merchantId),
          columns: { posPrintSettings: true, name: true },
        });
        const order = await db.query.orders.findFirst({
          where: and(
            eq(schema.orders.id, String(payload.orderId)),
            eq(schema.orders.merchantId, merchantId)
          ),
          with: { items: true },
        });
        if (!merchant || !order) return payload;
        const printSettings = normalizePosPrintSettings(merchant.posPrintSettings);
        const paper = printSettings.paperWidthMm === 58 ? 58 : 80;
        const items = (order.items || []).map((i) => ({
          name: String(i.productName || "Item"),
          quantity: Number(i.quantity) || 1,
          extras: itemExtras(i.selectedExtras),
        }));
        const source = String(payload.orderSource || order.orderSource || "online_shop");
        if (payload.printKitchen === true) {
          const printer = printersForRole(printSettings.printers, "kitchen", paper)[0];
          const bytes = kitchenTicketEscPos({
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
          const bytes = orderNotificationTicketEscPos({
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
          const bytes = deliverySlipEscPos({
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
    } catch (err) {
      console.warn("Print job materialize failed:", err);
    }
    return payload;
  }
}
