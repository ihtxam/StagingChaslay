import { schema } from "@/db";
export type SubscriptionAddonRow = typeof schema.subscriptionAddons.$inferSelect;
export declare class PackageProvisioningService {
    /** Apply a subscription package to a merchant (edition, limits, bundled addons). */
    static applyPlan(merchantId: string, planId: string): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        ownerType: string;
        ownerId: string | null;
        features: string[] | null;
        slug: string;
        maxPosPosts: number;
        maxWaiterPosts: number;
        maxStaff: number;
        editionId: string | null;
        sortOrder: number;
        description: string | null;
        priceMonthly: string;
        priceYearly: string | null;
        currency: string;
        maxDevices: number;
        maxProducts: number | null;
        includedAddons: schema.PackageIncludedAddons | null;
        isPublic: boolean;
        trialDays: number;
        edition: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            ownerType: string;
            ownerId: string | null;
            note: string | null;
            businessCategory: string;
            features: string[];
        } | null;
    }>;
    /** Apply a purchased add-on to a merchant (flags or limit bumps). */
    static applyAddon(merchantId: string, addon: SubscriptionAddonRow): Promise<void>;
}
//# sourceMappingURL=package-provisioning.service.d.ts.map