"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopCommissionService = void 0;
const pdfkit_1 = __importDefault(require("pdfkit"));
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const money_1 = require("@/lib/money");
const A4_W = 595.28;
const MARGIN = 40;
function parseMonth(month) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(month || "").trim());
    if (!m)
        throw new Error("Invalid month (use YYYY-MM)");
    const year = Number(m[1]);
    const monthIndex = Number(m[2]);
    if (monthIndex < 1 || monthIndex > 12)
        throw new Error("Invalid month");
    const start = new Date(Date.UTC(year, monthIndex - 1, 1));
    const end = new Date(Date.UTC(year, monthIndex, 1));
    return { year, monthIndex, start, end };
}
function currentMonthKey() {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}
function money(n) {
    return (0, money_1.roundMoney2)(n).toFixed(2);
}
class ShopCommissionService {
    static currentMonthKey() {
        return currentMonthKey();
    }
    static async getMonthlyReport(merchantId, month) {
        const monthKey = month?.trim() || currentMonthKey();
        const { start, end } = parseMonth(monthKey);
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: {
                id: true,
                name: true,
                shopCommissionPercent: true,
            },
        });
        if (!merchant)
            throw new Error("Merchant not found");
        const commissionPercent = Math.max(0, Number(merchant.shopCommissionPercent ?? 0) || 0);
        const orderRows = await db
            .select({
            id: db_1.schema.orders.id,
            orderNumber: db_1.schema.orders.orderNumber,
            createdAt: db_1.schema.orders.createdAt,
            subtotal: db_1.schema.orders.subtotal,
            total: db_1.schema.orders.total,
        })
            .from(db_1.schema.orders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.orders.orderType, "web_shop"), (0, drizzle_orm_1.eq)(db_1.schema.orders.status, "completed"), (0, drizzle_orm_1.gte)(db_1.schema.orders.createdAt, start), (0, drizzle_orm_1.lt)(db_1.schema.orders.createdAt, end)))
            .orderBy((0, drizzle_orm_1.asc)(db_1.schema.orders.createdAt));
        let ordersSubtotal = 0;
        const orders = orderRows.map((row) => {
            const subtotal = (0, money_1.roundMoney2)(Number(row.subtotal) || 0);
            const commission = (0, money_1.roundMoney2)((subtotal * commissionPercent) / 100);
            ordersSubtotal += subtotal;
            return {
                id: row.id,
                orderNumber: row.orderNumber,
                createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : "",
                subtotal,
                total: (0, money_1.roundMoney2)(Number(row.total) || 0),
                commission,
            };
        });
        ordersSubtotal = (0, money_1.roundMoney2)(ordersSubtotal);
        const totalCommission = (0, money_1.roundMoney2)((ordersSubtotal * commissionPercent) / 100);
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
    static async generatePdf(merchantId, month, reseller) {
        const report = await this.getMonthlyReport(merchantId, month);
        return new Promise((resolve, reject) => {
            const doc = new pdfkit_1.default({ size: "A4", margin: MARGIN });
            const chunks = [];
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
            if (reseller?.email)
                doc.text(`Email: ${reseller.email}`);
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
exports.ShopCommissionService = ShopCommissionService;
//# sourceMappingURL=shop-commission.service.js.map