"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CATALOG_VISIBILITY = exports.CATALOG_VISIBILITY_UI_CHANNELS = exports.ALL_CATALOG_CHANNELS = void 0;
exports.normalizeCatalogVisibility = normalizeCatalogVisibility;
exports.normalizeMenuCatalogChannels = normalizeMenuCatalogChannels;
exports.menuIncludesCatalogChannel = menuIncludesCatalogChannel;
exports.isVisibleOnChannel = isVisibleOnChannel;
exports.productVisibleOnChannel = productVisibleOnChannel;
exports.isPreKioskCatalogVisibility = isPreKioskCatalogVisibility;
exports.productVisibleOnKioskChannel = productVisibleOnKioskChannel;
exports.categoryVisibleOnKioskChannel = categoryVisibleOnKioskChannel;
exports.filterCatalogForChannel = filterCatalogForChannel;
exports.filterCatalogForKioskChannel = filterCatalogForKioskChannel;
exports.shopMenuCatalogChannel = shopMenuCatalogChannel;
/** All channels stored in DB (legacy rows may still list delivery). */
exports.ALL_CATALOG_CHANNELS = ["pos", "shop", "qr_table", "delivery", "kiosk"];
/** Channels shown in merchant UI — delivery is controlled via shop pickup/delivery settings. */
exports.CATALOG_VISIBILITY_UI_CHANNELS = ["pos", "shop", "qr_table", "kiosk"];
const CHANNEL_SET = new Set(exports.ALL_CATALOG_CHANNELS);
exports.DEFAULT_CATALOG_VISIBILITY = {
    channels: [...exports.CATALOG_VISIBILITY_UI_CHANNELS],
};
function collapseDeliveryIntoShop(channels) {
    const set = new Set(channels);
    if (set.delete("delivery")) {
        set.add("shop");
    }
    return [...set];
}
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
        return { ...exports.DEFAULT_CATALOG_VISIBILITY };
    return { channels: collapseDeliveryIntoShop([...new Set(channels)]) };
}
/** Normalize schedule-menu / HQ menu channel list (delivery → shop). */
function normalizeMenuCatalogChannels(channels) {
    if (!Array.isArray(channels))
        return [];
    const out = new Set();
    for (const c of channels) {
        const k = String(c || "").trim().toLowerCase();
        if (k === "delivery") {
            out.add("shop");
            continue;
        }
        if (CHANNEL_SET.has(k))
            out.add(k);
    }
    return [...out];
}
function menuIncludesCatalogChannel(menuChannels, channel) {
    const normalized = normalizeMenuCatalogChannels(menuChannels);
    if (!normalized.length)
        return true;
    return normalized.includes(channel);
}
function isVisibleOnChannel(visibility, channel) {
    const effective = channel === "delivery" ? "shop" : channel;
    const normalized = normalizeCatalogVisibility(visibility);
    if (!normalized.channels.length)
        return false;
    return normalized.channels.includes(effective);
}
function productVisibleOnChannel(product, category, channel) {
    if (product.isActive === false)
        return false;
    if (!isVisibleOnChannel(product.visibility, channel))
        return false;
    // POS honors per-product visibility even when the category omits POS (common after shop-only setup).
    if (channel === "pos")
        return true;
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
    if (c === "kiosk")
        return "kiosk";
    if (c === "dine_in")
        return "qr_table";
    // takeaway, delivery, and default shop checkout → same catalog visibility as online shop
    return "shop";
}
//# sourceMappingURL=catalog-visibility.js.map