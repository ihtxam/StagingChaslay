"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Staff PIN helpers — run: cd backend && npx tsx src/lib/staff-pin-input.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
function normalizePinInput(pin) {
    return String(pin ?? "")
        .trim()
        .replace(/\D/g, "");
}
strict_1.default.equal(normalizePinInput("0000"), "0000");
strict_1.default.equal(normalizePinInput(" 0000 "), "0000");
strict_1.default.equal(normalizePinInput(""), "");
strict_1.default.equal(normalizePinInput(null), "");
console.log("staff-pin-input: all assertions passed");
//# sourceMappingURL=staff-pin-input.test.js.map