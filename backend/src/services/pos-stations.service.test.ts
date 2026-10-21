/**
 * POS floor stations — run: cd backend && npx tsx src/services/pos-stations.service.test.ts
 */
import assert from "node:assert/strict";

function pickDefaultStation(
  stations: Array<{ id: string; isDefault: boolean }>,
  deviceDefaultId: string | null
): string | null {
  if (!stations.length) return null;
  if (deviceDefaultId && stations.some((s) => s.id === deviceDefaultId)) return deviceDefaultId;
  const def = stations.find((s) => s.isDefault);
  if (def) return def.id;
  return stations[0]!.id;
}

assert.equal(pickDefaultStation([], null), null);
assert.equal(
  pickDefaultStation([{ id: "a", isDefault: false }, { id: "b", isDefault: true }], null),
  "b"
);
assert.equal(
  pickDefaultStation([{ id: "a", isDefault: true }, { id: "b", isDefault: false }], "b"),
  "b"
);

console.log("pos-stations.service.test.ts: ok");
