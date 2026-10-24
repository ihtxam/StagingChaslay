import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveBranchPanelSettingsLocationId,
  adyenUpdatesUseCredentials,
} from "./branch-panel-settings.js";

const here = dirname(fileURLToPath(import.meta.url));

assert.equal(resolveBranchPanelSettingsLocationId(false, "abc"), null);
assert.equal(resolveBranchPanelSettingsLocationId(true, ""), null);
assert.equal(resolveBranchPanelSettingsLocationId(true, "loc-1"), "loc-1");
assert.equal(
  resolveBranchPanelSettingsLocationId(false, "loc-1", { branchPanelRequested: true }),
  "loc-1"
);

assert.equal(adyenUpdatesUseCredentials({ name: "x" }), false);
assert.equal(adyenUpdatesUseCredentials({ adyenApiKey: "k" }), true);

const serviceSrc = readFileSync(
  join(here, "..", "services", "merchant-settings.service.ts"),
  "utf8"
);
assert.match(serviceSrc, /branchLocationId/, "merchant settings accepts branch scope");

const routesSrc = readFileSync(join(here, "..", "routes", "merchant.routes.ts"), "utf8");
assert.match(routesSrc, /branch-panel-settings/, "settings routes wire branch overlay");

const overlaySrc = readFileSync(join(here, "branch-panel-settings.ts"), "utf8");
assert.match(overlaySrc, /BRANCH_LOCATION_COLUMN_KEYS/, "branch overlay includes location business columns");
assert.match(overlaySrc, /out\.name = location\.name/, "branch overlay maps location name to settings name");

console.log("branch-panel-settings.test.ts: ok");
