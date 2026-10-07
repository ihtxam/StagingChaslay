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
exports.AccountingExportService = void 0;
const XLSX = __importStar(require("xlsx"));
const accounting_integration_settings_1 = require("@/lib/accounting-integration-settings");
const pos_reports_service_1 = require("./pos-reports.service");
function money(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}
function escCsv(v) {
    const s = String(v ?? "");
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function resolveAccounts(map, fallback) {
    return { ...fallback, ...(map || {}) };
}
function paymentAccount(method, accounts) {
    const m = String(method || "").toLowerCase();
    if (m.includes("cash"))
        return accounts.cash || "1000";
    if (m.includes("terminal"))
        return accounts.terminalClearing || accounts.cardClearing || "1021";
    if (m.includes("card") || m.includes("adyen") || m.includes("online")) {
        return accounts.cardClearing || "1020";
    }
    return accounts.cardClearing || "1020";
}
function buildJournalLines(merchantId, businessName, overview, accounts, vatCodeByLabel) {
    const eod = overview.eod;
    const date = overview.range.to || overview.range.from;
    const ref = `CHASLAY-${merchantId.slice(0, 8)}-${overview.range.from}_${overview.range.to}`;
    const labelBase = `${businessName} POS ${overview.range.label}`;
    const lines = [];
    const revenue = accounts.salesRevenue || "3200";
    const vatAcct = accounts.vatPayable || "2200";
    for (const row of eod.vatRows || []) {
        const net = money(row.net);
        const tax = money(row.tva);
        if (net > 0) {
            lines.push({
                date,
                reference: ref,
                label: `${labelBase} — ${row.label} net`,
                debitAccount: "",
                creditAccount: revenue,
                amount: net,
                taxAmount: tax,
                taxCode: vatCodeByLabel[row.label] || row.label,
            });
        }
        if (tax > 0) {
            lines.push({
                date,
                reference: ref,
                label: `${labelBase} — ${row.label} VAT`,
                debitAccount: "",
                creditAccount: vatAcct,
                amount: tax,
                taxCode: vatCodeByLabel[row.label] || row.label,
            });
        }
    }
    if (!eod.vatRows?.length && money(eod.netTotal) > 0) {
        lines.push({
            date,
            reference: ref,
            label: `${labelBase} — net sales`,
            debitAccount: "",
            creditAccount: revenue,
            amount: money(eod.netTotal),
        });
    }
    if (!eod.vatRows?.length && money(eod.taxTotal) > 0) {
        lines.push({
            date,
            reference: ref,
            label: `${labelBase} — VAT`,
            debitAccount: "",
            creditAccount: vatAcct,
            amount: money(eod.taxTotal),
        });
    }
    if (money(eod.discountTotal) > 0) {
        lines.push({
            date,
            reference: ref,
            label: `${labelBase} — discounts`,
            debitAccount: accounts.discounts || "3800",
            creditAccount: revenue,
            amount: money(eod.discountTotal),
        });
    }
    if (money(eod.tipsTotal) > 0) {
        lines.push({
            date,
            reference: ref,
            label: `${labelBase} — tips`,
            debitAccount: "",
            creditAccount: accounts.tips || "3900",
            amount: money(eod.tipsTotal),
        });
    }
    if (money(eod.refundTotal) > 0) {
        lines.push({
            date,
            reference: ref,
            label: `${labelBase} — refunds`,
            debitAccount: accounts.refunds || revenue,
            creditAccount: paymentAccount("cash", accounts),
            amount: money(eod.refundTotal),
        });
    }
    for (const p of eod.paymentRows || []) {
        const amt = money(p.total);
        if (amt <= 0)
            continue;
        lines.push({
            date,
            reference: ref,
            label: `${labelBase} — ${p.method}`,
            debitAccount: paymentAccount(p.method, accounts),
            creditAccount: "",
            amount: amt,
        });
    }
    return lines;
}
function journalToBexioCsv(lines) {
    const header = "Date;Reference;Description;Debit account;Credit account;Amount;Tax amount;Tax code";
    const rows = lines.map((l) => [
        l.date,
        l.reference,
        l.label,
        l.debitAccount,
        l.creditAccount,
        money(l.amount).toFixed(2),
        l.taxAmount != null ? money(l.taxAmount).toFixed(2) : "",
        l.taxCode || "",
    ]
        .map(escCsv)
        .join(";"));
    return [header, ...rows].join("\n");
}
function journalToOdooCsv(lines, journalCode) {
    const header = "Date;Journal;Account;Label;Debit;Credit;Tax code";
    const rows = [];
    for (const l of lines) {
        if (l.debitAccount) {
            rows.push([
                l.date,
                journalCode,
                l.debitAccount,
                l.label,
                money(l.amount).toFixed(2),
                "",
                l.taxCode || "",
            ]
                .map(escCsv)
                .join(";"));
        }
        if (l.creditAccount) {
            rows.push([
                l.date,
                journalCode,
                l.creditAccount,
                l.label,
                "",
                money(l.amount).toFixed(2),
                l.taxCode || "",
            ]
                .map(escCsv)
                .join(";"));
        }
    }
    return [header, ...rows].join("\n");
}
class AccountingExportService {
    static async buildJournal(merchantId, opts) {
        const overview = await pos_reports_service_1.PosReportsService.getOverviewDashboard(merchantId, opts);
        const { getDb, schema } = await Promise.resolve().then(() => __importStar(require("@/db")));
        const { eq } = await Promise.resolve().then(() => __importStar(require("drizzle-orm")));
        const db = getDb();
        const merchant = await db.query.merchants.findFirst({
            where: eq(schema.merchants.id, merchantId),
            columns: {
                name: true,
                accountingIntegrationSettings: true,
            },
        });
        const settings = (0, accounting_integration_settings_1.normalizeAccountingIntegrationSettings)(merchant?.accountingIntegrationSettings);
        const target = (opts.target || "standard");
        const fallback = (0, accounting_integration_settings_1.defaultAccountingAccountMap)();
        const bexioAccounts = resolveAccounts(settings.bexio?.accounts, fallback);
        const odooAccounts = resolveAccounts(settings.odoo?.accounts, fallback);
        const accounts = target === "odoo" ? odooAccounts : bexioAccounts;
        const vatCodes = settings.bexio?.vatCodeByLabel || {};
        const businessName = merchant?.name || overview.businessName || "Store";
        const lines = buildJournalLines(merchantId, businessName, overview, accounts, vatCodes);
        return {
            overview,
            lines,
            reference: lines[0]?.reference,
            businessName,
            settings,
            target,
        };
    }
    static async buildExport(merchantId, opts) {
        const journal = await this.buildJournal(merchantId, opts);
        const { overview, lines, reference, businessName, settings, target } = journal;
        const safeName = (overview.businessName || "Report")
            .replace(/[^\w\- ]+/g, "")
            .trim()
            .slice(0, 40);
        const period = overview.range.from === overview.range.to
            ? overview.range.from
            : `${overview.range.from}_${overview.range.to}`;
        if (target === "bexio") {
            const buffer = Buffer.from(journalToBexioCsv(lines), "utf8");
            return {
                buffer,
                filename: `Bexio_journal_${safeName}_${period}.csv`,
                mime: "text/csv; charset=utf-8",
                overview,
                reference,
                lineCount: lines.length,
            };
        }
        if (target === "odoo") {
            const journalCode = settings.odoo?.journalCode || "MISC";
            const buffer = Buffer.from(journalToOdooCsv(lines, journalCode), "utf8");
            return {
                buffer,
                filename: `Odoo_journal_${safeName}_${period}.csv`,
                mime: "text/csv; charset=utf-8",
                overview,
                reference,
                lineCount: lines.length,
            };
        }
        const wb = XLSX.utils.book_new();
        const summary = [
            ["Store", overview.businessName],
            ["Period", overview.range.label],
            ["From", overview.range.from],
            ["To", overview.range.to],
            ["Paid orders", overview.eod.salesCount],
            ["Gross sales", money(overview.eod.revenue)],
            ["Net sales", money(overview.eod.netTotal)],
            ["Tax", money(overview.eod.taxTotal)],
            ["Refunds", money(overview.eod.refundTotal)],
            ["Tips", money(overview.eod.tipsTotal)],
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");
        const bexioSheet = [
            [
                "Date",
                "Reference",
                "Description",
                "Debit account",
                "Credit account",
                "Amount",
                "Tax amount",
                "Tax code",
            ],
            ...lines.map((l) => [
                l.date,
                l.reference,
                l.label,
                l.debitAccount,
                l.creditAccount,
                money(l.amount),
                l.taxAmount ?? "",
                l.taxCode ?? "",
            ]),
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bexioSheet), "Journal");
        const vatSheet = [
            ["VAT label", "Net", "Tax", "Gross"],
            ...(overview.eod.vatRows || []).map((v) => [
                v.label,
                money(v.net),
                money(v.tva),
                money(v.brut),
            ]),
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vatSheet), "VAT");
        const paySheet = [
            ["Method", "Count", "Total"],
            ...(overview.eod.paymentRows || []).map((p) => [p.method, p.count, money(p.total)]),
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(paySheet), "Payments");
        const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
        return {
            buffer,
            filename: `Accounting_${safeName}_${period}.xlsx`,
            mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            overview,
            reference: lines[0]?.reference,
            lineCount: lines.length,
        };
    }
}
exports.AccountingExportService = AccountingExportService;
//# sourceMappingURL=accounting-export.service.js.map