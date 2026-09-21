import assert from "node:assert/strict";
import { productVisibleOnChannel } from "./catalog-visibility";

const shopOnlyCategory = { visibility: { channels: ["shop"] } };
const posProduct = { visibility: { channels: ["pos", "shop"] }, isActive: true };

assert.equal(productVisibleOnChannel(posProduct, shopOnlyCategory, "pos"), true);
assert.equal(productVisibleOnChannel(posProduct, shopOnlyCategory, "shop"), true);
assert.equal(
  productVisibleOnChannel(
    { visibility: { channels: ["shop"] }, isActive: true },
    shopOnlyCategory,
    "pos"
  ),
  false
);

console.log("catalog-visibility.test.ts ok");
