import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export type WebPosEntitlementReason =
  | "ok"
  | "trial"
  | "subscription"
  | "legacy"
  | "trial_expired"
  | "subscription_expired"
  | "suspended"
  | "not_found";

export type WebPosEntitlement = {
  allowed: boolean;
  reason: WebPosEntitlementReason;
  status: string;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  subscriptionPlan: string | null;
  /** Whole days left on trial or subscription; null when not applicable */
  daysRemaining: number | null;
  reseller: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  } | null;
};

function daysUntil(date: Date | null | undefined, now: Date): number | null {
  if (!date) return null;
  const ms = date.getTime() - now.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

/**
 * Merchant-level WebPOS access (account trial / subscription).
 * Independent of Android device seat licenses.
 *
 * Rules:
 * - suspended → blocked
 * - valid subscriptionEndsAt → allowed
 * - trialEndsAt still in the future → allowed (status trial or active)
 * - status active with no dates → allowed (legacy / grandfathered)
 * - otherwise → blocked (trial or subscription expired)
 *
 * Does NOT flip merchant.status to "expired" so owners can still log in to Billing.
 */
export class WebPosEntitlementService {
  static async getEntitlement(merchantId: string): Promise<WebPosEntitlement> {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: {
        id: true,
        status: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
        subscriptionPlan: true,
        resellerId: true,
      },
    });

    if (!merchant) {
      return {
        allowed: false,
        reason: "not_found",
        status: "unknown",
        trialEndsAt: null,
        subscriptionEndsAt: null,
        subscriptionPlan: null,
        daysRemaining: null,
        reseller: null,
      };
    }

    let reseller: WebPosEntitlement["reseller"] = null;
    if (merchant.resellerId) {
      const row = await db.query.resellers.findFirst({
        where: eq(schema.resellers.id, merchant.resellerId),
        columns: { id: true, name: true, email: true, phone: true },
      });
      if (row) {
        reseller = {
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone || null,
        };
      }
    }

    const now = new Date();
    const status = String(merchant.status || "active");
    const trialEndsAt = merchant.trialEndsAt ?? null;
    const subscriptionEndsAt = merchant.subscriptionEndsAt ?? null;
    const base = {
      status,
      trialEndsAt: iso(trialEndsAt),
      subscriptionEndsAt: iso(subscriptionEndsAt),
      subscriptionPlan: merchant.subscriptionPlan || null,
      reseller,
    };

    if (status === "suspended") {
      return {
        ...base,
        allowed: false,
        reason: "suspended",
        daysRemaining: null,
      };
    }

    if (subscriptionEndsAt && subscriptionEndsAt.getTime() > now.getTime()) {
      return {
        ...base,
        allowed: true,
        reason: "subscription",
        daysRemaining: daysUntil(subscriptionEndsAt, now),
      };
    }

    if (trialEndsAt && trialEndsAt.getTime() > now.getTime()) {
      return {
        ...base,
        allowed: true,
        reason: "trial",
        daysRemaining: daysUntil(trialEndsAt, now),
      };
    }

    // Grandfather: activated merchants with no trial/subscription timestamps
    if (status === "active" && !trialEndsAt && !subscriptionEndsAt) {
      return {
        ...base,
        allowed: true,
        reason: "legacy",
        daysRemaining: null,
      };
    }

    if (subscriptionEndsAt && subscriptionEndsAt.getTime() <= now.getTime()) {
      return {
        ...base,
        allowed: false,
        reason: "subscription_expired",
        daysRemaining: 0,
      };
    }

    return {
      ...base,
      allowed: false,
      reason: "trial_expired",
      daysRemaining: 0,
    };
  }

  static async assertAllowed(merchantId: string): Promise<WebPosEntitlement> {
    const entitlement = await this.getEntitlement(merchantId);
    if (!entitlement.allowed) {
      const err = new Error(
        entitlement.reason === "suspended"
          ? "Merchant account is suspended"
          : "ChaslayReborn trial or subscription has expired. Buy a license or contact your reseller."
      ) as Error & { statusCode?: number; code?: string; entitlement?: WebPosEntitlement };
      err.statusCode = 402;
      err.code = "WEBPOS_LICENSE_REQUIRED";
      err.entitlement = entitlement;
      throw err;
    }
    return entitlement;
  }

  /** Express helper — returns false and writes 402 when blocked. */
  static async guard(
    merchantId: string | undefined,
    res: { status: (code: number) => { json: (body: unknown) => void } }
  ): Promise<boolean> {
    if (!merchantId) {
      res.status(400).json({ error: "Merchant ID is required" });
      return false;
    }
    try {
      await this.assertAllowed(merchantId);
      return true;
    } catch (error) {
      const err = error as Error & { statusCode?: number; code?: string; entitlement?: WebPosEntitlement };
      if (err.code === "WEBPOS_LICENSE_REQUIRED") {
        res.status(err.statusCode || 402).json({
          error: err.message,
          code: err.code,
          entitlement: err.entitlement,
        });
        return false;
      }
      throw error;
    }
  }
}
