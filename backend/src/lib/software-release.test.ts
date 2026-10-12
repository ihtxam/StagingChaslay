/**
 * Software release version labels.
 * Run: cd backend && npx tsx src/lib/software-release.test.ts
 */
import assert from "node:assert/strict";
import {
  normalizeSoftwareReleaseProduct,
  normalizeSoftwareReleaseVersion,
  parseSoftwareReleaseInput,
} from "./software-release.ts";

assert.equal(normalizeSoftwareReleaseVersion(" v1.4.2 "), "1.4.2");
assert.equal(normalizeSoftwareReleaseProduct("desktop"), "desktop");
assert.equal(normalizeSoftwareReleaseProduct("nope"), "all");

const created = parseSoftwareReleaseInput(
  { version: "2.0.0", title: "Kitchen print", body: "Faster tickets" },
  true
);
assert.equal(created.version, "2.0.0");
assert.equal(created.title, "Kitchen print");

assert.throws(() => parseSoftwareReleaseInput({ title: "Missing version" }, true));

console.log("software-release tests passed");
