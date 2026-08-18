import fs from "fs";
import path from "path";
import { and, eq, or, sql } from "drizzle-orm";
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
    paymentMethod: string
  ) {
    const db = getDb();
    const order = await this.findOrder(merchantId, orderRef);
    if (!order) throw new Error("Order not found");
    if (order.status === "cancelled") throw new Error("Cannot collect payment on a cancelled order");
    const pay = String(order.paymentStatus || "").toLowerCase();
    if (pay === "completed" || pay === "paid" || pay === "partially_refunded") {
      throw new Error("Payment already completed");
    }

    const methodRaw = String(paymentMethod || "cash").trim().toLowerCase().replace(/-/g, "_");
    const method = ["cash", "card", "terminal", "bank_transfer"].includes(methodRaw)
      ? methodRaw
      : "cash";

    const [updated] = await db
      .update(schema.orders)
      .set({
        paymentStatus: "completed",
        paymentMethod: method,
        completedAt: new Date(),
        paymentBreakdown: [{ method, amount: roundMoney2(Number(order.total) || 0) }],
      })
      .where(and(eq(schema.orders.id, order.id), eq(schema.orders.merchantId, merchantId)))
      .returning();

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
        qrPng = await QRCode.toBuffer(qrPayload, {
          errorCorrectionLevel: "M",
          margin: 0,
          width: 320,
          type: "png",
        });
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

function renderInvoicePdf(input: PdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: MARGIN,
      bufferPages: true,
      info: { Title: input.invoiceNumber },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const T = input.labels;
    const contentBottom = A4_H - QR_BILL_H - 16;
    let y = MARGIN;

    if (input.merchant.logoPath) {
      try {
        doc.image(input.merchant.logoPath, MARGIN, y, { fit: [120, 48] });
      } catch {
        /* ignore bad logo */
      }
    }
    doc.font("Helvetica-Bold").fontSize(22).fillColor("#111").text(T.invoice, MARGIN + 140, y, {
      width: A4_W - MARGIN * 2 - 140,
      align: "right",
    });
    y += 56;

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111").text(input.merchant.name, MARGIN, y);
    y += 14;
    doc.font("Helvetica").fontSize(9).fillColor("#444");
    const merchantLines = [
      input.merchant.address,
      [input.merchant.city, input.merchant.country].filter(Boolean).join(", "),
      input.merchant.phone ? `${T.phone}: ${input.merchant.phone}` : null,
      input.merchant.email ? `${T.email}: ${input.merchant.email}` : null,
      input.merchant.vatNumber ? `${T.vatNo}: ${input.merchant.vatNumber}` : null,
    ].filter(Boolean) as string[];
    for (const line of merchantLines) {
      doc.text(line, MARGIN, y);
      y += 12;
    }

    const metaX = 340;
    let my = MARGIN + 56;
    doc.font("Helvetica").fontSize(9).fillColor("#444");
    const meta = [
      [T.invoiceNo, input.invoiceNumber],
      [T.order, input.orderNumber],
      [T.date, formatDate(input.issued, input.lang)],
      [T.due, formatDate(input.due, input.lang)],
      ["Status", input.paid ? T.paid : T.awaiting],
    ];
    for (const [k, v] of meta) {
      doc.font("Helvetica").fillColor("#666").text(k, metaX, my, { width: 90 });
      doc.font("Helvetica-Bold").fillColor("#111").text(v, metaX + 90, my, { width: 125 });
      my += 14;
    }

    y = Math.max(y, my) + 16;
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#111").text(T.billTo, MARGIN, y);
    y += 14;
    doc.font("Helvetica").fontSize(9).fillColor("#333");
    const clientLines = [
      input.customer.name || "—",
      input.customer.address,
      input.customer.phone,
      input.customer.email,
    ].filter(Boolean) as string[];
    for (const line of clientLines) {
      doc.text(line, MARGIN, y);
      y += 12;
    }

    y += 16;
    const tableTop = y;
    const cols = { desc: MARGIN, qty: 340, unit: 400, amt: 470 };
    doc.rect(MARGIN, tableTop, A4_W - MARGIN * 2, 18).fill("#111");
    doc.fillColor("#fff").font("Helvetica-Bold").fontSize(8);
    doc.text(T.description, cols.desc + 4, tableTop + 5, { width: 280 });
    doc.text(T.qty, cols.qty, tableTop + 5, { width: 50, align: "right" });
    doc.text(T.unit, cols.unit, tableTop + 5, { width: 60, align: "right" });
    doc.text(T.amount, cols.amt, tableTop + 5, { width: 80, align: "right" });
    y = tableTop + 22;
    doc.fillColor("#111").font("Helvetica").fontSize(9);
    for (const item of input.items) {
      if (y > contentBottom - 120) {
        doc.addPage();
        y = MARGIN;
      }
      doc.text(item.name, cols.desc + 4, y, { width: 280 });
      doc.text(String(item.qty), cols.qty, y, { width: 50, align: "right" });
      doc.text(item.unit.toFixed(2), cols.unit, y, { width: 60, align: "right" });
      doc.text(item.total.toFixed(2), cols.amt, y, { width: 80, align: "right" });
      y += 16;
    }

    y += 8;
    const totals = [
      [T.subtotal, money(input.subtotal)],
      input.discount > 0.001 ? [T.discount, `−${money(input.discount)}`] : null,
      input.tax > 0.001 ? [T.vat, money(input.tax)] : null,
      input.tip > 0.001 ? [T.tip, money(input.tip)] : null,
      [T.total, money(input.total)],
    ].filter(Boolean) as Array<[string, string]>;
    for (const [label, value] of totals) {
      const bold = label === T.total;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9);
      doc.text(label, 360, y, { width: 80 });
      doc.text(value, 440, y, { width: 115, align: "right" });
      y += bold ? 16 : 13;
    }

    y += 10;
    doc.font("Helvetica-Bold").fontSize(10).text(T.bank, MARGIN, y);
    y += 14;
    doc.font("Helvetica").fontSize(9).fillColor("#333");
    const bankLines = [
      input.merchant.bankAccountHolder ? `${T.accountHolder}: ${input.merchant.bankAccountHolder}` : null,
      input.merchant.bankName ? `${T.bankName}: ${input.merchant.bankName}` : null,
      input.merchant.bankIban ? `${T.iban}: ${input.merchant.bankIban}` : null,
      input.merchant.bankQrIban ? `${T.qrIban}: ${input.merchant.bankQrIban}` : null,
    ].filter(Boolean) as string[];
    if (!bankLines.length) {
      doc.fillColor("#888").text("—", MARGIN, y);
    } else {
      for (const line of bankLines) {
        doc.text(line, MARGIN, y);
        y += 12;
      }
    }

    drawQrBill(doc, input);
    doc.end();
  });
}

function drawQrBill(doc: PDFKit.PDFDocument, input: PdfInput) {
  const T = input.labels;
  const top = A4_H - QR_BILL_H;
  const receiptW = 175.75; // 62mm
  const qrSize = 130.4; // 46mm

  doc.save();
  doc.switchToPage(0);
  // Separator
  doc.save();
  doc.strokeColor("#000").lineWidth(0.6).dash(3, { space: 2 });
  doc.moveTo(0, top).lineTo(A4_W, top).stroke();
  doc.moveTo(receiptW, top).lineTo(receiptW, A4_H).stroke();
  doc.undash();
  doc.restore();

  doc.font("Helvetica-Bold").fontSize(8).fillColor("#000");
  doc.text(T.receipt, 12, top + 8, { width: receiptW - 20 });
  doc.font("Helvetica").fontSize(6).text(T.account, 12, top + 22, { width: receiptW - 20 });
  doc.font("Helvetica").fontSize(7);
  const creditor = [
    input.merchant.bankAccountHolder || input.merchant.name,
    input.merchant.address,
    [input.merchant.city, input.merchant.country].filter(Boolean).join(" "),
    input.payIban,
  ]
    .filter(Boolean)
    .join("\n");
  doc.text(creditor, 12, top + 32, { width: receiptW - 20 });
  if (input.qrr) {
    doc.font("Helvetica").fontSize(6).text(T.reference, 12, top + 88, { width: receiptW - 20 });
    doc.font("Helvetica").fontSize(7).text(input.qrr, 12, top + 98, { width: receiptW - 20 });
  }
  doc.font("Helvetica").fontSize(6).text(T.payableBy, 12, top + 130, { width: receiptW - 20 });
  doc.font("Helvetica").fontSize(7).text(
    [input.customer.name, input.customer.address].filter(Boolean).join("\n") || "—",
    12,
    top + 140,
    { width: receiptW - 20 }
  );
  doc.font("Helvetica-Bold").fontSize(8).text("CHF", 12, top + 220);
  doc.text(input.total.toFixed(2), 50, top + 220);
  doc.font("Helvetica").fontSize(6).text(T.acceptance, 12, top + 260, { width: receiptW - 24 });

  const payX = receiptW + 12;
  doc.font("Helvetica-Bold").fontSize(8).text(T.payment, payX, top + 8);
  doc.font("Helvetica").fontSize(6).text(T.account, payX + qrSize + 12, top + 22);
  doc.font("Helvetica").fontSize(7).text(creditor, payX + qrSize + 12, top + 32, {
    width: A4_W - payX - qrSize - 24,
  });
  if (input.qrr) {
    doc.font("Helvetica").fontSize(6).text(T.reference, payX + qrSize + 12, top + 100);
    doc.font("Helvetica").fontSize(8).text(input.qrr, payX + qrSize + 12, top + 110, {
      width: A4_W - payX - qrSize - 24,
    });
  }
  doc.font("Helvetica").fontSize(6).text(T.additional, payX + qrSize + 12, top + 140);
  doc.font("Helvetica").fontSize(7).text(input.invoiceNumber, payX + qrSize + 12, top + 150);
  doc.font("Helvetica-Bold").fontSize(8).text("CHF", payX, top + 200);
  doc.text(input.total.toFixed(2), payX + 40, top + 200);
  doc.font("Helvetica").fontSize(6).text(T.payableBy, payX, top + 230);
  doc.font("Helvetica").fontSize(7).text(
    [input.customer.name, input.customer.address].filter(Boolean).join("\n") || "—",
    payX,
    top + 240,
    { width: 200 }
  );

  if (input.qrPng) {
    try {
      doc.image(input.qrPng, payX, top + 28, { width: qrSize, height: qrSize });
      drawSwissCross(doc, payX + qrSize / 2, top + 28 + qrSize / 2);
    } catch {
      /* ignore */
    }
  }
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
