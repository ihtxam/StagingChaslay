"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const pos_print_settings_1 = require("./pos-print-settings");
const defaults = (0, pos_print_settings_1.normalizePosPrintSettings)({});
strict_1.default.equal(defaults.orderLabelEnabled, false);
strict_1.default.equal(defaults.autoPrintOrderLabelOnHold, true);
strict_1.default.equal(defaults.autoPrintOrderLabelOnSend, false);
const enabled = (0, pos_print_settings_1.normalizePosPrintSettings)({
    orderLabelEnabled: true,
    autoPrintOrderLabelOnHold: false,
    autoPrintOrderLabelOnSend: true,
});
strict_1.default.equal(enabled.orderLabelEnabled, true);
strict_1.default.equal(enabled.autoPrintOrderLabelOnHold, false);
strict_1.default.equal(enabled.autoPrintOrderLabelOnSend, true);
console.log("pos-print-settings order labels: ok");
//# sourceMappingURL=pos-print-settings.order-labels.test.js.map