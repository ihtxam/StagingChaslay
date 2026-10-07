"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Public shop SQL leak + product column heal coverage.
 * Run: cd backend && npx tsx src/lib/public-shop-error.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const product_column_patches_1 = require("./product-column-patches");
const public_shop_error_1 = require("./public-shop-error");
const shop_public_error_1 = require("../../../dashboard/src/lib/shop-public-error");
const loyaltySql = new Error('Failed query: select "id", "merchant_id", "category_id", "name", "sku", "barcode", "price", "cost", "stock", "low_stock_threshold", "is_taxable", "description", "image_url", "product_type", "is_open_price", "sold_by_weight", "weight_unit", "bulk_pricing", "extras", "combo_items", "catering_config", "specifications", "button_color", "allow_extras", "loyalty_reward_points", "recipe_yield", "sort_order", "client_id", "is_active", "visibility", "similar_product_ids", "dietary_tags", "brand", "extra_barcodes", "time_slot_prices", "created_at", "updated_at" from "products" "products" where ("products"."merchant_id" = $1 and "products"."is_active" = $2 and "products"."loyalty_reward_points" is not null and "products"."loyalty_reward_points" > $3) order by "products"."loyalty_reward_points" asc, "products"."name" asc params: 144048d2-280c-45df-b1d2-df421562ace,true,0');
const shown = (0, public_shop_error_1.publicShopDbError)(loyaltySql, "Failed to load menu");
strict_1.default.equal(shown, "Failed to load menu");
strict_1.default.doesNotMatch(shown, /failed query|select |params:|loyalty_reward_points|dietary_tags/i);
strict_1.default.match((0, public_shop_error_1.publicShopDbError)(loyaltySql), /refresh/i);
strict_1.default.doesNotMatch((0, public_shop_error_1.publicShopDbError)(loyaltySql), /failed query|select |params:/i);
const missingCol = new Error('column "dietary_tags" of relation "products" does not exist');
missingCol.cause = undefined;
const missingShown = (0, public_shop_error_1.publicShopDbError)(missingCol);
strict_1.default.match(missingShown, /refresh/i);
strict_1.default.doesNotMatch(missingShown, /dietary_tags|select |does not exist/i);
strict_1.default.equal((0, public_shop_error_1.publicShopDbError)(new Error("Shop not found")), "Shop not found");
strict_1.default.equal((0, shop_public_error_1.customerShopError)(loyaltySql.message, "Failed to load shop"), "Failed to load shop");
strict_1.default.equal((0, shop_public_error_1.customerShopError)("Shop is closed", "Failed to load shop"), "Shop is closed");
strict_1.default.equal((0, shop_public_error_1.customerShopError)("", "Failed to load shop"), "Failed to load shop");
strict_1.default.equal((0, public_shop_error_1.isShopCatalogSchemaError)(loyaltySql), true);
strict_1.default.equal((0, public_shop_error_1.isShopCatalogSchemaError)(missingCol), true);
strict_1.default.equal((0, public_shop_error_1.isShopCatalogSchemaError)(new Error("Shop not found")), false);
const healed = new Set((0, product_column_patches_1.shopProductHealColumnNames)());
const base = new Set(product_column_patches_1.SHOP_PRODUCT_BASE_COLUMNS);
for (const column of product_column_patches_1.SHOP_PRODUCT_SELECT_COLUMNS) {
    strict_1.default.ok(healed.has(column) || base.has(column), `shop products SELECT column ${column} has no heal and is not a base column`);
}
const already = new Set(product_column_patches_1.SHOP_PRODUCT_COLUMNS_ALREADY_PATCHED);
for (const column of healed) {
    if (already.has(column))
        continue;
    const sql = product_column_patches_1.SHOP_CATALOG_EXTRA_PATCHES[`products_${column}`];
    strict_1.default.ok(sql, `missing ALTER for ${column}`);
    strict_1.default.match(sql, new RegExp(`ALTER TABLE products ADD COLUMN IF NOT EXISTS ${column}\\b`));
}
strict_1.default.match(product_column_patches_1.SHOP_CATALOG_EXTRA_PATCHES.categories_client_id, /ALTER TABLE categories ADD COLUMN IF NOT EXISTS client_id\b/);
console.log("public-shop-error.test.ts: ok");
//# sourceMappingURL=public-shop-error.test.js.map