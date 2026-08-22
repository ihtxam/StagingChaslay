"use strict";
/** Table QR stand download defaults (merchant dashboard). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TABLE_QR_SETTINGS = void 0;
exports.normalizeTableQrSettings = normalizeTableQrSettings;
exports.DEFAULT_TABLE_QR_SETTINGS = {
    headerText: "MENU",
    subtitleText: "Scan me to order",
    layoutTemplate: "vertical",
};
const LAYOUTS = ["vertical", "horizontal", "curved"];
function normalizeTableQrSettings(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const layout = String(src.layoutTemplate || "").toLowerCase();
    return {
        headerText: String(src.headerText ?? exports.DEFAULT_TABLE_QR_SETTINGS.headerText).trim().slice(0, 80) ||
            exports.DEFAULT_TABLE_QR_SETTINGS.headerText,
        subtitleText: String(src.subtitleText ?? exports.DEFAULT_TABLE_QR_SETTINGS.subtitleText).trim().slice(0, 120) ||
            exports.DEFAULT_TABLE_QR_SETTINGS.subtitleText,
        layoutTemplate: LAYOUTS.includes(layout)
            ? layout
            : exports.DEFAULT_TABLE_QR_SETTINGS.layoutTemplate,
    };
}
//# sourceMappingURL=table-qr-settings.js.map