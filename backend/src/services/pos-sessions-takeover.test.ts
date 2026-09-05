/**
 * POS session takeover — run: cd backend && npx tsx src/services/pos-sessions-takeover.test.ts
 */
import assert from "node:assert/strict";

/** Mirrors enforceLimit eviction count (last login wins). */
function sessionsToEvict(activeAfterSameDeviceCleanup: number, max: number): number {
  if (max <= 0 || activeAfterSameDeviceCleanup < max) return 0;
  return activeAfterSameDeviceCleanup - max + 1;
}

assert.equal(sessionsToEvict(0, 1), 0);
assert.equal(sessionsToEvict(1, 2), 0);
assert.equal(sessionsToEvict(1, 1), 1, "single-seat POS: new login kicks the other station");
assert.equal(sessionsToEvict(2, 2), 1, "two-seat POS at capacity: one oldest session evicted");
assert.equal(sessionsToEvict(3, 2), 2, "over capacity: evict down to max-1 before insert");
assert.equal(sessionsToEvict(5, 0), 0, "max 0 = unlimited");

console.log("pos-sessions-takeover.test.ts: ok");
