"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CATALOG_VISIBILITY = exports.ALL_CATALOG_CHANNELS = void 0;
exports.normalizeCatalogVisibility = normalizeCatalogVisibility;
exports.isVisibleOnChannel = isVisibleOnChannel;
exports.productVisibleOnChannel = productVisibleOnChannel;
exports.isPreKioskCatalogVisibility = isPreKioskCatalogVisibility;
exports.productVisibleOnKioskChannel = productVisibleOnKioskChannel;
exports.categoryVisibleOnKioskChannel = categoryVisibleOnKioskChannel;
exports.filterCatalogForChannel = filterCatalogForChannel;
exports.filterCatalogForKioskChannel = filterCatalogForKioskChannel;
exports.shopMenuCatalogChannel = shopMenuCatalogChannel;
exports.ALL_CATALOG_CHANNELS = ["pos", "shop", "qr_table", "delivery", "kiosk"];
const CHANNEL_SET = new Set(exports.ALL_CATALOG_CHANNELS);
exports.DEFAULT_CATALOG_VISIBILITY = {
    channels: [...exports.ALL_CATALOG_CHANNELS],
};
function normalizeCatalogVisibility(raw) {
    if (!raw || typeof raw !== "object")
        return { ...exports.DEFAULT_CATALOG_VISIBILITY };
    const src = raw;
    const channelsRaw = src.channels;
    if (!Array.isArray(channelsRaw))
        return { ...exports.DEFAULT_CATALOG_VISIBILITY };
    const channels = channelsRaw
        .map((c) => String(c).trim().toLowerCase())
        .filter((c) => CHANNEL_SET.has(c));
    if (!channels.length)
        return { channels: [] };
    return { channels: [...new Set(channels)] };
}
function isVisibleOnChannel(visibility, channel) {
    const normalized = normalizeCatalogVisibility(visibility);
    if (!normalized.channels.length)
        return false;
    return normalized.channels.includes(channel);
}
function productVisibleOnChannel(product, category, channel) {
    if (product.isActive === false)
        return false;
    if (!isVisibleOnChannel(product.visibility, channel))
        return false;
    if (category && !isVisibleOnChannel(category.visibility, channel))
        return false;
    return true;
}
/** Catalog rows saved before the kiosk channel existed (no explicit kiosk flag). */
function isPreKioskCatalogVisibility(visibility) {
    const normalized = normalizeCatalogVisibility(visibility);
    return normalized.channels.length > 0 && !normalized.channels.includes("kiosk");
}
/** Kiosk menu visibility — honors kiosk channel, with shop/POS fallback for legacy catalogs. */
function productVisibleOnKioskChannel(product, category) {
    if (product.isActive === false)
        return false;
    if (isVisibleOnChannel(product.visibility, "kiosk")) {
        if (category && !isVisibleOnChannel(category.visibility, "kiosk"))
            return false;
        return true;
    }
    if (!isPreKioskCatalogVisibility(product.visibility))
        return false;
    return (productVisibleOnChannel(product, category, "shop") ||
        productVisibleOnChannel(product, category, "pos"));
}
function categoryVisibleOnKioskChannel(category) {
    if (isVisibleOnChannel(category.visibility, "kiosk"))
        return true;
    if (!isPreKioskCatalogVisibility(category.visibility))
        return false;
    return (isVisibleOnChannel(category.visibility, "shop") ||
        isVisibleOnChannel(category.visibility, "pos"));
}
function filterCatalogForChannel(products, categories, channel) {
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const visibleProducts = products.filter((p) => productVisibleOnChannel(p, p.categoryId ? categoryById.get(p.categoryId) : null, channel));
    const categoryIdsWithProducts = new Set(visibleProducts.map((p) => p.categoryId).filter(Boolean));
    const visibleCategories = categories.filter((c) => categoryIdsWithProducts.has(c.id) || isVisibleOnChannel(c.visibility, channel));
    return { products: visibleProducts, categories: visibleCategories };
}
function filterCatalogForKioskChannel(products, categories) {
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const visibleProducts = products.filter((p) => productVisibleOnKioskChannel(p, p.categoryId ? categoryById.get(p.categoryId) : null));
    const categoryIdsWithProducts = new Set(visibleProducts.map((p) => p.categoryId).filter(Boolean));
    const visibleCategories = categories.filter((c) => categoryIdsWithProducts.has(c.id) ||
        c.isOffersCategory ||
        categoryVisibleOnKioskChannel(c));
    return { products: visibleProducts, categories: visibleCategories };
}
/** Map shop fulfillment channel query to catalog visibility channel. */
function shopMenuCatalogChannel(channelParam, tableId) {
    if (tableId)
        return "qr_table";
    const c = String(channelParam || "").toLowerCase();
    if (c === "delivery")
        return "delivery";
    if (c === "kiosk")
        return "kiosk";
    if (c === "dine_in")
        return "qr_table";
    return "shop";
}
//# sourceMappingURL=catalog-visibility.js.map