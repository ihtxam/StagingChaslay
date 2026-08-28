"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CATALOG_VISIBILITY = exports.ALL_CATALOG_CHANNELS = void 0;
exports.normalizeCatalogVisibility = normalizeCatalogVisibility;
exports.isVisibleOnChannel = isVisibleOnChannel;
exports.productVisibleOnChannel = productVisibleOnChannel;
exports.filterCatalogForChannel = filterCatalogForChannel;
exports.shopMenuCatalogChannel = shopMenuCatalogChannel;
exports.ALL_CATALOG_CHANNELS = ["pos", "shop", "qr_table", "delivery"];
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
function filterCatalogForChannel(products, categories, channel) {
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const visibleProducts = products.filter((p) => productVisibleOnChannel(p, p.categoryId ? categoryById.get(p.categoryId) : null, channel));
    const categoryIdsWithProducts = new Set(visibleProducts.map((p) => p.categoryId).filter(Boolean));
    const visibleCategories = categories.filter((c) => categoryIdsWithProducts.has(c.id) || isVisibleOnChannel(c.visibility, channel));
    return { products: visibleProducts, categories: visibleCategories };
}
/** Map shop fulfillment channel query to catalog visibility channel. */
function shopMenuCatalogChannel(channelParam, tableId) {
    if (tableId)
        return "qr_table";
    const c = String(channelParam || "").toLowerCase();
    if (c === "delivery")
        return "delivery";
    if (c === "dine_in")
        return "qr_table";
    return "shop";
}
//# sourceMappingURL=catalog-visibility.js.map