"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Staff login home validation — run: npx tsx backend/src/lib/staff-login-home.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const staff_login_home_1 = require("./staff-login-home");
const STOREKEEPER_PERMS = ["STOREKEEPER_INTAKE"];
const DELIVERY_PERMS = ["DELIVERY_ORDERS"];
const CASHIER_PERMS = ["USE_WEBPOS", "PROCESS_PAYMENTS"];
// Storekeeper role → POS login home, and validation must not throw
{
    strict_1.default.equal((0, staff_login_home_1.loginHomeFromPermissions)(STOREKEEPER_PERMS, false), "pos");
    strict_1.default.doesNotThrow(() => (0, staff_login_home_1.assertLoginHomeAllowed)("pos", STOREKEEPER_PERMS, false));
}
// Delivery driver → POS login home, and validation must not throw
{
    strict_1.default.equal((0, staff_login_home_1.loginHomeFromPermissions)(DELIVERY_PERMS, false), "pos");
    strict_1.default.doesNotThrow(() => (0, staff_login_home_1.assertLoginHomeAllowed)("pos", DELIVERY_PERMS, false));
}
// Cashier still works
{
    strict_1.default.equal((0, staff_login_home_1.loginHomeFromPermissions)(CASHIER_PERMS, true), "pos");
    strict_1.default.doesNotThrow(() => (0, staff_login_home_1.assertLoginHomeAllowed)("pos", CASHIER_PERMS, true));
}
// Unrelated role cannot use POS login home
{
    strict_1.default.throws(() => (0, staff_login_home_1.assertLoginHomeAllowed)("pos", ["VIEW_REPORTS"], true), /POS login requires register or waiter permissions/);
}
console.log("staff-login-home: all assertions passed");
//# sourceMappingURL=staff-login-home.test.js.map