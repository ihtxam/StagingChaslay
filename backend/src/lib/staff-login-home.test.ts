/**
 * Staff login home validation — run: npx tsx backend/src/lib/staff-login-home.test.ts
 */
import assert from "node:assert/strict";
import {
  assertLoginHomeAllowed,
  loginHomeFromPermissions,
} from "./staff-login-home";

const STOREKEEPER_PERMS = ["STOREKEEPER_INTAKE"];
const DELIVERY_PERMS = ["DELIVERY_ORDERS"];
const CASHIER_PERMS = ["USE_WEBPOS", "PROCESS_PAYMENTS"];

// Storekeeper role → POS login home, and validation must not throw
{
  assert.equal(loginHomeFromPermissions(STOREKEEPER_PERMS, false), "pos");
  assert.doesNotThrow(() =>
    assertLoginHomeAllowed("pos", STOREKEEPER_PERMS, false)
  );
}

// Delivery driver → POS login home, and validation must not throw
{
  assert.equal(loginHomeFromPermissions(DELIVERY_PERMS, false), "pos");
  assert.doesNotThrow(() => assertLoginHomeAllowed("pos", DELIVERY_PERMS, false));
}

// Cashier still works
{
  assert.equal(loginHomeFromPermissions(CASHIER_PERMS, true), "pos");
  assert.doesNotThrow(() => assertLoginHomeAllowed("pos", CASHIER_PERMS, true));
}

// Unrelated role cannot use POS login home
{
  assert.throws(
    () => assertLoginHomeAllowed("pos", ["VIEW_REPORTS"], true),
    /POS login requires register or waiter permissions/
  );
}

console.log("staff-login-home: all assertions passed");
