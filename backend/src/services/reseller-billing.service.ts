import { and, count, eq, gt, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { PlatformSettingsService } from "@/services/platform-settings.service";

/** Platform settings key for reseller ? Reborn monthly price list (CHF). */
export const RESELLER_BILLING_PRICES_KEY = "reseller_billing_prices";

/** Billable add-on keys (feature prices map). */
export type BillableFeatureKey =
  | "online_shop"
  | "loyalty"
  | "gift_cards"
  | "terminals"
  | "website_cms"
  | "online_payments"
  | "offers"
  | "reservations"
  | "inventory"
  | "digital_signage"
  | "kds"
  | "ods"
  | "self_order_kiosk";

export const BILLABLE_FEATURE_KEYS: BillableFeatureKey[] = [
  "online_shop",
  "loyalty",
  "gift_cards",
  "terminals",
  "website_cms",
  "online_payments",
  "offers",
  "reservations",
  "inventory",
  "digital_signage",
  "kds",
  "ods",
  "self_order_kiosk",
];

export type ResellerBillingPrices = {
  currency: string;
  /** Monthly fee per merchant that has at least one active POS license */
  basePosMonthly: number;
  featurePrices: Partial<Record<BillableFeatureKey, number>>;
};

const DEFAULT_PRICES: ResellerBillingPrices = {
  currency: "CHF",
  basePosMonthly: 49,
  featurePrices: {
    online_shop: 19,
    loyalty: 15,
    gift_cards: 15,
    terminals: 25,
    website_cms: 19,
    online_payments: 10,
    offers: 10,
    reservations: 10,
    inventory: 29,
    digital_signage: 19,
    kds: 19,
    ods: 15,
    self_order_kiosk: 29,
  },
};

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function giftCardSettingsEnabled(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  return (raw as { enabled?: unknown }).enabled === true;
}

/**
 * Detect which billable add-ons are active for a merchant.
 * Prefer concrete merchant flags / terminals over edition-only capability.
 */
export function detectActiveBillableFeatures(merchant: {
  shopEnabled?: boolean | null;
  loyaltyEnabled?: boolean | null;
  webposGiftCardEnabled?: boolean | null;
  giftCardSettings?: unknown;
  reservationsEnabled?: boolean | null;
  inventoryAddonEnabled?: boolean | null;
  signageAddonEnabled?: boolean | null;
  kdsAddonEnabled?: boolean | null;
  odsAddonEnabled?: boolean | null;
  kioskAddonEnabled?: boolean | null;
  adyenApiKey?: string | null;
  customDomain?: string | null;
  editionFeatures?: string[] | null;
  hasActiveTerminal?: boolean;
}): BillableFeatureKey[] {
  const features = merchant.editionFeatures || [];
  const out: BillableFeatureKey[] = [];

  if (merchant.shopEnabled) out.push("online_shop");
  if (merchant.loyaltyEnabled) out.push("loyalty");
  if (merchant.webposGiftCardEnabled || giftCardSettingsEnabled(merchant.giftCardSettings)) {
    out.push("gift_cards");
  }
  if (merchant.hasActiveTerminal) out.push("terminals");
  if (merchant.customDomain || features.includes("website_cms")) out.push("website_cms");
  if (
    (merchant.shopEnabled && !!merchant.adyenApiKey?.trim()) ||
    features.includes("online_payments")
  ) {
    out.push("online_payments");
  }
  if (features.includes("offers")) out.push("offers");
  if (merchant.reservationsEnabled || features.includes("reservations")) out.push("reservations");
  if (merchant.inventoryAddonEnabled) out.push("inventory");
  if (merchant.signageAddonEnabled) out.push("digital_signage");
  if (merchant.kdsAddonEnabled) out.push("kds");
  if (merchant.odsAddonEnabled) out.push("ods");
  if (merchant.kioskAddonEnabled) out.push("self_order_kiosk");

  return [...new Set(out)];
}

function monthBounds(year: number, month1to12: number) {
  const start = new Date(Date.UTC(year, month1to12 - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month1to12, 1, 0, 0, 0, 0));
  return { start, end };
}

export class ResellerBillingService {
  static defaultPrices(): ResellerBillingPrices {
    return structuredClone(DEFAULT_PRICES);
  }

  static async getPriceList(): Promise<ResellerBillingPrices> {
    const raw = await PlatformSettingsService.get(RESELLER_BILLING_PRICES_KEY);
    if (!raw) return this.defaultPrices();
    try {
      const parsed = JSON.parse(raw) as Partial<ResellerBillingPrices>;
      const featurePrices: Partial<Record<BillableFeatureKey, number>> = {
        ...DEFAULT_PRICES.featurePrices,
      };
      for (const key of BILLABLE_FEATURE_KEYS) {
        if (parsed.featurePrices && parsed.featurePrices[key] != null) {
          featurePrices[key] = num(parsed.featurePrices[key], featurePrices[key] || 0);
        }
      }
      return {
        currency: parsed.currency || "CHF",
        basePosMonthly: num(parsed.basePosMonthly, DEFAULT_PRICES.basePosMonthly),
        featurePrices,
      };
    } catch {
      return this.defaultPrices();
    }
  }

  static async setPriceList(input: Partial<ResellerBillingPrices>): Promise<ResellerBillingPrices> {
    const current = await this.getPriceList();
    const next: ResellerBillingPrices = {
      currency: (input.currency || current.currency || "CHF").toUpperCase(),
      basePosMonthly: num(input.basePosMonthly, current.basePosMonthly),
      featurePrices: { ...current.featurePrices },
    };
    if (input.featurePrices) {
      for (const key of BILLABLE_FEATURE_KEYS) {
        if (input.featurePrices[key] != null) {
          next.featurePrices[key] = num(input.featurePrices[key], next.featurePrices[key] || 0);
        }
      }
    }
    await PlatformSettingsService.set(RESELLER_BILLING_PRICES_KEY, JSON.stringify(next));
    return next;
  }

  /**
   * Invoice-style summary for a reseller.
   * Billing unit: merchants with ?1 active (non-expired) POS license.
   * Period is informational (current calendar month by default); amounts are monthly rates.
   */
  static async getResellerInvoice(
    resellerId: string,
    opts?: { year?: number; month?: number }
  ) {
    const db = getDb();
    const now = new Date();
    const year = opts?.year || now.getUTCFullYear();
    const month = opts?.month || now.getUTCMonth() + 1;
    const { start, end } = monthBounds(year, month);
    const prices = await this.getPriceList();

    const reseller = await db.query.resellers.findFirst({
      where: eq(schema.resellers.id, resellerId),
    });
    if (!reseller) throw new Error("Reseller not found");

    const merchants = await db.query.merchants.findMany({
      where: eq(schema.merchants.resellerId, resellerId),
      with: { edition: true },
    });

    const merchantIds = merchants.map((m) => m.id);
    const activeLicenseCounts = new Map<string, number>();
    const deviceCounts = new Map<string, number>();
    const terminalMerchantIds = new Set<string>();

    if (merchantIds.length) {
      const activeLicenses = await db
        .select({
          merchantId: schema.licenses.merchantId,
          c: count(),
        })
        .from(schema.licenses)
        .where(
          and(
            inArray(schema.licenses.merchantId, merchantIds),
            eq(schema.licenses.status, "active"),
            gt(schema.licenses.expiresAt, now)
          )
        )
        .groupBy(schema.licenses.merchantId);
      for (const row of activeLicenses) {
        activeLicenseCounts.set(row.merchantId, Number(row.c));
      }

      const devices = await db
        .select({
          merchantId: schema.devices.merchantId,
          c: count(),
        })
        .from(schema.devices)
        .where(inArray(schema.devices.merchantId, merchantIds))
        .groupBy(schema.devices.merchantId);
      for (const row of devices) {
        deviceCounts.set(row.merchantId, Number(row.c));
      }

      const terminals = await db
        .select({ merchantId: schema.paymentTerminals.merchantId })
        .from(schema.paymentTerminals)
        .where(
          and(
            inArray(schema.paymentTerminals.merchantId, merchantIds),
            eq(schema.paymentTerminals.status, "active")
          )
        );
      for (const t of terminals) terminalMerchantIds.add(t.merchantId);
    }

    type Line = {
      code: string;
      description: string;
      quantity: number;
      unitPrice: number;
      amount: number;
    };

    const merchantRows: Array<{
      merchantId: string;
      name: string;
      status: string;
      billable: boolean;
      activeLicenses: number;
      devices: number;
      activeFeatures: BillableFeatureKey[];
    }> = [];

    const featureQty: Record<BillableFeatureKey, number> = {
      online_shop: 0,
      loyalty: 0,
      gift_cards: 0,
      terminals: 0,
      website_cms: 0,
      online_payments: 0,
      offers: 0,
      reservations: 0,
      inventory: 0,
      digital_signage: 0,
      kds: 0,
      ods: 0,
    };

    let billableMerchants = 0;

    for (const m of merchants) {
      const activeLicenses = activeLicenseCounts.get(m.id) || 0;
      const billable = activeLicenses > 0 && m.status !== "suspended" && m.status !== "expired";
      const editionFeatures = (m.edition?.features as string[] | null) || null;
      const activeFeatures = billable
        ? detectActiveBillableFeatures({
            shopEnabled: m.shopEnabled,
            loyaltyEnabled: m.loyaltyEnabled,
            webposGiftCardEnabled: m.webposGiftCardEnabled,
            giftCardSettings: m.giftCardSettings,
            reservationsEnabled: m.reservationsEnabled,
            inventoryAddonEnabled: (m as { inventoryAddonEnabled?: boolean }).inventoryAddonEnabled,
            signageAddonEnabled: (m as { signageAddonEnabled?: boolean }).signageAddonEnabled,
            kdsAddonEnabled: (m as { kdsAddonEnabled?: boolean }).kdsAddonEnabled,
            odsAddonEnabled: (m as { odsAddonEnabled?: boolean }).odsAddonEnabled,
            adyenApiKey: m.adyenApiKey,
            customDomain: m.customDomain,
            editionFeatures,
            hasActiveTerminal: terminalMerchantIds.has(m.id),
          })
        : [];

      if (billable) {
        billableMerchants += 1;
        for (const f of activeFeatures) featureQty[f] += 1;
      }

      merchantRows.push({
        merchantId: m.id,
        name: m.name,
        status: m.status,
        billable,
        activeLicenses,
        devices: deviceCounts.get(m.id) || 0,
        activeFeatures,
      });
    }

    const lines: Line[] = [];
    const baseAmount = billableMerchants * prices.basePosMonthly;
    lines.push({
      code: "base_pos",
      description: "Base POS (per merchant with active POS license)",
      quantity: billableMerchants,
      unitPrice: prices.basePosMonthly,
      amount: baseAmount,
    });

    let featuresTotal = 0;
    for (const key of BILLABLE_FEATURE_KEYS) {
      const qty = featureQty[key];
      const unit = prices.featurePrices[key] ?? 0;
      if (qty <= 0 || unit <= 0) continue;
      const amount = qty * unit;
      featuresTotal += amount;
      lines.push({
        code: key,
        description: `Add-on: ${key.replace(/_/g, " ")}`,
        quantity: qty,
        unitPrice: unit,
        amount,
      });
    }

    const totalDue = baseAmount + featuresTotal;

    const activeCount = merchants.filter((m) => m.status === "active" || m.status === "trial").length;
    const suspendedCount = merchants.filter((m) => m.status === "suspended").length;

    const seatsUsedRow = await db
      .select({ c: count() })
      .from(schema.licenses)
      .where(
        and(
          eq(schema.licenses.issuedByResellerId, resellerId),
          eq(schema.licenses.status, "active")
        )
      );
    const seatsUsed = Number(seatsUsedRow[0]?.c || 0);

    return {
      reseller: {
        id: reseller.id,
        name: reseller.name,
        email: reseller.email,
        status: reseller.status,
        licenseSeats: reseller.licenseSeats,
        seatsUsed,
        seatsRemaining: Math.max(0, reseller.licenseSeats - seatsUsed),
      },
      period: {
        year,
        month,
        label: `${year}-${String(month).padStart(2, "0")}`,
        start: start.toISOString(),
        end: end.toISOString(),
        note: "Amounts are monthly platform fees owed by the reseller to Reborn for the selected calendar month.",
      },
      pricingUnit:
        "Merchants with ?1 active (non-expired) POS device license; suspended/expired merchants excluded.",
      stats: {
        merchantCount: merchants.length,
        activeOrTrialCount: activeCount,
        suspendedCount,
        billableMerchantCount: billableMerchants,
        deviceCount: [...deviceCounts.values()].reduce((a, b) => a + b, 0),
        licenseSeatsAllocated: reseller.licenseSeats,
        licenseSeatsUsed: seatsUsed,
        licenseSeatsRemaining: Math.max(0, reseller.licenseSeats - seatsUsed),
      },
      currency: prices.currency,
      prices,
      merchants: merchantRows,
      lines,
      subtotalBase: baseAmount,
      subtotalFeatures: featuresTotal,
      totalDue,
    };
  }

  /** Lightweight stats for reseller list rows */
  static async getResellerStatsMap(resellerIds: string[]) {
    const db = getDb();
    const map = new Map<
      string,
      {
        merchantCount: number;
        activeOrTrialCount: number;
        suspendedCount: number;
        seatsUsed: number;
        billableMerchantCount: number;
        deviceCount: number;
      }
    >();
    for (const id of resellerIds) {
      map.set(id, {
        merchantCount: 0,
        activeOrTrialCount: 0,
        suspendedCount: 0,
        seatsUsed: 0,
        billableMerchantCount: 0,
        deviceCount: 0,
      });
    }
    if (!resellerIds.length) return map;

    const merchants = await db
      .select({
        id: schema.merchants.id,
        resellerId: schema.merchants.resellerId,
        status: schema.merchants.status,
      })
      .from(schema.merchants)
      .where(inArray(schema.merchants.resellerId, resellerIds));

    const merchantIds = merchants.map((m) => m.id);
    const now = new Date();

    const billableSet = new Set<string>();
    if (merchantIds.length) {
      const activeLic = await db
        .select({ merchantId: schema.licenses.merchantId })
        .from(schema.licenses)
        .where(
          and(
            inArray(schema.licenses.merchantId, merchantIds),
            eq(schema.licenses.status, "active"),
            gt(schema.licenses.expiresAt, now)
          )
        );
      for (const row of activeLic) billableSet.add(row.merchantId);

      const deviceRows = await db
        .select({
          merchantId: schema.devices.merchantId,
          c: count(),
        })
        .from(schema.devices)
        .where(inArray(schema.devices.merchantId, merchantIds))
        .groupBy(schema.devices.merchantId);

      const merchantReseller = new Map(merchants.map((m) => [m.id, m.resellerId!]));
      for (const d of deviceRows) {
        const rid = merchantReseller.get(d.merchantId);
        if (!rid) continue;
        const st = map.get(rid)!;
        st.deviceCount += Number(d.c);
      }
    }

    for (const m of merchants) {
      if (!m.resellerId) continue;
      const st = map.get(m.resellerId)!;
      st.merchantCount += 1;
      if (m.status === "active" || m.status === "trial") st.activeOrTrialCount += 1;
      if (m.status === "suspended") st.suspendedCount += 1;
      if (billableSet.has(m.id) && m.status !== "suspended" && m.status !== "expired") {
        st.billableMerchantCount += 1;
      }
    }

    const seatRows = await db
      .select({
        resellerId: schema.licenses.issuedByResellerId,
        c: count(),
      })
      .from(schema.licenses)
      .where(
        and(
          inArray(schema.licenses.issuedByResellerId, resellerIds),
          eq(schema.licenses.status, "active")
        )
      )
      .groupBy(schema.licenses.issuedByResellerId);
    for (const row of seatRows) {
      if (!row.resellerId) continue;
      const st = map.get(row.resellerId);
      if (st) st.seatsUsed = Number(row.c);
    }

    return map;
  }
}
