import { schema } from "@/db";
import type { PackageIncludedAddons } from "@/db/schema";
/** Columns that existed on the original subscription_plans table (pre editions / addons). */
export type LegacyPlanLimits = {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    priceMonthly?: string | number;
    priceYearly?: string | number | null;
    currency?: string;
    maxDevices: number;
    maxProducts: number | null;
    maxPosPosts: number;
    maxWaiterPosts: number;
    maxStaff: number;
    maxLocations: number;
    features?: string[];
    isActive?: boolean;
    isPublic?: boolean;
    sortOrder?: number;
    trialDays?: number;
};
export type PlanInput = {
    name: string;
    slug: string;
    description?: string | null;
    priceMonthly: number | string;
    priceYearly?: number | string | null;
    currency?: string;
    editionId?: string | null;
    maxDevices?: number;
    maxProducts?: number | null;
    maxPosPosts?: number;
    maxWaiterPosts?: number;
    maxStaff?: number;
    includedAddons?: PackageIncludedAddons;
    features?: string[];
    isActive?: boolean;
    isPublic?: boolean;
    sortOrder?: number;
    trialDays?: number;
    ownerType?: "platform" | "reseller";
    ownerId?: string | null;
};
export declare class SubscriptionPlansService {
    /** Attach edition rows without relying on drizzle relational `with`. */
    private static withEditions;
    /**
     * List packages without `with: { edition }` — that relational join throws
     * `Cannot read properties of undefined (reading 'referencedTable')` when
     * `subscriptionPlansRelations` is missing from the schema export.
     */
    private static listPlansByOwner;
    /** Packages owned by one reseller (including Reborn Direct). */
    static listForReseller(resellerId: string, includeInactive?: boolean): Promise<{
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
        maxLocations: number;
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
    }[]>;
    static listAll(includeInactive?: boolean, opts?: {
        forResellerId?: string;
    }): Promise<{
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
        maxLocations: number;
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
    }[]>;
    /** @deprecated Use listForReseller(platformResellerId) */
    static listPublic(): Promise<{
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
        maxLocations: number;
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
    }[]>;
    static listPublicForMerchant(merchantId: string): Promise<({
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
        maxLocations: number;
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
    } & {
        edition: typeof schema.editions.$inferSelect | null;
    })[]>;
    static getById(id: string): Promise<{
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
        maxLocations: number;
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
    }>;
    /**
     * Plan lookup for POS / product / staff limits.
     * Never joins `editions` and never selects columns added after the original
     * packages table — production catalog must load even when drizzle-kit OOM'd.
     */
    static getBySlugForLimits(slug: string): Promise<LegacyPlanLimits | undefined>;
    static getBySlug(slug: string): Promise<{
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
        maxLocations: number;
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
    } | undefined>;
    /** Newer limit columns — queried separately so a missing column cannot abort the catalog. */
    private static selectNewerPlanColumns;
    private static getBySlugLegacy;
    private static getByIdLegacy;
    static create(input: PlanInput): Promise<{
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
        maxLocations: number;
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
    }>;
    static update(id: string, input: Partial<PlanInput>): Promise<{
        id: string;
        ownerType: string;
        ownerId: string | null;
        name: string;
        slug: string;
        description: string | null;
        priceMonthly: string;
        priceYearly: string | null;
        currency: string;
        editionId: string | null;
        maxDevices: number;
        maxProducts: number | null;
        maxPosPosts: number;
        maxWaiterPosts: number;
        maxStaff: number;
        maxLocations: number;
        includedAddons: schema.PackageIncludedAddons | null;
        features: string[] | null;
        isActive: boolean;
        isPublic: boolean;
        sortOrder: number;
        trialDays: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static remove(id: string): Promise<{
        id: string;
        ownerType: string;
        ownerId: string | null;
        name: string;
        slug: string;
        description: string | null;
        priceMonthly: string;
        priceYearly: string | null;
        currency: string;
        editionId: string | null;
        maxDevices: number;
        maxProducts: number | null;
        maxPosPosts: number;
        maxWaiterPosts: number;
        maxStaff: number;
        maxLocations: number;
        includedAddons: schema.PackageIncludedAddons | null;
        features: string[] | null;
        isActive: boolean;
        isPublic: boolean;
        sortOrder: number;
        trialDays: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static ensureDefaults(): Promise<void>;
}
//# sourceMappingURL=subscription-plans.service.d.ts.map