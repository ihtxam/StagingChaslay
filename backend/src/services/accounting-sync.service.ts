import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  mergeAccountingIntegrationSettings,
  normalizeAccountingIntegrationSettings,
} from "@/lib/accounting-integration-settings";
import {
  readBexioAddonEnabled,
  readOdooAddonEnabled,
} from "@/lib/accounting-integration-addon";
import {
  AccountingExportService,
  type AccountingExportOpts,
} from "./accounting-export.service";

const BEXIO_API = "https://api.bexio.com/2.0";

async function bexioFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${BEXIO_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg =
      typeof body === "object" && body && "message" in body
        ? String((body as { message?: string }).message)
        : text.slice(0, 200);
    throw new Error(`Bexio API ${res.status}: ${msg || res.statusText}`);
  }
  return body;
}

export class AccountingSyncService {
  static async testBexioConnection(merchantId: string) {
    const licensed = await readBexioAddonEnabled(merchantId);
    if (!licensed) throw new Error("Bexio add-on is not enabled for this merchant");

    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { accountingIntegrationSettings: true },
    });
    const settings = normalizeAccountingIntegrationSettings(
      merchant?.accountingIntegrationSettings
    );
    const token = settings.bexio?.personalAccessToken;
    if (!token) throw new Error("Bexio personal access token is not configured");

    await bexioFetch("/accounts?limit=1", token);
    return { ok: true as const };
  }

  static async testOdooConnection(merchantId: string) {
    const licensed = await readOdooAddonEnabled(merchantId);
    if (!licensed) throw new Error("Odoo add-on is not enabled for this merchant");

    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { accountingIntegrationSettings: true },
    });
    const settings = normalizeAccountingIntegrationSettings(
      merchant?.accountingIntegrationSettings
    );
    const odoo = settings.odoo || {};
    const baseUrl = odoo.baseUrl;
    const apiKey = odoo.apiKey;
    if (!baseUrl || !apiKey) {
      throw new Error("Odoo base URL and API key are required");
    }

    const res = await fetch(`${baseUrl}/json/2/res.users/context_get`, {
      method: "POST",
      headers: {
        Authorization: `bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(odoo.database ? { "X-Odoo-Database": odoo.database } : {}),
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Odoo API ${res.status}: ${text.slice(0, 200)}`);
    }
    return { ok: true as const };
  }

  static async pushPeriodToBexio(merchantId: string, opts: AccountingExportOpts) {
    const licensed = await readBexioAddonEnabled(merchantId);
    if (!licensed) throw new Error("Bexio add-on is not enabled for this merchant");

    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { accountingIntegrationSettings: true, name: true },
    });
    const merged = normalizeAccountingIntegrationSettings(
      merchant?.accountingIntegrationSettings
    );
    if (merged.bexio?.syncMode !== "api") {
      throw new Error("Enable Bexio API sync mode in Accounting settings");
    }
    const token = merged.bexio?.personalAccessToken;
    if (!token) throw new Error("Bexio personal access token is not configured");

    const file = await AccountingExportService.buildExport(merchantId, {
      ...opts,
      target: "bexio",
    });
    const reference = file.reference || `CHASLAY-${merchantId.slice(0, 8)}`;
    if (merged.bexio?.lastPushedReference === reference) {
      return { ok: true as const, skipped: true, reference };
    }

    const overview = file.overview;
    const eod = overview.eod;
    const date = overview.range.to || overview.range.from;
    const prefix = merged.bexio?.referencePrefix || "CHASLAY";
    const refNr = `${prefix}-${overview.range.from}-${overview.range.to}`.slice(0, 120);

    const accounts = merged.bexio?.accounts || {};
    const revenueId = accounts.salesRevenue;
    if (!revenueId || !/^\d+$/.test(revenueId)) {
      throw new Error(
        "For Bexio API push, set numeric Bexio account_id values on sales revenue and payment accounts (CSV export uses Kontonummer; API uses account_id)."
      );
    }

    const amount = Math.round((Number(eod.netTotal) + Number(eod.taxTotal)) * 100) / 100;
    const cashAcct = accounts.cash;
    if (!cashAcct || !/^\d+$/.test(cashAcct)) {
      throw new Error("Configure Bexio numeric account_id for cash (debit side) before API push");
    }

    await bexioFetch("/accounting/manual_entries", token, {
      method: "POST",
      body: JSON.stringify({
        type: "manual_single_entry",
        date,
        reference_nr: refNr,
        entries: [
          {
            debit_account_id: Number(cashAcct),
            credit_account_id: Number(revenueId),
            amount,
            currency_id: 1,
            currency_factor: 1,
            description: `${merchant?.name || "Store"} POS ${overview.range.label}`,
          },
        ],
      }),
    });

    const nextSettings = mergeAccountingIntegrationSettings(merged, {
      bexio: {
        lastPushedReference: reference,
        lastPushedAt: new Date().toISOString(),
        lastPushError: null,
      },
    });

    await db
      .update(schema.merchants)
      .set({
        accountingIntegrationSettings: nextSettings,
        updatedAt: new Date(),
      })
      .where(eq(schema.merchants.id, merchantId));

    return { ok: true as const, reference, pushed: true };
  }

  static async recordPushError(
    merchantId: string,
    platform: "bexio" | "odoo",
    message: string
  ) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { accountingIntegrationSettings: true },
    });
    const patch =
      platform === "bexio"
        ? { bexio: { lastPushError: message.slice(0, 500) } }
        : { odoo: { lastPushError: message.slice(0, 500) } };
    const next = mergeAccountingIntegrationSettings(
      merchant?.accountingIntegrationSettings,
      patch
    );
    await db
      .update(schema.merchants)
      .set({ accountingIntegrationSettings: next, updatedAt: new Date() })
      .where(eq(schema.merchants.id, merchantId));
  }
}
