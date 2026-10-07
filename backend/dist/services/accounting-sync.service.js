"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountingSyncService = void 0;
exports.parseAccountingReportPreset = parseAccountingReportPreset;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const accounting_integration_settings_1 = require("@/lib/accounting-integration-settings");
const accounting_integration_addon_1 = require("@/lib/accounting-integration-addon");
const bexio_oauth_1 = require("@/lib/bexio-oauth");
const accounting_export_service_1 = require("./accounting-export.service");
const BEXIO_API = "https://api.bexio.com/2.0";
async function bexioFetch(path, token, init) {
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
    let body = null;
    try {
        body = text ? JSON.parse(text) : null;
    }
    catch {
        body = text;
    }
    if (!res.ok) {
        const msg = typeof body === "object" && body && "message" in body
            ? String(body.message)
            : text.slice(0, 200);
        throw new Error(`Bexio API ${res.status}: ${msg || res.statusText}`);
    }
    return body;
}
async function loadBexioAccounts(token) {
    const rows = [];
    let offset = 0;
    const limit = 500;
    for (;;) {
        const batch = (await bexioFetch(`/accounts?limit=${limit}&offset=${offset}`, token));
        if (!Array.isArray(batch) || !batch.length)
            break;
        rows.push(...batch);
        if (batch.length < limit)
            break;
        offset += limit;
        if (offset > 5000)
            break;
    }
    return rows;
}
function normalizeAccountKey(v) {
    return String(v || "")
        .trim()
        .replace(/^0+/, "");
}
async function resolveBexioAccountId(token, cache, accounts, raw, label) {
    const key = String(raw || "").trim();
    if (!key)
        throw new Error(`Missing Bexio account mapping for ${label}`);
    if (/^\d+$/.test(key))
        return Number(key);
    const cached = cache.get(key);
    if (cached)
        return cached;
    const norm = normalizeAccountKey(key);
    const match = accounts.find((a) => {
        const no = normalizeAccountKey(String(a.account_no ?? ""));
        return no === norm || String(a.account_no ?? "").trim() === key;
    });
    if (!match?.id) {
        throw new Error(`Bexio account "${key}" (${label}) not found — check Kontonummer or use numeric account_id`);
    }
    cache.set(key, match.id);
    return match.id;
}
function journalLineToBexioEntry(line, resolve) {
    const amount = Math.round(line.amount * 100) / 100;
    const entry = {
        description: line.label.slice(0, 255),
        amount,
        currency_id: 1,
        currency_factor: 1,
    };
    return { line, entry, amount, resolve };
}
async function buildBexioEntries(lines, resolve) {
    const built = lines.map((line) => journalLineToBexioEntry(line, resolve));
    const entries = [];
    for (const { line, entry } of built) {
        if (line.debitAccount && line.creditAccount) {
            entry.debit_account_id = await resolve(line.debitAccount, line.label);
            entry.credit_account_id = await resolve(line.creditAccount, line.label);
        }
        else if (line.debitAccount) {
            entry.debit_account_id = await resolve(line.debitAccount, line.label);
        }
        else if (line.creditAccount) {
            entry.credit_account_id = await resolve(line.creditAccount, line.label);
        }
        else {
            throw new Error(`Journal line has no accounts: ${line.label}`);
        }
        const taxId = line.taxCode && /^\d+$/.test(line.taxCode) ? Number(line.taxCode) : null;
        if (taxId) {
            entry.tax_id = taxId;
            if (entry.debit_account_id)
                entry.tax_account_id = entry.debit_account_id;
            else if (entry.credit_account_id)
                entry.tax_account_id = entry.credit_account_id;
        }
        entries.push(entry);
    }
    return entries;
}
async function odooJson2(baseUrl, apiKey, database, model, method, body) {
    const res = await fetch(`${baseUrl}/json/2/${model}/${method}`, {
        method: "POST",
        headers: {
            Authorization: `bearer ${apiKey}`,
            "Content-Type": "application/json",
            ...(database ? { "X-Odoo-Database": database } : {}),
        },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    }
    catch {
        data = text;
    }
    if (!res.ok) {
        throw new Error(`Odoo API ${res.status}: ${text.slice(0, 300)}`);
    }
    return data;
}
async function resolveOdooAccountId(baseUrl, apiKey, database, cache, code) {
    const key = String(code || "").trim();
    if (!key)
        throw new Error("Missing Odoo account code on journal line");
    const cached = cache.get(key);
    if (cached)
        return cached;
    const rows = await odooJson2(baseUrl, apiKey, database, "account.account", "search_read", {
        domain: [["code", "=", key]],
        fields: ["id"],
        limit: 1,
    });
    const id = rows?.[0]?.id;
    if (!id)
        throw new Error(`Odoo account code "${key}" not found`);
    cache.set(key, id);
    return id;
}
function parseAccountingReportPreset(raw) {
    const allowed = [
        "today",
        "yesterday",
        "last_week",
        "this_month",
        "last_month",
        "last_3_months",
        "custom",
    ];
    const v = String(raw || "today");
    return allowed.includes(v) ? v : "today";
}
class AccountingSyncService {
    static async testBexioConnection(merchantId) {
        const licensed = await (0, accounting_integration_addon_1.readBexioAddonEnabled)(merchantId);
        if (!licensed)
            throw new Error("Bexio add-on is not enabled for this merchant");
        const token = await (0, bexio_oauth_1.getBexioAccessToken)(merchantId);
        await bexioFetch("/accounts?limit=1", token);
        return { ok: true };
    }
    static async testOdooConnection(merchantId) {
        const licensed = await (0, accounting_integration_addon_1.readOdooAddonEnabled)(merchantId);
        if (!licensed)
            throw new Error("Odoo add-on is not enabled for this merchant");
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { accountingIntegrationSettings: true },
        });
        const settings = (0, accounting_integration_settings_1.normalizeAccountingIntegrationSettings)(merchant?.accountingIntegrationSettings);
        const odoo = settings.odoo || {};
        const baseUrl = odoo.baseUrl;
        const apiKey = odoo.apiKey;
        if (!baseUrl || !apiKey) {
            throw new Error("Odoo base URL and API key are required");
        }
        await odooJson2(baseUrl, apiKey, odoo.database, "res.users", "context_get", {});
        return { ok: true };
    }
    static async pushPeriodToBexio(merchantId, opts) {
        const licensed = await (0, accounting_integration_addon_1.readBexioAddonEnabled)(merchantId);
        if (!licensed)
            throw new Error("Bexio add-on is not enabled for this merchant");
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { accountingIntegrationSettings: true, name: true },
        });
        const merged = (0, accounting_integration_settings_1.normalizeAccountingIntegrationSettings)(merchant?.accountingIntegrationSettings);
        if (merged.bexio?.syncMode !== "api") {
            throw new Error("Enable Bexio API sync mode in Accounting settings");
        }
        const token = await (0, bexio_oauth_1.getBexioAccessToken)(merchantId);
        const journal = await accounting_export_service_1.AccountingExportService.buildJournal(merchantId, {
            ...opts,
            target: "bexio",
        });
        const { overview, lines, reference } = journal;
        if (!lines.length)
            throw new Error("No journal lines for this period");
        const refKey = reference || `CHASLAY-${merchantId.slice(0, 8)}`;
        if (merged.bexio?.lastPushedReference === refKey) {
            return { ok: true, skipped: true, reference: refKey, lineCount: lines.length };
        }
        const date = overview.range.to || overview.range.from;
        const prefix = merged.bexio?.referencePrefix || "CHASLAY";
        const refNr = `${prefix}-${overview.range.from}-${overview.range.to}`.slice(0, 80);
        const bexioAccounts = await loadBexioAccounts(token);
        const idCache = new Map();
        const resolve = (code, label) => resolveBexioAccountId(token, idCache, bexioAccounts, code, label);
        const entries = await buildBexioEntries(lines, resolve);
        await bexioFetch("/accounting/manual_entries", token, {
            method: "POST",
            body: JSON.stringify({
                type: "manual_compound_entry",
                date,
                reference_nr: refNr,
                entries,
            }),
        });
        const nextSettings = (0, accounting_integration_settings_1.mergeAccountingIntegrationSettings)(merged, {
            bexio: {
                lastPushedReference: refKey,
                lastPushedAt: new Date().toISOString(),
                lastPushError: null,
            },
        });
        await db
            .update(db_1.schema.merchants)
            .set({
            accountingIntegrationSettings: nextSettings,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        return {
            ok: true,
            reference: refKey,
            pushed: true,
            lineCount: lines.length,
        };
    }
    static async pushPeriodToOdoo(merchantId, opts) {
        const licensed = await (0, accounting_integration_addon_1.readOdooAddonEnabled)(merchantId);
        if (!licensed)
            throw new Error("Odoo add-on is not enabled for this merchant");
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { accountingIntegrationSettings: true, name: true },
        });
        const merged = (0, accounting_integration_settings_1.normalizeAccountingIntegrationSettings)(merchant?.accountingIntegrationSettings);
        const odoo = merged.odoo || {};
        if (odoo.syncMode !== "api") {
            throw new Error("Enable Odoo API sync mode in Accounting settings");
        }
        const baseUrl = odoo.baseUrl;
        const apiKey = odoo.apiKey;
        if (!baseUrl || !apiKey) {
            throw new Error("Odoo base URL and API key are required");
        }
        const journal = await accounting_export_service_1.AccountingExportService.buildJournal(merchantId, {
            ...opts,
            target: "odoo",
        });
        const { overview, lines, reference } = journal;
        if (!lines.length)
            throw new Error("No journal lines for this period");
        const refKey = reference || `CHASLAY-${merchantId.slice(0, 8)}`;
        if (odoo.lastPushedReference === refKey) {
            return { ok: true, skipped: true, reference: refKey, lineCount: lines.length };
        }
        const journalCode = odoo.journalCode || "MISC";
        const journals = await odooJson2(baseUrl, apiKey, odoo.database, "account.journal", "search_read", {
            domain: [["code", "=", journalCode]],
            fields: ["id"],
            limit: 1,
        });
        const journalId = journals?.[0]?.id;
        if (!journalId) {
            throw new Error(`Odoo journal code "${journalCode}" not found`);
        }
        const accountCache = new Map();
        const lineIds = [];
        for (const line of lines) {
            const amt = Math.round(line.amount * 100) / 100;
            if (line.debitAccount) {
                const accountId = await resolveOdooAccountId(baseUrl, apiKey, odoo.database, accountCache, line.debitAccount);
                lineIds.push([
                    0,
                    0,
                    {
                        account_id: accountId,
                        name: line.label.slice(0, 255),
                        debit: amt,
                        credit: 0,
                    },
                ]);
            }
            if (line.creditAccount) {
                const accountId = await resolveOdooAccountId(baseUrl, apiKey, odoo.database, accountCache, line.creditAccount);
                lineIds.push([
                    0,
                    0,
                    {
                        account_id: accountId,
                        name: line.label.slice(0, 255),
                        debit: 0,
                        credit: amt,
                    },
                ]);
            }
        }
        const date = overview.range.to || overview.range.from;
        const refNr = `${odoo.journalCode || "POS"}-${overview.range.from}-${overview.range.to}`.slice(0, 200);
        await odooJson2(baseUrl, apiKey, odoo.database, "account.move", "create", {
            vals_list: [
                {
                    move_type: "entry",
                    journal_id: journalId,
                    date,
                    ref: refNr,
                    line_ids: lineIds,
                },
            ],
        });
        const nextSettings = (0, accounting_integration_settings_1.mergeAccountingIntegrationSettings)(merged, {
            odoo: {
                lastPushedReference: refKey,
                lastPushedAt: new Date().toISOString(),
                lastPushError: null,
            },
        });
        await db
            .update(db_1.schema.merchants)
            .set({
            accountingIntegrationSettings: nextSettings,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        return {
            ok: true,
            reference: refKey,
            pushed: true,
            lineCount: lines.length,
        };
    }
    static async recordPushError(merchantId, platform, message) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { accountingIntegrationSettings: true },
        });
        const patch = platform === "bexio"
            ? { bexio: { lastPushError: message.slice(0, 500) } }
            : { odoo: { lastPushError: message.slice(0, 500) } };
        const next = (0, accounting_integration_settings_1.mergeAccountingIntegrationSettings)(merchant?.accountingIntegrationSettings, patch);
        await db
            .update(db_1.schema.merchants)
            .set({ accountingIntegrationSettings: next, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
    }
}
exports.AccountingSyncService = AccountingSyncService;
//# sourceMappingURL=accounting-sync.service.js.map