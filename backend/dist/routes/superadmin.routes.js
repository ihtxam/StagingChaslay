"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("@/middleware/auth.middleware");
const merchant_service_1 = require("@/services/merchant.service");
const license_admin_service_1 = require("@/services/license-admin.service");
const analytics_service_1 = require("@/services/analytics.service");
const auth_service_1 = require("@/services/auth.service");
const subscription_plans_service_1 = require("@/services/subscription-plans.service");
const subscription_addons_service_1 = require("@/services/subscription-addons.service");
const platform_reseller_service_1 = require("@/services/platform-reseller.service");
const platform_settings_service_1 = require("@/services/platform-settings.service");
const edition_service_1 = require("@/services/edition.service");
const reseller_service_1 = require("@/services/reseller.service");
const edition_features_1 = require("@/lib/edition-features");
const inventory_addon_1 = require("@/lib/inventory-addon");
const signage_addon_1 = require("@/lib/signage-addon");
const kds_addon_1 = require("@/lib/kds-addon");
const ods_addon_1 = require("@/lib/ods-addon");
const storekeeper_addon_1 = require("@/lib/storekeeper-addon");
const router = (0, express_1.Router)();
const imageUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
});
// Apply superadmin middleware to all routes
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireSuperadmin);
// ============================================================================
// SUBSCRIPTION PLANS (packages)
// ============================================================================
/**
 * GET /api/superadmin/plans
 * List all subscription plans/packages
 */
router.get("/plans", async (_req, res) => {
    try {
        const plans = await subscription_plans_service_1.SubscriptionPlansService.listAll(true);
        res.json({ success: true, plans });
    }
    catch (error) {
        console.error("Error listing plans:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list plans" });
    }
});
/**
 * POST /api/superadmin/plans
 * Create a subscription plan/package
 */
router.post("/plans", async (req, res) => {
    try {
        const ownerId = await platform_reseller_service_1.PlatformResellerService.getId();
        const plan = await subscription_plans_service_1.SubscriptionPlansService.create({
            ...(req.body || {}),
            ownerId,
        });
        res.status(201).json({ success: true, plan });
    }
    catch (error) {
        console.error("Error creating plan:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create plan" });
    }
});
/**
 * PUT /api/superadmin/plans/:planId
 * Update a subscription plan/package
 */
router.put("/plans/:planId", async (req, res) => {
    try {
        const ownerId = await platform_reseller_service_1.PlatformResellerService.getId();
        const existing = await subscription_plans_service_1.SubscriptionPlansService.getById(req.params.planId);
        if (existing.ownerType !== "reseller" || existing.ownerId !== ownerId) {
            return res.status(404).json({ error: "Package not found" });
        }
        const plan = await subscription_plans_service_1.SubscriptionPlansService.update(req.params.planId, req.body || {});
        res.json({ success: true, plan });
    }
    catch (error) {
        console.error("Error updating plan:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update plan" });
    }
});
/**
 * DELETE /api/superadmin/plans/:planId
 * Soft-deactivate a subscription plan/package
 */
router.delete("/plans/:planId", async (req, res) => {
    try {
        const ownerId = await platform_reseller_service_1.PlatformResellerService.getId();
        const existing = await subscription_plans_service_1.SubscriptionPlansService.getById(req.params.planId);
        if (existing.ownerType !== "reseller" || existing.ownerId !== ownerId) {
            return res.status(404).json({ error: "Package not found" });
        }
        const plan = await subscription_plans_service_1.SubscriptionPlansService.remove(req.params.planId);
        res.json({ success: true, plan });
    }
    catch (error) {
        console.error("Error deactivating plan:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to deactivate plan" });
    }
});
// ============================================================================
// SUBSCRIPTION ADD-ONS
// ============================================================================
router.get("/addons", async (_req, res) => {
    try {
        const addons = await subscription_addons_service_1.SubscriptionAddonsService.listAll({ includeInactive: true });
        res.json({ success: true, addons });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list add-ons" });
    }
});
router.post("/addons", async (req, res) => {
    try {
        const ownerId = await platform_reseller_service_1.PlatformResellerService.getId();
        const addon = await subscription_addons_service_1.SubscriptionAddonsService.create({
            ...(req.body || {}),
            ownerId,
        });
        res.status(201).json({ success: true, addon });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create add-on" });
    }
});
router.put("/addons/:addonId", async (req, res) => {
    try {
        const ownerId = await platform_reseller_service_1.PlatformResellerService.getId();
        const existing = await subscription_addons_service_1.SubscriptionAddonsService.getById(req.params.addonId);
        if (existing.ownerType !== "reseller" || existing.ownerId !== ownerId) {
            return res.status(404).json({ error: "Add-on not found" });
        }
        const addon = await subscription_addons_service_1.SubscriptionAddonsService.update(req.params.addonId, req.body || {});
        res.json({ success: true, addon });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update add-on" });
    }
});
router.delete("/addons/:addonId", async (req, res) => {
    try {
        const ownerId = await platform_reseller_service_1.PlatformResellerService.getId();
        const existing = await subscription_addons_service_1.SubscriptionAddonsService.getById(req.params.addonId);
        if (existing.ownerType !== "reseller" || existing.ownerId !== ownerId) {
            return res.status(404).json({ error: "Add-on not found" });
        }
        const addon = await subscription_addons_service_1.SubscriptionAddonsService.remove(req.params.addonId);
        res.json({ success: true, addon });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to deactivate add-on" });
    }
});
// ============================================================================
// PLATFORM SETTINGS
// ============================================================================
/**
 * GET /api/superadmin/platform-settings/adyen
 */
router.get("/platform-settings/adyen", async (_req, res) => {
    try {
        const adyen = await platform_settings_service_1.PlatformSettingsService.getAdyenSettingsPublic();
        res.json({ success: true, adyen });
    }
    catch (error) {
        console.error("Error getting platform Adyen settings:", error);
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to load Adyen settings",
        });
    }
});
/**
 * PUT /api/superadmin/platform-settings/adyen
 */
router.put("/platform-settings/adyen", async (req, res) => {
    try {
        const adyen = await platform_settings_service_1.PlatformSettingsService.updateAdyenSettings(req.body || {});
        res.json({ success: true, adyen });
    }
    catch (error) {
        console.error("Error updating platform Adyen settings:", error);
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to save Adyen settings",
        });
    }
});
/**
 * GET /api/superadmin/platform-settings/brevo
 */
router.get("/platform-settings/brevo", async (_req, res) => {
    try {
        const brevo = await platform_settings_service_1.PlatformSettingsService.getBrevoSettingsPublic();
        res.json({ success: true, brevo });
    }
    catch (error) {
        console.error("Error getting platform Brevo settings:", error);
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to load Brevo settings",
        });
    }
});
/**
 * PUT /api/superadmin/platform-settings/brevo
 */
router.put("/platform-settings/brevo", async (req, res) => {
    try {
        const brevo = await platform_settings_service_1.PlatformSettingsService.updateBrevoSettings(req.body || {});
        res.json({ success: true, brevo });
    }
    catch (error) {
        console.error("Error updating platform Brevo settings:", error);
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to save Brevo settings",
        });
    }
});
/**
 * GET /api/superadmin/email/usage — platform email send statistics
 */
router.get("/email/usage", async (_req, res) => {
    try {
        const { EmailUsageService } = await Promise.resolve().then(() => __importStar(require("@/services/email-usage.service")));
        const usage = await EmailUsageService.getPlatformUsageSummary();
        res.json({ success: true, usage });
    }
    catch (error) {
        console.error("Error getting email usage:", error);
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to load email usage",
        });
    }
});
/**
 * POST /api/superadmin/email/test — send a test email via platform Brevo
 */
router.post("/email/test", async (req, res) => {
    try {
        const to = String(req.body?.to || "").trim();
        if (!to) {
            res.status(400).json({ error: "Recipient email is required" });
            return;
        }
        const { EmailService } = await Promise.resolve().then(() => __importStar(require("@/services/email.service")));
        await EmailService.send({
            to,
            subject: "Reborn platform email test",
            html: "<p>This is a test email from Reborn platform Brevo.</p>",
            emailType: "marketing_test",
        });
        res.json({ success: true });
    }
    catch (error) {
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
router.get("/merchants", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search;
        const merchants = await merchant_service_1.MerchantService.getAllMerchants(page, limit, search);
        res.json({
            success: true,
            merchants,
            pagination: { page, limit },
        });
    }
    catch (error) {
        console.error("Error getting merchants:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get merchants" });
    }
});
/**
 * GET /api/superadmin/merchants/:merchantId
 * Get merchant details
 */
router.get("/merchants/:merchantId", async (req, res) => {
    try {
        const { merchantId } = req.params;
        const merchant = await merchant_service_1.MerchantService.getMerchantById(merchantId);
        res.json({
            success: true,
            merchant,
        });
    }
    catch (error) {
        console.error("Error getting merchant:", error);
        res.status(404).json({ error: error instanceof Error ? error.message : "Merchant not found" });
    }
});
/**
 * POST /api/superadmin/merchants/:merchantId/impersonate
 * Open merchant admin panel as that merchant (keeps superadmin session on client for return)
 */
router.post("/merchants/:merchantId/impersonate", async (req, res) => {
    try {
        const { merchantId } = req.params;
        const superadminId = req.user?.id;
        if (!superadminId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const result = await auth_service_1.AuthService.impersonateMerchant(superadminId, merchantId);
        res.json({
            success: true,
            token: result.token,
            merchant: result.merchant,
            impersonatedBy: result.impersonatedBy,
        });
    }
    catch (error) {
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
router.post("/merchants", async (req, res) => {
    try {
        const { email, password, businessName, contactName, phone, address, city, country, slug, shopEnabled, subscriptionPlan, status, deviceSeats, licenseType, customDays, editionId, resellerId, businessCategory, maxPosPosts, maxWaiterPosts, inventoryAddonEnabled, signageAddonEnabled, signageScreenLimit, kdsAddonEnabled, odsAddonEnabled, storekeeperAddonEnabled, } = req.body;
        if (!email || !password || !businessName) {
            return res.status(400).json({ error: "Email, password, and business name are required" });
        }
        const merchant = await merchant_service_1.MerchantService.createMerchant(email, password, businessName, contactName, phone, address, city, country, {
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
            inventoryAddonEnabled: (0, inventory_addon_1.isInventoryAddonEnabled)(inventoryAddonEnabled),
            signageAddonEnabled: (0, signage_addon_1.isSignageAddonEnabled)(signageAddonEnabled),
            signageScreenLimit: signageScreenLimit != null ? (0, signage_addon_1.normalizeSignageScreenLimit)(signageScreenLimit) : undefined,
            kdsAddonEnabled: (0, kds_addon_1.isKdsAddonEnabled)(kdsAddonEnabled),
            odsAddonEnabled: (0, ods_addon_1.isOdsAddonEnabled)(odsAddonEnabled),
            storekeeperAddonEnabled: (0, storekeeper_addon_1.isStorekeeperAddonEnabled)(storekeeperAddonEnabled),
        });
        res.status(201).json({
            success: true,
            message: "Merchant created successfully",
            merchant,
        });
    }
    catch (error) {
        console.error("Error creating merchant:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create merchant" });
    }
});
/**
 * DELETE /api/superadmin/merchants/:merchantId
 * Soft-delete (suspend) merchant
 */
router.delete("/merchants/:merchantId", async (req, res) => {
    try {
        const { merchantId } = req.params;
        const merchant = await merchant_service_1.MerchantService.deleteMerchant(merchantId);
        res.json({ success: true, message: "Merchant deleted (suspended)", merchant });
    }
    catch (error) {
        console.error("Error deleting merchant:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete merchant" });
    }
});
/**
 * GET /api/superadmin/merchants/:merchantId/devices
 * List devices for a merchant
 */
router.get("/merchants/:merchantId/devices", async (req, res) => {
    try {
        const devices = await license_admin_service_1.LicenseAdminService.getMerchantDevices(req.params.merchantId);
        res.json({ success: true, devices });
    }
    catch (error) {
        console.error("Error listing devices:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list devices" });
    }
});
/**
 * PUT /api/superadmin/merchants/:merchantId
 * Update merchant details
 */
router.put("/merchants/:merchantId", async (req, res) => {
    try {
        const { merchantId } = req.params;
        const updates = req.body;
        if (updates.maxPosPosts != null ||
            updates.maxWaiterPosts != null ||
            updates.inventoryAddonEnabled != null ||
            updates.inventoryEnabled != null ||
            updates.signageAddonEnabled != null ||
            updates.signageEnabled != null ||
            updates.signageScreenLimit != null ||
            updates.kdsAddonEnabled != null ||
            updates.kdsEnabled != null ||
            updates.odsAddonEnabled != null ||
            updates.odsEnabled != null ||
            updates.storekeeperAddonEnabled != null) {
            await merchant_service_1.MerchantService.updatePosPostLimits(merchantId, {
                maxPosPosts: updates.maxPosPosts != null ? Number(updates.maxPosPosts) : undefined,
                maxWaiterPosts: updates.maxWaiterPosts != null ? Number(updates.maxWaiterPosts) : undefined,
                inventoryAddonEnabled: updates.inventoryAddonEnabled != null
                    ? (0, inventory_addon_1.isInventoryAddonEnabled)(updates.inventoryAddonEnabled)
                    : updates.inventoryEnabled != null
                        ? (0, inventory_addon_1.isInventoryAddonEnabled)(updates.inventoryEnabled)
                        : undefined,
                signageAddonEnabled: updates.signageAddonEnabled != null
                    ? (0, signage_addon_1.isSignageAddonEnabled)(updates.signageAddonEnabled)
                    : updates.signageEnabled != null
                        ? (0, signage_addon_1.isSignageAddonEnabled)(updates.signageEnabled)
                        : undefined,
                signageScreenLimit: updates.signageScreenLimit != null
                    ? (0, signage_addon_1.normalizeSignageScreenLimit)(updates.signageScreenLimit)
                    : undefined,
                kdsAddonEnabled: updates.kdsAddonEnabled != null
                    ? (0, kds_addon_1.isKdsAddonEnabled)(updates.kdsAddonEnabled)
                    : updates.kdsEnabled != null
                        ? (0, kds_addon_1.isKdsAddonEnabled)(updates.kdsEnabled)
                        : undefined,
                odsAddonEnabled: updates.odsAddonEnabled != null
                    ? (0, ods_addon_1.isOdsAddonEnabled)(updates.odsAddonEnabled)
                    : updates.odsEnabled != null
                        ? (0, ods_addon_1.isOdsAddonEnabled)(updates.odsEnabled)
                        : undefined,
                storekeeperAddonEnabled: updates.storekeeperAddonEnabled != null
                    ? (0, storekeeper_addon_1.isStorekeeperAddonEnabled)(updates.storekeeperAddonEnabled)
                    : undefined,
            });
            delete updates.maxPosPosts;
            delete updates.maxWaiterPosts;
            delete updates.inventoryAddonEnabled;
            delete updates.inventoryEnabled;
            delete updates.signageAddonEnabled;
            delete updates.signageEnabled;
            delete updates.signageScreenLimit;
            delete updates.kdsAddonEnabled;
            delete updates.kdsEnabled;
            delete updates.odsAddonEnabled;
            delete updates.odsEnabled;
            delete updates.storekeeperAddonEnabled;
        }
        const merchant = Object.keys(updates).length > 0
            ? await merchant_service_1.MerchantService.updateMerchant(merchantId, updates)
            : await merchant_service_1.MerchantService.getMerchantById(merchantId);
        res.json({
            success: true,
            message: "Merchant updated successfully",
            merchant,
        });
    }
    catch (error) {
        console.error("Error updating merchant:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update merchant" });
    }
});
/**
 * POST /api/superadmin/merchants/:merchantId/reset-password
 * Set a new password for the merchant owner account (POS + panel login).
 */
router.post("/merchants/:merchantId/reset-password", async (req, res) => {
    try {
        const { merchantId } = req.params;
        const password = String(req.body?.password || "");
        if (password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters" });
        }
        const existing = await merchant_service_1.MerchantService.getMerchantById(merchantId);
        if (!existing) {
            return res.status(404).json({ error: "Merchant not found" });
        }
        await auth_service_1.AuthService.updateMerchantPassword(merchantId, password);
        res.json({ success: true, message: "Password updated" });
    }
    catch (error) {
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
router.post("/merchants/:merchantId/purge-sales-data", async (req, res) => {
    try {
        const { merchantId } = req.params;
        const confirm = String(req.body?.confirm || "").trim();
        if (confirm !== "DELETE ALL SALES") {
            return res.status(400).json({
                error: 'Confirmation required: send { "confirm": "DELETE ALL SALES" } in the request body',
            });
        }
        const existing = await merchant_service_1.MerchantService.getMerchantById(merchantId);
        if (!existing) {
            return res.status(404).json({ error: "Merchant not found" });
        }
        const { MerchantDataResetService } = await Promise.resolve().then(() => __importStar(require("@/services/merchant-data-reset.service")));
        const result = await MerchantDataResetService.purgeSalesData(merchantId, {
            deleteCustomers: req.body?.deleteCustomers === true,
            deleteReservations: req.body?.deleteReservations !== false,
        });
        res.json({
            success: true,
            message: `Purged sales data for ${result.merchantName}`,
            result,
        });
    }
    catch (error) {
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
router.post("/merchants/:merchantId/suspend", async (req, res) => {
    try {
        const { merchantId } = req.params;
        const { reason } = req.body;
        const merchant = await merchant_service_1.MerchantService.suspendMerchant(merchantId, reason);
        res.json({
            success: true,
            message: "Merchant suspended successfully",
            merchant,
        });
    }
    catch (error) {
        console.error("Error suspending merchant:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to suspend merchant" });
    }
});
/**
 * POST /api/superadmin/merchants/:merchantId/reactivate
 * Reactivate merchant account
 */
router.post("/merchants/:merchantId/reactivate", async (req, res) => {
    try {
        const { merchantId } = req.params;
        const merchant = await merchant_service_1.MerchantService.reactivateMerchant(merchantId);
        res.json({
            success: true,
            message: "Merchant reactivated successfully",
            merchant,
        });
    }
    catch (error) {
        console.error("Error reactivating merchant:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to reactivate merchant" });
    }
});
/**
 * GET /api/superadmin/merchants/:merchantId/analytics
 * Get merchant analytics
 */
router.get("/merchants/:merchantId/analytics", async (req, res) => {
    try {
        const { merchantId } = req.params;
        const analytics = await merchant_service_1.MerchantService.getMerchantAnalytics(merchantId);
        res.json({
            success: true,
            analytics,
        });
    }
    catch (error) {
        console.error("Error getting merchant analytics:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get analytics" });
    }
});
/**
 * POST /api/superadmin/merchants/:merchantId/upgrade
 * Upgrade merchant subscription
 */
router.post("/merchants/:merchantId/upgrade", async (req, res) => {
    try {
        const { merchantId } = req.params;
        const { plan } = req.body;
        if (!plan || !["starter", "professional", "enterprise"].includes(plan)) {
            return res.status(400).json({ error: "Invalid subscription plan" });
        }
        const merchant = await merchant_service_1.MerchantService.upgradeMerchantSubscription(merchantId, plan);
        res.json({
            success: true,
            message: "Subscription upgraded successfully",
            merchant,
        });
    }
    catch (error) {
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
router.get("/licenses/statistics", async (_req, res) => {
    try {
        const stats = await license_admin_service_1.LicenseAdminService.getLicenseStatistics();
        res.json({ success: true, statistics: stats });
    }
    catch (error) {
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
router.get("/licenses/expiring-soon", async (req, res) => {
    try {
        const daysThreshold = parseInt(req.query.days) || 35;
        const licenses = await license_admin_service_1.LicenseAdminService.getLicensesExpiringSoon(daysThreshold);
        res.json({ success: true, licenses, threshold: `${daysThreshold} days` });
    }
    catch (error) {
        console.error("Error getting expiring licenses:", error);
        res.json({ success: true, licenses: [], threshold: `${daysThreshold} days` });
    }
});
/**
 * POST /api/superadmin/licenses/generate
 * Generate license for an existing device
 */
router.post("/licenses/generate", async (req, res) => {
    try {
        const { merchantId, deviceId, licenseType, customDays } = req.body;
        if (!merchantId || !deviceId) {
            return res.status(400).json({ error: "Merchant ID and device ID are required" });
        }
        const result = await license_admin_service_1.LicenseAdminService.generateLicenseForMerchant(merchantId, deviceId, licenseType || "yearly", customDays);
        res.json(result);
    }
    catch (error) {
        console.error("Error generating license:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to generate license" });
    }
});
/**
 * POST /api/superadmin/licenses/issue-seats
 * Create placeholder POS devices + license keys for a merchant
 */
router.post("/licenses/issue-seats", async (req, res) => {
    try {
        const { merchantId, seats, licenseType, customDays, deviceType } = req.body;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        const issued = await license_admin_service_1.LicenseAdminService.issueDeviceSeats(merchantId, Number(seats) || 1, licenseType || "yearly", customDays != null ? Number(customDays) : undefined, deviceType || "tablet");
        res.status(201).json({
            success: true,
            message: `Issued ${issued.length} device license(s)`,
            licenses: issued,
        });
    }
    catch (error) {
        console.error("Error issuing seats:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to issue licenses" });
    }
});
/**
 * POST /api/superadmin/licenses/issue-for-device
 * Bind a license to the Android POS device ID shown in the app
 */
router.post("/licenses/issue-for-device", async (req, res) => {
    try {
        const { merchantId, posDeviceId, licenseType, customDays, deviceType } = req.body;
        if (!merchantId || !String(posDeviceId || "").trim()) {
            return res.status(400).json({ error: "Merchant ID and POS device ID are required" });
        }
        const issued = await license_admin_service_1.LicenseAdminService.issueForPosDeviceId(merchantId, String(posDeviceId).trim(), licenseType || "yearly", customDays != null ? Number(customDays) : undefined, deviceType || "tablet");
        res.status(issued.reused ? 200 : 201).json({
            success: true,
            message: issued.reused
                ? "License already active for this device"
                : "Issued 1 device license",
            licenses: [issued],
        });
    }
    catch (error) {
        console.error("Error issuing device license:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to issue license" });
    }
});
/**
 * GET /api/superadmin/licenses
 * Get all licenses
 */
router.get("/licenses", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status;
        const merchantId = req.query.merchantId;
        const licenses = await license_admin_service_1.LicenseAdminService.getAllLicenses(page, limit, status, merchantId);
        res.json({
            success: true,
            licenses,
            pagination: { page, limit },
        });
    }
    catch (error) {
        console.error("Error getting licenses:", error);
        res.json({
            success: true,
            licenses: [],
            pagination: { page: parseInt(req.query.page) || 1, limit: parseInt(req.query.limit) || 20 },
        });
    }
});
/**
 * GET /api/superadmin/licenses/:licenseId
 * Get license details
 */
router.get("/licenses/:licenseId", async (req, res) => {
    try {
        const { licenseId } = req.params;
        const license = await license_admin_service_1.LicenseAdminService.getLicenseDetails(licenseId);
        res.json({ success: true, license });
    }
    catch (error) {
        console.error("Error getting license:", error);
        res.status(404).json({ error: error instanceof Error ? error.message : "License not found" });
    }
});
/**
 * POST /api/superadmin/licenses/:licenseId/revoke
 * Revoke license
 */
router.post("/licenses/:licenseId/revoke", async (req, res) => {
    try {
        const { licenseId } = req.params;
        const license = await license_admin_service_1.LicenseAdminService.revokeLicense(licenseId);
        res.json({ success: true, message: "License revoked successfully", license });
    }
    catch (error) {
        console.error("Error revoking license:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to revoke license" });
    }
});
/**
 * POST /api/superadmin/licenses/:licenseId/extend
 * Extend license expiry
 */
router.post("/licenses/:licenseId/extend", async (req, res) => {
    try {
        const { licenseId } = req.params;
        const { additionalDays } = req.body;
        if (!additionalDays || additionalDays <= 0) {
            return res.status(400).json({ error: "Additional days must be greater than 0" });
        }
        const license = await license_admin_service_1.LicenseAdminService.extendLicense(licenseId, additionalDays);
        res.json({ success: true, message: "License extended successfully", license });
    }
    catch (error) {
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
router.get("/analytics/overview", async (req, res) => {
    try {
        const overview = await analytics_service_1.AnalyticsService.getPlatformOverview();
        res.json({
            success: true,
            overview,
        });
    }
    catch (error) {
        console.error("Error getting overview:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get overview" });
    }
});
/**
 * GET /api/superadmin/analytics/revenue
 * Get revenue analytics
 */
router.get("/analytics/revenue", async (req, res) => {
    try {
        const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
        const analytics = await analytics_service_1.AnalyticsService.getRevenueAnalytics(startDate, endDate);
        res.json({
            success: true,
            analytics,
        });
    }
    catch (error) {
        console.error("Error getting revenue analytics:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get analytics" });
    }
});
/**
 * GET /api/superadmin/analytics/top-merchants
 * Get top merchants by revenue
 */
router.get("/analytics/top-merchants", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const merchants = await analytics_service_1.AnalyticsService.getTopMerchantsByRevenue(limit);
        res.json({
            success: true,
            merchants,
        });
    }
    catch (error) {
        console.error("Error getting top merchants:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get top merchants" });
    }
});
/**
 * GET /api/superadmin/analytics/subscription-distribution
 * Get subscription plan distribution
 */
router.get("/analytics/subscription-distribution", async (req, res) => {
    try {
        const distribution = await analytics_service_1.AnalyticsService.getSubscriptionDistribution();
        res.json({
            success: true,
            distribution,
        });
    }
    catch (error) {
        console.error("Error getting subscription distribution:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get distribution" });
    }
});
// ============================================================================
// EDITIONS
// ============================================================================
router.get("/editions/catalog", (_req, res) => {
    res.json({ success: true, groups: edition_features_1.EDITION_FEATURE_GROUPS, allFeatures: edition_features_1.ALL_EDITION_FEATURES });
});
router.get("/editions", async (req, res) => {
    try {
        await edition_service_1.EditionService.ensureDefaults();
        const editions = await edition_service_1.EditionService.list({
            ownerType: "platform",
            includeInactive: req.query.all === "1",
        });
        res.json({ success: true, editions });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list editions" });
    }
});
router.post("/editions", async (req, res) => {
    try {
        const edition = await edition_service_1.EditionService.create({
            name: req.body?.name,
            note: req.body?.note,
            businessCategory: req.body?.businessCategory,
            features: req.body?.features,
            ownerType: "platform",
        });
        res.status(201).json({ success: true, edition });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create edition" });
    }
});
router.put("/editions/:editionId", async (req, res) => {
    try {
        const edition = await edition_service_1.EditionService.update(req.params.editionId, {
            name: req.body?.name,
            note: req.body?.note,
            businessCategory: req.body?.businessCategory,
            features: req.body?.features,
            isActive: req.body?.isActive,
        }, { requireOwnerType: "platform" });
        res.json({ success: true, edition });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update edition" });
    }
});
router.delete("/editions/:editionId", async (req, res) => {
    try {
        const edition = await edition_service_1.EditionService.softDelete(req.params.editionId, {
            requireOwnerType: "platform",
        });
        res.json({ success: true, edition });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
router.patch("/merchants/:merchantId/edition", async (req, res) => {
    try {
        const { editionId, resellerId, planBillingPaid, subscriptionPlan } = req.body || {};
        if (editionId !== undefined ||
            planBillingPaid !== undefined ||
            subscriptionPlan !== undefined) {
            await merchant_service_1.MerchantService.updateMerchantPlan(req.params.merchantId, {
                editionId,
                planBillingPaid,
                subscriptionPlan,
            }, { allowClearEdition: true });
        }
        if (resellerId !== undefined) {
            await merchant_service_1.MerchantService.updateMerchant(req.params.merchantId, {
                resellerId: resellerId || null,
            });
        }
        const merchant = await merchant_service_1.MerchantService.getMerchantById(req.params.merchantId);
        res.json({ success: true, merchant });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * PATCH /api/superadmin/merchants/:merchantId/plan
 * Set POS edition and plan billing status.
 */
router.patch("/merchants/:merchantId/plan", async (req, res) => {
    try {
        const { editionId, planBillingPaid, subscriptionPlan } = req.body || {};
        const merchant = await merchant_service_1.MerchantService.updateMerchantPlan(req.params.merchantId, {
            editionId,
            planBillingPaid,
            subscriptionPlan,
        }, { allowClearEdition: true });
        res.json({ success: true, merchant });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update plan" });
    }
});
// ============================================================================
// RESELLERS
// ============================================================================
router.get("/resellers", async (req, res) => {
    try {
        const resellers = await reseller_service_1.ResellerService.list({
            search: typeof req.query.search === "string" ? req.query.search : undefined,
            status: typeof req.query.status === "string" ? req.query.status : undefined,
        });
        res.json({ success: true, resellers });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
router.post("/resellers", async (req, res) => {
    try {
        const reseller = await reseller_service_1.ResellerService.create({
            name: req.body?.name,
            email: req.body?.email,
            password: req.body?.password,
            phone: req.body?.phone,
            licenseSeats: req.body?.licenseSeats != null ? Number(req.body.licenseSeats) : 0,
            createdBySuperadminId: req.user?.id,
        });
        res.status(201).json({ success: true, reseller });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
router.get("/resellers/:resellerId", async (req, res) => {
    try {
        const reseller = await reseller_service_1.ResellerService.getById(req.params.resellerId);
        if (!reseller)
            return res.status(404).json({ error: "Reseller not found" });
        res.json({ success: true, reseller });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
router.put("/resellers/:resellerId", async (req, res) => {
    try {
        const reseller = await reseller_service_1.ResellerService.update(req.params.resellerId, {
            name: req.body?.name,
            phone: req.body?.phone,
            status: req.body?.status,
            password: req.body?.password,
            licenseSeats: req.body?.licenseSeats != null ? Number(req.body.licenseSeats) : undefined,
        });
        res.json({ success: true, reseller });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * POST /api/superadmin/resellers/:resellerId/allocate-seats
 * Body: { seats } absolute OR { delta } relative
 */
router.post("/resellers/:resellerId/allocate-seats", async (req, res) => {
    try {
        const reseller = await reseller_service_1.ResellerService.allocateLicenseSeats(req.params.resellerId, {
            seats: req.body?.seats != null ? Number(req.body.seats) : undefined,
            delta: req.body?.delta != null ? Number(req.body.delta) : undefined,
        });
        res.json({ success: true, reseller });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * GET /api/superadmin/resellers/:resellerId/billing
 * Invoice-style platform billing summary (what reseller owes Reborn)
 */
router.get("/resellers/:resellerId/billing", async (req, res) => {
    try {
        const { ResellerBillingService } = await Promise.resolve().then(() => __importStar(require("@/services/reseller-billing.service")));
        const year = req.query.year ? Number(req.query.year) : undefined;
        const month = req.query.month ? Number(req.query.month) : undefined;
        const invoice = await ResellerBillingService.getResellerInvoice(req.params.resellerId, {
            year,
            month,
        });
        res.json({ success: true, invoice });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * GET /api/superadmin/reseller-billing/prices
 */
router.get("/reseller-billing/prices", async (_req, res) => {
    try {
        const { ResellerBillingService } = await Promise.resolve().then(() => __importStar(require("@/services/reseller-billing.service")));
        const prices = await ResellerBillingService.getPriceList();
        res.json({ success: true, prices });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * PUT /api/superadmin/reseller-billing/prices
 */
router.put("/reseller-billing/prices", async (req, res) => {
    try {
        const { ResellerBillingService } = await Promise.resolve().then(() => __importStar(require("@/services/reseller-billing.service")));
        const prices = await ResellerBillingService.setPriceList(req.body || {});
        res.json({ success: true, prices });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
router.post("/resellers/:resellerId/impersonate", async (req, res) => {
    try {
        const result = await reseller_service_1.ResellerService.impersonateToken(req.params.resellerId, req.user.id);
        res.json({ success: true, token: result.token, reseller: result.reseller });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
router.post("/resellers/ensure-agency", async (req, res) => {
    try {
        const reseller = await reseller_service_1.ResellerService.ensureChaslayAgency(req.user?.id);
        res.json({ success: true, reseller });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
// ============================================================================
// PLATFORM SHOP (catalog sold to merchants)
// ============================================================================
router.get("/platform-shop/products", async (_req, res) => {
    try {
        const { PlatformShopService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-shop.service")));
        const products = await PlatformShopService.listProducts(false);
        res.json({ success: true, products });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list products" });
    }
});
router.post("/platform-shop/products", async (req, res) => {
    try {
        const { PlatformShopService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-shop.service")));
        const product = await PlatformShopService.createProduct(req.body || {});
        res.status(201).json({ success: true, product });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create product" });
    }
});
router.put("/platform-shop/products/:productId", async (req, res) => {
    try {
        const { PlatformShopService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-shop.service")));
        const product = await PlatformShopService.updateProduct(req.params.productId, req.body || {});
        res.json({ success: true, product });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update product" });
    }
});
router.delete("/platform-shop/products/:productId", async (req, res) => {
    try {
        const { PlatformShopService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-shop.service")));
        const product = await PlatformShopService.deleteProduct(req.params.productId);
        res.json({ success: true, product });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to deactivate product" });
    }
});
router.post("/platform-shop/products/:productId/image", imageUpload.single("file"), async (req, res) => {
    try {
        const { PlatformShopService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-shop.service")));
        const { isAllowedImageMime } = await Promise.resolve().then(() => __importStar(require("@/services/media-upload.service")));
        if (!req.file?.buffer)
            return res.status(400).json({ error: "Image file is required (field: file)" });
        if (!isAllowedImageMime(req.file.mimetype)) {
            return res.status(400).json({ error: "Only JPEG, PNG, WebP, or GIF images are allowed" });
        }
        const saved = await PlatformShopService.saveProductImage(req.file.buffer, req.file.mimetype, req.file.originalname);
        const product = await PlatformShopService.updateProduct(req.params.productId, {
            imageUrl: saved.url,
        });
        res.json({ success: true, product, image: saved });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to upload image" });
    }
});
router.get("/platform-shop/vouchers", async (_req, res) => {
    try {
        const { PlatformShopService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-shop.service")));
        const vouchers = await PlatformShopService.listVouchers(false);
        res.json({ success: true, vouchers });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list vouchers" });
    }
});
router.post("/platform-shop/vouchers", async (req, res) => {
    try {
        const { PlatformShopService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-shop.service")));
        const voucher = await PlatformShopService.createVoucher(req.body || {});
        res.status(201).json({ success: true, voucher });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create voucher" });
    }
});
router.put("/platform-shop/vouchers/:voucherId", async (req, res) => {
    try {
        const { PlatformShopService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-shop.service")));
        const voucher = await PlatformShopService.updateVoucher(req.params.voucherId, req.body || {});
        res.json({ success: true, voucher });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update voucher" });
    }
});
router.get("/platform-shop/orders", async (_req, res) => {
    try {
        const { PlatformShopService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-shop.service")));
        const orders = await PlatformShopService.listAllOrders();
        res.json({ success: true, orders });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list orders" });
    }
});
router.patch("/platform-shop/orders/:orderId", async (req, res) => {
    try {
        const { PlatformShopService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-shop.service")));
        const order = await PlatformShopService.updateOrderStatus(req.params.orderId, req.body?.status);
        res.json({ success: true, order });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update order" });
    }
});
// ============================================================================
// SYSTEM LOGS & PLATFORM MESSAGES
// ============================================================================
router.get("/system-logs", async (req, res) => {
    try {
        const { PlatformLogService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-log.service")));
        const result = await PlatformLogService.list({
            page: Number(req.query.page) || 1,
            limit: Number(req.query.limit) || 50,
            level: String(req.query.level || "") || undefined,
            category: String(req.query.category || "") || undefined,
            from: req.query.from ? new Date(String(req.query.from)) : undefined,
            to: req.query.to ? new Date(String(req.query.to)) : undefined,
        });
        res.json({ success: true, ...result });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list logs" });
    }
});
router.post("/system-logs", async (req, res) => {
    try {
        const { PlatformLogService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-log.service")));
        const log = await PlatformLogService.write({
            ...req.body,
            actorRole: "superadmin",
            actorId: req.user?.id,
        });
        res.status(201).json({ success: true, log });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to write log" });
    }
});
router.get("/platform-messages", async (req, res) => {
    try {
        const { PlatformMessageService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-message.service")));
        const messages = await PlatformMessageService.listAll(req.query.all === "1");
        res.json({ success: true, messages });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list messages" });
    }
});
router.post("/platform-messages", async (req, res) => {
    try {
        const { PlatformMessageService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-message.service")));
        const { PlatformLogService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-log.service")));
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
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create message" });
    }
});
router.put("/platform-messages/:messageId", async (req, res) => {
    try {
        const { PlatformMessageService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-message.service")));
        const message = await PlatformMessageService.update(req.params.messageId, req.body || {});
        res.json({ success: true, message });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update message" });
    }
});
router.delete("/platform-messages/:messageId", async (req, res) => {
    try {
        const { PlatformMessageService } = await Promise.resolve().then(() => __importStar(require("@/services/platform-message.service")));
        const message = await PlatformMessageService.remove(req.params.messageId);
        res.json({ success: true, message });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to deactivate message" });
    }
});
// ============================================================================
// SUPPORT TICKETS & AGENTS
// ============================================================================
router.get("/support/tickets", async (req, res) => {
    try {
        const { SupportTicketService } = await Promise.resolve().then(() => __importStar(require("@/services/support-ticket.service")));
        const tickets = await SupportTicketService.listAllTickets({
            status: String(req.query.status || "all"),
            category: String(req.query.category || "") || undefined,
            assignedTo: String(req.query.assignedTo || "") || undefined,
        });
        res.json({ success: true, tickets });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list tickets" });
    }
});
router.get("/support/tickets/:ticketId", async (req, res) => {
    try {
        const { SupportTicketService } = await Promise.resolve().then(() => __importStar(require("@/services/support-ticket.service")));
        const ticket = await SupportTicketService.getTicketWithMessages(req.params.ticketId);
        res.json({ success: true, ticket });
    }
    catch (error) {
        res.status(404).json({ error: error instanceof Error ? error.message : "Ticket not found" });
    }
});
router.post("/support/tickets/:ticketId/reply", async (req, res) => {
    try {
        const { SupportTicketService } = await Promise.resolve().then(() => __importStar(require("@/services/support-ticket.service")));
        const body = String(req.body?.body || "").trim();
        if (!body)
            return res.status(400).json({ error: "Message is required" });
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
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to reply" });
    }
});
router.patch("/support/tickets/:ticketId/assign", async (req, res) => {
    try {
        const { SupportTicketService } = await Promise.resolve().then(() => __importStar(require("@/services/support-ticket.service")));
        const ticket = await SupportTicketService.assignTicket(req.params.ticketId, req.body?.assignedToSuperadminId || null);
        res.json({ success: true, ticket });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to assign" });
    }
});
router.get("/support/agents", async (_req, res) => {
    try {
        const { SupportTicketService } = await Promise.resolve().then(() => __importStar(require("@/services/support-ticket.service")));
        const agents = await SupportTicketService.listSuperadminsForSupportMgmt();
        res.json({ success: true, agents });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list agents" });
    }
});
router.patch("/support/agents/:superadminId", async (req, res) => {
    try {
        const { SupportTicketService } = await Promise.resolve().then(() => __importStar(require("@/services/support-ticket.service")));
        const agent = await SupportTicketService.setSupportAgent(req.params.superadminId, !!req.body?.handlesSupport);
        res.json({ success: true, agent });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update agent" });
    }
});
exports.default = router;
//# sourceMappingURL=superadmin.routes.js.map