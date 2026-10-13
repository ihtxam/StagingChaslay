/**
 * Reseller/superadmin packages hard-delete (not deactivate).
 * run: npx tsx backend/src/services/subscription-package-delete.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addonInUseDeleteError, packageInUseDeleteError } from "../lib/subscription-package-delete";

assert.equal(packageInUseDeleteError("Starter", 0, 0), null);
assert.match(packageInUseDeleteError("Starter", 2, 0) || "", /2 merchant/);
assert.match(packageInUseDeleteError("Starter", 0, 1) || "", /billing history/);
assert.equal(addonInUseDeleteError("Inventory", 0, 0), null);
assert.match(addonInUseDeleteError("Inventory", 1, 0) || "", /still subscribe/);

const root = dirname(fileURLToPath(import.meta.url));
const plans = readFileSync(join(root, "subscription-plans.service.ts"), "utf8");
const addons = readFileSync(join(root, "subscription-addons.service.ts"), "utf8");
const reseller = readFileSync(join(root, "../routes/reseller.routes.ts"), "utf8");
const superadmin = readFileSync(join(root, "../routes/superadmin.routes.ts"), "utf8");

assert.match(plans, /db\.delete\(schema\.subscriptionPlans\)/);
assert.doesNotMatch(
  plans.slice(plans.indexOf("static async remove")),
  /isActive: false, isPublic: false/
);
assert.match(addons, /db\.delete\(schema\.subscriptionAddons\)/);
assert.match(reseller, /Failed to delete package/);
assert.match(reseller, /existing\.ownerType !== "reseller"/);
assert.match(superadmin, /Failed to delete plan/);
assert.doesNotMatch(reseller, /Failed to deactivate package/);

console.log("subscription-package-delete.test.ts OK");
