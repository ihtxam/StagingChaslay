"use strict";
/** Default restaurant homepage Craft.js state for legacy CMS bootstrap. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDefaultRestaurantTemplate = buildDefaultRestaurantTemplate;
const SECTION = {
    home: "home",
    menu: "menu",
    about: "about",
    openingHours: "opening-hours",
    reservations: "reservations",
    footer: "footer",
};
function node(id, resolvedName, props, parent, childIds = [], isCanvas = false) {
    return {
        [id]: {
            type: { resolvedName },
            isCanvas,
            props,
            displayName: resolvedName,
            custom: {},
            hidden: false,
            nodes: childIds,
            linkedNodes: {},
            parent,
        },
    };
}
function buildDefaultRestaurantTemplate(input) {
    const merchantName = input.merchantName.trim() || "Restaurant";
    const ids = [];
    const parts = [];
    let i = 0;
    const nextId = () => `tpl-${++i}`;
    const add = (resolvedName, props = {}) => {
        const id = nextId();
        ids.push(id);
        parts.push(node(id, resolvedName, props, "ROOT"));
        return id;
    };
    add("NavbarModern", {
        logoUrl: input.logoUrl || "",
        logoText: merchantName,
    });
    add("HeroBanner", {
        sectionId: SECTION.home,
        title: merchantName,
        subtitle: "Fresh ingredients, unforgettable flavours",
        backgroundColor: "#7f1d1d",
        textColor: "#ffffff",
        buttonText: "View Menu",
        buttonLink: "/menu",
        buttonColor: "#f97316",
        minHeight: 420,
        overlayOpacity: 55,
        textAlign: "center",
    });
    add("MenuList", {
        sectionId: SECTION.menu,
        title: "Our Menu",
        subtitle: "Chef specials and guest favourites",
        backgroundColor: "#fff7ed",
        textColor: "#1a1a2e",
        accentColor: "#f97316",
        buttonText: "Order Online",
        buttonLink: "/menu",
    });
    add("AboutUsModern", {
        sectionId: SECTION.about,
        title: "Our Story",
        subtitle: "Passion on every plate",
    });
    add("ReservationForm", {
        sectionId: SECTION.reservations,
        title: "Reserve a Table",
        subtitle: "Book your dining experience with us",
        backgroundColor: "#450a0a",
        textColor: "#ffffff",
        accentColor: "#f97316",
        buttonColor: "#f97316",
        buttonText: "Book Now",
        layout: "full",
    });
    add("HoursClassic", {
        sectionId: SECTION.openingHours,
        title: "Opening Hours",
        showStatus: true,
    });
    add("FooterModern", {
        sectionId: SECTION.footer,
        logoText: merchantName,
        logoUrl: input.logoUrl || "",
        phone: input.phone || "",
        address: input.address || "",
        copyrightText: `© ${new Date().getFullYear()} ${merchantName}. All rights reserved.`,
    });
    const state = {
        ROOT: {
            type: { resolvedName: "RootContainer" },
            isCanvas: true,
            props: { background: "#fff7ed", minHeight: 600 },
            displayName: "RootContainer",
            custom: {},
            hidden: false,
            nodes: ids,
            linkedNodes: {},
        },
    };
    for (const part of parts)
        Object.assign(state, part);
    return JSON.stringify(state);
}
//# sourceMappingURL=chaslay-default-template.js.map