import assert from "node:assert/strict";
import { seoFromCatalog } from "./shop-seo-from-catalog";

const seo = seoFromCatalog({
  businessName: "Brazza Pizza",
  city: "Zürich",
  productNames: ["Margherita", "Diavola", "Capricciosa"],
});
assert.match(seo.title, /Brazza Pizza/);
assert.match(seo.title, /Zürich/);
assert.match(seo.description, /Margherita/);
assert.ok(seo.title.length <= 70);
assert.ok(seo.description.length <= 180);

console.log("shop-seo-from-catalog.test.ts ok");
