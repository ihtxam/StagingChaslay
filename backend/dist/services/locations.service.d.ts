import { schema } from "@/db";
export type LocationRow = typeof schema.locations.$inferSelect;
export declare class LocationsService {
    static ensureDefaults(merchantId: string): Promise<LocationRow>;
    static getDefaultId(merchantId: string): Promise<string>;
    static resolveLocationIdOrNull(merchantId: string, locationId?: string | null): Promise<string | null>;
    static resolveLocationId(merchantId: string, locationId?: string | null): Promise<string>;
    static resolveBySlug(merchantId: string, slug: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        businessCategory: string;
        address: string | null;
        city: string | null;
        country: string | null;
        slug: string;
        merchantId: string;
        timezone: string | null;
        isDefault: boolean;
        settings: schema.LocationSettings;
    } | null>;
    static listPublicForShop(merchantId: string): Promise<{
        id: string;
        name: string;
        businessCategory: string;
        address: string | null;
        city: string | null;
        slug: string;
        isDefault: boolean;
    }[]>;
    static listForUser(merchantId: string, opts?: {
        staffId?: string | null;
        isOwner?: boolean;
    }): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        businessCategory: string;
        address: string | null;
        city: string | null;
        country: string | null;
        slug: string;
        merchantId: string;
        timezone: string | null;
        isDefault: boolean;
        settings: schema.LocationSettings;
    }[]>;
    static assertStaffAccess(merchantId: string, locationId: string, opts?: {
        staffId?: string | null;
        isOwner?: boolean;
    }): Promise<void>;
    static countActive(merchantId: string): Promise<number>;
    static assertCanCreate(merchantId: string): Promise<void>;
    static create(merchantId: string, input: {
        name: string;
        slug?: string;
        businessCategory?: string;
        address?: string | null;
        city?: string | null;
        country?: string | null;
        timezone?: string;
        isDefault?: boolean;
    }): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        businessCategory: string;
        address: string | null;
        city: string | null;
        country: string | null;
        slug: string;
        merchantId: string;
        timezone: string | null;
        isDefault: boolean;
        settings: schema.LocationSettings;
    }>;
    static update(merchantId: string, locationId: string, input: Partial<{
        name: string;
        slug: string;
        businessCategory: string;
        address: string | null;
        city: string | null;
        country: string | null;
        timezone: string;
        isDefault: boolean;
        status: string;
        settings: Record<string, unknown> | null;
    }>): Promise<{
        id: string;
        merchantId: string;
        name: string;
        slug: string;
        businessCategory: string;
        address: string | null;
        city: string | null;
        country: string | null;
        timezone: string | null;
        isDefault: boolean;
        status: string;
        settings: schema.LocationSettings;
        createdAt: Date;
        updatedAt: Date;
    }>;
    static remove(merchantId: string, locationId: string): Promise<{
        success: boolean;
    }>;
    static getStaffLocationIds(merchantId: string, staffId: string): Promise<string[]>;
    static setStaffLocations(merchantId: string, staffId: string, locationIds: string[]): Promise<string[]>;
}
//# sourceMappingURL=locations.service.d.ts.map