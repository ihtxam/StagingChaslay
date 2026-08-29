import { and, count, eq, gt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { withMerchantSchemaRetry } from "@/lib/ensure-merchant-schema";
import { SubscriptionPlansService } from "@/services/subscription-plans.service";
import { readSignageAddon, normalizeSignageScreenLimit } from "@/lib/signage-addon";

export type MerchantLimits = {
  maxPosPosts: number;
  maxWaiterPosts: number;
  maxStaff: number;
  maxLocations: number;
  maxProducts: number | null;
  signageScreenLimit: number;
  planSlug: string | null;
  planName: string | null;
};

export type StaffLimitInfo = {
  maxStaff: number;
  currentCount: number;
  planSlug: string | null;
  planName: string | null;
};

export type DeviceLicenseLimitInfo = {
  maxDevices: number;
  currentCount: number;
  planSlug: string | null;
  planName: string | null;
};

export type LocationLimitInfo = {
  maxLocations: number;
  currentCount: number;
  planSlug: string | null;
  planName: string | null;
};

/** 0 = unlimited for station/staff limits. */
function pickStationLimit(merchantVal: number, planVal: number, planDevices: number): number {
  const m = Math.max(0, Number(merchantVal) || 0);
  if (m > 0) return m;
  const p = Math.max(0, Number(planVal) || 0);
  if (p > 0) return p;
  const d = Math.max(0, Number(planDevices) || 0);
  return d > 0 ? d : 0;
}

export class MerchantEntitlementsService {
  static async getLimits(merchantId: string): Promise<MerchantLimits> {
    return withMerchantSchemaRetry(() => this.loadLimits(merchantId));
  }

  private static async loadLimits(merchantId: string): Promise<MerchantLimits> {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: {
        subscriptionPlan: true,
        maxPosPosts: true,
        maxWaiterPosts: true,
        maxStaff: true,
        maxLocations: true,
        signageScreenLimit: true,
      },
    });
    if (!merchant) throw new Error("Merchant not found");

    const planSlug = merchant.subscriptionPlan || "free";
    const plan = (await SubscriptionPlansService.getBySlug(planSlug)) || null;

    const maxPosPosts = pickStationLimit(
      merchant.maxPosPosts,
      plan?.maxPosPosts ?? 0,
      plan?.maxDevices ?? 0
    );
    const maxWaiterPosts = pickStationLimit(merchant.maxWaiterPosts, plan?.maxWaiterPosts ?? 0, 0);

    const merchantStaff = Math.max(0, Number(merchant.maxStaff) || 0);
    const planStaff = Math.max(0, Number(plan?.maxStaff) || 0);
    const maxStaff = merchantStaff > 0 ? merchantStaff : planStaff > 0 ? planStaff : 0;

    const merchantLocations = Math.max(0, Number(merchant.maxLocations) || 0);
    const planLocations = Math.max(0, Number(plan?.maxLocations) || 0);
    const maxLocations =
      merchantLocations > 0 ? merchantLocations : planLocations > 0 ? planLocations : 1;

    const maxRaw = plan?.maxProducts;
    const maxProducts =
      maxRaw === null || maxRaw === undefined ? null : Math.max(0, Number(maxRaw) || 0);

    const signage = await readSignageAddon(merchantId).catch(() => ({
      enabled: false,
      screenLimit: normalizeSignageScreenLimit(merchant.signageScreenLimit),
    }));

    return {
      maxPosPosts,
      maxWaiterPosts,
      maxStaff,
      maxLocations,
      maxProducts,
      signageScreenLimit: signage.screenLimit,
      planSlug: plan?.slug || planSlug,
      planName: plan?.name || null,
    };
  }

  static async countActiveLocations(merchantId: string): Promise<number> {
    const { LocationsService } = await import("@/services/locations.service");
    return LocationsService.countActive(merchantId);
  }

  static async getLocationLimitInfo(merchantId: string): Promise<LocationLimitInfo> {
    const limits = await this.getLimits(merchantId);
    const currentCount = await this.countActiveLocations(merchantId);
    return {
      maxLocations: limits.maxLocations,
      currentCount,
      planSlug: limits.planSlug,
      planName: limits.planName,
    };
  }

  static async assertCanAddLocation(merchantId: string, addCount = 1): Promise<LocationLimitInfo> {
    const info = await this.getLocationLimitInfo(merchantId);
    if (info.maxLocations <= 0) return info;
    const next = info.currentCount + Math.max(1, addCount);
    if (next > info.maxLocations) {
      const err = new Error(
        `Location limit reached (${info.maxLocations} on ${info.planName || info.planSlug || "your plan"}). Upgrade or add an extra location add-on.`
      ) as Error & { statusCode?: number; code?: string; limit?: LocationLimitInfo };
      err.statusCode = 403;
      err.code = "LOCATION_LIMIT_REACHED";
      err.limit = info;
      throw err;
    }
    return info;
  }

  static async countActiveStaff(merchantId: string): Promise<number> {
    const db = getDb();
    const [row] = await db
      .select({ total: count() })
      .from(schema.merchantStaff)
      .where(
        and(eq(schema.merchantStaff.merchantId, merchantId), eq(schema.merchantStaff.isActive, true))
      );
    return Number(row?.total) || 0;
  }

  static async getStaffLimitInfo(merchantId: string): Promise<StaffLimitInfo> {
    const limits = await this.getLimits(merchantId);
    const currentCount = await this.countActiveStaff(merchantId);
    return {
      maxStaff: limits.maxStaff,
      currentCount,
      planSlug: limits.planSlug,
      planName: limits.planName,
    };
  }

  static async assertCanAddStaff(merchantId: string, addCount = 1): Promise<StaffLimitInfo> {
    const info = await this.getStaffLimitInfo(merchantId);
    if (info.maxStaff <= 0) return info;
    const next = info.currentCount + Math.max(1, addCount);
    if (next > info.maxStaff) {
      const err = new Error(
        `Staff limit reached (${info.maxStaff} on ${info.planName || info.planSlug || "your plan"}). Upgrade your subscription or add a staff add-on.`
      ) as Error & { statusCode?: number; code?: string; limit?: StaffLimitInfo };
      err.statusCode = 403;
      err.code = "STAFF_LIMIT_REACHED";
      err.limit = info;
      throw err;
    }
    return info;
  }

  static async countActiveDeviceLicenses(merchantId: string): Promise<number> {
    const db = getDb();
    const now = new Date();
    const [row] = await db
      .select({ total: count() })
      .from(schema.licenses)
      .where(
        and(
          eq(schema.licenses.merchantId, merchantId),
          eq(schema.licenses.status, "active"),
          gt(schema.licenses.expiresAt, now)
        )
      );
    return Number(row?.total) || 0;
  }

  static async getDeviceLicenseLimitInfo(merchantId: string): Promise<DeviceLicenseLimitInfo> {
    const limits = await this.getLimits(merchantId);
    const currentCount = await this.countActiveDeviceLicenses(merchantId);
    return {
      maxDevices: limits.maxPosPosts,
      currentCount,
      planSlug: limits.planSlug,
      planName: limits.planName,
    };
  }

  static async assertCanIssueDeviceLicense(
    merchantId: string,
    addCount = 1,
    opts?: { skipIfDeviceAlreadyLicensed?: boolean; deviceId?: string }
  ): Promise<DeviceLicenseLimitInfo> {
    const info = await this.getDeviceLicenseLimitInfo(merchantId);
    if (info.maxDevices <= 0) return info;

    if (opts?.skipIfDeviceAlreadyLicensed && opts.deviceId) {
      const db = getDb();
      const existing = await db.query.licenses.findFirst({
        where: and(
          eq(schema.licenses.merchantId, merchantId),
          eq(schema.licenses.deviceId, opts.deviceId),
          eq(schema.licenses.status, "active"),
          gt(schema.licenses.expiresAt, new Date())
        ),
      });
      if (existing) return info;
    }

    const next = info.currentCount + Math.max(1, addCount);
    if (next > info.maxDevices) {
      const err = new Error(
        `Device license limit reached (${info.maxDevices} POS station(s) on ${info.planName || info.planSlug || "your plan"}). Upgrade your package or add an extra POS station add-on.`
      ) as Error & { statusCode?: number; code?: string; limit?: DeviceLicenseLimitInfo };
      err.statusCode = 403;
      err.code = "DEVICE_LIMIT_REACHED";
      err.limit = info;
      throw err;
    }
    return info;
  }
}
