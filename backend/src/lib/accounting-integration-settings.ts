export type AccountingAccountMap = {
  salesRevenue?: string | null;
  vatPayable?: string | null;
  cash?: string | null;
  cardClearing?: string | null;
  terminalClearing?: string | null;
  tips?: string | null;
  discounts?: string | null;
  refunds?: string | null;
};

export type BexioIntegrationConfig = {
  enabled?: boolean;
  /** export_only | api */
  syncMode?: "export_only" | "api";
  personalAccessToken?: string | null;
  referencePrefix?: string | null;
  accounts?: AccountingAccountMap;
  /** Bexio tax_id or code per VAT label, e.g. "8.1%": "17" */
  vatCodeByLabel?: Record<string, string>;
  lastPushedReference?: string | null;
  lastPushedAt?: string | null;
  lastPushError?: string | null;
};

export type OdooIntegrationConfig = {
  enabled?: boolean;
  syncMode?: "export_only" | "api";
  baseUrl?: string | null;
  database?: string | null;
  username?: string | null;
  apiKey?: string | null;
  journalCode?: string | null;
  accounts?: AccountingAccountMap;
  lastPushedReference?: string | null;
  lastPushedAt?: string | null;
  lastPushError?: string | null;
};

export type AccountingIntegrationSettings = {
  bexio?: BexioIntegrationConfig;
  odoo?: OdooIntegrationConfig;
};

function maskSecret(value?: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function isMasked(value?: string | null): boolean {
  return !!value && value.includes("••••");
}

function normalizeAccountMap(raw: unknown): AccountingAccountMap {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = (k: string) => {
    const v = o[k];
    if (v == null) return null;
    const s = String(v).trim();
    return s || null;
  };
  return {
    salesRevenue: pick("salesRevenue"),
    vatPayable: pick("vatPayable"),
    cash: pick("cash"),
    cardClearing: pick("cardClearing"),
    terminalClearing: pick("terminalClearing"),
    tips: pick("tips"),
    discounts: pick("discounts"),
    refunds: pick("refunds"),
  };
}

function normalizeBexio(raw: unknown): BexioIntegrationConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const vatRaw = o.vatCodeByLabel;
  const vatCodeByLabel: Record<string, string> = {};
  if (vatRaw && typeof vatRaw === "object") {
    for (const [k, v] of Object.entries(vatRaw as Record<string, unknown>)) {
      if (v != null && String(v).trim()) vatCodeByLabel[k] = String(v).trim();
    }
  }
  return {
    enabled: o.enabled === true,
    syncMode: o.syncMode === "api" ? "api" : "export_only",
    personalAccessToken:
      o.personalAccessToken != null ? String(o.personalAccessToken).trim() || null : null,
    referencePrefix:
      o.referencePrefix != null ? String(o.referencePrefix).trim().slice(0, 40) || null : null,
    accounts: normalizeAccountMap(o.accounts),
    vatCodeByLabel,
    lastPushedReference:
      o.lastPushedReference != null ? String(o.lastPushedReference).trim() || null : null,
    lastPushedAt: o.lastPushedAt != null ? String(o.lastPushedAt) : null,
    lastPushError: o.lastPushError != null ? String(o.lastPushError).slice(0, 500) : null,
  };
}

function normalizeOdoo(raw: unknown): OdooIntegrationConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    enabled: o.enabled === true,
    syncMode: o.syncMode === "api" ? "api" : "export_only",
    baseUrl: o.baseUrl != null ? String(o.baseUrl).trim().replace(/\/$/, "") || null : null,
    database: o.database != null ? String(o.database).trim() || null : null,
    username: o.username != null ? String(o.username).trim() || null : null,
    apiKey: o.apiKey != null ? String(o.apiKey).trim() || null : null,
    journalCode:
      o.journalCode != null ? String(o.journalCode).trim().slice(0, 20) || null : null,
    accounts: normalizeAccountMap(o.accounts),
    lastPushedReference:
      o.lastPushedReference != null ? String(o.lastPushedReference).trim() || null : null,
    lastPushedAt: o.lastPushedAt != null ? String(o.lastPushedAt) : null,
    lastPushError: o.lastPushError != null ? String(o.lastPushError).slice(0, 500) : null,
  };
}

export function normalizeAccountingIntegrationSettings(
  raw: unknown
): AccountingIntegrationSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    bexio: normalizeBexio(o.bexio),
    odoo: normalizeOdoo(o.odoo),
  };
}

export function getAccountingIntegrationPublic(raw: unknown) {
  const norm = normalizeAccountingIntegrationSettings(raw);
  const bexio = norm.bexio || {};
  const odoo = norm.odoo || {};
  return {
    bexio: {
      ...bexio,
      personalAccessToken: undefined,
      personalAccessTokenSet: !!bexio.personalAccessToken,
      personalAccessTokenMasked: maskSecret(bexio.personalAccessToken),
    },
    odoo: {
      ...odoo,
      apiKey: undefined,
      apiKeySet: !!odoo.apiKey,
      apiKeyMasked: maskSecret(odoo.apiKey),
    },
  };
}

export function mergeAccountingIntegrationSettings(
  prevRaw: unknown,
  updatesRaw: unknown
): AccountingIntegrationSettings {
  const prev = normalizeAccountingIntegrationSettings(prevRaw);
  const updates = normalizeAccountingIntegrationSettings(updatesRaw);

  const mergeBexio = (): BexioIntegrationConfig => {
    const base = prev.bexio || {};
    const next = updates.bexio || {};
    const out: BexioIntegrationConfig = {
      ...base,
      ...next,
      accounts: { ...base.accounts, ...next.accounts },
      vatCodeByLabel: { ...base.vatCodeByLabel, ...next.vatCodeByLabel },
    };
    if (isMasked(next.personalAccessToken)) {
      out.personalAccessToken = base.personalAccessToken;
    }
    return out;
  };

  const mergeOdoo = (): OdooIntegrationConfig => {
    const base = prev.odoo || {};
    const next = updates.odoo || {};
    const out: OdooIntegrationConfig = {
      ...base,
      ...next,
      accounts: { ...base.accounts, ...next.accounts },
    };
    if (isMasked(next.apiKey)) {
      out.apiKey = base.apiKey;
    }
    return out;
  };

  return {
    bexio: mergeBexio(),
    odoo: mergeOdoo(),
  };
}

export function defaultAccountingAccountMap(): AccountingAccountMap {
  return {
    salesRevenue: "3200",
    vatPayable: "2200",
    cash: "1000",
    cardClearing: "1020",
    terminalClearing: "1021",
    tips: "3900",
    discounts: "3800",
    refunds: "3200",
  };
}
