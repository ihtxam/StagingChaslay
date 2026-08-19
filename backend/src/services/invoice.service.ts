import fs from "fs";
import path from "path";
import { and, desc, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { getDb, schema } from "@/db";
import { roundMoney2 } from "@/lib/money";
import { getUploadsRoot } from "@/services/media-upload.service";
import {
  buildQrrReference,
  buildSwissQrPayload,
  isLikelyQrIban,
  parseAddressFromCustomer,
  parseAddressFromMerchant,
  stripIban,
} from "@/lib/swiss-qr-bill";

const INVOICE_DUE_DAYS = 30;
const A4_W = 595.28;
const A4_H = 841.89;
const QR_BILL_H = 297.64; // 105mm
const MARGIN = 40;

export type InvoiceLang = "en" | "fr" | "de";

const L: Record<InvoiceLang, Record<string, string>> = {
  en: {
    invoice: "INVOICE",
    invoiceNo: "Invoice no.",
    date: "Date",
    due: "Due date",
    order: "Order",
    billTo: "Bill to",
    description: "Description",
    qty: "Qty",
    unit: "Unit",
    amount: "Amount",
    subtotal: "Subtotal",
    discount: "Discount",
    tip: "Tip",
    vat: "VAT",
    total: "Total",
    bank: "Bank details",
    iban: "IBAN",
    qrIban: "QR-IBAN",
    accountHolder: "Account holder",
    bankName: "Bank",
    vatNo: "VAT",
    phone: "Phone",
    email: "Email",
    awaiting: "Awaiting payment",
    paid: "Paid",
    receipt: "Receipt",
    payment: "Payment part",
    currency: "Currency",
    account: "Account / Payable to",
    reference: "Reference",
    additional: "Additional information",
    payableBy: "Payable by",
    payableTo: "Payable to",
    acceptance: "Acceptance point",
  },
  fr: {
    invoice: "FACTURE",
    invoiceNo: "N° de facture",
    date: "Date",
    due: "Échéance",
    order: "Commande",
    billTo: "Facturer à",
    description: "Description",
    qty: "Qté",
    unit: "Prix",
    amount: "Montant",
    subtotal: "Sous-total",
    discount: "Rabais",
    tip: "Pourboire",
    vat: "TVA",
    total: "Total",
    bank: "Coordonnées bancaires",
    iban: "IBAN",
    qrIban: "QR-IBAN",
    accountHolder: "Titulaire",
    bankName: "Banque",
    vatNo: "TVA",
    phone: "Tél",
    email: "E-mail",
    awaiting: "En attente de paiement",
    paid: "Payée",
    receipt: "Récépissé",
    payment: "Section paiement",
    currency: "Monnaie",
    account: "Compte / Payable à",
    reference: "Référence",
    additional: "Informations supplémentaires",
    payableBy: "Payable par",
    payableTo: "Payable à",
    acceptance: "Point de dépôt",
  },
  de: {
    invoice: "RECHNUNG",
    invoiceNo: "Rechnungsnr.",
    date: "Datum",
    due: "Fällig am",
    order: "Bestellung",
    billTo: "Rechnungsempfänger",
    description: "Beschreibung",
    qty: "Menge",
    unit: "Preis",
    amount: "Betrag",
    subtotal: "Zwischensumme",
    discount: "Rabatt",
    tip: "Trinkgeld",
    vat: "MwSt",
    total: "Total",
    bank: "Bankverbindung",
    iban: "IBAN",
    qrIban: "QR-IBAN",
    accountHolder: "Kontoinhaber",
    bankName: "Bank",
    vatNo: "MWST",
    phone: "Tel",
    email: "E-Mail",
    awaiting: "Zahlung ausstehend",
    paid: "Bezahlt",
    receipt: "Empfangsschein",
    payment: "Zahlteil",
    currency: "Währung",
    account: "Konto / Zahlbar an",
    reference: "Referenz",
    additional: "Zusätzliche Informationen",
    payableBy: "Zahlbar durch",
    payableTo: "Zahlbar an",
    acceptance: "Annahmestelle",
  },
};

function langOf(raw?: string | null): InvoiceLang {
  const v = String(raw || "").toLowerCase();
  if (v.startsWith("fr")) return "fr";
  if (v.startsWith("de")) return "de";
  return "en";
}

function formatDate(d: Date, lang: InvoiceLang): string {
  const loc = lang === "fr" ? "fr-CH" : lang === "de" ? "de-CH" : "en-GB";
  return d.toLocaleDateString(loc, { timeZone: "Europe/Zurich" });
}

function money(n: number): string {
  return `CHF ${roundMoney2(n).toFixed(2)}`;
}

export function isInvoicePaymentMethod(method?: string | null): boolean {
  return String(method || "").toLowerCase().replace(/-/g, "_") === "invoice";
}

/** POS invoice sale — unpaid until bank transfer is recorded. */
export function isInvoiceOrderRecord(order: {
  paymentMethod?: string | null;
  invoiceNumber?: string | null;
}): boolean {
  return isInvoicePaymentMethod(order.paymentMethod) || !!order.invoiceNumber;
}

export class InvoiceService {
  static async ensureInvoiceNumber(merchantId: string, orderId: string): Promise<string> {
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
    });
    if (!order) throw new Error("Order not found");
    if (order.invoiceNumber) return order.invoiceNumber;

    const [seqRow] = await db
      .update(schema.merchants)
      .set({
        invoiceSequence: sql`${schema.merchants.invoiceSequence} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.merchants.id, merchantId))
      .returning({ invoiceSequence: schema.merchants.invoiceSequence });

    const seq = Number(seqRow?.invoiceSequence || 1);
    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${String(seq).padStart(5, "0")}`;
    const issuedAt = new Date();
    const dueAt = new Date(issuedAt.getTime() + INVOICE_DUE_DAYS * 24 * 60 * 60 * 1000);

    await db
      .update(schema.orders)
      .set({
        invoiceNumber,
        invoiceIssuedAt: issuedAt,
        invoiceDueAt: dueAt,
        paymentMethod: "invoice",
        paymentStatus: "awaiting_payment",
      })
      .where(eq(schema.orders.id, orderId));

    return invoiceNumber;
  }

  static async list(
    merchantId: string,
    opts: { status?: string; q?: string; limit?: number } = {}
  ) {
    const db = getDb();
    const limit = Math.min(Math.max(Number(opts.limit) || 100, 1), 200);
    const pay = String(opts.status || "all").toLowerCase();
    const conditions = [
      eq(schema.orders.merchantId, merchantId),
      or(isNotNull(schema.orders.invoiceNumber), eq(schema.orders.paymentMethod, "invoice"))!,
    ];

    if (pay === "unpaid") {
      conditions.push(
        and(
          or(
            eq(schema.orders.paymentStatus, "awaiting_payment"),
            eq(schema.orders.paymentStatus, "pending")
          )!,
          sql`lower(coalesce(${schema.orders.status}, '')) not in ('cancelled', 'refunded')`
        )!
      );
    } else if (pay === "paid") {
      conditions.push(
        or(
          eq(schema.orders.paymentStatus, "completed"),
          eq(schema.orders.paymentStatus, "paid"),
          eq(schema.orders.paymentStatus, "partially_refunded")
        )!
      );
    }

    const q = String(opts.q || "").trim();
    if (q) {
      conditions.push(
        or(
          ilike(schema.orders.invoiceNumber, `%${q}%`),
          ilike(schema.orders.orderNumber, `%${q}%`),
          ilike(schema.orders.customerName, `%${q}%`),
          ilike(schema.orders.customerPhone, `%${q}%`),
          ilike(schema.orders.customerEmail, `%${q}%`)
        )!
      );
    }

    const rows = await db.query.orders.findMany({
      where: and(...conditions),
      with: { items: { with: { product: true } }, customer: true },
      orderBy: [desc(schema.orders.invoiceIssuedAt), desc(schema.orders.createdAt)],
      limit,
    });

    return rows.map((o) => {
      const customerName =
        o.customerName ||
        [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(" ") ||
        null;
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        orderType: o.orderType,
        status: o.status,
        channel: o.fulfillmentChannel,
        fulfillmentChannel: o.fulfillmentChannel,
        paymentMethod: o.paymentMethod,
        paymentBreakdown: o.paymentBreakdown ?? null,
        paymentStatus: o.paymentStatus,
        invoiceNumber: o.invoiceNumber || null,
        invoiceIssuedAt: o.invoiceIssuedAt || null,
        invoiceDueAt: o.invoiceDueAt || null,
        total: Number(o.total),
        subtotal: Number(o.subtotal),
        taxAmount: Number(o.taxAmount),
        discountAmount: Number(o.discountAmount || 0),
        tipAmount: Number(o.tipAmount || 0),
        refundAmount: Number(o.refundAmount || 0),
        customerName,
        customerPhone: o.customerPhone || o.customer?.phone || null,
        customerEmail: o.customerEmail || o.customer?.email || null,
        shippingAddress: o.shippingAddress,
        staffName: o.staffName,
        notes: o.notes,
        createdAt: o.createdAt,
        completedAt: o.completedAt,
        scheduledFor: o.scheduledFor,
        items: (o.items || []).map((i) => ({
          id: i.id,
          name: i.productName || i.product?.name,
          productName: i.productName,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          totalPrice: Number(i.totalPrice),
          selectedExtras: i.selectedExtras,
          comboSelections: i.comboSelections,
          product: i.product,
        })),
      };
    });
  }

  static async findOrder(merchantId: string, ref: string) {
    const db = getDb();
    const looksLikeUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ref);
    return db.query.orders.findFirst({
      where: and(
        eq(schema.orders.merchantId, merchantId),
        looksLikeUuid
          ? or(
              eq(schema.orders.id, ref),
              eq(schema.orders.orderNumber, ref),
              eq(schema.orders.clientId, ref),
              eq(schema.orders.invoiceNumber, ref)
            )
          : or(
              eq(schema.orders.orderNumber, ref),
              eq(schema.orders.clientId, ref),
              eq(schema.orders.invoiceNumber, ref)
            )
      ),
      with: { items: { with: { product: true } }, customer: true },
    });
  }

  static async recordPayment(
    merchantId: string,
    orderRef: string,
    _paymentMethod?: string
  ) {
    const db = getDb();
    const order = await this.findOrder(merchantId, orderRef);
    if (!order) throw new Error("Order not found");
    if (order.status === "cancelled") throw new Error("Cannot collect payment on a cancelled order");
    if (!isInvoiceOrderRecord(order)) {
      throw new Error("Order is not an invoice");
    }
    const pay = String(order.paymentStatus || "").toLowerCase();
    if (pay === "completed" || pay === "paid" || pay === "partially_refunded") {
      throw new Error("Payment already completed");
    }

    // Invoice tickets are settled by bank transfer — never cash or card.
    const method = "invoice";

    const [updated] = await db
      .update(schema.orders)
      .set({
        paymentStatus: "completed",
        paymentMethod: method,
        completedAt: order.completedAt || new Date(),
        paymentBreakdown: [{ method, amount: roundMoney2(Number(order.total) || 0) }],
      })
      .where(and(eq(schema.orders.id, order.id), eq(schema.orders.merchantId, merchantId)))
      .returning();

    try {
      const { InventoryService } = await import("@/services/inventory.service");
      await InventoryService.deductForPaidOrder(merchantId, order.id);
    } catch (invErr) {
      console.warn("Inventory deduct after invoice payment failed:", invErr);
    }

    return updated;
  }

  static async renderPdf(merchantId: string, orderRef: string): Promise<{
    buffer: Buffer;
    filename: string;
    invoiceNumber: string;
  }> {
    const db = getDb();
    const order = await this.findOrder(merchantId, orderRef);
    if (!order) throw new Error("Order not found");
    if (!isInvoicePaymentMethod(order.paymentMethod) && !order.invoiceNumber) {
      if (String(order.paymentStatus || "") !== "awaiting_payment") {
        throw new Error("Order is not an invoice");
      }
    }

    const invoiceNumber = await this.ensureInvoiceNumber(merchantId, order.id);
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");

    const lang = langOf(merchant.panelLanguage);
    const labels = L[lang];
    const issued = order.invoiceIssuedAt || new Date();
    const due =
      order.invoiceDueAt ||
      new Date(issued.getTime() + INVOICE_DUE_DAYS * 24 * 60 * 60 * 1000);
    const items = (order.items || []).map((i) => ({
      name: i.productName || i.product?.name || "Item",
      qty: Number(i.quantity) || 0,
      unit: Number(i.unitPrice) || 0,
      total: Number(i.totalPrice) || 0,
    }));
    const subtotal = Number(order.subtotal) || 0;
    const tax = Number(order.taxAmount) || 0;
    const discount = Number(order.discountAmount) || 0;
    const tip = Number(order.tipAmount) || 0;
    const total = Number(order.total) || 0;
    const customerName =
      order.customerName ||
      [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(" ") ||
      "";
    const customerAddress =
      order.shippingAddress ||
      [order.customer?.defaultAddress, order.customer?.defaultZip, order.customer?.defaultCity]
        .filter(Boolean)
        .join(", ");
    const iban = stripIban(merchant.bankQrIban || merchant.bankIban || "");
    const qrIban = stripIban(merchant.bankQrIban || "");
    const useQrIban = !!qrIban && isLikelyQrIban(qrIban);
    const payIban = useQrIban ? qrIban : iban;
    const seq = Number((invoiceNumber.match(/(\d+)$/) || [])[1] || 1);
    const qrr = useQrIban ? buildQrrReference(seq) : "";

    let qrPng: Buffer | null = null;
    let qrPayload = "";
    if (payIban) {
      try {
        qrPayload = buildSwissQrPayload({
          iban: payIban,
          amount: total,
          currency: "CHF",
          creditor: parseAddressFromMerchant({
            name: merchant.bankAccountHolder || merchant.name,
            address: merchant.address,
            city: merchant.city,
            country: merchant.country,
          }),
          debtor: parseAddressFromCustomer({
            name: customerName,
            address: customerAddress,
            city: order.customer?.defaultCity,
          }),
          referenceType: useQrIban ? "QRR" : "NON",
          reference: qrr || undefined,
          unstructuredMessage: invoiceNumber,
        });
        qrPng = await swissQrPng(qrPayload);
      } catch (err) {
        console.warn("[invoice] Swiss QR payload failed:", err);
      }
    }

    const logoPath = resolveLogoPath(merchant.shopLogoUrl);
    const paid =
      String(order.paymentStatus || "").toLowerCase() === "completed" ||
      String(order.paymentStatus || "").toLowerCase() === "paid";

    const buffer = await renderInvoicePdf({
      labels,
      lang,
      merchant: {
        name: merchant.name,
        address: merchant.address,
        city: merchant.city,
        country: merchant.country,
        phone: merchant.phone,
        email: merchant.email,
        vatNumber: merchant.vatNumber,
        bankIban: merchant.bankIban,
        bankQrIban: merchant.bankQrIban,
        bankName: merchant.bankName,
        bankAccountHolder: merchant.bankAccountHolder,
        logoPath,
      },
      customer: {
        name: customerName,
        address: customerAddress,
        phone: order.customerPhone || order.customer?.phone,
        email: order.customerEmail || order.customer?.email,
      },
      invoiceNumber,
      orderNumber: order.orderNumber,
      issued,
      due,
      items,
      subtotal,
      tax,
      discount,
      tip,
      total,
      paid,
      qrPng,
      qrr,
      payIban,
    });

    return {
      buffer,
      filename: `${invoiceNumber}.pdf`,
      invoiceNumber,
    };
  }
}

/** PDFKit embeds data-URLs more reliably than raw PNG buffers. */
async function swissQrPng(payload: string): Promise<Buffer | null> {
  try {
    const dataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 0,
      width: 368,
      type: "image/png",
    });
    const b64 = dataUrl.split(",")[1];
    if (b64) return Buffer.from(b64, "base64");
  } catch {
    /* fall through */
  }
  try {
    return await QRCode.toBuffer(payload, {
      errorCorrectionLevel: "M",
      margin: 0,
      width: 368,
      type: "png",
    });
  } catch (err) {
    console.warn("[invoice] QR image encode failed:", err);
    return null;
  }
}

function resolveLogoPath(url?: string | null): string | null {
  if (!url) return null;
  const rel = String(url).match(/\/api\/uploads\/(.+)$/);
  if (rel) {
    const full = path.join(getUploadsRoot(), rel[1]);
    if (fs.existsSync(full)) return full;
  }
  if (url.startsWith("/") && fs.existsSync(url)) return url;
  return null;
}

type PdfInput = {
  labels: Record<string, string>;
  lang: InvoiceLang;
  merchant: {
    name: string;
    address?: string | null;
    city?: string | null;
    country?: string | null;
    phone?: string | null;
    email?: string | null;
    vatNumber?: string | null;
    bankIban?: string | null;
    bankQrIban?: string | null;
    bankName?: string | null;
    bankAccountHolder?: string | null;
    logoPath?: string | null;
  };
  customer: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  invoiceNumber: string;
  orderNumber: string;
  issued: Date;
  due: Date;
  items: Array<{ name: string; qty: number; unit: number; total: number }>;
  subtotal: number;
  tax: number;
  discount: number;
  tip: number;
  total: number;
  paid: boolean;
  qrPng: Buffer | null;
  qrr: string;
  payIban: string;
};

function merchantLinesOf(input: PdfInput): string[] {
  const T = input.labels;
  return [
    input.merchant.address,
    [input.merchant.city, input.merchant.country].filter(Boolean).join(", "),
    input.merchant.phone ? `${T.phone}: ${input.merchant.phone}` : null,
    input.merchant.email ? `${T.email}: ${input.merchant.email}` : null,
    input.merchant.vatNumber ? `${T.vatNo}: ${input.merchant.vatNumber}` : null,
  ].filter(Boolean) as string[];
}

function clientLinesOf(input: PdfInput): string[] {
  return [
    input.customer.name || "—",
    input.customer.address,
    input.customer.phone,
    input.customer.email,
  ].filter(Boolean) as string[];
}

function totalsRowsOf(input: PdfInput): Array<[string, string, boolean]> {
  const T = input.labels;
  return (
    [
      [T.subtotal, money(input.subtotal), false],
      input.discount > 0.001 ? [T.discount, `−${money(input.discount)}`, false] : null,
      input.tax > 0.001 ? [T.vat, money(input.tax), false] : null,
      input.tip > 0.001 ? [T.tip, money(input.tip), false] : null,
      [T.total, money(input.total), true],
    ] as Array<[string, string, boolean] | null>
  ).filter(Boolean) as Array<[string, string, boolean]>;
}

function estimateHeaderH(input: PdfInput): number {
  const left = 34 + merchantLinesOf(input).length * 10;
  const right = 34 + 5 * 11;
  return Math.max(left, right) + 12 + 11 + clientLinesOf(input).length * 10 + 22;
}

function estimateTotalsH(input: PdfInput): number {
  return 6 + totalsRowsOf(input).reduce((h, [, , bold]) => h + (bold ? 13 : 11), 0);
}

function renderInvoicePdf(input: PdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      bufferPages: true,
      autoFirstPage: true,
      info: { Title: input.invoiceNumber },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const T = input.labels;
    const qrTop = A4_H - QR_BILL_H;
    const headerH = estimateHeaderH(input);
    const totalsH = estimateTotalsH(input);
    const tableHeadH = 16;
    const items = input.items.length ? input.items : [{ name: "—", qty: 0, unit: 0, total: 0 }];

    // Fit items + totals above the 105mm QR slip. Typical bills stay on page 1.
    let itemH = 12;
    const page1WithQr = qrTop - 8 - MARGIN - headerH - tableHeadH - totalsH;
    const fitWithQr = Math.max(0, Math.floor(page1WithQr / itemH));
    const onePage = items.length <= fitWithQr;

    let page1Count: number;
    if (onePage) {
      page1Count = items.length;
    } else {
      const page1Full = A4_H - MARGIN - 16 - headerH - tableHeadH;
      page1Count = Math.max(1, Math.min(items.length - 1, Math.floor(page1Full / itemH)));
      const rest = items.length - page1Count;
      const page2Limit = qrTop - 8 - MARGIN - tableHeadH - totalsH;
      if (rest * itemH > page2Limit) {
        itemH = Math.max(5, page2Limit / rest);
      }
    }

    const cols = { desc: MARGIN, qty: 348, unit: 408, amt: 478 };
    const textOpts = { lineBreak: false, ellipsis: true } as const;

    const drawHeader = () => {
      let y = MARGIN;
      if (input.merchant.logoPath) {
        try {
          doc.image(input.merchant.logoPath, MARGIN, y, { fit: [96, 32] });
        } catch {
          /* ignore bad logo */
        }
      }
      doc.font("Helvetica-Bold").fontSize(16).fillColor("#111").text(T.invoice, MARGIN + 110, y, {
        width: A4_W - MARGIN * 2 - 110,
        align: "right",
        lineBreak: false,
      });
      y += 34;

      doc.font("Helvetica-Bold").fontSize(9).fillColor("#111").text(input.merchant.name, MARGIN, y, {
        width: 280,
        lineBreak: false,
        ellipsis: true,
      });
      y += 11;
      doc.font("Helvetica").fontSize(8).fillColor("#444");
      for (const line of merchantLinesOf(input)) {
        doc.text(line, MARGIN, y, { width: 280, ...textOpts });
        y += 10;
      }

      const metaX = 348;
      let my = MARGIN + 34;
      const meta = [
        [T.invoiceNo, input.invoiceNumber],
        [T.order, input.orderNumber],
        [T.date, formatDate(input.issued, input.lang)],
        [T.due, formatDate(input.due, input.lang)],
        ["Status", input.paid ? T.paid : T.awaiting],
      ];
      for (const [k, v] of meta) {
        doc.font("Helvetica").fontSize(8).fillColor("#666").text(k, metaX, my, {
          width: 78,
          ...textOpts,
        });
        doc.font("Helvetica-Bold").fillColor("#111").text(v, metaX + 80, my, {
          width: 128,
          ...textOpts,
        });
        my += 11;
      }

      y = Math.max(y, my) + 10;
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#111").text(T.billTo, MARGIN, y, textOpts);
      y += 11;
      doc.font("Helvetica").fontSize(8).fillColor("#333");
      for (const line of clientLinesOf(input)) {
        doc.text(line, MARGIN, y, { width: 320, ...textOpts });
        y += 10;
      }
      return y + 8;
    };

    const drawTableHeader = (y: number) => {
      doc.rect(MARGIN, y, A4_W - MARGIN * 2, 14).fill("#111");
      doc.fillColor("#fff").font("Helvetica-Bold").fontSize(7);
      doc.text(T.description, cols.desc + 4, y + 3.5, { width: 290, ...textOpts });
      doc.text(T.qty, cols.qty, y + 3.5, { width: 50, align: "right", ...textOpts });
      doc.text(T.unit, cols.unit, y + 3.5, { width: 60, align: "right", ...textOpts });
      doc.text(T.amount, cols.amt, y + 3.5, { width: 76, align: "right", ...textOpts });
      return y + tableHeadH;
    };

    const drawItems = (rows: typeof items, startY: number, rowH: number) => {
      let y = startY;
      doc.fillColor("#111").font("Helvetica").fontSize(8);
      for (const item of rows) {
        doc.text(item.name, cols.desc + 4, y, { width: 290, ...textOpts });
        doc.text(String(item.qty), cols.qty, y, { width: 50, align: "right", ...textOpts });
        doc.text(item.unit.toFixed(2), cols.unit, y, { width: 60, align: "right", ...textOpts });
        doc.text(item.total.toFixed(2), cols.amt, y, { width: 76, align: "right", ...textOpts });
        y += rowH;
      }
      return y;
    };

    const drawTotals = (startY: number) => {
      let y = startY + 4;
      for (const [label, value, bold] of totalsRowsOf(input)) {
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 10 : 8).fillColor("#111");
        doc.text(label, 360, y, { width: 80, ...textOpts });
        doc.text(value, 440, y, { width: 114, align: "right", ...textOpts });
        y += bold ? 13 : 11;
      }
      return y;
    };

    let y = drawHeader();
    y = drawTableHeader(y);
    y = drawItems(items.slice(0, page1Count), y, onePage ? itemH : 12);

    if (!onePage) {
      doc.addPage({ size: "A4", margin: 0 });
      y = MARGIN;
      y = drawTableHeader(y);
      y = drawItems(items.slice(page1Count), y, itemH);
    }
    drawTotals(y);

    const range = doc.bufferedPageRange();
    const lastPage = Math.min(1, range.count - 1);
    drawQrBill(doc, input, lastPage);
    doc.end();
  });
}

function drawQrBill(doc: PDFKit.PDFDocument, input: PdfInput, pageIndex: number) {
  const T = input.labels;
  const top = A4_H - QR_BILL_H;
  const receiptW = 175.75; // 62mm
  const qrSize = 130.4; // 46mm
  const range = doc.bufferedPageRange();
  const idx = Math.max(0, Math.min(pageIndex, range.count - 1));
  doc.switchToPage(range.start + idx);
  // Keep PDFKit from auto-adding a 3rd page while painting the slip.
  doc.x = 12;
  doc.y = 40;
  (doc.page as { margins: { top: number; bottom: number; left: number; right: number } }).margins = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  };

  const slipText = (str: string, x: number, y: number, opts?: PDFKit.Mixins.TextOptions) => {
    doc.text(str, x, y, { lineBreak: false, ...opts });
  };

  doc.save();
  doc.strokeColor("#000").lineWidth(0.6).dash(3, { space: 2 });
  doc.moveTo(0, top).lineTo(A4_W, top).stroke();
  doc.moveTo(receiptW, top).lineTo(receiptW, A4_H).stroke();
  doc.undash();
  doc.restore();

  doc.font("Helvetica-Bold").fontSize(8).fillColor("#000");
  slipText(T.receipt, 12, top + 8, { width: receiptW - 20 });
  doc.font("Helvetica").fontSize(6);
  slipText(T.account, 12, top + 22, { width: receiptW - 20 });
  doc.font("Helvetica").fontSize(7);
  const creditor = [
    input.merchant.bankAccountHolder || input.merchant.name,
    input.merchant.address,
    [input.merchant.city, input.merchant.country].filter(Boolean).join(" "),
    input.payIban,
  ]
    .filter(Boolean)
    .join("\n");
  doc.text(creditor, 12, top + 32, { width: receiptW - 20, lineBreak: true, height: 50 });
  if (input.qrr) {
    doc.font("Helvetica").fontSize(6);
    slipText(T.reference, 12, top + 88, { width: receiptW - 20 });
    doc.font("Helvetica").fontSize(7);
    slipText(input.qrr, 12, top + 98, { width: receiptW - 20 });
  }
  doc.font("Helvetica").fontSize(6);
  slipText(T.payableBy, 12, top + 130, { width: receiptW - 20 });
  doc.font("Helvetica").fontSize(7);
  doc.text(
    [input.customer.name, input.customer.address].filter(Boolean).join("\n") || "—",
    12,
    top + 140,
    { width: receiptW - 20, lineBreak: true, height: 40 }
  );
  doc.font("Helvetica-Bold").fontSize(8);
  slipText("CHF", 12, top + 220);
  slipText(input.total.toFixed(2), 50, top + 220);
  doc.font("Helvetica").fontSize(6);
  slipText(T.acceptance, 12, top + 260, { width: receiptW - 24 });

  const payX = receiptW + 12;
  doc.font("Helvetica-Bold").fontSize(8);
  slipText(T.payment, payX, top + 8);
  doc.font("Helvetica").fontSize(6);
  slipText(T.account, payX + qrSize + 12, top + 22);
  doc.font("Helvetica").fontSize(7);
  doc.text(creditor, payX + qrSize + 12, top + 32, {
    width: A4_W - payX - qrSize - 24,
    lineBreak: true,
    height: 56,
  });
  if (input.qrr) {
    doc.font("Helvetica").fontSize(6);
    slipText(T.reference, payX + qrSize + 12, top + 100);
    doc.font("Helvetica").fontSize(8);
    slipText(input.qrr, payX + qrSize + 12, top + 110, {
      width: A4_W - payX - qrSize - 24,
    });
  }
  doc.font("Helvetica").fontSize(6);
  slipText(T.additional, payX + qrSize + 12, top + 140);
  doc.font("Helvetica").fontSize(7);
  slipText(input.invoiceNumber, payX + qrSize + 12, top + 150);
  doc.font("Helvetica-Bold").fontSize(8);
  slipText("CHF", payX, top + 200);
  slipText(input.total.toFixed(2), payX + 40, top + 200);
  doc.font("Helvetica").fontSize(6);
  slipText(T.payableBy, payX, top + 230);
  doc.font("Helvetica").fontSize(7);
  doc.text(
    [input.customer.name, input.customer.address].filter(Boolean).join("\n") || "—",
    payX,
    top + 240,
    { width: 200, lineBreak: true, height: 36 }
  );

  const qrX = payX;
  const qrY = top + 28;
  if (input.qrPng) {
    try {
      doc.image(input.qrPng, qrX, qrY, { width: qrSize, height: qrSize });
      drawSwissCross(doc, qrX + qrSize / 2, qrY + qrSize / 2);
    } catch (err) {
      console.warn("[invoice] QR image embed failed:", err);
      drawQrFallback(doc, qrX, qrY, qrSize);
    }
  } else if (input.payIban) {
    drawQrFallback(doc, qrX, qrY, qrSize);
  }
}

function drawQrFallback(doc: PDFKit.PDFDocument, x: number, y: number, size: number) {
  doc.save();
  doc.rect(x, y, size, size).strokeColor("#000").lineWidth(0.8).stroke();
  doc.font("Helvetica").fontSize(7).fillColor("#000");
  doc.text("QR", x, y + size / 2 - 6, { width: size, align: "center", lineBreak: false });
  doc.restore();
}

/** Official Swiss cross overlay (~7×7 mm) in the QR center. */
function drawSwissCross(doc: PDFKit.PDFDocument, cx: number, cy: number) {
  const outer = 19.8; // 7mm
  const inner = 16.4;
  doc.save();
  doc.rect(cx - outer / 2, cy - outer / 2, outer, outer).fill("#fff");
  doc.rect(cx - inner / 2, cy - inner / 2, inner, inner).fill("#000");
  const bar = 3.5;
  const arm = 10.5;
  doc.fillColor("#fff");
  doc.rect(cx - bar / 2, cy - arm / 2, bar, arm).fill();
  doc.rect(cx - arm / 2, cy - bar / 2, arm, bar).fill();
  doc.restore();
}
