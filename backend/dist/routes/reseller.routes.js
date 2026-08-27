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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const reseller_service_1 = require("@/services/reseller.service");
const edition_service_1 = require("@/services/edition.service");
const auth_service_1 = require("@/services/auth.service");
const edition_features_1 = require("@/lib/edition-features");
const inventory_addon_1 = require("@/lib/inventory-addon");
const signage_addon_1 = require("@/lib/signage-addon");
const kds_addon_1 = require("@/lib/kds-addon");
const ods_addon_1 = require("@/lib/ods-addon");
const subscription_plans_service_1 = require("@/services/subscription-plans.service");
const subscription_addons_service_1 = require("@/services/subscription-addons.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireReseller);
function resellerId(req) {
    return req.user.resellerId;
}
/**
 * GET /api/reseller/me
 */
router.get("/me", async (req, res) => {
    try {
        const me = await reseller_service_1.ResellerService.getById(resellerId(req));
        if (!me)
            return res.status(404).json({ error: "Reseller not found" });
        res.json({ success: true, reseller: me });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * GET /api/reseller/overview
 */
router.get("/overview", async (req, res) => {
    try {
        const rid = resellerId(req);
        const me = await reseller_service_1.ResellerService.getById(rid);
        const merchants = await reseller_service_1.ResellerService.listMerchants(rid);
        const active = merchants.filter((m) => m.status === "active" || m.status === "trial").length;
        const pool = await reseller_service_1.ResellerService.getSeatPool(rid);
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
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * GET /api/reseller/licenses/pool
 */
router.get("/licenses/pool", async (req, res) => {
    try {
        const pool = await reseller_service_1.ResellerService.getSeatPool(resellerId(req));
        res.json({ success: true, pool });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * GET /api/reseller/licenses
 * Licenses for this reseller's merchants only
 */
router.get("/licenses", async (req, res) => {
    try {
        const licenses = await reseller_service_1.ResellerService.listLicenses(resellerId(req), {
            status: typeof req.query.status === "string" ? req.query.status : undefined,
            merchantId: typeof req.query.merchantId === "string" ? req.query.merchantId : undefined,
            page: req.query.page ? Number(req.query.page) : 1,
            limit: req.query.limit ? Number(req.query.limit) : 20,
        });
        res.json({ success: true, licenses });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * POST /api/reseller/licenses/issue-seats
 */
router.post("/licenses/issue-seats", async (req, res) => {
    try {
        const { merchantId, seats, licenseType, customDays, deviceType, posDeviceId, mode } = req.body || {};
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const result = await reseller_service_1.ResellerService.issueDeviceSeats(resellerId(req), {
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
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to issue licenses" });
    }
});
/**
 * POST /api/reseller/licenses/:licenseId/revoke
 */
router.post("/licenses/:licenseId/revoke", async (req, res) => {
    try {
        const license = await reseller_service_1.ResellerService.revokeOwnedLicense(resellerId(req), req.params.licenseId);
        res.json({ success: true, license });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * POST /api/reseller/licenses/:licenseId/extend
 */
router.post("/licenses/:licenseId/extend", async (req, res) => {
    try {
        const days = Number(req.body?.additionalDays);
        if (!days || days <= 0)
            return res.status(400).json({ error: "additionalDays required" });
        const license = await reseller_service_1.ResellerService.extendOwnedLicense(resellerId(req), req.params.licenseId, days);
        res.json({ success: true, license });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * GET /api/reseller/merchants
 */
router.get("/merchants", async (req, res) => {
    try {
        const merchants = await reseller_service_1.ResellerService.listMerchants(resellerId(req), {
            search: typeof req.query.search === "string" ? req.query.search : undefined,
            status: typeof req.query.status === "string" ? req.query.status : undefined,
        });
        res.json({ success: true, merchants });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * POST /api/reseller/merchants
 */
router.post("/merchants", async (req, res) => {
    try {
        const { email, password, businessName, phone, address, city, country, editionId, businessCategory, shopEnabled, deviceSeats, licenseType, customDays, sendInvite, maxPosPosts, maxWaiterPosts, inventoryAddonEnabled, signageAddonEnabled, signageScreenLimit, kdsAddonEnabled, odsAddonEnabled, } = req.body || {};
        const trimmedBusinessName = typeof businessName === "string" ? businessName.trim() : "";
        if (!email || !trimmedBusinessName || !editionId) {
            return res.status(400).json({ error: "Email, business name, and edition are required" });
        }
        const merchant = await reseller_service_1.ResellerService.createMerchantForReseller(resellerId(req), {
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
            inventoryAddonEnabled: inventoryAddonEnabled === true,
            signageAddonEnabled: signageAddonEnabled === true,
            signageScreenLimit: signageScreenLimit != null ? Number(signageScreenLimit) : undefined,
            kdsAddonEnabled: kdsAddonEnabled === true,
            odsAddonEnabled: odsAddonEnabled === true,
        });
        res.status(201).json({ success: true, merchant });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create merchant" });
    }
});
/**
 * PUT /api/reseller/merchants/:merchantId/pos-limits
 * Agency sets concurrent POS / waiter station limits for a merchant license.
 */
router.put("/merchants/:merchantId/pos-limits", async (req, res) => {
    try {
        const { maxPosPosts, maxWaiterPosts, inventoryAddonEnabled, inventoryEnabled, signageAddonEnabled, signageEnabled, signageScreenLimit, kdsAddonEnabled, kdsEnabled, odsAddonEnabled, odsEnabled, } = req.body || {};
        const merchant = await reseller_service_1.ResellerService.updateMerchantPosLimits(resellerId(req), req.params.merchantId, {
            maxPosPosts: maxPosPosts != null ? Number(maxPosPosts) : undefined,
            maxWaiterPosts: maxWaiterPosts != null ? Number(maxWaiterPosts) : undefined,
            inventoryAddonEnabled: inventoryAddonEnabled != null
                ? (0, inventory_addon_1.isInventoryAddonEnabled)(inventoryAddonEnabled)
                : inventoryEnabled != null
                    ? (0, inventory_addon_1.isInventoryAddonEnabled)(inventoryEnabled)
                    : undefined,
            signageAddonEnabled: signageAddonEnabled != null
                ? (0, signage_addon_1.isSignageAddonEnabled)(signageAddonEnabled)
                : signageEnabled != null
                    ? (0, signage_addon_1.isSignageAddonEnabled)(signageEnabled)
                    : undefined,
            signageScreenLimit: signageScreenLimit != null ? (0, signage_addon_1.normalizeSignageScreenLimit)(signageScreenLimit) : undefined,
            kdsAddonEnabled: kdsAddonEnabled != null
                ? (0, kds_addon_1.isKdsAddonEnabled)(kdsAddonEnabled)
                : kdsEnabled != null
                    ? (0, kds_addon_1.isKdsAddonEnabled)(kdsEnabled)
                    : undefined,
            odsAddonEnabled: odsAddonEnabled != null
                ? (0, ods_addon_1.isOdsAddonEnabled)(odsAddonEnabled)
                : odsEnabled != null
                    ? (0, ods_addon_1.isOdsAddonEnabled)(odsEnabled)
                    : undefined,
        });
        res.json({ success: true, merchant });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update limits" });
    }
});
/**
 * GET /api/reseller/plans
 * Active subscription plans assignable to merchants.
 */
router.get("/plans", async (req, res) => {
    try {
        const plans = await subscription_plans_service_1.SubscriptionPlansService.listAll(false, {
            forResellerId: resellerId(req),
        });
        res.json({ success: true, plans });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list plans" });
    }
});
router.post("/plans", async (req, res) => {
    try {
        const plan = await subscription_plans_service_1.SubscriptionPlansService.create({
            ...(req.body || {}),
            ownerType: "reseller",
            ownerId: resellerId(req),
        });
        res.status(201).json({ success: true, plan });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create package" });
    }
});
router.put("/plans/:planId", async (req, res) => {
    try {
        const existing = await subscription_plans_service_1.SubscriptionPlansService.getById(req.params.planId);
        if (existing.ownerType !== "reseller" || existing.ownerId !== resellerId(req)) {
            return res.status(404).json({ error: "Package not found" });
        }
        const plan = await subscription_plans_service_1.SubscriptionPlansService.update(req.params.planId, req.body || {});
        res.json({ success: true, plan });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update package" });
    }
});
router.get("/addons", async (req, res) => {
    try {
        const addons = await subscription_addons_service_1.SubscriptionAddonsService.listAll({
            forResellerId: resellerId(req),
            includeInactive: true,
        });
        res.json({ success: true, addons });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list add-ons" });
    }
});
router.post("/addons", async (req, res) => {
    try {
        const addon = await subscription_addons_service_1.SubscriptionAddonsService.create({
            ...(req.body || {}),
            ownerType: "reseller",
            ownerId: resellerId(req),
        });
        res.status(201).json({ success: true, addon });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create add-on" });
    }
});
router.put("/addons/:addonId", async (req, res) => {
    try {
        const existing = await subscription_addons_service_1.SubscriptionAddonsService.getById(req.params.addonId);
        if (existing.ownerType !== "reseller" || existing.ownerId !== resellerId(req)) {
            return res.status(404).json({ error: "Add-on not found" });
        }
        const addon = await subscription_addons_service_1.SubscriptionAddonsService.update(req.params.addonId, req.body || {});
        res.json({ success: true, addon });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update add-on" });
    }
});
/**
 * PATCH /api/reseller/merchants/:merchantId/plan
 * Set POS edition and plan billing status for an owned merchant.
 */
router.patch("/merchants/:merchantId/plan", async (req, res) => {
    try {
        const { editionId, planBillingPaid, subscriptionPlan } = req.body || {};
        const merchant = await reseller_service_1.ResellerService.updateOwnedMerchantPlan(resellerId(req), req.params.merchantId, { editionId, planBillingPaid, subscriptionPlan });
        res.json({ success: true, merchant });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update plan";
        res.status(message === "Merchant not found" ? 404 : 400).json({ error: message });
    }
});
/**
 * POST /api/reseller/merchants/:merchantId/suspend
 * Reseller-owned merchants only — same status flag as superadmin suspend.
 */
router.post("/merchants/:merchantId/suspend", async (req, res) => {
    try {
        const merchant = await reseller_service_1.ResellerService.suspendOwnedMerchant(resellerId(req), req.params.merchantId, typeof req.body?.reason === "string" ? req.body.reason : undefined);
        res.json({
            success: true,
            message: "Merchant suspended successfully",
            merchant,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to suspend merchant";
        res.status(message === "Merchant not found" ? 404 : 400).json({ error: message });
    }
});
/**
 * POST /api/reseller/merchants/:merchantId/reactivate
 * Unsuspend a reseller-owned merchant.
 */
router.post("/merchants/:merchantId/reactivate", async (req, res) => {
    try {
        const merchant = await reseller_service_1.ResellerService.reactivateOwnedMerchant(resellerId(req), req.params.merchantId);
        res.json({
            success: true,
            message: "Merchant reactivated successfully",
            merchant,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to reactivate merchant";
        res.status(message === "Merchant not found" ? 404 : 400).json({ error: message });
    }
});
/**
 * POST /api/reseller/merchants/:merchantId/impersonate
 */
router.post("/merchants/:merchantId/impersonate", async (req, res) => {
    try {
        const m = await reseller_service_1.ResellerService.assertOwnsMerchant(resellerId(req), req.params.merchantId);
        if (m.status === "suspended" || m.status === "expired") {
            return res.status(400).json({ error: `Cannot open panel while merchant is ${m.status}` });
        }
        const result = await auth_service_1.AuthService.impersonateMerchant(req.user.id, req.params.merchantId);
        res.json({
            success: true,
            token: result.token,
            merchant: result.merchant,
        });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to impersonate" });
    }
});
/**
 * POST /api/reseller/merchants/:merchantId/purge-sales-data
 * Fresh start after demos / training — reseller-owned merchants only.
 * Deletes orders, held carts, payments, shifts, reports, loyalty/gift history.
 * Keeps menu, staff, settings, licenses, devices, and floor plan layout.
 */
router.post("/merchants/:merchantId/purge-sales-data", async (req, res) => {
    try {
        const merchantId = req.params.merchantId;
        const confirm = String(req.body?.confirm || "").trim();
        if (confirm !== "DELETE ALL SALES") {
            return res.status(400).json({
                error: 'Confirmation required: send { "confirm": "DELETE ALL SALES" } in the request body',
            });
        }
        const m = await reseller_service_1.ResellerService.assertOwnsMerchant(resellerId(req), merchantId);
        const { MerchantDataResetService } = await Promise.resolve().then(() => __importStar(require("@/services/merchant-data-reset.service")));
        const result = await MerchantDataResetService.purgeSalesData(merchantId, {
            deleteCustomers: req.body?.deleteCustomers === true,
            deleteReservations: req.body?.deleteReservations !== false,
        });
        res.json({
            success: true,
            message: `Purged sales data for ${result.merchantName || m.name}`,
            result,
        });
    }
    catch (error) {
        console.error("Reseller purge sales data failed:", error);
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to purge sales data",
        });
    }
});
/**
 * GET /api/reseller/editions/catalog
 */
router.get("/editions/catalog", (_req, res) => {
    res.json({
        success: true,
        groups: edition_features_1.EDITION_FEATURE_GROUPS,
        allFeatures: edition_features_1.ALL_EDITION_FEATURES,
    });
});
/**
 * GET /api/reseller/editions
 */
router.get("/editions", async (req, res) => {
    try {
        const editions = await edition_service_1.EditionService.list({
            forResellerId: resellerId(req),
            includeInactive: req.query.all === "1",
        });
        res.json({ success: true, editions });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * POST /api/reseller/editions
 */
router.post("/editions", async (req, res) => {
    try {
        const edition = await edition_service_1.EditionService.create({
            name: req.body?.name,
            note: req.body?.note,
            businessCategory: req.body?.businessCategory,
            features: req.body?.features,
            ownerType: "reseller",
            ownerId: resellerId(req),
        });
        res.status(201).json({ success: true, edition });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * POST /api/reseller/editions/:id/clone
 */
router.post("/editions/:id/clone", async (req, res) => {
    try {
        const edition = await edition_service_1.EditionService.cloneForReseller(req.params.id, resellerId(req), req.body?.name);
        res.status(201).json({ success: true, edition });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * PUT /api/reseller/editions/:id
 */
router.put("/editions/:id", async (req, res) => {
    try {
        const edition = await edition_service_1.EditionService.update(req.params.id, {
            name: req.body?.name,
            note: req.body?.note,
            businessCategory: req.body?.businessCategory,
            features: req.body?.features,
            isActive: req.body?.isActive,
        }, { requireOwnerType: "reseller", requireOwnerId: resellerId(req) });
        res.json({ success: true, edition });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * DELETE /api/reseller/editions/:id
 */
router.delete("/editions/:id", async (req, res) => {
    try {
        const edition = await edition_service_1.EditionService.softDelete(req.params.id, {
            requireOwnerType: "reseller",
            requireOwnerId: resellerId(req),
        });
        res.json({ success: true, edition });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
exports.default = router;
//# sourceMappingURL=reseller.routes.js.map