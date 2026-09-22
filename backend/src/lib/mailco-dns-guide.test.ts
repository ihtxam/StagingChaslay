import assert from "node:assert/strict";
import {
  buildMailcoDnsGuide,
  isPostalSubdomain,
  mailcoApexDomain,
  parseMailcoFromEmail,
  postalSubdomainForApex,
} from "./mailco-dns-guide";

assert.deepEqual(parseMailcoFromEmail("noreply@rebornsense.com"), {
  local: "noreply",
  domain: "rebornsense.com",
});

assert.equal(mailcoApexDomain("psrp.rebornsense.com"), "rebornsense.com");
assert.equal(mailcoApexDomain("rebornsense.com"), "rebornsense.com");
assert.equal(isPostalSubdomain("psrp.rebornsense.com"), true);
assert.equal(isPostalSubdomain("rebornsense.com"), false);
assert.equal(postalSubdomainForApex("rebornsense.com"), "psrp.rebornsense.com");

const guide = buildMailcoDnsGuide("m9cdwo@psrp.rebornsense.com");
assert.ok(guide);
assert.equal(guide!.apexDomain, "rebornsense.com");
assert.equal(guide!.isPostalFromAddress, true);
assert.ok(guide!.records.some((r) => r.id === "postal-spf" && r.value.includes("91.98.126.226")));
assert.ok(guide!.records.some((r) => r.id === "apex-spf" && r.value.includes("spf.postal.mailco.ch")));

const apexGuide = buildMailcoDnsGuide("noreply@rebornsense.com");
assert.ok(apexGuide);
assert.equal(apexGuide!.isPostalFromAddress, false);
assert.ok(apexGuide!.recommendations.some((r) => r.includes("mail-tester")));

console.log("mailco-dns-guide.test.ts OK");
