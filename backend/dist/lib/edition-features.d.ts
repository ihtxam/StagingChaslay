/**
 * SaaS edition feature catalog ? capability gates (not staff RBAC).
 * Keep in sync with dashboard/src/lib/edition-features.ts
 */
export type EditionFeatureKey = "pos_tables" | "pos_courses" | "pos_shifts" | "pos_kitchen" | "pos_express" | "pos_retail" | "pos_cash_drawer" | "pos_tips" | "pos_gift_cards" | "channel_takeaway" | "channel_delivery" | "channel_online_orders" | "online_shop" | "online_payments" | "gift_cards" | "loyalty" | "offers" | "reports" | "staff_roles" | "reservations" | "website_cms" | "inventory" | "digital_signage";
export type EditionFeatureGroup = {
    id: string;
    label: string;
    features: Array<{
        key: EditionFeatureKey;
        label: string;
    }>;
};
export declare const EDITION_FEATURE_GROUPS: EditionFeatureGroup[];
export declare const ALL_EDITION_FEATURES: EditionFeatureKey[];
/**
 * Merchant panel routes gated by edition features.
 * Do not add /merchant/inventory or /merchant/signage here ? those are paid
 * merchant addons (inventory_addon_enabled / signage_addon_enabled), not edition entitlements.
 */
export declare const EDITION_ROUTE_FEATURES: Record<string, EditionFeatureKey[]>;
export declare function normalizeEditionFeatures(input: unknown): EditionFeatureKey[];
export declare function hasEditionFeature(features: EditionFeatureKey[] | null | undefined, required: EditionFeatureKey): boolean;
export declare function hasAnyEditionFeature(features: EditionFeatureKey[] | null | undefined, required: EditionFeatureKey[]): boolean;
export declare function canAccessEditionRoute(path: string, features: EditionFeatureKey[] | null | undefined): boolean;
/** Defaults applied when assigning a retail-oriented edition */
export declare function retailDefaultsFromFeatures(features: EditionFeatureKey[]): {
    floorPlanEnabled: boolean;
    coursesEnabled: boolean;
    reservationsEnabled: boolean;
    shopEnabled: boolean;
    pickupEnabled: boolean;
    deliveryEnabled: boolean;
    loyaltyEnabled: boolean;
    webposGiftCardEnabled: boolean;
    posMode: "retail" | "restaurant";
};
//# sourceMappingURL=edition-features.d.ts.map