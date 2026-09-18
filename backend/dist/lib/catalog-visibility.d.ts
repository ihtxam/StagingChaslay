/** Where a product/category may appear in the catalog. */
export type CatalogChannel = "pos" | "shop" | "qr_table" | "delivery" | "kiosk";
export type CatalogVisibility = {
    channels: CatalogChannel[];
};
export declare const ALL_CATALOG_CHANNELS: CatalogChannel[];
export declare const DEFAULT_CATALOG_VISIBILITY: CatalogVisibility;
export declare function normalizeCatalogVisibility(raw: unknown): CatalogVisibility;
export declare function isVisibleOnChannel(visibility: unknown, channel: CatalogChannel): boolean;
export declare function productVisibleOnChannel(product: {
    visibility?: unknown;
    isActive?: boolean | null;
}, category: {
    visibility?: unknown;
} | null | undefined, channel: CatalogChannel): boolean;
/** Catalog rows saved before the kiosk channel existed (no explicit kiosk flag). */
export declare function isPreKioskCatalogVisibility(visibility: unknown): boolean;
/** Kiosk menu visibility — honors kiosk channel, with shop/POS fallback for legacy catalogs. */
export declare function productVisibleOnKioskChannel(product: {
    visibility?: unknown;
    isActive?: boolean | null;
}, category: {
    visibility?: unknown;
} | null | undefined): boolean;
export declare function categoryVisibleOnKioskChannel(category: {
    visibility?: unknown;
}): boolean;
export declare function filterCatalogForChannel<T extends {
    id: string;
    categoryId?: string | null;
    visibility?: unknown;
    isActive?: boolean | null;
}, C extends {
    id: string;
    visibility?: unknown;
}>(products: T[], categories: C[], channel: CatalogChannel): {
    products: T[];
    categories: C[];
};
export declare function filterCatalogForKioskChannel<T extends {
    id: string;
    categoryId?: string | null;
    visibility?: unknown;
    isActive?: boolean | null;
}, C extends {
    id: string;
    visibility?: unknown;
    isOffersCategory?: boolean | null;
}>(products: T[], categories: C[]): {
    products: T[];
    categories: C[];
};
/** Map shop fulfillment channel query to catalog visibility channel. */
export declare function shopMenuCatalogChannel(channelParam?: string | null, tableId?: string | null): CatalogChannel;
//# sourceMappingURL=catalog-visibility.d.ts.map