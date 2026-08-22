"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CATEGORY_PALETTE = void 0;
exports.paletteColorAt = paletteColorAt;
exports.isValidHexColor = isValidHexColor;
exports.normalizeHexColor = normalizeHexColor;
/** Pastel palette assigned automatically when categories are created without a color. */
exports.CATEGORY_PALETTE = [
    "#f9a8d4",
    "#86efac",
    "#fde68a",
    "#fdba74",
    "#c4b5fd",
    "#67e8f9",
    "#fca5a5",
    "#a5b4fc",
    "#bef264",
    "#fcd34d",
    "#fda4af",
    "#6ee7b7",
];
function paletteColorAt(index) {
    return exports.CATEGORY_PALETTE[Math.abs(index) % exports.CATEGORY_PALETTE.length];
}
function isValidHexColor(value) {
    if (!value)
        return false;
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}
function normalizeHexColor(value) {
    const hex = value.trim();
    if (hex.length === 4) {
        return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    return hex;
}
//# sourceMappingURL=category-colors.js.map