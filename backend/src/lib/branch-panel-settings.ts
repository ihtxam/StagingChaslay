import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  normalizePosPrintSettings,
  type PosPrintSettings,
} from "@/lib/pos-print-settings";
/** Per-branch overrides stored on `locations.settings` (JSON). */
export type BranchLocationSettingsBlob = {
  posPrintSettings?: PosPrintSettings | null;
  tapToPayEnabled?: boolean;
  webposCashEnabled?: boolean;
  webposCardEnabled?: boolean;
  webposTerminalEnabled?: boolean;
  webposGiftCardEnabled?: boolean;
  webposInvoiceEnabled?: boolean;
  webposExpressEnabled?: boolean;
  bankIban?: string | null;
  bankQrIban?: string | null;
  bankName?: string | null;
  bankAccountHolder?: string | null;
};

const BRANCH_BLOB_KEYS = [
  "posPrintSettings",
  "tapToPayEnabled",
  "webposCashEnabled",
  "webposCardEnabled",
  "webposTerminalEnabled",
  "webposGiftCardEnabled",
  "webposInvoiceEnabled",
  "webposExpressEnabled",
  "bankIban",
  "bankQrIban",
  "bankName",
  "bankAccountHolder",
] as const;

const ADYEN_PROFILE_KEYS = [
  "adyenMerchantAccount",
  "adyenApiKey",
  "adyenClientId",
  "adyenStoreReference",
  "adyenHmacKey",
  "adyenLiveEnvironment",
  "adyenLiveUrlPrefix",
  "adyenLiveRegion",
  "adyenUseLegacyEndpoint",
] as const;

function maskSecret(value?: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export async function merchantHasMultipleLocations(merchantId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db.query.locations.findMany({
    where: eq(schema.locations.merchantId, merchantId),
    columns: { id: true },
    limit: 2,
  });
  return rows.length > 1;
}

/** Panel sent X-Location-Id for an explicit branch scope (not staff-bound default). */
export function resolveBranchPanelSettingsLocationId(
  locationFromHeader?: boolean,
  locationId?: string | null
): string | null {
  if (!locationFromHeader) return null;
  const id = String(locationId || "").trim();
  return id || null;
}

function readBranchBlob(raw: unknown): BranchLocationSettingsBlob {
  if (!raw || typeof raw !== "object") return {};
  return raw as BranchLocationSettingsBlob;
}

export async function applyBranchPanelSettingsOverlay(
  merchantId: string,
  base: Record<string, unknown>,
  branchLocationId: string
): Promise<Record<string, unknown>> {
  const multi = await merchantHasMultipleLocations(merchantId);
  if (!multi) return base;

  const { PaymentProfilesService } = await import("@/services/payment-profiles.service");
  const profile = await PaymentProfilesService.ensureProfileForLocation(merchantId, branchLocationId);

  const db = getDb();
  const location = await db.query.locations.findFirst({
    where: and(
      eq(schema.locations.id, branchLocationId),
      eq(schema.locations.merchantId, merchantId)
    ),
  });
  const blob = readBranchBlob(location?.settings);

  const out: Record<string, unknown> = { ...base };

  out.adyenMerchantAccount = profile.adyenMerchantAccount;
  out.adyenStoreReference = profile.adyenStoreReference;
  out.adyenClientId = profile.adyenClientId;
  out.adyenApiKeyMasked = maskSecret(profile.adyenApiKey);
  out.adyenApiKeySet = !!profile.adyenApiKey;
  out.adyenHmacKeyMasked = maskSecret(profile.adyenHmacKey);
  out.adyenHmacKeySet = !!profile.adyenHmacKey;
  out.adyenLiveEnvironment = profile.adyenLiveEnvironment;
  out.adyenLiveUrlPrefix = profile.adyenLiveUrlPrefix;
  out.adyenLiveRegion = profile.adyenLiveRegion || "EU";
  out.adyenUseLegacyEndpoint = profile.adyenUseLegacyEndpoint;

  if (blob.tapToPayEnabled !== undefined) out.tapToPayEnabled = blob.tapToPayEnabled;
  if (blob.webposCashEnabled !== undefined) out.webposCashEnabled = blob.webposCashEnabled;
  if (blob.webposCardEnabled !== undefined) out.webposCardEnabled = blob.webposCardEnabled;
  if (blob.webposTerminalEnabled !== undefined) {
    out.webposTerminalEnabled = blob.webposTerminalEnabled;
  }
  if (blob.webposGiftCardEnabled !== undefined) {
    out.webposGiftCardEnabled = blob.webposGiftCardEnabled;
  }
  if (blob.webposInvoiceEnabled !== undefined) {
    out.webposInvoiceEnabled = blob.webposInvoiceEnabled;
  }
  if (blob.webposExpressEnabled !== undefined) {
    out.webposExpressEnabled = blob.webposExpressEnabled;
  }
  if (blob.bankIban !== undefined) out.bankIban = blob.bankIban;
  if (blob.bankQrIban !== undefined) out.bankQrIban = blob.bankQrIban;
  if (blob.bankName !== undefined) out.bankName = blob.bankName;
  if (blob.bankAccountHolder !== undefined) out.bankAccountHolder = blob.bankAccountHolder;

  if (blob.posPrintSettings !== undefined && blob.posPrintSettings !== null) {
    out.posPrintSettings = normalizePosPrintSettings(blob.posPrintSettings);
  }

  out.settingsScope = "branch";
  out.settingsBranchLocationId = branchLocationId;
  out.settingsBranchName = location?.name || null;

  return out;
}

/**
 * Persist branch-only fields to payment profile + location.settings; return merchant-level patch.
 */
export async function splitAndPersistBranchPanelSettings(
  merchantId: string,
  branchLocationId: string,
  updates: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const multi = await merchantHasMultipleLocations(merchantId);
  if (!multi) return updates;

  const merchantPatch: Record<string, unknown> = { ...updates };

  const adyenInput: Record<string, unknown> = {};
  for (const key of ADYEN_PROFILE_KEYS) {
    if (key in updates) {
      adyenInput[key] = updates[key];
      delete merchantPatch[key];
    }
  }

  const blobPatch: Partial<BranchLocationSettingsBlob> = {};
  for (const key of BRANCH_BLOB_KEYS) {
    if (key in updates) {
      (blobPatch as Record<string, unknown>)[key] = updates[key];
      delete merchantPatch[key];
    }
  }

  if (Object.keys(adyenInput).length) {
    const { PaymentProfilesService } = await import("@/services/payment-profiles.service");
    const profileId = await PaymentProfilesService.getProfileIdForLocation(
      merchantId,
      branchLocationId
    );
    await PaymentProfilesService.update(merchantId, profileId, adyenInput);
  }

  if (Object.keys(blobPatch).length) {
    const db = getDb();
    const location = await db.query.locations.findFirst({
      where: and(
        eq(schema.locations.id, branchLocationId),
        eq(schema.locations.merchantId, merchantId)
      ),
    });
    if (!location) throw new Error("Location not found");

    const prev = readBranchBlob(location.settings);
    let nextBlob: BranchLocationSettingsBlob = { ...prev, ...blobPatch };
    if (blobPatch.posPrintSettings !== undefined) {
      nextBlob.posPrintSettings =
        blobPatch.posPrintSettings === null
          ? null
          : normalizePosPrintSettings(blobPatch.posPrintSettings);
    }

    await db
      .update(schema.locations)
      .set({ settings: nextBlob, updatedAt: new Date() })
      .where(eq(schema.locations.id, branchLocationId));
  }

  return merchantPatch;
}

export function adyenUpdatesUseCredentials(updates: Record<string, unknown>): boolean {
  return ADYEN_PROFILE_KEYS.some((key) => key in updates);
}

/** Terminals + Adyen summary for Settings payments tab when a branch is selected. */
export async function branchPanelTerminalsContext(
  merchantId: string,
  branchLocationId: string
): Promise<{ profileId: string; filterByProfile: boolean }> {
  const multi = await merchantHasMultipleLocations(merchantId);
  if (!multi) {
    const { PaymentProfilesService } = await import("@/services/payment-profiles.service");
    const profileId = await PaymentProfilesService.getDefaultProfileId(merchantId);
    return { profileId, filterByProfile: false };
  }
  const { PaymentProfilesService } = await import("@/services/payment-profiles.service");
  const profileId = await PaymentProfilesService.getProfileIdForLocation(
    merchantId,
    branchLocationId
  );
  return { profileId, filterByProfile: true };
}
