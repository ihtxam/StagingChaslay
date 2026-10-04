/**
 * Columns Drizzle selects for the public shop menu and loyalty reward query.
 * Keep this list aligned with schema.products — a missing column fails the whole SELECT.
 */
export const SHOP_PRODUCT_SELECT_COLUMNS = [
  "id",
  "merchant_id",
  "category_id",
  "name",
  "sku",
  "barcode",
  "price",
  "cost",
  "stock",
  "low_stock_threshold",
  "is_taxable",
  "description",
  "image_url",
  "product_type",
  "is_open_price",
  "sold_by_weight",
  "weight_unit",
  "bulk_pricing",
  "extras",
  "combo_items",
  "catering_config",
  "specifications",
  "button_color",
  "allow_extras",
  "loyalty_reward_points",
  "recipe_yield",
  "sort_order",
  "client_id",
  "is_active",
  "visibility",
  "similar_product_ids",
  "dietary_tags",
  "brand",
  "extra_barcodes",
  "time_slot_prices",
  "created_at",
  "updated_at",
] as const;

/**
 * Original products columns. These are not re-added by the shop heal because they
 * ship with the table itself (primary key, price, timestamps).
 */
export const SHOP_PRODUCT_BASE_COLUMNS = [
  "id",
  "merchant_id",
  "category_id",
  "name",
  "sku",
  "price",
  "cost",
  "stock",
  "low_stock_threshold",
  "is_taxable",
  "description",
  "image_url",
  "created_at",
  "updated_at",
] as const;

/**
 * Product columns already patched in EXTRA_COLUMN_PATCHES before the shop-menu heal.
 * ensureShopCatalogColumnsSchema still applies them on retry.
 */
export const SHOP_PRODUCT_COLUMNS_ALREADY_PATCHED = [
  "barcode",
  "catering_config",
  "recipe_yield",
  "visibility",
  "similar_product_ids",
  "brand",
  "extra_barcodes",
  "time_slot_prices",
] as const;

/** Idempotent ALTERs for shop SELECT columns that were not already patched. */
export const SHOP_CATALOG_EXTRA_PATCHES: Record<string, string> = {
  products_product_type:
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type varchar(50) NOT NULL DEFAULT 'standard'",
  products_is_open_price:
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_open_price boolean NOT NULL DEFAULT false",
  products_sold_by_weight:
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS sold_by_weight boolean NOT NULL DEFAULT false",
  products_weight_unit:
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_unit varchar(10) DEFAULT 'kg'",
  products_bulk_pricing:
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS bulk_pricing jsonb NOT NULL DEFAULT '[]'::jsonb",
  products_extras:
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS extras jsonb NOT NULL DEFAULT '[]'::jsonb",
  products_combo_items:
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS combo_items jsonb NOT NULL DEFAULT '[]'::jsonb",
  products_specifications:
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS specifications jsonb NOT NULL DEFAULT '[]'::jsonb",
  products_button_color:
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS button_color varchar(20)",
  products_allow_extras:
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_extras boolean NOT NULL DEFAULT false",
  products_loyalty_reward_points:
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS loyalty_reward_points integer",
  products_sort_order:
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0",
  products_client_id: "ALTER TABLE products ADD COLUMN IF NOT EXISTS client_id varchar(64)",
  products_is_active:
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true",
  products_dietary_tags:
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS dietary_tags jsonb NOT NULL DEFAULT '[]'::jsonb",
  categories_client_id: "ALTER TABLE categories ADD COLUMN IF NOT EXISTS client_id varchar(64)",
  categories_is_offers_category:
    "ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_offers_category boolean NOT NULL DEFAULT false",
  categories_sort_order:
    "ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0",
  categories_description: "ALTER TABLE categories ADD COLUMN IF NOT EXISTS description text",
  categories_color: "ALTER TABLE categories ADD COLUMN IF NOT EXISTS color varchar(7)",
  categories_image_url: "ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url varchar(500)",
};

export function shopProductHealColumnNames(): string[] {
  const fromPatches = Object.keys(SHOP_CATALOG_EXTRA_PATCHES)
    .filter((key) => key.startsWith("products_"))
    .map((key) => key.slice("products_".length));
  return [...SHOP_PRODUCT_COLUMNS_ALREADY_PATCHED, ...fromPatches];
}
