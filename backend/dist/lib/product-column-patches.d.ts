/**
 * Columns Drizzle selects for the public shop menu and loyalty reward query.
 * Keep this list aligned with schema.products — a missing column fails the whole SELECT.
 */
export declare const SHOP_PRODUCT_SELECT_COLUMNS: readonly ["id", "merchant_id", "category_id", "name", "sku", "barcode", "price", "cost", "stock", "low_stock_threshold", "is_taxable", "description", "image_url", "product_type", "is_open_price", "sold_by_weight", "weight_unit", "bulk_pricing", "extras", "combo_items", "catering_config", "specifications", "button_color", "allow_extras", "loyalty_reward_points", "recipe_yield", "sort_order", "client_id", "is_active", "visibility", "similar_product_ids", "dietary_tags", "brand", "extra_barcodes", "time_slot_prices", "created_at", "updated_at"];
/**
 * Original products columns. These are not re-added by the shop heal because they
 * ship with the table itself (primary key, price, timestamps).
 */
export declare const SHOP_PRODUCT_BASE_COLUMNS: readonly ["id", "merchant_id", "category_id", "name", "sku", "price", "cost", "stock", "low_stock_threshold", "is_taxable", "description", "image_url", "created_at", "updated_at"];
/**
 * Product columns already patched in EXTRA_COLUMN_PATCHES before the shop-menu heal.
 * ensureShopCatalogColumnsSchema still applies them on retry.
 */
export declare const SHOP_PRODUCT_COLUMNS_ALREADY_PATCHED: readonly ["barcode", "catering_config", "recipe_yield", "visibility", "similar_product_ids", "brand", "extra_barcodes", "time_slot_prices"];
/** Idempotent ALTERs for shop SELECT columns that were not already patched. */
export declare const SHOP_CATALOG_EXTRA_PATCHES: Record<string, string>;
export declare function shopProductHealColumnNames(): string[];
//# sourceMappingURL=product-column-patches.d.ts.map