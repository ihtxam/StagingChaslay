"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Custom domain host matching — run: cd backend && npx tsx src/lib/domain.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const domain_ts_1 = require("./domain.ts");
strict_1.default.equal((0, domain_ts_1.normalizeCustomDomain)("https://WWW.BrazzaPizza.ch/menu"), "brazzapizza.ch");
strict_1.default.equal((0, domain_ts_1.normalizeCustomDomain)("www.mycafe.ch"), "mycafe.ch");
strict_1.default.equal((0, domain_ts_1.normalizeCustomDomain)("mycafe.ch"), "mycafe.ch");
strict_1.default.deepEqual((0, domain_ts_1.customDomainHostVariants)("brazzapizza.ch"), [
    "brazzapizza.ch",
    "www.brazzapizza.ch",
]);
strict_1.default.deepEqual((0, domain_ts_1.customDomainHostVariants)("www.brazzapizza.ch"), [
    "www.brazzapizza.ch",
    "brazzapizza.ch",
]);
strict_1.default.equal((0, domain_ts_1.customDomainMatches)("www.brazzapizza.ch", "brazzapizza.ch"), true);
strict_1.default.equal((0, domain_ts_1.customDomainMatches)("brazzapizza.ch", "www.brazzapizza.ch"), true);
strict_1.default.equal((0, domain_ts_1.customDomainMatches)("other.ch", "brazzapizza.ch"), false);
console.log("domain.test.ts OK");
//# sourceMappingURL=domain.test.js.map