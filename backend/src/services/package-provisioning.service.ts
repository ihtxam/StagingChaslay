import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { PackageIncludedAddons } from "@/db/schema";
import { readKioskAddonEnabled, writeKioskAddonEnabled } from "@/lib/kiosk-addon";
import { EditionService } from "@/services/edition.service";
import { SubscriptionPlansService } from "@/services/subscription-plans.service";

export type SubscriptionAddonRow = typeof schema.subscriptionAddons.$inferSelect;

function applyIncludedAddons(
  patch: Record<string, unknown>,
  addons: PackageIncludedAddons | null | undefined
) {
  if (!addons || typeof addons !== "object") return;
  if (addons.inventory) patch.inventoryAddonEnabled = true;
  if (addons.signage) {
    patch.signageAddonEnabled = true;
    if (addons.signageScreenLimit != null && addons.signageScreenLimit > 0) {
      patch.signageScreenLimit = addons.signageScreenLimit;
    }
  }
  if (addons.kds) patch.kdsAddonEnabled = true;
  if (addons.ods) patch.odsAddonEnabled = true;
  // kiosk flag is persisted via writeKioskAddonEnabled (SQL source of truth)
}

export class PackageProvisioningService {
  /** Apply a subscription package to a merchant (edition, limits, bundled addons). */
  static async applyPlan(merchantId: string, planId: string) {
    const plan = await SubscriptionPlansService.getById(planId);
    const db = getDb();
    const kioskBefore = await readKioskAddonEnabled(merchantId).catch(() => false);
    const bundleKiosk = plan.includedAddons?.kiosk === true;

    if (plan.editionId) {
      await EditionService.applyEditionDefaultsToMerchant(merchantId, plan.editionId);
    }

    const patch: Record<string, unknown> = {
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
      .update(schema.merchants)
      .set(patch as typeof schema.merchants.$inferInsert)
      .where(eq(schema.merchants.id, merchantId));

    if (bundleKiosk || kioskBefore) {
      await writeKioskAddonEnabled(merchantId, true);
    }

    return plan;
  }

  /** Apply a purchased add-on to a merchant (flags or limit bumps). */
  static async applyAddon(merchantId: string, addon: SubscriptionAddonRow) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");

    const patch: Record<string, unknown> = { updatedAt: new Date() };
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
        await writeKioskAddonEnabled(merchantId, true);
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
      .update(schema.merchants)
      .set(patch as typeof schema.merchants.$inferInsert)
      .where(eq(schema.merchants.id, merchantId));
  }
}
