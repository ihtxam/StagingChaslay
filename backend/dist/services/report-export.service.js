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
exports.ReportExportService = void 0;
const XLSX = __importStar(require("xlsx"));
const report_export_labels_1 = require("@/lib/report-export-labels");
const pos_reports_service_1 = require("./pos-reports.service");
function money(n) {
    return (Number(n) || 0).toFixed(2);
}
/**
 * Build OrderPin-inspired multi-sheet workbook (or CSV) from overview/EOD data.
 */
class ReportExportService {
    static async buildOverviewWorkbook(merchantId, opts) {
        const L = (0, report_export_labels_1.reportExportLabels)((0, report_export_labels_1.normalizeReportExportLang)(opts.language));
        const overview = await pos_reports_service_1.PosReportsService.getOverviewDashboard(merchantId, opts);
        const eod = overview.eod;
        const store = overview.businessName || "Store";
        const period = overview.range.label;
        const generated = new Date().toISOString().replace("T", " ").slice(0, 19);
        const wb = XLSX.utils.book_new();
        const infoSheet = XLSX.utils.aoa_to_sheet([
            [L.reportInfo],
            [L.storeName, L.generationTime, L.timePeriod],
            [store, generated, period],
        ]);
        XLSX.utils.book_append_sheet(wb, infoSheet, L.reportInfo.slice(0, 31));
        const overviewRows = [
            [L.salesSummary],
            ["", L.amount, L.qty],
            [L.paidOrdersQty, "-", eod.salesCount],
            [L.totalPaid, money(eod.revenue), "-"],
            [L.tax, money(eod.taxTotal), "-"],
            [L.totalRefund, money(eod.refundTotal), "-"],
            [L.actualSales, money(eod.netTotal), "-"],
            [L.refundedOrdersQty, "-", eod.refundCount],
            [L.tips, money(eod.tipsTotal), "-"],
            [],
            [L.feeSummary],
            ["", L.amount, L.qty],
            [L.product, money(eod.netTotal), "-"],
            [L.dishesDiscount, money(eod.discountTotal), "-"],
            [L.tax, money(eod.taxTotal), "-"],
            [L.totalPaid, money(eod.revenue), "-"],
            [L.totalRefund, money(eod.refundTotal), "-"],
            [L.netSales, money(eod.netTotal), "-"],
            [L.actualSales, money(eod.netTotal), "-"],
            [L.paidOrdersQty, "-", eod.salesCount],
            [],
            [L.orderTypeReport],
            [L.orderTypes, L.amount, L.qty],
            ...(eod.orderTypeRows || []).map((r) => [
                L.channelLabel(r.channel),
                money(r.total),
                r.count,
            ]),
            [L.total, money(eod.revenue), eod.salesCount],
            [],
            [L.paymentMethodReport],
            [L.paymentMethod, L.amount, L.qty],
            ...(eod.paymentRows || []).map((p) => [
                L.paymentMethodLabel(p.method),
                money(p.total),
                p.count,
            ]),
            [L.total, money(eod.grandTotal || eod.revenue), eod.salesCount],
            [],
            [L.tax],
            [L.notes, L.amount, L.qty],
            ...(eod.vatRows || []).map((v) => [v.label, money(v.tva), "-"]),
            [L.totalTax, money(eod.taxTotal), "-"],
            [],
            [L.orderPlacedByReport],
            [L.waiter, L.amount, L.qty],
            ...(eod.userPerformance || []).map((u) => [u.name, money(u.total), u.salesCount]),
            [],
            [L.cashDrawerFunding],
            [L.fundingAmountSalesTips, money(overview.kpis.fundingAmount), "-"],
            ...(eod.shiftCash || []).flatMap((s, i) => {
                const n = i + 1;
                return [
                    [L.shiftOpeningFloat(n), money(s.openingFloat), s.staffName || "-"],
                    [L.shiftCashSales(n), money(s.cashSales + (s.cashRefunds || 0)), "-"],
                    [L.shiftCashIn(n), money(s.cashIn || 0), "-"],
                    ...(s.movements || [])
                        .filter((m) => String(m.type).toLowerCase() !== "out")
                        .map((m) => [
                        `  ${L.cashInMovement}: ${m.reason || m.staffName || "—"}`,
                        money(m.amount),
                        "-",
                    ]),
                    [L.shiftCashOut(n), money(s.cashOut || 0), "-"],
                    ...(s.movements || [])
                        .filter((m) => String(m.type).toLowerCase() === "out")
                        .map((m) => [
                        `  ${L.cashOutMovement}: ${m.reason || m.staffName || "—"}`,
                        money(m.amount),
                        "-",
                    ]),
                    ...(s.cashRefunds
                        ? [[L.shiftCashRefunds(n), money(s.cashRefunds), "-"]]
                        : []),
                    [L.shiftExpectedCash(n), money(s.expectedCash), "-"],
                ];
            }),
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overviewRows), L.storeOrdersOverview.slice(0, 31));
        const dailySheet = XLSX.utils.aoa_to_sheet([
            [
                L.businessDate,
                L.paidOrdersQty,
                L.refundedOrdersQtyShort,
                L.cash,
                L.cardTerminal,
                L.totalPaid,
                L.totalRefund,
                L.totalTax,
                L.netSales,
            ],
            [
                overview.range.from === overview.range.to
                    ? overview.range.from
                    : `${overview.range.from} – ${overview.range.to}`,
                eod.salesCount,
                eod.refundCount,
                money(eod.cashTotal),
                money(eod.cardTotal + eod.terminalTotal),
                money(eod.revenue),
                money(eod.refundTotal),
                money(eod.taxTotal),
                money(eod.netTotal),
            ],
            [L.totalAmountOfReport, money(eod.revenue)],
        ]);
        XLSX.utils.book_append_sheet(wb, dailySheet, L.dailyReport.slice(0, 31));
        const productRows = [
            [L.productReport],
            [
                L.product,
                L.specification,
                L.qty,
                L.grossSales,
                L.discCompsRewards,
                L.netSale,
                L.taxAmount,
                L.totalSales,
                L.refund,
            ],
            ...(eod.productsSold || []).map((p) => [
                p.name,
                "-",
                p.quantity,
                money(p.total),
                "0.00",
                money(p.total),
                "-",
                money(p.total),
                "0.00",
            ]),
            [
                L.total,
                "-",
                (eod.productsSold || []).reduce((s, p) => s + Number(p.quantity || 0), 0),
                money(eod.netTotal),
                "0.00",
                money(eod.netTotal),
                money(eod.taxTotal),
                money(eod.netTotal),
                "0.00",
            ],
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(productRows), L.productReport.slice(0, 31));
        const staffTotal = (eod.userPerformance || []).reduce((s, u) => s + u.total, 0) || 1;
        const perfRows = [
            [L.staff, L.productAmount, L.amountRatio, L.orders, L.orderRatio],
            ...(eod.userPerformance || []).map((u) => [
                u.name,
                money(u.total),
                `${((u.total / staffTotal) * 100).toFixed(2)}%`,
                u.salesCount,
                `${((u.salesCount / (eod.salesCount || 1)) * 100).toFixed(2)}%`,
            ]),
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(perfRows), L.performanceReport.slice(0, 31));
        const safeName = store.replace(/[^\w\- ]+/g, "").trim().slice(0, 40) || "Report";
        const filename = `Report ${safeName}_${overview.range.from}${overview.range.from !== overview.range.to ? `_${overview.range.to}` : ""}.xlsx`;
        const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
        return { buffer, filename, overview, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    }
    static async buildOverviewCsv(merchantId, opts) {
        const L = (0, report_export_labels_1.reportExportLabels)((0, report_export_labels_1.normalizeReportExportLang)(opts.language));
        const overview = await pos_reports_service_1.PosReportsService.getOverviewDashboard(merchantId, opts);
        const eod = overview.eod;
        const lines = [];
        const esc = (v) => {
            const s = String(v ?? "");
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const row = (...cells) => lines.push(cells.map(esc).join(","));
        row(L.section, L.label, L.amount, L.qty);
        row(L.summary, L.store, overview.businessName, "");
        row(L.summary, L.period, overview.range.label, "");
        row(L.summary, L.totalSales, money(overview.kpis.totalSales), overview.kpis.orders);
        row(L.summary, L.netSales, money(overview.kpis.netSales), "");
        row(L.summary, L.cashDrawerFunding, money(overview.kpis.fundingAmount), "");
        row(L.summary, L.tax, money(eod.taxTotal), "");
        row(L.summary, L.tips, money(eod.tipsTotal), "");
        row(L.summary, L.customers, overview.kpis.customers, "");
        for (const p of overview.paymentMethods) {
            row(L.payment, L.paymentMethodLabel(p.method), money(p.total), p.count);
        }
        for (const o of overview.orderTypes) {
            row(L.orderType, L.channelLabel(o.channel), money(o.total), o.count);
        }
        for (const p of overview.products) {
            row(L.product, p.name, money(p.total), p.quantity);
        }
        for (const s of overview.staff) {
            row(L.staff, s.name, money(s.total), s.salesCount);
        }
        for (const [i, s] of (eod.shiftCash || []).entries()) {
            const n = i + 1;
            row(L.cashDrawer, L.shiftOpeningFloat(n), money(s.openingFloat), "");
            row(L.cashDrawer, L.shiftCashSales(n), money(s.cashSales + (s.cashRefunds || 0)), "");
            row(L.cashDrawer, L.shiftCashIn(n), money(s.cashIn || 0), "");
            row(L.cashDrawer, L.shiftCashOut(n), money(s.cashOut || 0), "");
            if (s.cashRefunds)
                row(L.cashDrawer, L.shiftCashRefunds(n), money(s.cashRefunds), "");
            row(L.cashDrawer, L.shiftExpectedCash(n), money(s.expectedCash), "");
            for (const m of s.movements || []) {
                row(L.cashDrawer, `Shift ${n} ${m.type === "out" ? L.cashOutMovement : L.cashInMovement}: ${m.reason || m.staffName || "—"}`, money(m.amount), "");
            }
        }
        const safeName = (overview.businessName || "Report").replace(/[^\w\- ]+/g, "").trim().slice(0, 40);
        const filename = `Report ${safeName}_${overview.range.from}.csv`;
        return {
            buffer: Buffer.from(lines.join("\n"), "utf8"),
            filename,
            overview,
            mime: "text/csv; charset=utf-8",
        };
    }
}
exports.ReportExportService = ReportExportService;
//# sourceMappingURL=report-export.service.js.map