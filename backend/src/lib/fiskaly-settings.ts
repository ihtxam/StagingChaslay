export type FiskalyEnvironment = "test" | "live";

export type FiskalyDeSettings = {
  apiKey?: string;
  apiSecret?: string;
  tssId?: string;
  clientId?: string;
  clientSerial?: string;
  adminPin?: string;
};

export type FiskalyFrSettings = {
  apiKey?: string;
  apiSecret?: string;
  unitId?: string;
  systemId?: string;
  taxpayerId?: string;
  locationId?: string;
  siren?: string;
};

export type FiskalySettings = {
  enabled?: boolean;
  environment?: FiskalyEnvironment;
  de?: FiskalyDeSettings;
  fr?: FiskalyFrSettings;
};

export type FiskalySignature = {
  country: "DE" | "FR";
  qrCodeData?: string | null;
  signature?: string | null;
  txNumber?: string | number | null;
  txId?: string | null;
  tssSerial?: string | null;
  signedAt?: string;
  raw?: Record<string, unknown>;
};

export type FiskalySettingsPublic = {
  enabled: boolean;
  environment: FiskalyEnvironment;
  de: {
    apiKeyMasked: string | null;
    apiKeySet: boolean;
    apiSecretMasked: string | null;
    apiSecretSet: boolean;
    tssId: string | null;
    clientId: string | null;
    clientSerial: string | null;
    adminPinSet: boolean;
  };
  fr: {
    apiKeyMasked: string | null;
    apiKeySet: boolean;
    apiSecretMasked: string | null;
    apiSecretSet: boolean;
    unitId: string | null;
    systemId: string | null;
    taxpayerId: string | null;
    locationId: string | null;
    siren: string | null;
  };
};

function maskSecret(value?: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function cleanStr(value: unknown, max = 255): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  if (!s) return undefined;
  return s.slice(0, max);
}

export function normalizeFiskalyEnvironment(raw?: string | null): FiskalyEnvironment {
  return String(raw || "").trim().toLowerCase() === "live" ? "live" : "test";
}

export function normalizeFiskalySettings(raw?: FiskalySettings | Record<string, unknown> | null): FiskalySettings {
  const src = (raw || {}) as FiskalySettings;
  const de = src.de || {};
  const fr = src.fr || {};
  return {
    enabled: src.enabled === true,
    environment: normalizeFiskalyEnvironment(src.environment),
    de: {
      apiKey: cleanStr(de.apiKey, 512),
      apiSecret: cleanStr(de.apiSecret, 512),
      tssId: cleanStr(de.tssId, 64),
      clientId: cleanStr(de.clientId, 64),
      clientSerial: cleanStr(de.clientSerial, 70),
      adminPin: cleanStr(de.adminPin, 32),
    },
    fr: {
      apiKey: cleanStr(fr.apiKey, 512),
      apiSecret: cleanStr(fr.apiSecret, 512),
      unitId: cleanStr(fr.unitId, 64),
      systemId: cleanStr(fr.systemId, 64),
      taxpayerId: cleanStr(fr.taxpayerId, 64),
      locationId: cleanStr(fr.locationId, 64),
      siren: cleanStr(fr.siren, 20),
    },
  };
}

export function getFiskalyPublic(raw?: FiskalySettings | Record<string, unknown> | null): FiskalySettingsPublic {
  const s = normalizeFiskalySettings(raw);
  const de = s.de || {};
  const fr = s.fr || {};
  return {
    enabled: s.enabled === true,
    environment: s.environment || "test",
    de: {
      apiKeyMasked: maskSecret(de.apiKey),
      apiKeySet: !!de.apiKey,
      apiSecretMasked: maskSecret(de.apiSecret),
      apiSecretSet: !!de.apiSecret,
      tssId: de.tssId || null,
      clientId: de.clientId || null,
      clientSerial: de.clientSerial || null,
      adminPinSet: !!de.adminPin,
    },
    fr: {
      apiKeyMasked: maskSecret(fr.apiKey),
      apiKeySet: !!fr.apiKey,
      apiSecretMasked: maskSecret(fr.apiSecret),
      apiSecretSet: !!fr.apiSecret,
      unitId: fr.unitId || null,
      systemId: fr.systemId || null,
      taxpayerId: fr.taxpayerId || null,
      locationId: fr.locationId || null,
      siren: fr.siren || null,
    },
  };
}

function secretUnchanged(incoming: string | undefined, masked?: string | null): boolean {
  if (!incoming) return false;
  return incoming.includes("••••");
}

export function mergeFiskalySettings(
  currentRaw: FiskalySettings | Record<string, unknown> | null | undefined,
  patchRaw: FiskalySettings | Record<string, unknown> | null | undefined
): FiskalySettings {
  const current = normalizeFiskalySettings(currentRaw);
  if (!patchRaw || typeof patchRaw !== "object") return current;

  const patch = patchRaw as FiskalySettings;
  const next: FiskalySettings = {
    enabled: patch.enabled !== undefined ? patch.enabled === true : current.enabled,
    environment:
      patch.environment !== undefined
        ? normalizeFiskalyEnvironment(patch.environment)
        : current.environment,
    de: { ...current.de },
    fr: { ...current.fr },
  };

  if (patch.de && typeof patch.de === "object") {
    const p = patch.de;
    const pub = getFiskalyPublic(current);
    if (p.apiKey !== undefined && !secretUnchanged(p.apiKey, pub.de.apiKeyMasked)) {
      next.de!.apiKey = cleanStr(p.apiKey, 512);
    }
    if (p.apiSecret !== undefined && !secretUnchanged(p.apiSecret, pub.de.apiSecretMasked)) {
      next.de!.apiSecret = cleanStr(p.apiSecret, 512);
    }
    if (p.tssId !== undefined) next.de!.tssId = cleanStr(p.tssId, 64);
    if (p.clientId !== undefined) next.de!.clientId = cleanStr(p.clientId, 64);
    if (p.clientSerial !== undefined) next.de!.clientSerial = cleanStr(p.clientSerial, 70);
    if (p.adminPin !== undefined && !secretUnchanged(p.adminPin, pub.de.adminPinSet ? "••••" : null)) {
      next.de!.adminPin = cleanStr(p.adminPin, 32);
    }
  }

  if (patch.fr && typeof patch.fr === "object") {
    const p = patch.fr;
    const pub = getFiskalyPublic(current);
    if (p.apiKey !== undefined && !secretUnchanged(p.apiKey, pub.fr.apiKeyMasked)) {
      next.fr!.apiKey = cleanStr(p.apiKey, 512);
    }
    if (p.apiSecret !== undefined && !secretUnchanged(p.apiSecret, pub.fr.apiSecretMasked)) {
      next.fr!.apiSecret = cleanStr(p.apiSecret, 512);
    }
    if (p.unitId !== undefined) next.fr!.unitId = cleanStr(p.unitId, 64);
    if (p.systemId !== undefined) next.fr!.systemId = cleanStr(p.systemId, 64);
    if (p.taxpayerId !== undefined) next.fr!.taxpayerId = cleanStr(p.taxpayerId, 64);
    if (p.locationId !== undefined) next.fr!.locationId = cleanStr(p.locationId, 64);
    if (p.siren !== undefined) next.fr!.siren = cleanStr(p.siren, 20);
  }

  return normalizeFiskalySettings(next);
}

export function isFiskalyCountrySupported(country?: string | null): boolean {
  return normalizeCountry(country) != null;
}

/** Normalize merchant.country to DE | FR | null (CH and others → null). */
export function normalizeCountry(country?: string | null): "DE" | "FR" | null {
  const c = String(country || "")
    .trim()
    .toUpperCase();
  if (!c) return null;
  if (c === "DE" || c === "GERMANY" || c === "DEUTSCHLAND") return "DE";
  if (c === "FR" || c === "FRANCE") return "FR";
  return null;
}
