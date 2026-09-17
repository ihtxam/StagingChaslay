import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  billDisplayLabel,
  calcSplitPaymentAmounts,
  filterOpenBillsForStaff,
  heldBillIdentity,
  heldCartTotal,
  matchBillByTableInput,
  parseReferenceFromEventDetails,
  type OpenBillRow,
} from "@/lib/adyen-pay-at-x-bills";
import {
  parseEventNotification,
  parseInputResponse,
  parseSplitPaymentResponse,
  type SplitPaymentParseResult,
} from "@/lib/adyen-poi-builders";
import { isFullyPaidTicket, OPEN_TICKET_STATUSES } from "@/lib/pos-open-ticket";
import { normalizePosCheckoutSettings } from "@/lib/pos-checkout-settings";
import { roundMoney2 } from "@/lib/money";
import { resolveOrderItemName } from "@/lib/order-item-name";
import { withMerchantSchemaRetry } from "@/lib/ensure-merchant-schema";
import { AdyenService } from "@/services/adyen.service";
import { AdyenTerminalPoiService } from "@/services/adyen-terminal-poi.service";
import { PosOrdersService } from "@/services/pos-orders.service";

type PayAtXSessionStatus =
  | "awaiting_payment"
  | "awaiting_input"
  | "active"
  | "completed"
  | "cancelled";

type RequestLike = {
  protocol?: string;
  get(name: string): string | undefined;
};

const ACTIVE_STATUSES: PayAtXSessionStatus[] = [
  "awaiting_payment",
  "awaiting_input",
  "active",
];

function newSaleTransactionRef(): { id: string; timestamp: string } {
  return {
    id: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
    timestamp: new Date().toISOString(),
  };
}

function parseHeldCartLines(cartJson: unknown) {
  let data: unknown = cartJson;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      data = null;
    }
  }
  const lines = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { cart?: unknown }).cart)
      ? (data as { cart: unknown[] }).cart
      : [];
  const channel =
    !Array.isArray(data) && data && typeof data === "object"
      ? String((data as { channel?: string }).channel || "takeaway")
      : "takeaway";
  const tableLabel =
    !Array.isArray(data) && data && typeof data === "object"
      ? ((data as { tableLabel?: string | null }).tableLabel || null)
      : null;
  const notes =
    !Array.isArray(data) && data && typeof data === "object"
      ? ((data as { orderNote?: string }).orderNote || null)
      : null;
  return { lines, channel, tableLabel, notes };
}

export class AdyenPayAtXService {
  static terminalWebhookUrl(merchantId: string): string {
    const base =
      process.env.PUBLIC_APP_URL ||
      process.env.MERCHANT_DASHBOARD_URL ||
      "https://app.rebornsense.com";
    const apiBase = base.replace(/\/$/, "").includes("api.")
      ? base.replace(/\/$/, "")
      : `${base.replace(/\/$/, "")}/api`;
    return `${apiBase}/webhooks/adyen-terminal/${merchantId}`;
  }

  static terminalWebhookUrlFromRequest(merchantId: string, req: RequestLike): string {
    const proto = (req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0]?.trim();
    const host = (req.get("x-forwarded-host") || req.get("host") || "").split(",")[0]?.trim();
    if (host && proto) {
      const origin = `${proto}://${host}`.replace(/\/$/, "");
      const apiBase = origin.includes("/api") ? origin : `${origin}/api`;
      return `${apiBase}/webhooks/adyen-terminal/${merchantId}`;
    }
    return this.terminalWebhookUrl(merchantId);
  }

  static async resolveMerchantByPoiId(poiId: string): Promise<string | null> {
    const db = getDb();
    const terminal = await db.query.paymentTerminals.findFirst({
      where: eq(schema.paymentTerminals.terminalId, poiId),
      columns: { merchantId: true, status: true },
    });
    if (!terminal || terminal.status === "inactive") return null;
    return terminal.merchantId;
  }

  static async findStaffByPinDisplay(merchantId: string, ref: string | null) {
    if (!ref) return null;
    const db = getDb();
    const staff = await db.query.merchantStaff.findFirst({
      where: and(
        eq(schema.merchantStaff.merchantId, merchantId),
        eq(schema.merchantStaff.pinDisplay, ref),
        eq(schema.merchantStaff.isActive, true)
      ),
      columns: { id: true, name: true, pinDisplay: true },
    });
    return staff || null;
  }

  static async listOpenBills(
    merchantId: string,
    opts: { staffId?: string | null; limit?: number } = {}
  ): Promise<OpenBillRow[]> {
    const db = getDb();
    const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 100);
    const rows = await db.query.heldOrders.findMany({
      where: and(
        eq(schema.heldOrders.merchantId, merchantId),
        inArray(schema.heldOrders.status, [...OPEN_TICKET_STATUSES]),
        isNull(schema.heldOrders.closedAt)
      ),
      orderBy: [desc(schema.heldOrders.updatedAt)],
      limit,
    });
    const bills: OpenBillRow[] = rows.map((row) => ({
      id: row.id,
      label: row.label,
      staffId: row.staffId,
      cartJson: row.cartJson,
      paidTotal: row.paidTotal,
    }));
    return filterOpenBillsForStaff(bills, opts.staffId);
  }

  static async listActiveSessions(merchantId: string) {
    return withMerchantSchemaRetry(async () => {
      const db = getDb();
      const sessions = await db.query.payAtXSessions.findMany({
        where: and(
          eq(schema.payAtXSessions.merchantId, merchantId),
          inArray(schema.payAtXSessions.status, ACTIVE_STATUSES)
        ),
        orderBy: [desc(schema.payAtXSessions.updatedAt)],
        limit: 50,
      });

      const heldIds = sessions.map((s) => s.heldOrderId).filter(Boolean) as string[];
      const heldRows =
        heldIds.length
          ? await db.query.heldOrders.findMany({
              where: and(
                eq(schema.heldOrders.merchantId, merchantId),
                inArray(schema.heldOrders.id, heldIds)
              ),
            })
          : [];
      const heldById = new Map(heldRows.map((h) => [h.id, h]));

      return sessions.map((session) => {
        const held = session.heldOrderId ? heldById.get(session.heldOrderId) : null;
        const ident = held ? heldBillIdentity(held.cartJson) : null;
        return {
          id: session.id,
          heldOrderId: session.heldOrderId,
          terminalPoiId: session.terminalPoiId,
          staffReference: session.staffReference,
          paidAmount: Number(session.paidAmount) || 0,
          cartTotal: Number(session.cartTotal) || 0,
          status: session.status,
          inputStep: session.inputStep,
          ticketDisplay: ident?.ticketDisplay || null,
          tableId: ident?.tableId || null,
          tableLabel: ident?.tableLabel || null,
          updatedAt: session.updatedAt,
        };
      });
    });
  }

  static async isEnabled(merchantId: string): Promise<boolean> {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { posCheckoutSettings: true },
    });
    return normalizePosCheckoutSettings(merchant?.posCheckoutSettings).payAtXEnabled === true;
  }

  static async handleWebhookBody(merchantId: string, body: unknown): Promise<void> {
    const event = parseEventNotification(body);
    if (event?.eventToNotify.toLowerCase() === "salewakeup") {
      const poiId = event.poiId || "";
      await this.handleSaleWakeUp(merchantId, poiId, event.eventDetails);
      return;
    }

    const paymentResponse = (body as Record<string, unknown>)?.SaleToPOIResponse
      ? body
      : null;
    if (paymentResponse) {
      const parsed = parseSplitPaymentResponse(paymentResponse);
      const header = (
        (paymentResponse as Record<string, unknown>).SaleToPOIResponse as Record<string, unknown>
      )?.MessageHeader as Record<string, unknown> | undefined;
      const poiId = typeof header?.POIID === "string" ? header.POIID : "";
      if (parsed.status !== "error") {
        await this.handlePaymentResponse(merchantId, poiId, parsed);
      }
      return;
    }

    const input = parseInputResponse(body);
    if (input) {
      const poiId = input.poiId || "";
      await this.handleInputResponse(merchantId, poiId, input);
    }
  }

  static async handleSaleWakeUp(
    merchantId: string,
    poiId: string,
    eventDetails?: string | null
  ): Promise<void> {
    if (!(await this.isEnabled(merchantId))) {
      console.info("[pay-at-x] disabled", { merchantId, poiId });
      return;
    }

    const staffRef = parseReferenceFromEventDetails(eventDetails);
    const staff = await this.findStaffByPinDisplay(merchantId, staffRef);
    const bills = await this.listOpenBills(merchantId, { staffId: staff?.id });

    if (!bills.length) {
      await AdyenTerminalPoiService.sendDisplayMessage(merchantId, {
        terminalId: poiId,
        message: "No open bills found on the till.",
      });
      return;
    }

    if (bills.length === 1) {
      await this.startPaymentSession(merchantId, poiId, bills[0]!, staffRef);
      return;
    }

    const db = getDb();
    const [session] = await db
      .insert(schema.payAtXSessions)
      .values({
        merchantId,
        terminalPoiId: poiId,
        staffReference: staffRef,
        cartTotal: "0",
        status: "awaiting_input",
        inputStep: "table_number",
      })
      .returning();

    await AdyenTerminalPoiService.sendInputRequest(merchantId, {
      terminalId: poiId,
      mode: "text",
      prompt: "Enter table number",
      placeholder: "Table / ticket #",
    });

    console.info("[pay-at-x] awaiting table input", {
      merchantId,
      poiId,
      sessionId: session.id,
      billCount: bills.length,
    });
  }

  static async handleInputResponse(
    merchantId: string,
    poiId: string,
    input: { textInput?: string | null; menuEntryNumber?: number | null }
  ): Promise<void> {
    const db = getDb();
    const session = await db.query.payAtXSessions.findFirst({
      where: and(
        eq(schema.payAtXSessions.merchantId, merchantId),
        eq(schema.payAtXSessions.terminalPoiId, poiId),
        inArray(schema.payAtXSessions.status, ["awaiting_input", "active"])
      ),
      orderBy: [desc(schema.payAtXSessions.updatedAt)],
    });
    if (!session) return;

    const staff = await this.findStaffByPinDisplay(merchantId, session.staffReference);
    const bills = await this.listOpenBills(merchantId, { staffId: staff?.id });

    if (session.inputStep === "table_number") {
      const matches = matchBillByTableInput(bills, input.textInput || "");
      if (!matches.length) {
        await AdyenTerminalPoiService.sendDisplayMessage(merchantId, {
          terminalId: poiId,
          message: "No bill matches that table number.",
        });
        await db
          .update(schema.payAtXSessions)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(schema.payAtXSessions.id, session.id));
        return;
      }

      if (matches.length === 1) {
        await this.startPaymentSession(merchantId, poiId, matches[0]!, session.staffReference, session.id);
        return;
      }

      const menuIds = matches.map((b) => b.id).join(",");
      await db
        .update(schema.payAtXSessions)
        .set({ inputStep: `bill_menu:${menuIds}`, updatedAt: new Date() })
        .where(eq(schema.payAtXSessions.id, session.id));

      await AdyenTerminalPoiService.sendInputRequest(merchantId, {
        terminalId: poiId,
        mode: "menu",
        prompt: "Select bill",
        subtitle: `${matches.length} open bills`,
        menuEntries: matches.map((bill) => ({
          label: billDisplayLabel(bill),
          sublabel: `CHF ${heldCartTotal(bill.cartJson).toFixed(2)}`,
        })),
      });
      return;
    }

    if (session.inputStep?.startsWith("bill_menu:")) {
      const idx = Number(input.menuEntryNumber);
      const menuIds = session.inputStep.slice("bill_menu:".length).split(",").filter(Boolean);
      const menuIndex = idx > 0 ? idx - 1 : 0;
      const selectedId = menuIds[menuIndex];
      const selected = bills.find((b) => b.id === selectedId) || null;
      if (!selected) {
        await AdyenTerminalPoiService.sendDisplayMessage(merchantId, {
          terminalId: poiId,
          message: "Invalid bill selection.",
        });
        return;
      }
      await this.startPaymentSession(
        merchantId,
        poiId,
        selected,
        session.staffReference,
        session.id
      );
    }
  }

  static async handlePaymentResponse(
    merchantId: string,
    poiId: string,
    paymentResponse: SplitPaymentParseResult
  ): Promise<void> {
    if (paymentResponse.status === "pay_later") {
      const db = getDb();
      const session = await this.findActiveSession(merchantId, poiId, paymentResponse.saleTransactionId);
      if (session) {
        await db
          .update(schema.payAtXSessions)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(schema.payAtXSessions.id, session.id));
      }
      return;
    }

    if (paymentResponse.status === "cancelled" || paymentResponse.status === "failure") {
      const db = getDb();
      const session = await this.findActiveSession(merchantId, poiId, paymentResponse.saleTransactionId);
      if (session) {
        await db
          .update(schema.payAtXSessions)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(schema.payAtXSessions.id, session.id));
      }
      if (paymentResponse.message) {
        await AdyenTerminalPoiService.sendDisplayMessage(merchantId, {
          terminalId: poiId,
          message: paymentResponse.message,
        });
      }
      return;
    }

    const authorized = Number(paymentResponse.authorizedAmount) || 0;
    if (authorized <= 0) return;

    const db = getDb();
    const session = await this.findActiveSession(merchantId, poiId, paymentResponse.saleTransactionId);
    if (!session?.heldOrderId) return;

    const newPaid = roundMoney2(Number(session.paidAmount) + authorized);
    await db
      .update(schema.payAtXSessions)
      .set({
        paidAmount: newPaid.toFixed(2),
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(schema.payAtXSessions.id, session.id));

    await db
      .update(schema.heldOrders)
      .set({ paidTotal: newPaid.toFixed(2), updatedAt: new Date() })
      .where(
        and(
          eq(schema.heldOrders.id, session.heldOrderId),
          eq(schema.heldOrders.merchantId, merchantId)
        )
      );

    const cartTotal = Number(session.cartTotal) || 0;
    const fullyPaid =
      paymentResponse.status === "success" || isFullyPaidTicket(cartTotal, newPaid);

    if (fullyPaid) {
      await this.finalizePaidBill(merchantId, session.id, {
        poiTransactionId: paymentResponse.poiTransactionId,
        poiTransactionTimestamp: paymentResponse.poiTransactionTimestamp,
        paidTotal: newPaid,
      });
      return;
    }

    const amounts = calcSplitPaymentAmounts(cartTotal, newPaid);
    if (amounts.requestedAmount > 0 && session.saleTransactionId && session.saleTransactionTimestamp) {
      const nextResult = await AdyenTerminalPoiService.sendSplitPayment(merchantId, {
        terminalId: poiId,
        requestedAmount: amounts.requestedAmount,
        paidAmount: amounts.paidAmount,
        saleTransactionId: session.saleTransactionId,
        saleTransactionTimestamp: session.saleTransactionTimestamp,
      });
      if (nextResult.status !== "error") {
        await this.handlePaymentResponse(merchantId, poiId, nextResult);
      }
    }
  }

  private static async findActiveSession(
    merchantId: string,
    poiId: string,
    saleTransactionId?: string | null
  ) {
    const db = getDb();
    if (saleTransactionId) {
      const bySale = await db.query.payAtXSessions.findFirst({
        where: and(
          eq(schema.payAtXSessions.merchantId, merchantId),
          eq(schema.payAtXSessions.saleTransactionId, saleTransactionId),
          inArray(schema.payAtXSessions.status, [...ACTIVE_STATUSES, "active"])
        ),
        orderBy: [desc(schema.payAtXSessions.updatedAt)],
      });
      if (bySale) return bySale;
    }

    return db.query.payAtXSessions.findFirst({
      where: and(
        eq(schema.payAtXSessions.merchantId, merchantId),
        eq(schema.payAtXSessions.terminalPoiId, poiId),
        inArray(schema.payAtXSessions.status, [...ACTIVE_STATUSES, "active"])
      ),
      orderBy: [desc(schema.payAtXSessions.updatedAt)],
    });
  }

  private static async startPaymentSession(
    merchantId: string,
    poiId: string,
    bill: OpenBillRow,
    staffReference?: string | null,
    existingSessionId?: string
  ) {
    const db = getDb();
    const existingPaid = Number(bill.paidTotal) || 0;
    const cartTotal = heldCartTotal(bill.cartJson);
    const amounts = calcSplitPaymentAmounts(cartTotal, existingPaid);
    const saleTx = newSaleTransactionRef();

    let sessionId = existingSessionId;
    if (sessionId) {
      await db
        .update(schema.payAtXSessions)
        .set({
          heldOrderId: bill.id,
          staffReference: staffReference || null,
          saleTransactionId: saleTx.id,
          saleTransactionTimestamp: saleTx.timestamp,
          paidAmount: amounts.paidAmount.toFixed(2),
          cartTotal: amounts.cartTotal.toFixed(2),
          status: "awaiting_payment",
          inputStep: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.payAtXSessions.id, sessionId));
    } else {
      const [created] = await db
        .insert(schema.payAtXSessions)
        .values({
          merchantId,
          heldOrderId: bill.id,
          terminalPoiId: poiId,
          staffReference: staffReference || null,
          saleTransactionId: saleTx.id,
          saleTransactionTimestamp: saleTx.timestamp,
          paidAmount: amounts.paidAmount.toFixed(2),
          cartTotal: amounts.cartTotal.toFixed(2),
          status: "awaiting_payment",
        })
        .returning();
      sessionId = created.id;
    }

    const paymentResult = await AdyenTerminalPoiService.sendSplitPayment(merchantId, {
      terminalId: poiId,
      requestedAmount: amounts.requestedAmount,
      paidAmount: amounts.paidAmount,
      saleTransactionId: saleTx.id,
      saleTransactionTimestamp: saleTx.timestamp,
    });
    if (paymentResult.status !== "error") {
      await this.handlePaymentResponse(merchantId, poiId, paymentResult);
    }

    console.info("[pay-at-x] split payment started", {
      merchantId,
      poiId,
      sessionId,
      heldOrderId: bill.id,
      requestedAmount: amounts.requestedAmount,
      paidAmount: amounts.paidAmount,
    });
  }

  static async finalizePaidBill(
    merchantId: string,
    sessionId: string,
    opts: {
      poiTransactionId?: string | null;
      poiTransactionTimestamp?: string | null;
      paidTotal: number;
    }
  ) {
    const db = getDb();
    const session = await db.query.payAtXSessions.findFirst({
      where: and(
        eq(schema.payAtXSessions.id, sessionId),
        eq(schema.payAtXSessions.merchantId, merchantId)
      ),
    });
    if (!session?.heldOrderId) return;

    const held = await db.query.heldOrders.findFirst({
      where: and(
        eq(schema.heldOrders.id, session.heldOrderId),
        eq(schema.heldOrders.merchantId, merchantId)
      ),
    });
    if (!held) return;

    const ident = heldBillIdentity(held.cartJson);
    const { lines, channel, tableLabel, notes } = parseHeldCartLines(held.cartJson);
    let subtotal = 0;
    for (const line of lines) {
      subtotal += Number((line as { lineTotal?: unknown }).lineTotal) || 0;
    }
    subtotal = roundMoney2(subtotal);
    const paidTotal = roundMoney2(opts.paidTotal);
    const clientId = `payatx-${session.id}`.slice(0, 64);
    const orderNumber = `PAX-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 5)
      .toUpperCase()}`.slice(0, 50);

    const [order] = await db
      .insert(schema.orders)
      .values({
        merchantId,
        orderNumber,
        orderType: "pos",
        fulfillmentChannel: held.channel || channel || "dine_in",
        status: "completed",
        subtotal: subtotal.toFixed(2),
        taxAmount: "0.00",
        discountAmount: "0.00",
        tipAmount: "0.00",
        roundingAmount: "0.00",
        total: paidTotal.toFixed(2),
        paymentMethod: "terminal",
        paymentStatus: "completed",
        notes: notes || held.notes || null,
        tableLabel: tableLabel || ident.tableLabel || null,
        staffName: held.staffName || null,
        staffId: held.staffId || null,
        clientId,
        completedAt: new Date(),
        syncedAt: new Date(),
      })
      .returning();

    for (const line of lines) {
      const row = line as {
        name?: string;
        quantity?: number;
        unitPrice?: number;
        lineTotal?: number;
        selectedExtras?: unknown;
        comboSelections?: unknown;
        isOpenPrice?: boolean;
      };
      const qty = Number(row.quantity) || 1;
      const totalPrice = roundMoney2(Number(row.lineTotal || 0));
      const unitPrice = roundMoney2(
        Number(row.unitPrice != null ? row.unitPrice : qty ? totalPrice / qty : 0)
      );
      await db.insert(schema.orderItems).values({
        orderId: order.id,
        productId: null,
        productName: resolveOrderItemName(row.name),
        quantity: String(qty),
        unitPrice: unitPrice.toFixed(2),
        totalPrice: totalPrice.toFixed(2),
        taxAmount: "0.00",
        selectedExtras: Array.isArray(row.selectedExtras) ? row.selectedExtras : [],
        comboSelections: Array.isArray(row.comboSelections) ? row.comboSelections : [],
        isOpenPrice: !!row.isOpenPrice,
      });
    }

    try {
      await AdyenService.recordPaymentTransaction(
        merchantId,
        order.id,
        paidTotal,
        "terminal",
        opts.poiTransactionId || `payatx-${session.id}`,
        "completed",
        { poiTransactionTimestamp: opts.poiTransactionTimestamp }
      );
    } catch (err) {
      console.warn("[pay-at-x] record payment failed:", err);
    }

    await PosOrdersService.releaseHeldByIdentity(merchantId, {
      heldId: held.id,
      ticketDisplay: ident.ticketDisplay,
      tableId: ident.tableId,
      tabNumber: ident.tabNumber,
      paidTotal,
      settleKitchen: true,
      paymentSettled: true,
    });

    await db
      .update(schema.payAtXSessions)
      .set({ status: "completed", paidAmount: paidTotal.toFixed(2), updatedAt: new Date() })
      .where(eq(schema.payAtXSessions.id, sessionId));

    console.info("[pay-at-x] bill finalized", {
      merchantId,
      sessionId,
      orderId: order.id,
      paidTotal,
    });
  }
}
