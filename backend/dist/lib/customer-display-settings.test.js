"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const customer_display_settings_1 = require("./customer-display-settings");
const origin = "https://app.rebornsense.com";
strict_1.default.equal((0, customer_display_settings_1.buildCdsPublicUrl)("exotic-market", "48291", origin), "https://app.rebornsense.com/cds/m/exotic-market");
strict_1.default.equal((0, customer_display_settings_1.buildCdsPublicUrl)(null, "48291", origin), "https://app.rebornsense.com/cds/48291");
console.log("customer-display-settings.test.ts ok");
//# sourceMappingURL=customer-display-settings.test.js.map