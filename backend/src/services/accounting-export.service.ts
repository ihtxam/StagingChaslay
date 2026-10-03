import * as XLSX from "xlsx";
import {
  defaultAccountingAccountMap,
  normalizeAccountingIntegrationSettings,
  type AccountingAccountMap,
} from "@/lib/accounting-integration-settings";
import {
  PosReportsService,
  type ReportPreset,
  type SalesScopeOpts,
} from "./pos-reports.service";

function money(n: number | undefined | null): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function escCsv(v: string | number): string {
  const s = String(v ?? "");
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export type AccountingExportTarget = "bexio" | "odoo" | "standard";

export type AccountingExportOpts = {
  preset?: ReportPreset;
  from?: string;
  to?: string;
  target?: AccountingExportTarget;
  language?: string;
} & SalesScopeOpts;

type JournalLine = {
  date: string;
  reference: string;
  label: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  taxAmount?: number;
  taxCode?: string;
};

function resolveAccounts(
  map: AccountingAccountMap | undefined,
  fallback: AccountingAccountMap
): AccountingAccountMap {
  return { ...fallback, ...(map || {}) };
}

function paymentAccount(method: string, accounts: AccountingAccountMap): string {
  const m = String(method || "").toLowerCase();
  if (m.includes("cash")) return accounts.cash || "1000";
  if (m.includes("terminal")) return accounts.terminalClearing || accounts.cardClearing || "1021";
  if (m.includes("card") || m.includes("adyen") || m.includes("online")) {
    return accounts.cardClearing || "1020";
  }
  return accounts.cardClearing || "1020";
}

function buildJournalLines(
  merchantId: string,
  businessName: string,
  overview: Awaited<ReturnType<typeof PosReportsService.getOverviewDashboard>>,
  accounts: AccountingAccountMap,
  vatCodeByLabel: Record<string, string>
): JournalLine[] {
  const eod = overview.eod;
  const date = overview.range.to || overview.range.from;
  const ref = `CHASLAY-${merchantId.slice(0, 8)}-${overview.range.from}_${overview.range.to}`;
  const labelBase = `${businessName} POS ${overview.range.label}`;
  const lines: JournalLine[] = [];
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
    if (amt <= 0) continue;
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

function journalToBexioCsv(lines: JournalLine[]): string {
  const header =
    "Date;Reference;Description;Debit account;Credit account;Amount;Tax amount;Tax code";
  const rows = lines.map((l) =>
    [
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
      .join(";")
  );
  return [header, ...rows].join("\n");
}

function journalToOdooCsv(lines: JournalLine[], journalCode: string): string {
  const header = "Date;Journal;Account;Label;Debit;Credit;Tax code";
  const rows: string[] = [];
  for (const l of lines) {
    if (l.debitAccount) {
      rows.push(
        [
          l.date,
          journalCode,
          l.debitAccount,
          l.label,
          money(l.amount).toFixed(2),
          "",
          l.taxCode || "",
        ]
          .map(escCsv)
          .join(";")
      );
    }
    if (l.creditAccount) {
      rows.push(
        [
          l.date,
          journalCode,
          l.creditAccount,
          l.label,
          "",
          money(l.amount).toFixed(2),
          l.taxCode || "",
        ]
          .map(escCsv)
          .join(";")
      );
    }
  }
  return [header, ...rows].join("\n");
}

export class AccountingExportService {
  static async buildExport(merchantId: string, opts: AccountingExportOpts) {
    const overview = await PosReportsService.getOverviewDashboard(merchantId, opts);
    const { getDb, schema } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: {
        name: true,
        accountingIntegrationSettings: true,
      },
    });
    const settings = normalizeAccountingIntegrationSettings(
      merchant?.accountingIntegrationSettings
    );
    const target = (opts.target || "standard") as AccountingExportTarget;
    const fallback = defaultAccountingAccountMap();
    const bexioAccounts = resolveAccounts(settings.bexio?.accounts, fallback);
    const odooAccounts = resolveAccounts(settings.odoo?.accounts, fallback);
    const accounts = target === "odoo" ? odooAccounts : bexioAccounts;
    const vatCodes = settings.bexio?.vatCodeByLabel || {};
    const lines = buildJournalLines(
      merchantId,
      merchant?.name || overview.businessName || "Store",
      overview,
      accounts,
      vatCodes
    );
    const safeName = (overview.businessName || "Report")
      .replace(/[^\w\- ]+/g, "")
      .trim()
      .slice(0, 40);
    const period =
      overview.range.from === overview.range.to
        ? overview.range.from
        : `${overview.range.from}_${overview.range.to}`;

    if (target === "bexio") {
      const buffer = Buffer.from(journalToBexioCsv(lines), "utf8");
      return {
        buffer,
        filename: `Bexio_journal_${safeName}_${period}.csv`,
        mime: "text/csv; charset=utf-8",
        overview,
        reference: lines[0]?.reference,
        lineCount: lines.length,
      };
    }

    if (target === "odoo") {
      const journal = settings.odoo?.journalCode || "MISC";
      const buffer = Buffer.from(journalToOdooCsv(lines, journal), "utf8");
      return {
        buffer,
        filename: `Odoo_journal_${safeName}_${period}.csv`,
        mime: "text/csv; charset=utf-8",
        overview,
        reference: lines[0]?.reference,
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

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
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
