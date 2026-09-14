"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * POS session takeover — run: cd backend && npx tsx src/services/pos-sessions-takeover.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
/** Mirrors enforceLimit eviction count (last login wins). */
function sessionsToEvict(activeAfterSameDeviceCleanup, max) {
    if (max <= 0 || activeAfterSameDeviceCleanup < max)
        return 0;
    return activeAfterSameDeviceCleanup - max + 1;
}
strict_1.default.equal(sessionsToEvict(0, 1), 0);
strict_1.default.equal(sessionsToEvict(1, 2), 0);
strict_1.default.equal(sessionsToEvict(1, 1), 1, "single-seat POS: new login kicks the other station");
strict_1.default.equal(sessionsToEvict(2, 2), 1, "two-seat POS at capacity: one oldest session evicted");
strict_1.default.equal(sessionsToEvict(3, 2), 2, "over capacity: evict down to max-1 before insert");
strict_1.default.equal(sessionsToEvict(5, 0), 0, "max 0 = unlimited");
console.log("pos-sessions-takeover.test.ts: ok");
//# sourceMappingURL=pos-sessions-takeover.test.js.map