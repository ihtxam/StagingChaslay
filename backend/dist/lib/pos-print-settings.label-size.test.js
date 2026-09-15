"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const pos_print_settings_1 = require("./pos-print-settings");
strict_1.default.equal((0, pos_print_settings_1.parseLabelWidthMm)(100), 100);
strict_1.default.equal((0, pos_print_settings_1.parseLabelWidthMm)(80), 80);
strict_1.default.equal((0, pos_print_settings_1.parseLabelWidthMm)(12), 40);
strict_1.default.equal((0, pos_print_settings_1.parseLabelHeightMm)(150), 150);
strict_1.default.equal((0, pos_print_settings_1.parseLabelHeightMm)(50), 50);
strict_1.default.equal((0, pos_print_settings_1.parseLabelHeightMm)(99), 20);
const settings = (0, pos_print_settings_1.normalizePosPrintSettings)({
    labelWidthMm: 100,
    labelHeightMm: 50,
    printers: [{ id: "p1", name: "EML-400L (4inch)", printLabels: true }],
});
strict_1.default.equal(settings.labelWidthMm, 100);
strict_1.default.equal(settings.labelHeightMm, 50);
strict_1.default.equal(settings.printers?.[0]?.printLabels, true);
console.log("pos-print-settings label sizes: ok");
//# sourceMappingURL=pos-print-settings.label-size.test.js.map