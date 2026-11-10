import assert from "node:assert/strict";
import { productVisibleOnChannel } from "./catalog-visibility";

const shopOnlyCategory = { visibility: { channels: ["shop"] } };
const posProduct = { visibility: { channels: ["pos", "shop"] }, isActive: true };
const hiddenCategory = { visibility: { channels: [] as const } };

assert.equal(productVisibleOnChannel(posProduct, shopOnlyCategory, "pos"), false);
assert.equal(productVisibleOnChannel(posProduct, shopOnlyCategory, "shop"), true);
assert.equal(productVisibleOnChannel(posProduct, hiddenCategory, "shop"), false);
assert.equal(
  productVisibleOnChannel(
    { visibility: { channels: ["shop"] }, isActive: true },
    shopOnlyCategory,
    "pos"
  ),
  false
);

assert.equal(
  productVisibleOnChannel(
    { visibility: { channels: ["shop"] }, isActive: true },
    shopOnlyCategory,
    "delivery"
  ),
  true
);

console.log("catalog-visibility.test.ts ok");
