import PDFDocument from "pdfkit";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { roundMoney2 } from "@/lib/money";

const A4_W = 595.28;
const MARGIN = 40;

export type ShopCommissionOrderRow = {
  id: string;
  orderNumber: string;
  createdAt: string;
  subtotal: number;
  total: number;
  commission: number;
};

export type ShopCommissionReport = {
  merchantId: string;
  merchantName: string;
  month: string;
  commissionPercent: number;
  orderCount: number;
  ordersSubtotal: number;
  totalCommission: number;
  orders: ShopCommissionOrderRow[];
};

function parseMonth(month: string): { year: number; monthIndex: number; start: Date; end: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || "").trim());
  if (!m) throw new Error("Invalid month (use YYYY-MM)");
  const year = Number(m[1]);
  const monthIndex = Number(m[2]);
  if (monthIndex < 1 || monthIndex > 12) throw new Error("Invalid month");
  const start = new Date(Date.UTC(year, monthIndex - 1, 1));
  const end = new Date(Date.UTC(year, monthIndex, 1));
  return { year, monthIndex, start, end };
}

function currentMonthKey(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function money(n: number): string {
  return roundMoney2(n).toFixed(2);
}

export class ShopCommissionService {
  static currentMonthKey(): string {
    return currentMonthKey();
  }

  static async getMonthlyReport(merchantId: string, month?: string): Promise<ShopCommissionReport> {
    const monthKey = month?.trim() || currentMonthKey();
    const { start, end } = parseMonth(monthKey);
    const db = getDb();

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: {
        id: true,
        name: true,
        shopCommissionPercent: true,
      },
    });
    if (!merchant) throw new Error("Merchant not found");

    const commissionPercent = Math.max(0, Number(merchant.shopCommissionPercent ?? 0) || 0);

    const orderRows = await db
      .select({
        id: schema.orders.id,
        orderNumber: schema.orders.orderNumber,
        createdAt: schema.orders.createdAt,
        subtotal: schema.orders.subtotal,
        total: schema.orders.total,
      })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.merchantId, merchantId),
          eq(schema.orders.orderType, "web_shop"),
          eq(schema.orders.status, "completed"),
          gte(schema.orders.createdAt, start),
          lt(schema.orders.createdAt, end)
        )
      )
      .orderBy(asc(schema.orders.createdAt));

    let ordersSubtotal = 0;
    const orders: ShopCommissionOrderRow[] = orderRows.map((row) => {
      const subtotal = roundMoney2(Number(row.subtotal) || 0);
      const commission = roundMoney2((subtotal * commissionPercent) / 100);
      ordersSubtotal += subtotal;
      return {
        id: row.id,
        orderNumber: row.orderNumber,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : "",
        subtotal,
        total: roundMoney2(Number(row.total) || 0),
        commission,
      };
    });

    ordersSubtotal = roundMoney2(ordersSubtotal);
    const totalCommission = roundMoney2((ordersSubtotal * commissionPercent) / 100);

    return {
      merchantId: merchant.id,
      merchantName: merchant.name,
      month: monthKey,
      commissionPercent,
      orderCount: orders.length,
      ordersSubtotal,
      totalCommission,
      orders,
    };
  }

  static async generatePdf(
    merchantId: string,
    month: string,
    reseller?: { name?: string | null; email?: string | null }
  ): Promise<Buffer> {
    const report = await this.getMonthlyReport(merchantId, month);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: MARGIN });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const resellerName = reseller?.name?.trim() || "Reseller";
      const [year, mon] = report.month.split("-");
      const monthLabel = new Date(Number(year), Number(mon) - 1, 1).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      });

      doc.fontSize(18).text("Shop commission statement", { align: "left" });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor("#444");
      doc.text(`Issued by: ${resellerName}`);
      if (reseller?.email) doc.text(`Email: ${reseller.email}`);
      doc.text(`Merchant: ${report.merchantName}`);
      doc.text(`Period: ${monthLabel}`);
      doc.text(`Commission rate: ${money(report.commissionPercent)}%`);
      doc.moveDown();

      doc.fillColor("#000").fontSize(11).text("Summary", { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor("#333");
      doc.text(`Completed shop orders: ${report.orderCount}`);
      doc.text(`Orders subtotal (excl. fees): CHF ${money(report.ordersSubtotal)}`);
      doc.text(`Total commission due: CHF ${money(report.totalCommission)}`, { continued: false });
      doc.moveDown();

      doc.fillColor("#000").fontSize(11).text("Order details", { underline: true });
      doc.moveDown(0.4);

      const colX = [MARGIN, MARGIN + 90, MARGIN + 170, MARGIN + 250, MARGIN + 330, MARGIN + 410];
      doc.fontSize(9).fillColor("#666");
      doc.text("Date", colX[0], doc.y, { width: 80 });
      doc.text("Order #", colX[1], doc.y - doc.currentLineHeight(), { width: 70 });
      doc.text("Subtotal", colX[2], doc.y - doc.currentLineHeight(), { width: 70 });
      doc.text("Total", colX[3], doc.y - doc.currentLineHeight(), { width: 70 });
      doc.text("Rate", colX[4], doc.y - doc.currentLineHeight(), { width: 50 });
      doc.text("Commission", colX[5], doc.y - doc.currentLineHeight(), { width: 80 });
      doc.moveDown(0.3);
      doc.strokeColor("#ccc").moveTo(MARGIN, doc.y).lineTo(A4_W - MARGIN, doc.y).stroke();
      doc.moveDown(0.2);

      doc.fillColor("#222").fontSize(8);
      for (const row of report.orders) {
        const y = doc.y;
        if (y > 760) {
          doc.addPage();
        }
        const dateStr = row.createdAt
          ? new Date(row.createdAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "—";
        const rowY = doc.y;
        doc.text(dateStr, colX[0], rowY, { width: 80 });
        doc.text(row.orderNumber, colX[1], rowY, { width: 70 });
        doc.text(`CHF ${money(row.subtotal)}`, colX[2], rowY, { width: 70 });
        doc.text(`CHF ${money(row.total)}`, colX[3], rowY, { width: 70 });
        doc.text(`${money(report.commissionPercent)}%`, colX[4], rowY, { width: 50 });
        doc.text(`CHF ${money(row.commission)}`, colX[5], rowY, { width: 80 });
        doc.moveDown(0.6);
      }

      doc.moveDown();
      doc.fontSize(10).fillColor("#000");
      doc.text(`Total commission: CHF ${money(report.totalCommission)}`, { align: "right" });

      doc.end();
    });
  }
}
