/** Unified ordering channel for online shop + delivery aggregators. */
export type OrderSource = "online_shop" | "justeat" | "ubereats";

export type DeliveryPlatformKey = "justEat" | "uberEats";

export type DeliveryPlatformCredentials = {
  enabled?: boolean;
  /** When true, accept simplified test webhooks without live API credentials. */
  testMode?: boolean;
  storeId?: string | null;
  apiKey?: string | null;
  apiSecret?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
  webhookSecret?: string | null;
  /** Skip pending_approval and go straight to preparing (kitchen). */
  autoAccept?: boolean;
};

export type DeliveryPlatformSettings = {
  justEat?: DeliveryPlatformCredentials;
  uberEats?: DeliveryPlatformCredentials;
};

function maskSecret(value?: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function isMasked(value?: string | null): boolean {
  return !!value && value.includes("••••");
}

function normalizeCreds(raw: unknown): DeliveryPlatformCredentials {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    enabled: o.enabled === true,
    testMode: o.testMode === true,
    storeId: o.storeId != null ? String(o.storeId).trim() || null : null,
    apiKey: o.apiKey != null ? String(o.apiKey).trim() || null : null,
    apiSecret: o.apiSecret != null ? String(o.apiSecret).trim() || null : null,
    clientId: o.clientId != null ? String(o.clientId).trim() || null : null,
    clientSecret: o.clientSecret != null ? String(o.clientSecret).trim() || null : null,
    webhookSecret: o.webhookSecret != null ? String(o.webhookSecret).trim() || null : null,
    autoAccept: o.autoAccept === true,
  };
}

export function normalizeDeliveryPlatformSettings(raw: unknown): DeliveryPlatformSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    justEat: normalizeCreds(o.justEat),
    uberEats: normalizeCreds(o.uberEats),
  };
}

export function getDeliveryPlatformPublic(raw: unknown): DeliveryPlatformSettings & {
  justEat?: DeliveryPlatformCredentials & {
    apiKeySet?: boolean;
    apiKeyMasked?: string | null;
    apiSecretSet?: boolean;
    apiSecretMasked?: string | null;
    webhookSecretSet?: boolean;
    webhookSecretMasked?: string | null;
  };
  uberEats?: DeliveryPlatformCredentials & {
    clientId?: string | null;
    clientSecretSet?: boolean;
    clientSecretMasked?: string | null;
    webhookSecretSet?: boolean;
    webhookSecretMasked?: string | null;
  };
} {
  const norm = normalizeDeliveryPlatformSettings(raw);
  const je = norm.justEat || {};
  const ue = norm.uberEats || {};
  return {
    justEat: {
      ...je,
      apiKey: undefined,
      apiSecret: undefined,
      webhookSecret: undefined,
      apiKeySet: !!je.apiKey,
      apiKeyMasked: maskSecret(je.apiKey),
      apiSecretSet: !!je.apiSecret,
      apiSecretMasked: maskSecret(je.apiSecret),
      webhookSecretSet: !!je.webhookSecret,
      webhookSecretMasked: maskSecret(je.webhookSecret),
    },
    uberEats: {
      ...ue,
      clientSecret: undefined,
      webhookSecret: undefined,
      clientSecretSet: !!ue.clientSecret,
      clientSecretMasked: maskSecret(ue.clientSecret),
      webhookSecretSet: !!ue.webhookSecret,
      webhookSecretMasked: maskSecret(ue.webhookSecret),
    },
  };
}

export function mergeDeliveryPlatformSettings(
  prevRaw: unknown,
  updatesRaw: unknown
): DeliveryPlatformSettings {
  const prev = normalizeDeliveryPlatformSettings(prevRaw);
  const updates = normalizeDeliveryPlatformSettings(updatesRaw);

  const mergeOne = (
    key: DeliveryPlatformKey,
    patch: DeliveryPlatformCredentials | undefined
  ): DeliveryPlatformCredentials => {
    const base = prev[key] || {};
    const next = patch || {};
    const out: DeliveryPlatformCredentials = {
      ...base,
      ...next,
    };
    if (isMasked(next.apiKey)) out.apiKey = base.apiKey;
    if (isMasked(next.apiSecret)) out.apiSecret = base.apiSecret;
    if (isMasked(next.clientSecret)) out.clientSecret = base.clientSecret;
    if (isMasked(next.webhookSecret)) out.webhookSecret = base.webhookSecret;
    return out;
  };

  return {
    justEat: mergeOne("justEat", updates.justEat),
    uberEats: mergeOne("uberEats", updates.uberEats),
  };
}

export function orderSourceFromPlatform(platform: string): OrderSource | null {
  const p = String(platform || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (p === "just-eat" || p === "justeat") return "justeat";
  if (p === "uber-eats" || p === "ubereats") return "ubereats";
  if (p === "online-shop" || p === "online_shop" || p === "web-shop") return "online_shop";
  return null;
}

export function platformKeyFromSource(source: OrderSource): DeliveryPlatformKey | null {
  if (source === "justeat") return "justEat";
  if (source === "ubereats") return "uberEats";
  return null;
}
