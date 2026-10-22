import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { shouldWriteCredential } from "@/lib/merchant-settings-preserve";

function maskSecret(value?: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export type PaymentProfilePublic = {
  id: string;
  merchantId: string;
  name: string;
  locationId: string | null;
  isDefault: boolean;
  adyenMerchantAccount: string | null;
  adyenStoreReference: string | null;
  adyenClientId: string | null;
  adyenApiKeyMasked: string | null;
  adyenApiKeySet: boolean;
  adyenHmacKeyMasked: string | null;
  adyenHmacKeySet: boolean;
  adyenLiveEnvironment: boolean;
  adyenLiveUrlPrefix: string | null;
  adyenLiveRegion: string;
  adyenUseLegacyEndpoint: boolean;
  terminalCount?: number;
  createdAt: Date;
  updatedAt: Date;
};

function sanitizeProfile(
  row: typeof schema.paymentProfiles.$inferSelect,
  terminalCount?: number
): PaymentProfilePublic {
  return {
    id: row.id,
    merchantId: row.merchantId,
    name: row.name,
    locationId: row.locationId,
    isDefault: row.isDefault,
    adyenMerchantAccount: row.adyenMerchantAccount,
    adyenStoreReference: row.adyenStoreReference,
    adyenClientId: row.adyenClientId,
    adyenApiKeyMasked: maskSecret(row.adyenApiKey),
    adyenApiKeySet: !!row.adyenApiKey,
    adyenHmacKeyMasked: maskSecret(row.adyenHmacKey),
    adyenHmacKeySet: !!row.adyenHmacKey,
    adyenLiveEnvironment: row.adyenLiveEnvironment,
    adyenLiveUrlPrefix: row.adyenLiveUrlPrefix,
    adyenLiveRegion: row.adyenLiveRegion || "EU",
    adyenUseLegacyEndpoint: row.adyenUseLegacyEndpoint,
    terminalCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Hidden implementation detail — managers configure per-branch payments, not “profiles”. */
export function allowManualPaymentProfileCreate(): boolean {
  return process.env.ALLOW_PAYMENT_PROFILE_CREATE === "1";
}

export class PaymentProfilesService {
  static async ensureDefaultProfile(merchantId: string) {
    const db = getDb();
    const existing = await db.query.paymentProfiles.findFirst({
      where: and(
        eq(schema.paymentProfiles.merchantId, merchantId),
        eq(schema.paymentProfiles.isDefault, true)
      ),
    });
    if (existing) return existing;

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");

    const [created] = await db
      .insert(schema.paymentProfiles)
      .values({
        merchantId,
        name: "Default",
        isDefault: true,
        adyenMerchantAccount: merchant.adyenMerchantAccount,
        adyenApiKey: merchant.adyenApiKey,
        adyenClientId: merchant.adyenClientId,
        adyenStoreReference: merchant.adyenStoreReference,
        adyenHmacKey: merchant.adyenHmacKey,
        adyenLiveEnvironment: merchant.adyenLiveEnvironment,
        adyenLiveUrlPrefix: merchant.adyenLiveUrlPrefix,
        adyenLiveRegion: merchant.adyenLiveRegion,
        adyenUseLegacyEndpoint: merchant.adyenUseLegacyEndpoint,
      })
      .returning();
    return created!;
  }

  /** One auto profile per branch — named after the location, credentials copied from default/merchant. */
  static async ensureProfileForLocation(merchantId: string, locationId: string) {
    const db = getDb();
    const locId = String(locationId || "").trim();
    if (!locId) throw new Error("Location id is required");

    const location = await db.query.locations.findFirst({
      where: and(eq(schema.locations.id, locId), eq(schema.locations.merchantId, merchantId)),
    });
    if (!location) throw new Error("Location not found");

    const existing = await db.query.paymentProfiles.findFirst({
      where: and(
        eq(schema.paymentProfiles.merchantId, merchantId),
        eq(schema.paymentProfiles.locationId, locId)
      ),
    });
    if (existing) return existing;

    const defaultProfile = await this.ensureDefaultProfile(merchantId);
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");

    const name = String(location.name || "Branch").trim().slice(0, 120) || "Branch";
    const [created] = await db
      .insert(schema.paymentProfiles)
      .values({
        merchantId,
        name,
        locationId: locId,
        isDefault: false,
        adyenMerchantAccount:
          defaultProfile.adyenMerchantAccount ?? merchant.adyenMerchantAccount,
        adyenApiKey: defaultProfile.adyenApiKey ?? merchant.adyenApiKey,
        adyenClientId: defaultProfile.adyenClientId ?? merchant.adyenClientId,
        adyenStoreReference:
          defaultProfile.adyenStoreReference ?? merchant.adyenStoreReference,
        adyenHmacKey: defaultProfile.adyenHmacKey ?? merchant.adyenHmacKey,
        adyenLiveEnvironment:
          defaultProfile.adyenLiveEnvironment ?? merchant.adyenLiveEnvironment,
        adyenLiveUrlPrefix:
          defaultProfile.adyenLiveUrlPrefix ?? merchant.adyenLiveUrlPrefix,
        adyenLiveRegion: defaultProfile.adyenLiveRegion ?? merchant.adyenLiveRegion,
        adyenUseLegacyEndpoint:
          defaultProfile.adyenUseLegacyEndpoint ?? merchant.adyenUseLegacyEndpoint,
      })
      .returning();
    if (!created) throw new Error("Failed to create branch payment profile");
    return created;
  }

  static async getProfileIdForLocation(
    merchantId: string,
    locationId: string
  ): Promise<string> {
    const row = await this.ensureProfileForLocation(merchantId, locationId);
    return row.id;
  }

  static async list(
    merchantId: string,
    filters?: { locationId?: string | null; paymentProfileId?: string | null }
  ): Promise<PaymentProfilePublic[]> {
    await this.ensureDefaultProfile(merchantId);
    const db = getDb();
    if (filters?.locationId) {
      const branchProfile = await this.ensureProfileForLocation(
        merchantId,
        filters.locationId
      );
      const rows = [branchProfile];
      const filtered = rows;
      const ids = filtered.map((r) => r.id);
      const counts = new Map<string, number>();
      if (ids.length) {
        const terminals = await db.query.paymentTerminals.findMany({
          where: and(
            eq(schema.paymentTerminals.merchantId, merchantId),
            inArray(schema.paymentTerminals.paymentProfileId, ids)
          ),
          columns: { paymentProfileId: true },
        });
        for (const t of terminals) {
          if (!t.paymentProfileId) continue;
          counts.set(t.paymentProfileId, (counts.get(t.paymentProfileId) || 0) + 1);
        }
      }
      return filtered.map((r) => sanitizeProfile(r, counts.get(r.id) || 0));
    }
    const rows = await db.query.paymentProfiles.findMany({
      where: eq(schema.paymentProfiles.merchantId, merchantId),
      orderBy: [asc(schema.paymentProfiles.isDefault), asc(schema.paymentProfiles.name)],
    });
    const filtered = rows;
    const ids = filtered.map((r) => r.id);
    const counts = new Map<string, number>();
    if (ids.length) {
      const terminals = await db.query.paymentTerminals.findMany({
        where: and(
          eq(schema.paymentTerminals.merchantId, merchantId),
          inArray(schema.paymentTerminals.paymentProfileId, ids)
        ),
        columns: { paymentProfileId: true },
      });
      for (const t of terminals) {
        if (!t.paymentProfileId) continue;
        counts.set(t.paymentProfileId, (counts.get(t.paymentProfileId) || 0) + 1);
      }
    }
    return filtered.map((r) => sanitizeProfile(r, counts.get(r.id) || 0));
  }

  static async getDefaultProfileId(merchantId: string): Promise<string> {
    const row = await this.ensureDefaultProfile(merchantId);
    return row.id;
  }

  static async create(
    merchantId: string,
    input: {
      name: string;
      locationId?: string | null;
      isDefault?: boolean;
      adyenMerchantAccount?: string;
      adyenApiKey?: string;
      adyenClientId?: string;
      adyenStoreReference?: string;
      adyenHmacKey?: string;
      adyenLiveEnvironment?: boolean;
      adyenLiveUrlPrefix?: string;
      adyenLiveRegion?: string;
      adyenUseLegacyEndpoint?: boolean;
    }
  ) {
    if (!allowManualPaymentProfileCreate()) {
      throw new Error(
        "Payment profiles are managed automatically per branch. Select a branch in the panel to configure payments."
      );
    }
    const name = String(input.name || "").trim();
    if (!name) throw new Error("Profile name is required");
    const db = getDb();
    if (input.isDefault) {
      await db
        .update(schema.paymentProfiles)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(schema.paymentProfiles.merchantId, merchantId));
    }
    const [row] = await db
      .insert(schema.paymentProfiles)
      .values({
        merchantId,
        name: name.slice(0, 120),
        locationId: input.locationId || null,
        isDefault: input.isDefault === true,
        ...(shouldWriteCredential(input.adyenMerchantAccount)
          ? { adyenMerchantAccount: input.adyenMerchantAccount }
          : {}),
        ...(shouldWriteCredential(input.adyenApiKey) ? { adyenApiKey: input.adyenApiKey } : {}),
        ...(shouldWriteCredential(input.adyenClientId) ? { adyenClientId: input.adyenClientId } : {}),
        ...(shouldWriteCredential(input.adyenHmacKey) ? { adyenHmacKey: input.adyenHmacKey } : {}),
        ...(typeof input.adyenStoreReference === "string"
          ? { adyenStoreReference: input.adyenStoreReference.trim() || null }
          : {}),
        ...(input.adyenLiveEnvironment != null
          ? { adyenLiveEnvironment: !!input.adyenLiveEnvironment }
          : {}),
        ...(typeof input.adyenLiveUrlPrefix === "string"
          ? { adyenLiveUrlPrefix: input.adyenLiveUrlPrefix.trim() || null }
          : {}),
        ...(input.adyenLiveRegion ? { adyenLiveRegion: String(input.adyenLiveRegion).slice(0, 10) } : {}),
        ...(input.adyenUseLegacyEndpoint != null
          ? { adyenUseLegacyEndpoint: !!input.adyenUseLegacyEndpoint }
          : {}),
      })
      .returning();
    if (!row) throw new Error("Failed to create payment profile");
    return sanitizeProfile(row, 0);
  }

  static async update(
    merchantId: string,
    profileId: string,
    input: Record<string, unknown>
  ): Promise<PaymentProfilePublic> {
    const db = getDb();
    const patch: Partial<typeof schema.paymentProfiles.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.name != null) {
      const name = String(input.name).trim();
      if (!name) throw new Error("Profile name is required");
      patch.name = name.slice(0, 120);
    }
    if (input.locationId !== undefined) {
      patch.locationId = input.locationId ? String(input.locationId) : null;
    }
    if (input.isDefault === true) {
      await db
        .update(schema.paymentProfiles)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(eq(schema.paymentProfiles.merchantId, merchantId), ne(schema.paymentProfiles.id, profileId))
        );
      patch.isDefault = true;
    } else if (input.isDefault === false) {
      patch.isDefault = false;
    }
    if (shouldWriteCredential(input.adyenMerchantAccount as string)) {
      patch.adyenMerchantAccount = String(input.adyenMerchantAccount).trim() || null;
    }
    if (shouldWriteCredential(input.adyenApiKey as string)) {
      patch.adyenApiKey = String(input.adyenApiKey).trim() || null;
    }
    if (shouldWriteCredential(input.adyenClientId as string)) {
      patch.adyenClientId = String(input.adyenClientId).trim() || null;
    }
    if (shouldWriteCredential(input.adyenHmacKey as string)) {
      patch.adyenHmacKey = String(input.adyenHmacKey).trim() || null;
    }
    if (typeof input.adyenStoreReference === "string") {
      patch.adyenStoreReference = input.adyenStoreReference.trim() || null;
    }
    if (input.adyenLiveEnvironment != null) patch.adyenLiveEnvironment = !!input.adyenLiveEnvironment;
    if (typeof input.adyenLiveUrlPrefix === "string") {
      patch.adyenLiveUrlPrefix = input.adyenLiveUrlPrefix.trim() || null;
    }
    if (input.adyenLiveRegion != null) {
      patch.adyenLiveRegion = String(input.adyenLiveRegion).slice(0, 10) || "EU";
    }
    if (input.adyenUseLegacyEndpoint != null) {
      patch.adyenUseLegacyEndpoint = !!input.adyenUseLegacyEndpoint;
    }

    const [row] = await db
      .update(schema.paymentProfiles)
      .set(patch)
      .where(
        and(eq(schema.paymentProfiles.id, profileId), eq(schema.paymentProfiles.merchantId, merchantId))
      )
      .returning();
    if (!row) throw new Error("Payment profile not found");
    return sanitizeProfile(row);
  }

  static async delete(merchantId: string, profileId: string) {
    const db = getDb();
    const row = await db.query.paymentProfiles.findFirst({
      where: and(
        eq(schema.paymentProfiles.id, profileId),
        eq(schema.paymentProfiles.merchantId, merchantId)
      ),
    });
    if (!row) throw new Error("Payment profile not found");
    if (row.isDefault) throw new Error("Cannot delete the default payment profile");

    const enrolled = await db.query.deviceEnrollments.findFirst({
      where: eq(schema.deviceEnrollments.paymentProfileId, profileId),
    });
    if (enrolled) throw new Error("Profile is used by enrolled devices");

    await db
      .update(schema.paymentTerminals)
      .set({ paymentProfileId: null })
      .where(eq(schema.paymentTerminals.paymentProfileId, profileId));

    await db
      .delete(schema.paymentProfiles)
      .where(
        and(eq(schema.paymentProfiles.id, profileId), eq(schema.paymentProfiles.merchantId, merchantId))
      );
  }

  static async assignTerminals(merchantId: string, profileId: string, terminalIds: string[]) {
    const db = getDb();
    const profile = await db.query.paymentProfiles.findFirst({
      where: and(
        eq(schema.paymentProfiles.id, profileId),
        eq(schema.paymentProfiles.merchantId, merchantId)
      ),
    });
    if (!profile) throw new Error("Payment profile not found");
    const ids = terminalIds.map((id) => String(id).trim()).filter(Boolean);
    if (!ids.length) return { updated: 0 };
    const updated = await db
      .update(schema.paymentTerminals)
      .set({ paymentProfileId: profileId })
      .where(
        and(eq(schema.paymentTerminals.merchantId, merchantId), inArray(schema.paymentTerminals.id, ids))
      )
      .returning({ id: schema.paymentTerminals.id });
    return { updated: updated.length };
  }

  static async listTerminals(
    merchantId: string,
    filters?: { paymentProfileId?: string; locationId?: string }
  ) {
    const db = getDb();
    const defaultProfileId = await this.getDefaultProfileId(merchantId);
    let terminals = await db.query.paymentTerminals.findMany({
      where: eq(schema.paymentTerminals.merchantId, merchantId),
      orderBy: asc(schema.paymentTerminals.createdAt),
    });
    if (filters?.paymentProfileId) {
      const pid = filters.paymentProfileId;
      terminals = terminals.filter(
        (t) => (t.paymentProfileId || defaultProfileId) === pid
      );
    }
    if (filters?.locationId) {
      const branchProfile = await this.ensureProfileForLocation(
        merchantId,
        filters.locationId
      );
      const profileIdsForLocation = [branchProfile.id];
      const allowed = new Set([defaultProfileId, ...profileIdsForLocation]);
      terminals = terminals.filter((t) =>
        allowed.has(t.paymentProfileId || defaultProfileId)
      );
    }
    return terminals.map((t) => ({
      id: t.id,
      terminalId: t.terminalId,
      terminalName: t.terminalName,
      status: t.status,
      paymentProfileId: t.paymentProfileId || defaultProfileId,
    }));
  }
}
