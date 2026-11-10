import assert from "node:assert/strict";
import { merchantHasPublicStorefront } from "./shop-storefront";

assert.equal(
  merchantHasPublicStorefront({
    shopEnabled: false,
    reservationsEnabled: true,
    cmsHomepageEnabled: false,
  }),
  true
);
assert.equal(
  merchantHasPublicStorefront({
    shopEnabled: false,
    reservationsEnabled: false,
    cmsHomepageEnabled: true,
  }),
  true
);
assert.equal(
  merchantHasPublicStorefront({
    shopEnabled: false,
    reservationsEnabled: false,
    cmsHomepageEnabled: false,
  }),
  false
);

console.log("shop-storefront.test.ts ok");
