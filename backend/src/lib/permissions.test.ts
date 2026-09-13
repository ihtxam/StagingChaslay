/**
 * Role permission persistence — run: npx tsx backend/src/lib/permissions.test.ts
 */
import assert from "node:assert/strict";
import {
  ALL_PERMISSIONS,
  applyRolePermissionPolicy,
  encodePermissions,
  normalizePermissions,
  parsePermissions,
  waiterSystemKind,
} from "./permissions";

{
  const spaced = "USE_POS, USE_WEBPOS, MANAGE_PRODUCTS";
  assert.deepEqual(parsePermissions(spaced), ["USE_POS", "USE_WEBPOS", "MANAGE_PRODUCTS"]);
}

{
  const fromArray = normalizePermissions([" USE_POS ", "BOGUS", "MANAGE_PRODUCTS", "USE_POS"]);
  assert.deepEqual(fromArray, ["USE_POS", "MANAGE_PRODUCTS"]);
  const fromString = normalizePermissions("ACCESS_PANEL, VIEW_REPORTS, not-a-perm");
  assert.deepEqual(fromString, ["VIEW_REPORTS", "ACCESS_PANEL"]);
}

{
  const encoded = encodePermissions([...ALL_PERMISSIONS].reverse());
  assert.equal(parsePermissions(encoded).length, ALL_PERMISSIONS.length);
  assert.deepEqual(parsePermissions(encoded), [...ALL_PERMISSIONS]);
}

{
  assert.equal(waiterSystemKind("Waiter + menu editor"), "menu-editor");
  assert.equal(waiterSystemKind("Waiter"), "pos-only");
  const granted = normalizePermissions(ALL_PERMISSIONS);
  assert.deepEqual(
    applyRolePermissionPolicy("Waiter + menu editor", granted),
    granted,
    "Waiter + menu editor must keep merchant-saved permissions"
  );
  assert.deepEqual(applyRolePermissionPolicy("Waiter", granted), granted);
}

{
  const storekeeper = applyRolePermissionPolicy("Storekeeper", [
    "STOREKEEPER_INTAKE",
    "ACCESS_PANEL",
    "MANAGE_SETTINGS",
  ]);
  assert.deepEqual(storekeeper, ["STOREKEEPER_INTAKE"]);
}

console.log("permissions: all assertions passed");
