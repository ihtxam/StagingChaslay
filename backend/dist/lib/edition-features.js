"use strict";
/**
 * SaaS edition feature catalog ? capability gates (not staff RBAC).
 * Keep in sync with dashboard/src/lib/edition-features.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EDITION_ROUTE_FEATURES = exports.ALL_EDITION_FEATURES = exports.EDITION_FEATURE_GROUPS = void 0;
exports.normalizeEditionFeatures = normalizeEditionFeatures;
exports.hasEditionFeature = hasEditionFeature;
exports.hasAnyEditionFeature = hasAnyEditionFeature;
exports.canAccessEditionRoute = canAccessEditionRoute;
exports.retailDefaultsFromFeatures = retailDefaultsFromFeatures;
exports.EDITION_FEATURE_GROUPS = [
    {
        id: "pos",
        label: "POS",
        features: [
            { key: "pos_tables", label: "Tables / floor plan" },
            { key: "pos_courses", label: "Courses" },
            { key: "pos_shifts", label: "Shift management" },
            { key: "pos_kitchen", label: "Kitchen tickets" },
            { key: "pos_express", label: "Express checkout" },
            { key: "pos_retail", label: "Retail mode" },
            { key: "pos_cash_drawer", label: "Cash drawer" },
            { key: "pos_tips", label: "Tips" },
            { key: "pos_gift_cards", label: "Gift cards at POS" },
        ],
    },
    {
        id: "channels",
        label: "Channels",
        features: [
            { key: "channel_takeaway", label: "Takeaway" },
            { key: "channel_delivery", label: "Delivery" },
            { key: "channel_online_orders", label: "Online orders" },
        ],
    },
    {
        id: "commerce",
        label: "Commerce",
        features: [
            { key: "online_shop", label: "Online shop" },
            { key: "online_payments", label: "Online payments" },
            { key: "gift_cards", label: "Gift cards module" },
            { key: "loyalty", label: "Loyalty / membership" },
            { key: "offers", label: "Offers / promotions" },
        ],
    },
    {
        id: "ops",
        label: "Operations",
        features: [
            { key: "reports", label: "Reports / end of day" },
            { key: "staff_roles", label: "Staff & roles" },
            { key: "reservations", label: "Reservations" },
            { key: "website_cms", label: "Website / CMS" },
            { key: "inventory", label: "Restaurant inventory (paid addon)" },
            { key: "digital_signage", label: "Digital signage / menu boards (paid addon)" },
        ],
    },
];
exports.ALL_EDITION_FEATURES = exports.EDITION_FEATURE_GROUPS.flatMap((g) => g.features.map((f) => f.key));
/**
 * Merchant panel routes gated by edition features.
 * Do not add /merchant/inventory or /merchant/signage here ? those are paid
 * merchant addons (inventory_addon_enabled / signage_addon_enabled), not edition entitlements.
 */
exports.EDITION_ROUTE_FEATURES = {
    "/merchant/floor-plan": ["pos_tables"],
    "/merchant/tables": ["pos_tables"],
    "/merchant/tables/settings": ["pos_tables"],
    "/merchant/tables/layout": ["pos_tables"],
    "/merchant/tables/qr": ["pos_tables"],
    "/merchant/loyalty": ["loyalty", "gift_cards"],
    "/merchant/offers": ["offers"],
    "/merchant/newsletter": ["online_shop"],
    "/merchant/online-shop": ["online_shop"],
    "/merchant/website": ["website_cms"],
    "/merchant/reservations": ["reservations"],
    "/merchant/reports": ["reports"],
    "/merchant/users": ["staff_roles"],
};
function normalizeEditionFeatures(input) {
    if (!Array.isArray(input))
        return [...exports.ALL_EDITION_FEATURES];
    const allowed = new Set(exports.ALL_EDITION_FEATURES);
    const out = [];
    for (const raw of input) {
        const key = String(raw || "").trim();
        if (allowed.has(key) && !out.includes(key)) {
            out.push(key);
        }
    }
    return out;
}
function hasEditionFeature(features, required) {
    // null/undefined = legacy full access
    if (features == null)
        return true;
    return features.includes(required);
}
function hasAnyEditionFeature(features, required) {
    if (features == null)
        return true;
    if (!required.length)
        return true;
    return required.some((k) => features.includes(k));
}
function canAccessEditionRoute(path, features) {
    const required = exports.EDITION_ROUTE_FEATURES[path];
    if (!required?.length)
        return true;
    return hasAnyEditionFeature(features, required);
}
/** Defaults applied when assigning a retail-oriented edition */
function retailDefaultsFromFeatures(features) {
    const hasTables = features.includes("pos_tables");
    return {
        floorPlanEnabled: hasTables,
        coursesEnabled: features.includes("pos_courses"),
        reservationsEnabled: features.includes("reservations"),
        shopEnabled: features.includes("online_shop"),
        pickupEnabled: features.includes("channel_takeaway"),
        deliveryEnabled: features.includes("channel_delivery"),
        loyaltyEnabled: features.includes("loyalty"),
        webposGiftCardEnabled: features.includes("pos_gift_cards") || features.includes("gift_cards"),
        posMode: features.includes("pos_retail") && !hasTables ? "retail" : "restaurant",
    };
}
//# sourceMappingURL=edition-features.js.map