/**
 * Custom domain host matching — run: cd backend && npx tsx src/lib/domain.test.ts
 */
import assert from "node:assert/strict";
import {
  customDomainHostVariants,
  customDomainMatches,
  normalizeCustomDomain,
} from "./domain.ts";

assert.equal(normalizeCustomDomain("https://WWW.BrazzaPizza.ch/menu"), "brazzapizza.ch");
assert.equal(normalizeCustomDomain("www.mycafe.ch"), "mycafe.ch");
assert.equal(normalizeCustomDomain("mycafe.ch"), "mycafe.ch");

assert.deepEqual(customDomainHostVariants("brazzapizza.ch"), [
  "brazzapizza.ch",
  "www.brazzapizza.ch",
]);
assert.deepEqual(customDomainHostVariants("www.brazzapizza.ch"), [
  "www.brazzapizza.ch",
  "brazzapizza.ch",
]);

assert.equal(customDomainMatches("www.brazzapizza.ch", "brazzapizza.ch"), true);
assert.equal(customDomainMatches("brazzapizza.ch", "www.brazzapizza.ch"), true);
assert.equal(customDomainMatches("other.ch", "brazzapizza.ch"), false);

console.log("domain.test.ts OK");
