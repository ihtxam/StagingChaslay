/**
 * Public shop SQL leak + product column heal coverage.
 * Run: cd backend && npx tsx src/lib/public-shop-error.test.ts
 */
import assert from "node:assert/strict";
import {
  SHOP_CATALOG_EXTRA_PATCHES,
  SHOP_PRODUCT_BASE_COLUMNS,
  SHOP_PRODUCT_COLUMNS_ALREADY_PATCHED,
  SHOP_PRODUCT_SELECT_COLUMNS,
  shopProductHealColumnNames,
} from "./product-column-patches";
import { isShopCatalogSchemaError, publicShopDbError } from "./public-shop-error";
import { customerShopError } from "../../../dashboard/src/lib/shop-public-error";

const loyaltySql = new Error(
  'Failed query: select "id", "merchant_id", "category_id", "name", "sku", "barcode", "price", "cost", "stock", "low_stock_threshold", "is_taxable", "description", "image_url", "product_type", "is_open_price", "sold_by_weight", "weight_unit", "bulk_pricing", "extras", "combo_items", "catering_config", "specifications", "button_color", "allow_extras", "loyalty_reward_points", "recipe_yield", "sort_order", "client_id", "is_active", "visibility", "similar_product_ids", "dietary_tags", "brand", "extra_barcodes", "time_slot_prices", "created_at", "updated_at" from "products" "products" where ("products"."merchant_id" = $1 and "products"."is_active" = $2 and "products"."loyalty_reward_points" is not null and "products"."loyalty_reward_points" > $3) order by "products"."loyalty_reward_points" asc, "products"."name" asc params: 144048d2-280c-45df-b1d2-df421562ace,true,0'
);

const shown = publicShopDbError(loyaltySql, "Failed to load menu");
assert.equal(shown, "Failed to load menu");
assert.doesNotMatch(shown, /failed query|select |params:|loyalty_reward_points|dietary_tags/i);
assert.match(publicShopDbError(loyaltySql), /refresh/i);
assert.doesNotMatch(publicShopDbError(loyaltySql), /failed query|select |params:/i);

const missingCol = new Error('column "dietary_tags" of relation "products" does not exist');
(missingCol as Error & { cause?: unknown }).cause = undefined;
const missingShown = publicShopDbError(missingCol);
assert.match(missingShown, /refresh/i);
assert.doesNotMatch(missingShown, /dietary_tags|select |does not exist/i);

assert.equal(publicShopDbError(new Error("Shop not found")), "Shop not found");
assert.equal(customerShopError(loyaltySql.message, "Failed to load shop"), "Failed to load shop");
assert.equal(customerShopError("Shop is closed", "Failed to load shop"), "Shop is closed");
assert.equal(customerShopError("", "Failed to load shop"), "Failed to load shop");
assert.equal(isShopCatalogSchemaError(loyaltySql), true);
assert.equal(isShopCatalogSchemaError(missingCol), true);
assert.equal(isShopCatalogSchemaError(new Error("Shop not found")), false);

const healed = new Set(shopProductHealColumnNames());
const base = new Set<string>(SHOP_PRODUCT_BASE_COLUMNS);
for (const column of SHOP_PRODUCT_SELECT_COLUMNS) {
  assert.ok(
    healed.has(column) || base.has(column),
    `shop products SELECT column ${column} has no heal and is not a base column`
  );
}

const already = new Set<string>(SHOP_PRODUCT_COLUMNS_ALREADY_PATCHED);
for (const column of healed) {
  if (already.has(column)) continue;
  const sql = SHOP_CATALOG_EXTRA_PATCHES[`products_${column}`];
  assert.ok(sql, `missing ALTER for ${column}`);
  assert.match(sql, new RegExp(`ALTER TABLE products ADD COLUMN IF NOT EXISTS ${column}\\b`));
}

assert.match(
  SHOP_CATALOG_EXTRA_PATCHES.categories_client_id,
  /ALTER TABLE categories ADD COLUMN IF NOT EXISTS client_id\b/
);

console.log("public-shop-error.test.ts: ok");
