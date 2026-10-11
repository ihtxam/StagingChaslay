/**
 * Persist every reseller hide checkbox, including JSON-string columns.
 * Run: cd backend && npx tsx src/lib/panel-nav-hidden.test.ts
 */
import assert from "node:assert/strict";
import {
  isPanelNavGroupHidden,
  isPanelNavHidden,
  normalizePanelNavHidden,
  parsePanelNavHidden,
} from "./panel-nav-hidden.ts";

assert.deepEqual(parsePanelNavHidden('["cms","products"]'), ["cms", "products"]);
assert.deepEqual(normalizePanelNavHidden('["cms","products","not-a-key"]'), ["cms", "products"]);
assert.deepEqual(normalizePanelNavHidden(["cms", "products", "catalog", "platform-shop"]), [
  "cms",
  "products",
  "catalog",
  "platform-shop",
]);
assert.deepEqual(normalizePanelNavHidden(["cms", "/merchant/website"]), ["cms", "/merchant/website"]);
assert.deepEqual(normalizePanelNavHidden(null), []);
assert.deepEqual(normalizePanelNavHidden("cms,customers"), ["cms", "customers"]);

assert.equal(isPanelNavHidden("/merchant/online-shop", ["cms"]), true);
assert.equal(isPanelNavHidden("/merchant/website", ["cms"]), true);
assert.equal(isPanelNavGroupHidden("products", ["catalog"]), true);
assert.equal(isPanelNavHidden("/merchant/products/catering-guide", ["products"]), true);
assert.equal(isPanelNavHidden("/merchant/platform-shop", ["platform-shop"]), true);
assert.equal(isPanelNavHidden("/merchant/inventory", ["products"]), false);

console.log("panel-nav-hidden tests passed");
