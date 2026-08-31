import { Router, Request, Response } from "express";
import multer from "multer";
import { verifyToken, requireSuperadmin } from "@/middleware/auth.middleware";
import { MerchantService } from "@/services/merchant.service";
import { LicenseAdminService } from "@/services/license-admin.service";
import { AnalyticsService } from "@/services/analytics.service";
import { AuthService } from "@/services/auth.service";
import { SubscriptionPlansService } from "@/services/subscription-plans.service";
import { SubscriptionAddonsService } from "@/services/subscription-addons.service";
import { PlatformResellerService } from "@/services/platform-reseller.service";
import { PlatformSettingsService } from "@/services/platform-settings.service";
import { EditionService } from "@/services/edition.service";
import { ResellerService } from "@/services/reseller.service";
import { EDITION_FEATURE_GROUPS, ALL_EDITION_FEATURES } from "@/lib/edition-features";
import { isInventoryAddonEnabled } from "@/lib/inventory-addon";
import { isSignageAddonEnabled, normalizeSignageScreenLimit } from "@/lib/signage-addon";
import { isKdsAddonEnabled } from "@/lib/kds-addon";
import { isOdsAddonEnabled } from "@/lib/ods-addon";
import { isStorekeeperAddonEnabled } from "@/lib/storekeeper-addon";
import { isKioskAddonEnabled } from "@/lib/kiosk-addon";

const router = Router();
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Apply superadmin middleware to all routes
router.use(verifyToken);
router.use(requireSuperadmin);

// ============================================================================
// SUBSCRIPTION PLANS (packages)
// ============================================================================

/**
 * GET /api/superadmin/plans
 * List all subscription plans/packages
 */
router.get("/plans", async (_req: Request, res: Response) => {
  try {
    const plans = await SubscriptionPlansService.listAll(true);
    res.json({ success: true, plans });
  } catch (error) {
    console.error("Error listing plans:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list plans" });
  }
});

/**
 * POST /api/superadmin/plans
 * Create a subscription plan/package
 */
router.post("/plans", async (req: Request, res: Response) => {
  try {
    const ownerId = await PlatformResellerService.getId();
    const plan = await SubscriptionPlansService.create({
      ...(req.body || {}),
      ownerId,
    });
    res.status(201).json({ success: true, plan });
  } catch (error) {
    console.error("Error creating plan:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create plan" });
  }
});

/**
 * PUT /api/superadmin/plans/:planId
 * Update a subscription plan/package
 */
router.put("/plans/:planId", async (req: Request, res: Response) => {
  try {
    const ownerId = await PlatformResellerService.getId();
    const existing = await SubscriptionPlansService.getById(req.params.planId);
    if (existing.ownerType !== "reseller" || existing.ownerId !== ownerId) {
      return res.status(404).json({ error: "Package not found" });
    }
    const plan = await SubscriptionPlansService.update(req.params.planId, req.body || {});
    res.json({ success: true, plan });
  } catch (error) {
    console.error("Error updating plan:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update plan" });
  }
});

/**
 * DELETE /api/superadmin/plans/:planId
 * Soft-deactivate a subscription plan/package
 */
router.delete("/plans/:planId", async (req: Request, res: Response) => {
  try {
    const ownerId = await PlatformResellerService.getId();
    const existing = await SubscriptionPlansService.getById(req.params.planId);
    if (existing.ownerType !== "reseller" || existing.ownerId !== ownerId) {
      return res.status(404).json({ error: "Package not found" });
    }
    const plan = await SubscriptionPlansService.remove(req.params.planId);
    res.json({ success: true, plan });
  } catch (error) {
    console.error("Error deactivating plan:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to deactivate plan" });
  }
});

// ============================================================================
// SUBSCRIPTION ADD-ONS
// ============================================================================

router.get("/addons", async (_req: Request, res: Response) => {
  try {
    const addons = await SubscriptionAddonsService.listAll({ includeInactive: true });
    res.json({ success: true, addons });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list add-ons" });
  }
});

router.post("/addons", async (req: Request, res: Response) => {
  try {
    const ownerId = await PlatformResellerService.getId();
    const addon = await SubscriptionAddonsService.create({
      ...(req.body || {}),
      ownerId,
    });
    res.status(201).json({ success: true, addon });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create add-on" });
  }
});

router.put("/addons/:addonId", async (req: Request, res: Response) => {
  try {
    const ownerId = await PlatformResellerService.getId();
    const existing = await SubscriptionAddonsService.getById(req.params.addonId);
    if (existing.ownerType !== "reseller" || existing.ownerId !== ownerId) {
      return res.status(404).json({ error: "Add-on not found" });
    }
    const addon = await SubscriptionAddonsService.update(req.params.addonId, req.body || {});
    res.json({ success: true, addon });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update add-on" });
  }
});

router.delete("/addons/:addonId", async (req: Request, res: Response) => {
  try {
    const ownerId = await PlatformResellerService.getId();
    const existing = await SubscriptionAddonsService.getById(req.params.addonId);
    if (existing.ownerType !== "reseller" || existing.ownerId !== ownerId) {
      return res.status(404).json({ error: "Add-on not found" });
    }
    const addon = await SubscriptionAddonsService.remove(req.params.addonId);
    res.json({ success: true, addon });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to deactivate add-on" });
  }
});

// ============================================================================
// PLATFORM SETTINGS
// ============================================================================

/**
 * GET /api/superadmin/platform-settings/adyen
 */
router.get("/platform-settings/adyen", async (_req: Request, res: Response) => {
  try {
    const adyen = await PlatformSettingsService.getAdyenSettingsPublic();
    res.json({ success: true, adyen });
  } catch (error) {
    console.error("Error getting platform Adyen settings:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load Adyen settings",
    });
  }
});

/**
 * PUT /api/superadmin/platform-settings/adyen
 */
router.put("/platform-settings/adyen", async (req: Request, res: Response) => {
  try {
    const adyen = await PlatformSettingsService.updateAdyenSettings(req.body || {});
    res.json({ success: true, adyen });
  } catch (error) {
    console.error("Error updating platform Adyen settings:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to save Adyen settings",
    });
  }
});

/**
 * GET /api/superadmin/platform-settings/brevo
 */
router.get("/platform-settings/brevo", async (_req: Request, res: Response) => {
  try {
    const brevo = await PlatformSettingsService.getBrevoSettingsPublic();
    res.json({ success: true, brevo });
  } catch (error) {
    console.error("Error getting platform Brevo settings:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load Brevo settings",
    });
  }
});

/**
 * PUT /api/superadmin/platform-settings/brevo
 */
router.put("/platform-settings/brevo", async (req: Request, res: Response) => {
  try {
    const brevo = await PlatformSettingsService.updateBrevoSettings(req.body || {});
    res.json({ success: true, brevo });
  } catch (error) {
    console.error("Error updating platform Brevo settings:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to save Brevo settings",
    });
  }
});

/**
 * GET /api/superadmin/email/usage — platform email send statistics
 */
router.get("/email/usage", async (_req: Request, res: Response) => {
  try {
    const { EmailUsageService } = await import("@/services/email-usage.service");
    const usage = await EmailUsageService.getPlatformUsageSummary();
    res.json({ success: true, usage });
  } catch (error) {
    console.error("Error getting email usage:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load email usage",
    });
  }
});

/**
 * POST /api/superadmin/email/test — send a test email via platform Brevo
 */
router.post("/email/test", async (req: Request, res: Response) => {
  try {
    const to = String(req.body?.to || "").trim();
    if (!to) {
      res.status(400).json({ error: "Recipient email is required" });
      return;
    }
    const { EmailService } = await import("@/services/email.service");
    await EmailService.send({
      to,
      subject: "Reborn platform email test",
      html: "<p>This is a test email from Reborn platform Brevo.</p>",
      emailType: "marketing_test",
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Error sending platform test email:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to send test email",
    });
  }
});

// ============================================================================
// MERCHANT MANAGEMENT
// ============================================================================

/**
 * GET /api/superadmin/merchants
 * Get all merchants with pagination
 */
router.get("/merchants", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;

    const merchants = await MerchantService.getAllMerchants(page, limit, search);

    res.json({
      success: true,
      merchants,
      pagination: { page, limit },
    });
  } catch (error) {
    console.error("Error getting merchants:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get merchants" });
  }
});

/**
 * GET /api/superadmin/merchants/:merchantId
 * Get merchant details
 */
router.get("/merchants/:merchantId", async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const merchant = await MerchantService.getMerchantById(merchantId);

    res.json({
      success: true,
      merchant,
    });
  } catch (error) {
    console.error("Error getting merchant:", error);
    res.status(404).json({ error: error instanceof Error ? error.message : "Merchant not found" });
  }
});

/**
 * POST /api/superadmin/merchants/:merchantId/impersonate
 * Open merchant admin panel as that merchant (keeps superadmin session on client for return)
 */
router.post("/merchants/:merchantId/impersonate", async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const superadminId = req.user?.id;

    if (!superadminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await AuthService.impersonateMerchant(superadminId, merchantId);

    res.json({
      success: true,
      token: result.token,
      merchant: result.merchant,
      impersonatedBy: result.impersonatedBy,
    });
  } catch (error) {
    console.error("Error impersonating merchant:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to open merchant panel",
    });
  }
});

/**
 * POST /api/superadmin/merchants
 * Create new merchant (+ optional device license seats)
 */
router.post("/merchants", async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      businessName,
      contactName,
      phone,
      address,
      city,
      country,
      slug,
      shopEnabled,
      subscriptionPlan,
      status,
      deviceSeats,
      licenseType,
      customDays,
      editionId,
      resellerId,
      businessCategory,
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
      kioskAddonEnabled,
    } = req.body;

    if (!email || !password || !businessName) {
      return res.status(400).json({ error: "Email, password, and business name are required" });
    }

    const merchant = await MerchantService.createMerchant(
      email,
      password,
      businessName,
      contactName,
      phone,
      address,
      city,
      country,
      {
        slug,
        shopEnabled,
        subscriptionPlan,
        status,
        deviceSeats: deviceSeats != null ? Number(deviceSeats) : 0,
        licenseType,
        customDays: customDays != null ? Number(customDays) : undefined,
        editionId: editionId || undefined,
        resellerId: resellerId || undefined,
        businessCategory,
        maxPosPosts: maxPosPosts != null ? Number(maxPosPosts) : undefined,
        maxWaiterPosts: maxWaiterPosts != null ? Number(maxWaiterPosts) : undefined,
        maxLocations: maxLocations != null ? Number(maxLocations) : undefined,
        inventoryAddonEnabled: isInventoryAddonEnabled(inventoryAddonEnabled),
        signageAddonEnabled: isSignageAddonEnabled(signageAddonEnabled),
        signageScreenLimit:
          signageScreenLimit != null ? normalizeSignageScreenLimit(signageScreenLimit) : undefined,
        kdsAddonEnabled: isKdsAddonEnabled(kdsAddonEnabled),
        odsAddonEnabled: isOdsAddonEnabled(odsAddonEnabled),
        deliveryPlatformsAddonEnabled: deliveryPlatformsAddonEnabled === true,
        storekeeperAddonEnabled: isStorekeeperAddonEnabled(storekeeperAddonEnabled),
        kioskAddonEnabled: isKioskAddonEnabled(kioskAddonEnabled),
      }
    );

    res.status(201).json({
      success: true,
      message: "Merchant created successfully",
      merchant,
    });
  } catch (error) {
    console.error("Error creating merchant:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create merchant" });
  }
});

/**
 * DELETE /api/superadmin/merchants/:merchantId
 * Soft-delete (suspend) merchant
 */
router.delete("/merchants/:merchantId", async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const merchant = await MerchantService.deleteMerchant(merchantId);
    res.json({ success: true, message: "Merchant deleted (suspended)", merchant });
  } catch (error) {
    console.error("Error deleting merchant:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete merchant" });
  }
});

/**
 * GET /api/superadmin/merchants/:merchantId/devices
 * List devices for a merchant
 */
router.get("/merchants/:merchantId/devices", async (req: Request, res: Response) => {
  try {
    const devices = await LicenseAdminService.getMerchantDevices(req.params.merchantId);
    res.json({ success: true, devices });
  } catch (error) {
    console.error("Error listing devices:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list devices" });
  }
});

/**
 * PUT /api/superadmin/merchants/:merchantId
 * Update merchant details
 */
router.put("/merchants/:merchantId", async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const updates = req.body;

    if (
      updates.maxPosPosts != null ||
      updates.maxWaiterPosts != null ||
      updates.maxLocations != null ||
      updates.inventoryAddonEnabled != null ||
      updates.inventoryEnabled != null ||
      updates.signageAddonEnabled != null ||
      updates.signageEnabled != null ||
      updates.signageScreenLimit != null ||
      updates.kdsAddonEnabled != null ||
      updates.kdsEnabled != null ||
      updates.odsAddonEnabled != null ||
      updates.odsEnabled != null ||
      updates.deliveryPlatformsAddonEnabled != null ||
      updates.storekeeperAddonEnabled != null ||
      updates.kioskAddonEnabled != null ||
      updates.kioskEnabled != null
    ) {
      await MerchantService.updatePosPostLimits(merchantId, {
        maxPosPosts: updates.maxPosPosts != null ? Number(updates.maxPosPosts) : undefined,
        maxWaiterPosts: updates.maxWaiterPosts != null ? Number(updates.maxWaiterPosts) : undefined,
        maxLocations: updates.maxLocations != null ? Number(updates.maxLocations) : undefined,
        inventoryAddonEnabled:
          updates.inventoryAddonEnabled != null
            ? isInventoryAddonEnabled(updates.inventoryAddonEnabled)
            : updates.inventoryEnabled != null
              ? isInventoryAddonEnabled(updates.inventoryEnabled)
              : undefined,
        signageAddonEnabled:
          updates.signageAddonEnabled != null
            ? isSignageAddonEnabled(updates.signageAddonEnabled)
            : updates.signageEnabled != null
              ? isSignageAddonEnabled(updates.signageEnabled)
              : undefined,
        signageScreenLimit:
          updates.signageScreenLimit != null
            ? normalizeSignageScreenLimit(updates.signageScreenLimit)
            : undefined,
        kdsAddonEnabled:
          updates.kdsAddonEnabled != null
            ? isKdsAddonEnabled(updates.kdsAddonEnabled)
            : updates.kdsEnabled != null
              ? isKdsAddonEnabled(updates.kdsEnabled)
              : undefined,
        odsAddonEnabled:
          updates.odsAddonEnabled != null
            ? isOdsAddonEnabled(updates.odsAddonEnabled)
            : updates.odsEnabled != null
              ? isOdsAddonEnabled(updates.odsEnabled)
              : undefined,
        deliveryPlatformsAddonEnabled:
          updates.deliveryPlatformsAddonEnabled != null
            ? updates.deliveryPlatformsAddonEnabled === true
            : undefined,
        storekeeperAddonEnabled:
          updates.storekeeperAddonEnabled != null
            ? isStorekeeperAddonEnabled(updates.storekeeperAddonEnabled)
            : undefined,
        kioskAddonEnabled:
          updates.kioskAddonEnabled != null
            ? isKioskAddonEnabled(updates.kioskAddonEnabled)
            : updates.kioskEnabled != null
              ? isKioskAddonEnabled(updates.kioskEnabled)
              : undefined,
      });
      delete updates.maxPosPosts;
      delete updates.maxWaiterPosts;
      delete updates.maxLocations;
      delete updates.inventoryAddonEnabled;
      delete updates.inventoryEnabled;
      delete updates.signageAddonEnabled;
      delete updates.signageEnabled;
      delete updates.signageScreenLimit;
      delete updates.kdsAddonEnabled;
      delete updates.kdsEnabled;
      delete updates.odsAddonEnabled;
      delete updates.odsEnabled;
      delete updates.deliveryPlatformsAddonEnabled;
      delete updates.storekeeperAddonEnabled;
      delete updates.kioskAddonEnabled;
      delete updates.kioskEnabled;
    }

    const merchant =
      Object.keys(updates).length > 0
        ? await MerchantService.updateMerchant(merchantId, updates)
        : await MerchantService.getMerchantById(merchantId);

    res.json({
      success: true,
      message: "Merchant updated successfully",
      merchant,
    });
  } catch (error) {
    console.error("Error updating merchant:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update merchant" });
  }
});

/**
 * POST /api/superadmin/merchants/:merchantId/reset-password
 * Set a new password for the merchant owner account (POS + panel login).
 */
router.post("/merchants/:merchantId/reset-password", async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const password = String(req.body?.password || "");
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const existing = await MerchantService.getMerchantById(merchantId);
    if (!existing) {
      return res.status(404).json({ error: "Merchant not found" });
    }
    await AuthService.updateMerchantPassword(merchantId, password);
    res.json({ success: true, message: "Password updated" });
  } catch (error) {
    console.error("Error resetting merchant password:", error);
    res
      .status(400)
      .json({ error: error instanceof Error ? error.message : "Failed to reset password" });
  }
});

/**
 * POST /api/superadmin/merchants/:merchantId/purge-sales-data
 * Delete all orders / sales / held carts / reports for a merchant (testing reset).
 * Menu, staff, settings, licenses, and devices are kept.
 */
router.post("/merchants/:merchantId/purge-sales-data", async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const confirm = String(req.body?.confirm || "").trim();
    if (confirm !== "DELETE ALL SALES") {
      return res.status(400).json({
        error: 'Confirmation required: send { "confirm": "DELETE ALL SALES" } in the request body',
      });
    }
    const existing = await MerchantService.getMerchantById(merchantId);
    if (!existing) {
      return res.status(404).json({ error: "Merchant not found" });
    }
    const { MerchantDataResetService } = await import("@/services/merchant-data-reset.service");
    const result = await MerchantDataResetService.purgeSalesData(merchantId, {
      deleteCustomers: req.body?.deleteCustomers === true,
      deleteReservations: req.body?.deleteReservations !== false,
    });
    res.json({
      success: true,
      message: `Purged sales data for ${result.merchantName}`,
      result,
    });
  } catch (error) {
    console.error("Error purging merchant sales data:", error);
    res
      .status(400)
      .json({ error: error instanceof Error ? error.message : "Failed to purge sales data" });
  }
});

/**
 * POST /api/superadmin/merchants/:merchantId/suspend
 * Suspend merchant account
 */
router.post("/merchants/:merchantId/suspend", async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const { reason } = req.body;

    const merchant = await MerchantService.suspendMerchant(merchantId, reason);

    res.json({
      success: true,
      message: "Merchant suspended successfully",
      merchant,
    });
  } catch (error) {
    console.error("Error suspending merchant:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to suspend merchant" });
  }
});

/**
 * POST /api/superadmin/merchants/:merchantId/revoke-sessions
 * Force logout merchant from all dashboard JWTs and POS/waiter devices.
 */
router.post("/merchants/:merchantId/revoke-sessions", async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    await MerchantService.revokeAllAuthSessions(merchantId);
    res.json({ success: true, message: "All merchant sessions revoked" });
  } catch (error) {
    console.error("Error revoking merchant sessions:", error);
    res
      .status(400)
      .json({ error: error instanceof Error ? error.message : "Failed to revoke sessions" });
  }
});

/**
 * POST /api/superadmin/merchants/:merchantId/reactivate
 * Reactivate merchant account
 */
router.post("/merchants/:merchantId/reactivate", async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;

    const merchant = await MerchantService.reactivateMerchant(merchantId);

    res.json({
      success: true,
      message: "Merchant reactivated successfully",
      merchant,
    });
  } catch (error) {
    console.error("Error reactivating merchant:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to reactivate merchant" });
  }
});

/**
 * GET /api/superadmin/merchants/:merchantId/analytics
 * Get merchant analytics
 */
router.get("/merchants/:merchantId/analytics", async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;

    const analytics = await MerchantService.getMerchantAnalytics(merchantId);

    res.json({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error("Error getting merchant analytics:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get analytics" });
  }
});

/**
 * POST /api/superadmin/merchants/:merchantId/upgrade
 * Upgrade merchant subscription
 */
router.post("/merchants/:merchantId/upgrade", async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const { plan } = req.body;

    if (!plan || !["starter", "professional", "enterprise"].includes(plan)) {
      return res.status(400).json({ error: "Invalid subscription plan" });
    }

    const merchant = await MerchantService.upgradeMerchantSubscription(merchantId, plan);

    res.json({
      success: true,
      message: "Subscription upgraded successfully",
      merchant,
    });
  } catch (error) {
    console.error("Error upgrading subscription:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to upgrade subscription" });
  }
});

// ============================================================================
// LICENSE MANAGEMENT
// ============================================================================

/**
 * GET /api/superadmin/licenses/statistics
 * Get license statistics (must be before :licenseId)
 */
router.get("/licenses/statistics", async (_req: Request, res: Response) => {
  try {
    const stats = await LicenseAdminService.getLicenseStatistics();
    res.json({ success: true, statistics: stats });
  } catch (error) {
    console.error("Error getting license statistics:", error);
    res.json({
      success: true,
      statistics: {
        total: 0,
        active: 0,
        expired: 0,
        suspended: 0,
        expiringIn30Days: 0,
        trial: 0,
        yearly: 0,
      },
    });
  }
});

/**
 * GET /api/superadmin/licenses/expiring-soon
 * Get licenses expiring soon (must be before :licenseId)
 */
router.get("/licenses/expiring-soon", async (req: Request, res: Response) => {
  try {
    const daysThreshold = parseInt(req.query.days as string) || 35;
    const licenses = await LicenseAdminService.getLicensesExpiringSoon(daysThreshold);
    res.json({ success: true, licenses, threshold: `${daysThreshold} days` });
  } catch (error) {
    console.error("Error getting expiring licenses:", error);
    res.json({ success: true, licenses: [], threshold: `${daysThreshold} days` });
  }
});

/**
 * POST /api/superadmin/licenses/generate
 * Generate license for an existing device
 */
router.post("/licenses/generate", async (req: Request, res: Response) => {
  try {
    const { merchantId, deviceId, licenseType, customDays } = req.body;

    if (!merchantId || !deviceId) {
      return res.status(400).json({ error: "Merchant ID and device ID are required" });
    }

    const result = await LicenseAdminService.generateLicenseForMerchant(
      merchantId,
      deviceId,
      licenseType || "yearly",
      customDays
    );

    res.json(result);
  } catch (error) {
    console.error("Error generating license:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to generate license" });
  }
});

/**
 * POST /api/superadmin/licenses/issue-seats
 * Create placeholder POS devices + license keys for a merchant
 */
router.post("/licenses/issue-seats", async (req: Request, res: Response) => {
  try {
    const { merchantId, seats, licenseType, customDays, deviceType } = req.body;
    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }

    const issued = await LicenseAdminService.issueDeviceSeats(
      merchantId,
      Number(seats) || 1,
      licenseType || "yearly",
      customDays != null ? Number(customDays) : undefined,
      deviceType || "tablet"
    );

    res.status(201).json({
      success: true,
      message: `Issued ${issued.length} device license(s)`,
      licenses: issued,
    });
  } catch (error) {
    console.error("Error issuing seats:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to issue licenses" });
  }
});

/**
 * POST /api/superadmin/licenses/issue-for-device
 * Bind a license to the Android POS device ID shown in the app
 */
router.post("/licenses/issue-for-device", async (req: Request, res: Response) => {
  try {
    const { merchantId, posDeviceId, licenseType, customDays, deviceType } = req.body;
    if (!merchantId || !String(posDeviceId || "").trim()) {
      return res.status(400).json({ error: "Merchant ID and POS device ID are required" });
    }

    const issued = await LicenseAdminService.issueForPosDeviceId(
      merchantId,
      String(posDeviceId).trim(),
      licenseType || "yearly",
      customDays != null ? Number(customDays) : undefined,
      deviceType || "tablet"
    );

    res.status(issued.reused ? 200 : 201).json({
      success: true,
      message: issued.reused
        ? "License already active for this device"
        : "Issued 1 device license",
      licenses: [issued],
    });
  } catch (error) {
    console.error("Error issuing device license:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to issue license" });
  }
});

/**
 * GET /api/superadmin/licenses
 * Get all licenses
 */
router.get("/licenses", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const merchantId = req.query.merchantId as string;

    const licenses = await LicenseAdminService.getAllLicenses(page, limit, status, merchantId);

    res.json({
      success: true,
      licenses,
      pagination: { page, limit },
    });
  } catch (error) {
    console.error("Error getting licenses:", error);
    res.json({
      success: true,
      licenses: [],
      pagination: { page: parseInt(req.query.page as string) || 1, limit: parseInt(req.query.limit as string) || 20 },
    });
  }
});

/**
 * GET /api/superadmin/licenses/:licenseId
 * Get license details
 */
router.get("/licenses/:licenseId", async (req: Request, res: Response) => {
  try {
    const { licenseId } = req.params;
    const license = await LicenseAdminService.getLicenseDetails(licenseId);
    res.json({ success: true, license });
  } catch (error) {
    console.error("Error getting license:", error);
    res.status(404).json({ error: error instanceof Error ? error.message : "License not found" });
  }
});

/**
 * POST /api/superadmin/licenses/:licenseId/revoke
 * Revoke license
 */
router.post("/licenses/:licenseId/revoke", async (req: Request, res: Response) => {
  try {
    const { licenseId } = req.params;
    const license = await LicenseAdminService.revokeLicense(licenseId);
    res.json({ success: true, message: "License revoked successfully", license });
  } catch (error) {
    console.error("Error revoking license:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to revoke license" });
  }
});

/**
 * POST /api/superadmin/licenses/:licenseId/extend
 * Extend license expiry
 */
router.post("/licenses/:licenseId/extend", async (req: Request, res: Response) => {
  try {
    const { licenseId } = req.params;
    const { additionalDays } = req.body;

    if (!additionalDays || additionalDays <= 0) {
      return res.status(400).json({ error: "Additional days must be greater than 0" });
    }

    const license = await LicenseAdminService.extendLicense(licenseId, additionalDays);
    res.json({ success: true, message: "License extended successfully", license });
  } catch (error) {
    console.error("Error extending license:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to extend license" });
  }
});

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * GET /api/superadmin/analytics/overview
 * Get platform overview
 */
router.get("/analytics/overview", async (req: Request, res: Response) => {
  try {
    const overview = await AnalyticsService.getPlatformOverview();

    res.json({
      success: true,
      overview,
    });
  } catch (error) {
    console.error("Error getting overview:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get overview" });
  }
});

/**
 * GET /api/superadmin/analytics/revenue
 * Get revenue analytics
 */
router.get("/analytics/revenue", async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const analytics = await AnalyticsService.getRevenueAnalytics(startDate, endDate);

    res.json({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error("Error getting revenue analytics:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get analytics" });
  }
});

/**
 * GET /api/superadmin/analytics/top-merchants
 * Get top merchants by revenue
 */
router.get("/analytics/top-merchants", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const merchants = await AnalyticsService.getTopMerchantsByRevenue(limit);

    res.json({
      success: true,
      merchants,
    });
  } catch (error) {
    console.error("Error getting top merchants:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get top merchants" });
  }
});

/**
 * GET /api/superadmin/analytics/subscription-distribution
 * Get subscription plan distribution
 */
router.get("/analytics/subscription-distribution", async (req: Request, res: Response) => {
  try {
    const distribution = await AnalyticsService.getSubscriptionDistribution();

    res.json({
      success: true,
      distribution,
    });
  } catch (error) {
    console.error("Error getting subscription distribution:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get distribution" });
  }
});

// ============================================================================
// EDITIONS
// ============================================================================

router.get("/editions/catalog", (_req: Request, res: Response) => {
  res.json({ success: true, groups: EDITION_FEATURE_GROUPS, allFeatures: ALL_EDITION_FEATURES });
});

router.get("/editions", async (req: Request, res: Response) => {
  try {
    await EditionService.ensureDefaults();
    const editions = await EditionService.list({
      ownerType: "platform",
      includeInactive: req.query.all === "1",
    });
    res.json({ success: true, editions });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list editions" });
  }
});

router.post("/editions", async (req: Request, res: Response) => {
  try {
    const edition = await EditionService.create({
      name: req.body?.name,
      note: req.body?.note,
      businessCategory: req.body?.businessCategory,
      features: req.body?.features,
      ownerType: "platform",
    });
    res.status(201).json({ success: true, edition });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create edition" });
  }
});

router.put("/editions/:editionId", async (req: Request, res: Response) => {
  try {
    const edition = await EditionService.update(
      req.params.editionId,
      {
        name: req.body?.name,
        note: req.body?.note,
        businessCategory: req.body?.businessCategory,
        features: req.body?.features,
        isActive: req.body?.isActive,
      },
      { requireOwnerType: "platform" }
    );
    res.json({ success: true, edition });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update edition" });
  }
});

router.delete("/editions/:editionId", async (req: Request, res: Response) => {
  try {
    const edition = await EditionService.softDelete(req.params.editionId, {
      requireOwnerType: "platform",
    });
    res.json({ success: true, edition });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

router.patch("/merchants/:merchantId/edition", async (req: Request, res: Response) => {
  try {
    const { editionId, resellerId, planBillingPaid, subscriptionPlan } = req.body || {};

    if (
      editionId !== undefined ||
      planBillingPaid !== undefined ||
      subscriptionPlan !== undefined
    ) {
      await MerchantService.updateMerchantPlan(req.params.merchantId, {
        editionId,
        planBillingPaid,
        subscriptionPlan,
      }, { allowClearEdition: true });
    }

    if (resellerId !== undefined) {
      await MerchantService.updateMerchant(req.params.merchantId, {
        resellerId: resellerId || null,
      } as any);
    }

    const merchant = await MerchantService.getMerchantById(req.params.merchantId);
    res.json({ success: true, merchant });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * PATCH /api/superadmin/merchants/:merchantId/plan
 * Set POS edition and plan billing status.
 */
router.patch("/merchants/:merchantId/plan", async (req: Request, res: Response) => {
  try {
    const { editionId, planBillingPaid, subscriptionPlan } = req.body || {};
    const merchant = await MerchantService.updateMerchantPlan(req.params.merchantId, {
      editionId,
      planBillingPaid,
      subscriptionPlan,
    }, { allowClearEdition: true });
    res.json({ success: true, merchant });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update plan" });
  }
});

// ============================================================================
// RESELLERS
// ============================================================================

router.get("/resellers", async (req: Request, res: Response) => {
  try {
    const resellers = await ResellerService.list({
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
    });
    res.json({ success: true, resellers });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

router.post("/resellers", async (req: Request, res: Response) => {
  try {
    const reseller = await ResellerService.create({
      name: req.body?.name,
      email: req.body?.email,
      password: req.body?.password,
      phone: req.body?.phone,
      licenseSeats: req.body?.licenseSeats != null ? Number(req.body.licenseSeats) : 0,
      createdBySuperadminId: req.user?.id,
    });
    res.status(201).json({ success: true, reseller });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

router.get("/resellers/:resellerId", async (req: Request, res: Response) => {
  try {
    const reseller = await ResellerService.getById(req.params.resellerId);
    if (!reseller) return res.status(404).json({ error: "Reseller not found" });
    res.json({ success: true, reseller });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

router.put("/resellers/:resellerId", async (req: Request, res: Response) => {
  try {
    const reseller = await ResellerService.update(req.params.resellerId, {
      name: req.body?.name,
      phone: req.body?.phone,
      status: req.body?.status,
      password: req.body?.password,
      licenseSeats:
        req.body?.licenseSeats != null ? Number(req.body.licenseSeats) : undefined,
    });
    res.json({ success: true, reseller });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * POST /api/superadmin/resellers/:resellerId/allocate-seats
 * Body: { seats } absolute OR { delta } relative
 */
router.post("/resellers/:resellerId/allocate-seats", async (req: Request, res: Response) => {
  try {
    const reseller = await ResellerService.allocateLicenseSeats(req.params.resellerId, {
      seats: req.body?.seats != null ? Number(req.body.seats) : undefined,
      delta: req.body?.delta != null ? Number(req.body.delta) : undefined,
    });
    res.json({ success: true, reseller });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * GET /api/superadmin/resellers/:resellerId/billing
 * Invoice-style platform billing summary (what reseller owes Reborn)
 */
router.get("/resellers/:resellerId/billing", async (req: Request, res: Response) => {
  try {
    const { ResellerBillingService } = await import("@/services/reseller-billing.service");
    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;
    const invoice = await ResellerBillingService.getResellerInvoice(req.params.resellerId, {
      year,
      month,
    });
    res.json({ success: true, invoice });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * GET /api/superadmin/reseller-billing/prices
 */
router.get("/reseller-billing/prices", async (_req: Request, res: Response) => {
  try {
    const { ResellerBillingService } = await import("@/services/reseller-billing.service");
    const prices = await ResellerBillingService.getPriceList();
    res.json({ success: true, prices });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * PUT /api/superadmin/reseller-billing/prices
 */
router.put("/reseller-billing/prices", async (req: Request, res: Response) => {
  try {
    const { ResellerBillingService } = await import("@/services/reseller-billing.service");
    const prices = await ResellerBillingService.setPriceList(req.body || {});
    res.json({ success: true, prices });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

router.post("/resellers/:resellerId/impersonate", async (req: Request, res: Response) => {
  try {
    const result = await ResellerService.impersonateToken(req.params.resellerId, req.user!.id);
    res.json({ success: true, token: result.token, reseller: result.reseller });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

router.post("/resellers/ensure-agency", async (req: Request, res: Response) => {
  try {
    const reseller = await ResellerService.ensureChaslayAgency(req.user?.id);
    res.json({ success: true, reseller });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

// ============================================================================
// PLATFORM SHOP (catalog sold to merchants)
// ============================================================================

router.get("/platform-shop/products", async (_req: Request, res: Response) => {
  try {
    const { PlatformShopService } = await import("@/services/platform-shop.service");
    const products = await PlatformShopService.listProducts(false);
    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list products" });
  }
});

router.post("/platform-shop/products", async (req: Request, res: Response) => {
  try {
    const { PlatformShopService } = await import("@/services/platform-shop.service");
    const product = await PlatformShopService.createProduct(req.body || {});
    res.status(201).json({ success: true, product });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create product" });
  }
});

router.put("/platform-shop/products/:productId", async (req: Request, res: Response) => {
  try {
    const { PlatformShopService } = await import("@/services/platform-shop.service");
    const product = await PlatformShopService.updateProduct(req.params.productId, req.body || {});
    res.json({ success: true, product });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update product" });
  }
});

router.delete("/platform-shop/products/:productId", async (req: Request, res: Response) => {
  try {
    const { PlatformShopService } = await import("@/services/platform-shop.service");
    const product = await PlatformShopService.deleteProduct(req.params.productId);
    res.json({ success: true, product });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to deactivate product" });
  }
});

router.post(
  "/platform-shop/products/:productId/image",
  imageUpload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const { PlatformShopService } = await import("@/services/platform-shop.service");
      const { isAllowedImageMime } = await import("@/services/media-upload.service");
      if (!req.file?.buffer) return res.status(400).json({ error: "Image file is required (field: file)" });
      if (!isAllowedImageMime(req.file.mimetype)) {
        return res.status(400).json({ error: "Only JPEG, PNG, WebP, or GIF images are allowed" });
      }
      const saved = await PlatformShopService.saveProductImage(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname
      );
      const product = await PlatformShopService.updateProduct(req.params.productId, {
        imageUrl: saved.url,
      });
      res.json({ success: true, product, image: saved });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to upload image" });
    }
  }
);

router.get("/platform-shop/vouchers", async (_req: Request, res: Response) => {
  try {
    const { PlatformShopService } = await import("@/services/platform-shop.service");
    const vouchers = await PlatformShopService.listVouchers(false);
    res.json({ success: true, vouchers });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list vouchers" });
  }
});

router.post("/platform-shop/vouchers", async (req: Request, res: Response) => {
  try {
    const { PlatformShopService } = await import("@/services/platform-shop.service");
    const voucher = await PlatformShopService.createVoucher(req.body || {});
    res.status(201).json({ success: true, voucher });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create voucher" });
  }
});

router.put("/platform-shop/vouchers/:voucherId", async (req: Request, res: Response) => {
  try {
    const { PlatformShopService } = await import("@/services/platform-shop.service");
    const voucher = await PlatformShopService.updateVoucher(req.params.voucherId, req.body || {});
    res.json({ success: true, voucher });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update voucher" });
  }
});

router.get("/platform-shop/orders", async (_req: Request, res: Response) => {
  try {
    const { PlatformShopService } = await import("@/services/platform-shop.service");
    const orders = await PlatformShopService.listAllOrders();
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list orders" });
  }
});

router.patch("/platform-shop/orders/:orderId", async (req: Request, res: Response) => {
  try {
    const { PlatformShopService } = await import("@/services/platform-shop.service");
    const order = await PlatformShopService.updateOrderStatus(req.params.orderId, req.body?.status);
    res.json({ success: true, order });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update order" });
  }
});

// ============================================================================
// SYSTEM LOGS & PLATFORM MESSAGES
// ============================================================================

router.get("/system-logs", async (req: Request, res: Response) => {
  try {
    const { PlatformLogService } = await import("@/services/platform-log.service");
    const result = await PlatformLogService.list({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 50,
      level: String(req.query.level || "") || undefined,
      category: String(req.query.category || "") || undefined,
      from: req.query.from ? new Date(String(req.query.from)) : undefined,
      to: req.query.to ? new Date(String(req.query.to)) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list logs" });
  }
});

router.post("/system-logs", async (req: Request, res: Response) => {
  try {
    const { PlatformLogService } = await import("@/services/platform-log.service");
    const log = await PlatformLogService.write({
      ...req.body,
      actorRole: "superadmin",
      actorId: req.user?.id,
    });
    res.status(201).json({ success: true, log });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to write log" });
  }
});

router.get("/platform-messages", async (req: Request, res: Response) => {
  try {
    const { PlatformMessageService } = await import("@/services/platform-message.service");
    const messages = await PlatformMessageService.listAll(req.query.all === "1");
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list messages" });
  }
});

router.post("/platform-messages", async (req: Request, res: Response) => {
  try {
    const { PlatformMessageService } = await import("@/services/platform-message.service");
    const { PlatformLogService } = await import("@/services/platform-log.service");
    const message = await PlatformMessageService.create({
      ...req.body,
      createdBySuperadminId: req.user?.id,
    });
    await PlatformLogService.write({
      level: "info",
      category: "platform_message",
      message: `Published ${message.kind}: ${message.title}`,
      actorRole: "superadmin",
      actorId: req.user?.id,
      metadata: { messageId: message.id, audience: message.audience },
    });
    res.status(201).json({ success: true, message });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create message" });
  }
});

router.put("/platform-messages/:messageId", async (req: Request, res: Response) => {
  try {
    const { PlatformMessageService } = await import("@/services/platform-message.service");
    const message = await PlatformMessageService.update(req.params.messageId, req.body || {});
    res.json({ success: true, message });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update message" });
  }
});

router.delete("/platform-messages/:messageId", async (req: Request, res: Response) => {
  try {
    const { PlatformMessageService } = await import("@/services/platform-message.service");
    const message = await PlatformMessageService.remove(req.params.messageId);
    res.json({ success: true, message });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to deactivate message" });
  }
});

// ============================================================================
// SUPPORT TICKETS & AGENTS
// ============================================================================

router.get("/support/tickets", async (req: Request, res: Response) => {
  try {
    const { SupportTicketService } = await import("@/services/support-ticket.service");
    const tickets = await SupportTicketService.listAllTickets({
      status: String(req.query.status || "all"),
      category: String(req.query.category || "") || undefined,
      assignedTo: String(req.query.assignedTo || "") || undefined,
    });
    res.json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list tickets" });
  }
});

router.get("/support/tickets/:ticketId", async (req: Request, res: Response) => {
  try {
    const { SupportTicketService } = await import("@/services/support-ticket.service");
    const ticket = await SupportTicketService.getTicketWithMessages(req.params.ticketId);
    res.json({ success: true, ticket });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Ticket not found" });
  }
});

router.post("/support/tickets/:ticketId/reply", async (req: Request, res: Response) => {
  try {
    const { SupportTicketService } = await import("@/services/support-ticket.service");
    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ error: "Message is required" });
    const existing = await SupportTicketService.getTicketWithMessages(req.params.ticketId);
    if (existing.category !== "technical") {
      return res.status(403).json({
        error: "Non-technical tickets are handled by the merchant's reseller (information only).",
      });
    }
    const ticket = await SupportTicketService.addReply(req.params.ticketId, {
      authorRole: "superadmin",
      authorId: req.user?.id,
      authorName: req.user?.name,
      body,
      closeTicket: !!req.body?.close,
    });
    res.json({ success: true, ticket });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to reply" });
  }
});

router.patch("/support/tickets/:ticketId/assign", async (req: Request, res: Response) => {
  try {
    const { SupportTicketService } = await import("@/services/support-ticket.service");
    const ticket = await SupportTicketService.assignTicket(
      req.params.ticketId,
      req.body?.assignedToSuperadminId || null
    );
    res.json({ success: true, ticket });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to assign" });
  }
});

router.get("/support/agents", async (_req: Request, res: Response) => {
  try {
    const { SupportTicketService } = await import("@/services/support-ticket.service");
    const agents = await SupportTicketService.listSuperadminsForSupportMgmt();
    res.json({ success: true, agents });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list agents" });
  }
});

router.patch("/support/agents/:superadminId", async (req: Request, res: Response) => {
  try {
    const { SupportTicketService } = await import("@/services/support-ticket.service");
    const agent = await SupportTicketService.setSupportAgent(
      req.params.superadminId,
      !!req.body?.handlesSupport
    );
    res.json({ success: true, agent });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update agent" });
  }
});

export default router;
