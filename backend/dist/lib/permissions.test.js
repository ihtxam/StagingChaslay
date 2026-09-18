"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Role permission persistence — run: npx tsx backend/src/lib/permissions.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const permissions_1 = require("./permissions");
{
    const spaced = "USE_POS, USE_WEBPOS, MANAGE_PRODUCTS";
    strict_1.default.deepEqual((0, permissions_1.parsePermissions)(spaced), ["USE_POS", "USE_WEBPOS", "MANAGE_PRODUCTS"]);
}
{
    const fromArray = (0, permissions_1.normalizePermissions)([" USE_POS ", "BOGUS", "MANAGE_PRODUCTS", "USE_POS"]);
    strict_1.default.deepEqual(fromArray, ["USE_POS", "MANAGE_PRODUCTS"]);
    const fromString = (0, permissions_1.normalizePermissions)("ACCESS_PANEL, VIEW_REPORTS, not-a-perm");
    strict_1.default.deepEqual(fromString, ["VIEW_REPORTS", "ACCESS_PANEL"]);
}
{
    const encoded = (0, permissions_1.encodePermissions)([...permissions_1.ALL_PERMISSIONS].reverse());
    strict_1.default.equal((0, permissions_1.parsePermissions)(encoded).length, permissions_1.ALL_PERMISSIONS.length);
    strict_1.default.deepEqual((0, permissions_1.parsePermissions)(encoded), [...permissions_1.ALL_PERMISSIONS]);
}
{
    strict_1.default.equal((0, permissions_1.waiterSystemKind)("Waiter + menu editor"), "menu-editor");
    strict_1.default.equal((0, permissions_1.waiterSystemKind)("Waiter"), "pos-only");
    const granted = (0, permissions_1.normalizePermissions)(permissions_1.ALL_PERMISSIONS);
    strict_1.default.deepEqual((0, permissions_1.applyRolePermissionPolicy)("Waiter + menu editor", granted), granted, "Waiter + menu editor must keep merchant-saved permissions");
    strict_1.default.deepEqual((0, permissions_1.applyRolePermissionPolicy)("Waiter", granted), granted);
}
{
    const storekeeper = (0, permissions_1.applyRolePermissionPolicy)("Storekeeper", [
        "STOREKEEPER_INTAKE",
        "ACCESS_PANEL",
        "MANAGE_SETTINGS",
    ]);
    strict_1.default.deepEqual(storekeeper, ["STOREKEEPER_INTAKE"]);
}
console.log("permissions: all assertions passed");
//# sourceMappingURL=permissions.test.js.map