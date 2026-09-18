/** Default restaurant homepage Craft.js state for legacy CMS bootstrap. */

type CraftNode = Record<string, unknown>;

const SECTION = {
  home: "home",
  menu: "menu",
  about: "about",
  openingHours: "opening-hours",
  reservations: "reservations",
  footer: "footer",
} as const;

function node(
  id: string,
  resolvedName: string,
  props: Record<string, unknown>,
  parent: string,
  childIds: string[] = [],
  isCanvas = false
): CraftNode {
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

export type DefaultRestaurantTemplateInput = {
  merchantName: string;
  logoUrl?: string | null;
  phone?: string | null;
  address?: string | null;
};

export function buildDefaultRestaurantTemplate(input: DefaultRestaurantTemplateInput): string {
  const merchantName = input.merchantName.trim() || "Restaurant";
  const ids: string[] = [];
  const parts: CraftNode[] = [];
  let i = 0;
  const nextId = () => `tpl-${++i}`;

  const add = (resolvedName: string, props: Record<string, unknown> = {}) => {
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

  const state: CraftNode = {
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
  for (const part of parts) Object.assign(state, part);
  return JSON.stringify(state);
}
