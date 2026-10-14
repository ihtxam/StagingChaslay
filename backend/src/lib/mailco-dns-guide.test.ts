import assert from "node:assert/strict";
import {
  DEFAULT_POSTAL_IPV4,
  DEFAULT_POSTAL_IPV6,
  DEFAULT_POSTAL_SPF_INCLUDE,
  DEFAULT_RETURN_PATH_HOST,
  buildMailcoDnsGuide,
  buildPostalIncludeSpfRecord,
  buildPostalSenderSpfRecord,
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

const expectedSenderSpf = `v=spf1 ip4:${DEFAULT_POSTAL_IPV4} ip6:${DEFAULT_POSTAL_IPV6} ~all`;
assert.equal(buildPostalSenderSpfRecord(), expectedSenderSpf);
assert.equal(
  buildPostalSenderSpfRecord({ ipv4: "1.2.3.4", ipv6: "2001:db8::1" }),
  "v=spf1 ip4:1.2.3.4 ip6:2001:db8::1 ~all"
);
assert.equal(buildPostalSenderSpfRecord({ ipv4: "1.2.3.4", ipv6: "" }), "v=spf1 ip4:1.2.3.4 ~all");
assert.equal(
  buildPostalIncludeSpfRecord(),
  `v=spf1 include:${DEFAULT_POSTAL_SPF_INCLUDE} ~all`
);
assert.equal(
  buildPostalIncludeSpfRecord({ include: "spf.example.com" }),
  "v=spf1 include:spf.example.com ~all"
);

const guide = buildMailcoDnsGuide("m9cdwo@psrp.rebornsense.com");
assert.ok(guide);
assert.equal(guide!.apexDomain, "rebornsense.com");
assert.equal(guide!.isPostalFromAddress, true);
assert.equal(guide!.postalIp, DEFAULT_POSTAL_IPV4);
assert.equal(guide!.postalIpv6, DEFAULT_POSTAL_IPV6);
assert.equal(guide!.returnPathHost, DEFAULT_RETURN_PATH_HOST);

const includeRecord = guide!.records.find((r) => r.id === "mailco-include-spf");
assert.ok(includeRecord);
assert.equal(includeRecord!.zone, "mailco.ch");
assert.equal(includeRecord!.value, expectedSenderSpf);
assert.ok(includeRecord!.value.includes(`ip6:${DEFAULT_POSTAL_IPV6}`));

const rpRecord = guide!.records.find((r) => r.id === "mailco-rp-spf");
assert.ok(rpRecord);
assert.equal(rpRecord!.zone, "mailco.ch");
assert.equal(rpRecord!.value, expectedSenderSpf);
assert.equal(rpRecord!.required, true);
assert.ok(!rpRecord!.value.includes(" a "));
assert.ok(!rpRecord!.value.includes(" mx "));

const cname = guide!.records.find((r) => r.id === "postal-cname");
assert.ok(cname);
assert.equal(cname!.type, "CNAME");
assert.equal(cname!.host, "psrp");
assert.equal(cname!.value, DEFAULT_RETURN_PATH_HOST);
assert.equal(cname!.required, true);

const fallback = guide!.records.find((r) => r.id === "postal-spf");
assert.ok(fallback);
assert.equal(fallback!.required, false);
assert.equal(fallback!.value, expectedSenderSpf);

assert.ok(guide!.records.some((r) => r.id === "apex-spf" && r.value.includes(DEFAULT_POSTAL_SPF_INCLUDE)));
assert.ok(guide!.recommendations.some((r) => r.includes("Gmail SPF NONE")));
assert.ok(guide!.recommendations.some((r) => r.includes("mail-tester.com advice")));
assert.ok(guide!.recommendations.some((r) => r.includes("WRONG")));

const apexGuide = buildMailcoDnsGuide("hello@rebornsense.com");
assert.ok(apexGuide);
assert.equal(apexGuide!.isPostalFromAddress, false);
assert.equal(apexGuide!.postalSubdomain, "psrp.rebornsense.com");
assert.ok(apexGuide!.records.some((r) => r.id === "mailco-rp-spf" && r.value === expectedSenderSpf));
assert.ok(apexGuide!.recommendations.some((r) => r.includes("TTL")));
assert.ok(apexGuide!.recommendations.some((r) => r.includes("mail-tester.com advice")));

assert.equal(buildMailcoDnsGuide(""), null);
assert.equal(buildMailcoDnsGuide("not-an-email"), null);

console.log("mailco-dns-guide.test.ts OK");
