import { schema } from "@/db";
import { type EditionFeatureKey } from "@/lib/edition-features";
export type EditionRow = typeof schema.editions.$inferSelect;
export declare class EditionService {
    static ensureDefaults(): Promise<void>;
    static list(opts?: {
        ownerType?: "platform" | "reseller";
        ownerId?: string | null;
        includeInactive?: boolean;
        /** Platform templates + this reseller's editions */
        forResellerId?: string;
    }): Promise<{
        id: string;
        ownerType: string;
        ownerId: string | null;
        name: string;
        note: string | null;
        businessCategory: string;
        features: EditionFeatureKey[];
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    static getById(id: string): Promise<{
        id: string;
        ownerType: string;
        ownerId: string | null;
        name: string;
        note: string | null;
        businessCategory: string;
        features: EditionFeatureKey[];
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    static create(input: {
        name: string;
        note?: string | null;
        businessCategory?: string;
        features?: unknown;
        ownerType?: "platform" | "reseller";
        ownerId?: string | null;
        isActive?: boolean;
    }): Promise<{
        id: string;
        ownerType: string;
        ownerId: string | null;
        name: string;
        note: string | null;
        businessCategory: string;
        features: EditionFeatureKey[];
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static update(id: string, input: {
        name?: string;
        note?: string | null;
        businessCategory?: string;
        features?: unknown;
        isActive?: boolean;
    }, opts?: {
        requireOwnerType?: "platform" | "reseller";
        requireOwnerId?: string;
    }): Promise<{
        id: string;
        ownerType: string;
        ownerId: string | null;
        name: string;
        note: string | null;
        businessCategory: string;
        features: EditionFeatureKey[];
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static softDelete(id: string, opts?: {
        requireOwnerType?: "platform" | "reseller";
        requireOwnerId?: string;
    }): Promise<{
        id: string;
        ownerType: string;
        ownerId: string | null;
        name: string;
        note: string | null;
        businessCategory: string;
        features: EditionFeatureKey[];
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static cloneForReseller(sourceId: string, resellerId: string, name?: string): Promise<{
        id: string;
        ownerType: string;
        ownerId: string | null;
        name: string;
        note: string | null;
        businessCategory: string;
        features: EditionFeatureKey[];
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /** Features for a merchant; null means legacy full access */
    static getMerchantFeatures(merchantId: string): Promise<EditionFeatureKey[] | null>;
    static applyEditionDefaultsToMerchant(merchantId: string, editionId: string): Promise<void>;
    static getLegacyFullEditionId(): Promise<string | null>;
}
//# sourceMappingURL=edition.service.d.ts.map