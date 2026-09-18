"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageProvisioningService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const edition_features_1 = require("@/lib/edition-features");
const kiosk_addon_1 = require("@/lib/kiosk-addon");
const inventory_addon_1 = require("@/lib/inventory-addon");
const signage_addon_1 = require("@/lib/signage-addon");
const kds_addon_1 = require("@/lib/kds-addon");
const ods_addon_1 = require("@/lib/ods-addon");
const edition_service_1 = require("@/services/edition.service");
const subscription_plans_service_1 = require("@/services/subscription-plans.service");
function applyIncludedAddons(patch, addons) {
    if (!addons || typeof addons !== "object")
        return;
    if (addons.inventory)
        patch.inventoryAddonEnabled = true;
    if (addons.signage) {
        patch.signageAddonEnabled = true;
        if (addons.signageScreenLimit != null && addons.signageScreenLimit > 0) {
            patch.signageScreenLimit = addons.signageScreenLimit;
        }
    }
    if (addons.kds)
        patch.kdsAddonEnabled = true;
    if (addons.ods)
        patch.odsAddonEnabled = true;
    // kiosk flag is persisted via writeKioskAddonEnabled (SQL source of truth)
}
class PackageProvisioningService {
    /**
     * Turn on paid merchant add-on columns when the assigned edition includes them.
     * Full / Legacy editions include inventory, signage, KDS, ODS, and kiosk in features.
     */
    static async applyEditionFeatureAddons(merchantId, features) {
        const normalized = (0, edition_features_1.normalizeEditionFeatures)(features ?? null);
        if (normalized.includes("inventory")) {
            await (0, inventory_addon_1.writeInventoryAddonEnabled)(merchantId, true);
        }
        if (normalized.includes("digital_signage")) {
            await (0, signage_addon_1.writeSignageAddonEnabled)(merchantId, true);
        }
        if (normalized.includes("kds")) {
            await (0, kds_addon_1.writeKdsAddonEnabled)(merchantId, true);
        }
        if (normalized.includes("ods")) {
            await (0, ods_addon_1.writeOdsAddonEnabled)(merchantId, true);
        }
        if (normalized.includes("self_order_kiosk")) {
            await (0, kiosk_addon_1.writeKioskAddonEnabled)(merchantId, true);
        }
    }
    /** Apply a subscription package to a merchant (edition, limits, bundled addons). */
    static async applyPlan(merchantId, planId) {
        const plan = await subscription_plans_service_1.SubscriptionPlansService.getById(planId);
        const db = (0, db_1.getDb)();
        const kioskBefore = await (0, kiosk_addon_1.readKioskAddonEnabled)(merchantId).catch(() => false);
        const bundleKiosk = plan.includedAddons?.kiosk === true;
        if (plan.editionId) {
            const edition = await edition_service_1.EditionService.getById(plan.editionId);
            await edition_service_1.EditionService.applyEditionDefaultsToMerchant(merchantId, plan.editionId);
            if (edition?.features) {
                await this.applyEditionFeatureAddons(merchantId, edition.features);
            }
        }
        const patch = {
            subscriptionPlan: plan.slug,
            updatedAt: new Date(),
        };
        let maxPos = Number(plan.maxPosPosts ?? 0);
        if (maxPos <= 0) {
            maxPos = Number(plan.maxDevices ?? 0);
        }
        patch.maxPosPosts = Math.max(0, maxPos);
        patch.maxWaiterPosts = Math.max(0, Number(plan.maxWaiterPosts ?? 0));
        patch.maxStaff = Math.max(0, Number(plan.maxStaff ?? 0));
        patch.maxLocations = Math.max(1, Number(plan.maxLocations ?? 1));
        applyIncludedAddons(patch, plan.includedAddons);
        await db
            .update(db_1.schema.merchants)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        if (bundleKiosk || kioskBefore) {
            await (0, kiosk_addon_1.writeKioskAddonEnabled)(merchantId, true);
        }
        return plan;
    }
    /** Apply a purchased add-on to a merchant (flags or limit bumps). */
    static async applyAddon(merchantId, addon) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        });
        if (!merchant)
            throw new Error("Merchant not found");
        const patch = { updatedAt: new Date() };
        const qty = Math.max(1, Number(addon.quantity || 1));
        const key = String(addon.addonKey || "").toLowerCase();
        switch (key) {
            case "inventory":
                patch.inventoryAddonEnabled = true;
                break;
            case "storekeeper":
                patch.storekeeperAddonEnabled = true;
                break;
            case "signage":
                patch.signageAddonEnabled = true;
                patch.signageScreenLimit = Math.max(Number(merchant.signageScreenLimit || 2), qty);
                break;
            case "kds":
                patch.kdsAddonEnabled = true;
                break;
            case "ods":
                patch.odsAddonEnabled = true;
                break;
            case "kiosk":
                await (0, kiosk_addon_1.writeKioskAddonEnabled)(merchantId, true);
                break;
            case "just_eat":
                patch.justEatAddonEnabled = true;
                break;
            case "uber_eats":
                patch.uberEatsAddonEnabled = true;
                break;
            case "extra_pos_post": {
                const current = Number(merchant.maxPosPosts || 0);
                patch.maxPosPosts = current === 0 ? qty : current + qty;
                break;
            }
            case "extra_waiter_post": {
                const current = Number(merchant.maxWaiterPosts || 0);
                patch.maxWaiterPosts = current === 0 ? qty : current + qty;
                break;
            }
            case "extra_staff": {
                const current = Number(merchant.maxStaff || 0);
                patch.maxStaff = current === 0 ? qty : current + qty;
                break;
            }
            case "extra_location": {
                const current = Number(merchant.maxLocations || 0);
                patch.maxLocations = current === 0 ? qty : current + qty;
                break;
            }
            default:
                throw new Error(`Unknown add-on type: ${addon.addonKey}`);
        }
        await db
            .update(db_1.schema.merchants)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
    }
}
exports.PackageProvisioningService = PackageProvisioningService;
//# sourceMappingURL=package-provisioning.service.js.map