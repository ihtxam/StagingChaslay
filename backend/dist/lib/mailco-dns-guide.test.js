"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const mailco_dns_guide_1 = require("./mailco-dns-guide");
strict_1.default.deepEqual((0, mailco_dns_guide_1.parseMailcoFromEmail)("noreply@rebornsense.com"), {
    local: "noreply",
    domain: "rebornsense.com",
});
strict_1.default.equal((0, mailco_dns_guide_1.mailcoApexDomain)("psrp.rebornsense.com"), "rebornsense.com");
strict_1.default.equal((0, mailco_dns_guide_1.mailcoApexDomain)("rebornsense.com"), "rebornsense.com");
strict_1.default.equal((0, mailco_dns_guide_1.isPostalSubdomain)("psrp.rebornsense.com"), true);
strict_1.default.equal((0, mailco_dns_guide_1.isPostalSubdomain)("rebornsense.com"), false);
strict_1.default.equal((0, mailco_dns_guide_1.postalSubdomainForApex)("rebornsense.com"), "psrp.rebornsense.com");
const guide = (0, mailco_dns_guide_1.buildMailcoDnsGuide)("m9cdwo@psrp.rebornsense.com");
strict_1.default.ok(guide);
strict_1.default.equal(guide.apexDomain, "rebornsense.com");
strict_1.default.equal(guide.isPostalFromAddress, true);
strict_1.default.ok(guide.records.some((r) => r.id === "postal-spf" && r.value.includes("91.98.126.226")));
strict_1.default.ok(guide.records.some((r) => r.id === "apex-spf" && r.value.includes("spf.postal.mailco.ch")));
const apexGuide = (0, mailco_dns_guide_1.buildMailcoDnsGuide)("noreply@rebornsense.com");
strict_1.default.ok(apexGuide);
strict_1.default.equal(apexGuide.isPostalFromAddress, false);
strict_1.default.ok(apexGuide.recommendations.some((r) => r.includes("mail-tester")));
console.log("mailco-dns-guide.test.ts OK");
//# sourceMappingURL=mailco-dns-guide.test.js.map