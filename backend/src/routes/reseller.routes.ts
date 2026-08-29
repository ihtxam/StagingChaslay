import { Router, Request, Response } from "express";
import { verifyToken, requireReseller } from "@/middleware/auth.middleware";
import { ResellerService } from "@/services/reseller.service";
import { EditionService } from "@/services/edition.service";
import { AuthService } from "@/services/auth.service";
import { EDITION_FEATURE_GROUPS, ALL_EDITION_FEATURES } from "@/lib/edition-features";
import { isInventoryAddonEnabled } from "@/lib/inventory-addon";
import { isSignageAddonEnabled, normalizeSignageScreenLimit } from "@/lib/signage-addon";
import { isKdsAddonEnabled } from "@/lib/kds-addon";
import { isOdsAddonEnabled } from "@/lib/ods-addon";
import { isStorekeeperAddonEnabled } from "@/lib/storekeeper-addon";
import { isKioskAddonEnabled } from "@/lib/kiosk-addon";
import { SubscriptionPlansService } from "@/services/subscription-plans.service";
import { SubscriptionAddonsService } from "@/services/subscription-addons.service";

const router = Router();

router.use(verifyToken);
router.use(requireReseller);

function resellerId(req: Request): string {
  return req.user!.resellerId!;
}

/**
 * GET /api/reseller/me
 */
router.get("/me", async (req: Request, res: Response) => {
  try {
    const me = await ResellerService.getById(resellerId(req));
    if (!me) return res.status(404).json({ error: "Reseller not found" });
    res.json({ success: true, reseller: me });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * GET /api/reseller/overview
 */
router.get("/overview", async (req: Request, res: Response) => {
  try {
    const rid = resellerId(req);
    const me = await ResellerService.getById(rid);
    const merchants = await ResellerService.listMerchants(rid);
    const active = merchants.filter((m) => m.status === "active" || m.status === "trial").length;
    const pool = await ResellerService.getSeatPool(rid);
    res.json({
      success: true,
      overview: {
        merchantCount: merchants.length,
        activeCount: active,
        suspendedCount: merchants.filter((m) => m.status === "suspended").length,
        licenseSeats: pool.licenseSeats,
        seatsUsed: pool.seatsUsed,
        seatsRemaining: pool.seatsRemaining,
        billableMerchantCount: me?.billableMerchantCount ?? 0,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * GET /api/reseller/licenses/pool
 */
router.get("/licenses/pool", async (req: Request, res: Response) => {
  try {
    const pool = await ResellerService.getSeatPool(resellerId(req));
    res.json({ success: true, pool });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * GET /api/reseller/licenses
 * Licenses for this reseller's merchants only
 */
router.get("/licenses", async (req: Request, res: Response) => {
  try {
    const licenses = await ResellerService.listLicenses(resellerId(req), {
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      merchantId: typeof req.query.merchantId === "string" ? req.query.merchantId : undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
    });
    res.json({ success: true, licenses });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * POST /api/reseller/licenses/issue-seats
 */
router.post("/licenses/issue-seats", async (req: Request, res: Response) => {
  try {
    const { merchantId, seats, licenseType, customDays, deviceType, posDeviceId, mode } =
      req.body || {};
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const result = await ResellerService.issueDeviceSeats(resellerId(req), {
      merchantId,
      seats: seats != null ? Number(seats) : 1,
      licenseType,
      customDays: customDays != null ? Number(customDays) : undefined,
      deviceType,
      posDeviceId,
      mode: mode === "device" || posDeviceId ? "device" : "seats",
    });
    res.status(201).json({
      success: true,
      message: `Issued ${result.licenses.length} device license(s)`,
      licenses: result.licenses,
      pool: result.pool,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to issue licenses" });
  }
});

/**
 * POST /api/reseller/licenses/:licenseId/revoke
 */
router.post("/licenses/:licenseId/revoke", async (req: Request, res: Response) => {
  try {
    const license = await ResellerService.revokeOwnedLicense(resellerId(req), req.params.licenseId);
    res.json({ success: true, license });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * POST /api/reseller/licenses/:licenseId/extend
 */
router.post("/licenses/:licenseId/extend", async (req: Request, res: Response) => {
  try {
    const days = Number(req.body?.additionalDays);
    if (!days || days <= 0) return res.status(400).json({ error: "additionalDays required" });
    const license = await ResellerService.extendOwnedLicense(
      resellerId(req),
      req.params.licenseId,
      days
    );
    res.json({ success: true, license });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * GET /api/reseller/merchants
 */
router.get("/merchants", async (req: Request, res: Response) => {
  try {
    const merchants = await ResellerService.listMerchants(resellerId(req), {
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
    });
    res.json({ success: true, merchants });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * POST /api/reseller/merchants
 */
router.post("/merchants", async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      businessName,
      phone,
      address,
      city,
      country,
      editionId,
      businessCategory,
      shopEnabled,
      deviceSeats,
      licenseType,
      customDays,
      sendInvite,
      maxPosPosts,
      maxWaiterPosts,
      maxLocations,
      inventoryAddonEnabled,
      signageAddonEnabled,
      signageScreenLimit,
      kdsAddonEnabled,
      odsAddonEnabled,
      deliveryPlatformsAddonEnabled,
      storekeeperAddonEnabled,
    } = req.body || {};
    const trimmedBusinessName = typeof businessName === "string" ? businessName.trim() : "";
    if (!email || !trimmedBusinessName || !editionId) {
      return res.status(400).json({ error: "Email, business name, and edition are required" });
    }
    const merchant = await ResellerService.createMerchantForReseller(resellerId(req), {
      email,
      password,
      businessName: trimmedBusinessName,
      phone,
      address,
      city,
      country,
      editionId,
      businessCategory,
      shopEnabled,
      deviceSeats: deviceSeats != null ? Number(deviceSeats) : 0,
      licenseType,
      customDays: customDays != null ? Number(customDays) : undefined,
      sendInvite,
      maxPosPosts: maxPosPosts != null ? Number(maxPosPosts) : undefined,
      maxWaiterPosts: maxWaiterPosts != null ? Number(maxWaiterPosts) : undefined,
      maxLocations: maxLocations != null ? Number(maxLocations) : undefined,
      inventoryAddonEnabled: inventoryAddonEnabled === true,
      signageAddonEnabled: signageAddonEnabled === true,
      signageScreenLimit:
        signageScreenLimit != null ? Number(signageScreenLimit) : undefined,
      kdsAddonEnabled: kdsAddonEnabled === true,
      odsAddonEnabled: odsAddonEnabled === true,
      deliveryPlatformsAddonEnabled: deliveryPlatformsAddonEnabled === true,
      storekeeperAddonEnabled: storekeeperAddonEnabled === true,
    });
    res.status(201).json({ success: true, merchant });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create merchant" });
  }
});

/**
 * PUT /api/reseller/merchants/:merchantId/pos-limits
 * Agency sets concurrent POS / waiter station limits for a merchant license.
 */
router.put("/merchants/:merchantId/pos-limits", async (req: Request, res: Response) => {
  try {
    const {
      maxPosPosts,
      maxWaiterPosts,
      maxLocations,
      inventoryAddonEnabled,
      inventoryEnabled,
      signageAddonEnabled,
      signageEnabled,
      signageScreenLimit,
      kdsAddonEnabled,
      kdsEnabled,
      odsAddonEnabled,
      odsEnabled,
      deliveryPlatformsAddonEnabled,
      storekeeperAddonEnabled,
      kioskAddonEnabled,
      kioskEnabled,
    } = req.body || {};
    const merchant = await ResellerService.updateMerchantPosLimits(
      resellerId(req),
      req.params.merchantId,
      {
        maxPosPosts: maxPosPosts != null ? Number(maxPosPosts) : undefined,
        maxWaiterPosts: maxWaiterPosts != null ? Number(maxWaiterPosts) : undefined,
        maxLocations: maxLocations != null ? Number(maxLocations) : undefined,
        inventoryAddonEnabled:
          inventoryAddonEnabled != null
            ? isInventoryAddonEnabled(inventoryAddonEnabled)
            : inventoryEnabled != null
              ? isInventoryAddonEnabled(inventoryEnabled)
              : undefined,
        signageAddonEnabled:
          signageAddonEnabled != null
            ? isSignageAddonEnabled(signageAddonEnabled)
            : signageEnabled != null
              ? isSignageAddonEnabled(signageEnabled)
              : undefined,
        signageScreenLimit:
          signageScreenLimit != null ? normalizeSignageScreenLimit(signageScreenLimit) : undefined,
        kdsAddonEnabled:
          kdsAddonEnabled != null
            ? isKdsAddonEnabled(kdsAddonEnabled)
            : kdsEnabled != null
              ? isKdsAddonEnabled(kdsEnabled)
              : undefined,
        odsAddonEnabled:
          odsAddonEnabled != null
            ? isOdsAddonEnabled(odsAddonEnabled)
            : odsEnabled != null
              ? isOdsAddonEnabled(odsEnabled)
              : undefined,
        deliveryPlatformsAddonEnabled:
          deliveryPlatformsAddonEnabled != null ? deliveryPlatformsAddonEnabled === true : undefined,
        storekeeperAddonEnabled:
          storekeeperAddonEnabled != null
            ? isStorekeeperAddonEnabled(storekeeperAddonEnabled)
            : undefined,
        kioskAddonEnabled:
          kioskAddonEnabled != null
            ? isKioskAddonEnabled(kioskAddonEnabled)
            : kioskEnabled != null
              ? isKioskAddonEnabled(kioskEnabled)
              : undefined,
      }
    );
    res.json({ success: true, merchant });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update limits" });
  }
});

/**
 * GET /api/reseller/plans
 * Active subscription plans assignable to merchants.
 */
router.get("/plans", async (req: Request, res: Response) => {
  try {
    const plans = await SubscriptionPlansService.listAll(true, {
      forResellerId: resellerId(req),
    });
    res.json({ success: true, plans });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list plans" });
  }
});

router.post("/plans", async (req: Request, res: Response) => {
  try {
    const plan = await SubscriptionPlansService.create({
      ...(req.body || {}),
      ownerType: "reseller",
      ownerId: resellerId(req),
    });
    res.status(201).json({ success: true, plan });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create package" });
  }
});

router.put("/plans/:planId", async (req: Request, res: Response) => {
  try {
    const existing = await SubscriptionPlansService.getById(req.params.planId);
    if (existing.ownerType !== "reseller" || existing.ownerId !== resellerId(req)) {
      return res.status(404).json({ error: "Package not found" });
    }
    const plan = await SubscriptionPlansService.update(req.params.planId, req.body || {});
    res.json({ success: true, plan });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update package" });
  }
});

router.get("/addons", async (req: Request, res: Response) => {
  try {
    const addons = await SubscriptionAddonsService.listAll({
      forResellerId: resellerId(req),
      includeInactive: true,
    });
    res.json({ success: true, addons });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list add-ons" });
  }
});

router.post("/addons", async (req: Request, res: Response) => {
  try {
    const addon = await SubscriptionAddonsService.create({
      ...(req.body || {}),
      ownerType: "reseller",
      ownerId: resellerId(req),
    });
    res.status(201).json({ success: true, addon });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create add-on" });
  }
});

router.put("/addons/:addonId", async (req: Request, res: Response) => {
  try {
    const existing = await SubscriptionAddonsService.getById(req.params.addonId);
    if (existing.ownerType !== "reseller" || existing.ownerId !== resellerId(req)) {
      return res.status(404).json({ error: "Add-on not found" });
    }
    const addon = await SubscriptionAddonsService.update(req.params.addonId, req.body || {});
    res.json({ success: true, addon });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update add-on" });
  }
});

router.delete("/plans/:planId", async (req: Request, res: Response) => {
  try {
    const existing = await SubscriptionPlansService.getById(req.params.planId);
    if (existing.ownerType !== "reseller" || existing.ownerId !== resellerId(req)) {
      return res.status(404).json({ error: "Package not found" });
    }
    const plan = await SubscriptionPlansService.remove(req.params.planId);
    res.json({ success: true, plan });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to deactivate package" });
  }
});

router.delete("/addons/:addonId", async (req: Request, res: Response) => {
  try {
    const existing = await SubscriptionAddonsService.getById(req.params.addonId);
    if (existing.ownerType !== "reseller" || existing.ownerId !== resellerId(req)) {
      return res.status(404).json({ error: "Add-on not found" });
    }
    const addon = await SubscriptionAddonsService.remove(req.params.addonId);
    res.json({ success: true, addon });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to deactivate add-on" });
  }
});

/**
 * PATCH /api/reseller/merchants/:merchantId/plan
 * Set POS edition and plan billing status for an owned merchant.
 */
router.patch("/merchants/:merchantId/plan", async (req: Request, res: Response) => {
  try {
    const { editionId, planBillingPaid, subscriptionPlan } = req.body || {};
    const merchant = await ResellerService.updateOwnedMerchantPlan(
      resellerId(req),
      req.params.merchantId,
      { editionId, planBillingPaid, subscriptionPlan }
    );
    res.json({ success: true, merchant });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update plan";
    res.status(message === "Merchant not found" ? 404 : 400).json({ error: message });
  }
});

/**
 * POST /api/reseller/merchants/:merchantId/suspend
 * Reseller-owned merchants only — same status flag as superadmin suspend.
 */
router.post("/merchants/:merchantId/suspend", async (req: Request, res: Response) => {
  try {
    const merchant = await ResellerService.suspendOwnedMerchant(
      resellerId(req),
      req.params.merchantId,
      typeof req.body?.reason === "string" ? req.body.reason : undefined
    );
    res.json({
      success: true,
      message: "Merchant suspended successfully",
      merchant,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to suspend merchant";
    res.status(message === "Merchant not found" ? 404 : 400).json({ error: message });
  }
});

/**
 * POST /api/reseller/merchants/:merchantId/reactivate
 * Unsuspend a reseller-owned merchant.
 */
router.post("/merchants/:merchantId/reactivate", async (req: Request, res: Response) => {
  try {
    const merchant = await ResellerService.reactivateOwnedMerchant(
      resellerId(req),
      req.params.merchantId
    );
    res.json({
      success: true,
      message: "Merchant reactivated successfully",
      merchant,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reactivate merchant";
    res.status(message === "Merchant not found" ? 404 : 400).json({ error: message });
  }
});

/**
 * POST /api/reseller/merchants/:merchantId/impersonate
 */
router.post("/merchants/:merchantId/impersonate", async (req: Request, res: Response) => {
  try {
    const m = await ResellerService.assertOwnsMerchant(resellerId(req), req.params.merchantId);
    if (m.status === "suspended" || m.status === "expired") {
      return res.status(400).json({ error: `Cannot open panel while merchant is ${m.status}` });
    }
    const result = await AuthService.impersonateMerchant(req.user!.id, req.params.merchantId);
    res.json({
      success: true,
      token: result.token,
      merchant: result.merchant,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to impersonate" });
  }
});

/**
 * POST /api/reseller/merchants/:merchantId/purge-sales-data
 * Fresh start after demos / training — reseller-owned merchants only.
 * Deletes orders, held carts, payments, shifts, reports, loyalty/gift history.
 * Keeps menu, staff, settings, licenses, devices, and floor plan layout.
 */
router.post("/merchants/:merchantId/purge-sales-data", async (req: Request, res: Response) => {
  try {
    const merchantId = req.params.merchantId;
    const confirm = String(req.body?.confirm || "").trim();
    if (confirm !== "DELETE ALL SALES") {
      return res.status(400).json({
        error: 'Confirmation required: send { "confirm": "DELETE ALL SALES" } in the request body',
      });
    }
    const m = await ResellerService.assertOwnsMerchant(resellerId(req), merchantId);
    const { MerchantDataResetService } = await import("@/services/merchant-data-reset.service");
    const result = await MerchantDataResetService.purgeSalesData(merchantId, {
      deleteCustomers: req.body?.deleteCustomers === true,
      deleteReservations: req.body?.deleteReservations !== false,
    });
    res.json({
      success: true,
      message: `Purged sales data for ${result.merchantName || m.name}`,
      result,
    });
  } catch (error) {
    console.error("Reseller purge sales data failed:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to purge sales data",
    });
  }
});

/**
 * GET /api/reseller/editions/catalog
 */
router.get("/editions/catalog", (_req: Request, res: Response) => {
  res.json({
    success: true,
    groups: EDITION_FEATURE_GROUPS,
    allFeatures: ALL_EDITION_FEATURES,
  });
});

/**
 * GET /api/reseller/editions
 */
router.get("/editions", async (req: Request, res: Response) => {
  try {
    const editions = await EditionService.list({
      forResellerId: resellerId(req),
      includeInactive: req.query.all === "1",
    });
    res.json({ success: true, editions });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * POST /api/reseller/editions
 */
router.post("/editions", async (req: Request, res: Response) => {
  try {
    const edition = await EditionService.create({
      name: req.body?.name,
      note: req.body?.note,
      businessCategory: req.body?.businessCategory,
      features: req.body?.features,
      ownerType: "reseller",
      ownerId: resellerId(req),
    });
    res.status(201).json({ success: true, edition });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * POST /api/reseller/editions/:id/clone
 */
router.post("/editions/:id/clone", async (req: Request, res: Response) => {
  try {
    const edition = await EditionService.cloneForReseller(
      req.params.id,
      resellerId(req),
      req.body?.name
    );
    res.status(201).json({ success: true, edition });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * PUT /api/reseller/editions/:id
 */
router.put("/editions/:id", async (req: Request, res: Response) => {
  try {
    const edition = await EditionService.update(
      req.params.id,
      {
        name: req.body?.name,
        note: req.body?.note,
        businessCategory: req.body?.businessCategory,
        features: req.body?.features,
        isActive: req.body?.isActive,
      },
      { requireOwnerType: "reseller", requireOwnerId: resellerId(req) }
    );
    res.json({ success: true, edition });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * DELETE /api/reseller/editions/:id
 */
router.delete("/editions/:id", async (req: Request, res: Response) => {
  try {
    const edition = await EditionService.softDelete(req.params.id, {
      requireOwnerType: "reseller",
      requireOwnerId: resellerId(req),
    });
    res.json({ success: true, edition });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

export default router;
