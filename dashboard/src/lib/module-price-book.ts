/** Keep in sync with backend/src/lib/module-price-book.ts */

export type ModulePriceKey =
  | "pos_seats"
  | "shop"
  | "website"
  | "reservations"
  | "kds"
  | "ods"
  | "loyalty"
  | "gift_cards"
  | "delivery_platforms"
  | "photo_menu";

export type ModulePriceEntry = {
  key: ModulePriceKey;
  label: string;
  description: string;
  group: "core" | "guest" | "service";
  suggestedMonthlyChf: number;
  addonKey?: string;
};

export const MODULE_PRICE_BOOK: ModulePriceEntry[] = [
  {
    key: "pos_seats",
    label: "POS seats",
    description: "Each till / handheld. Feature tier is the POS version (Restaurant Pro, Retail Basic).",
    group: "core",
    suggestedMonthlyChf: 55,
  },
  {
    key: "shop",
    label: "Online shop (Order)",
    description: "First-party ordering, QR, Google Order link. Same catalog as POS.",
    group: "guest",
    suggestedMonthlyChf: 49,
    addonKey: "shop",
  },
  {
    key: "website",
    label: "Website / CMS",
    description: "Homepage and pages with Order / Reserve buttons into the shop.",
    group: "guest",
    suggestedMonthlyChf: 39,
    addonKey: "website",
  },
  {
    key: "reservations",
    label: "Reservations + waitlist",
    description: "Flat monthly booking. Live-links POS tables. No per-cover fee.",
    group: "guest",
    suggestedMonthlyChf: 49,
    addonKey: "reservations",
  },
  {
    key: "photo_menu",
    label: "Photo menu (table QR)",
    description: "Guests scan the table QR, browse photos, order. Staff approve on POS → KDS.",
    group: "guest",
    suggestedMonthlyChf: 29,
    addonKey: "kiosk",
  },
  {
    key: "kds",
    label: "Kitchen display (KDS)",
    description: "Every channel (POS, shop, QR, delivery) hits one kitchen screen.",
    group: "service",
    suggestedMonthlyChf: 29,
    addonKey: "kds",
  },
  {
    key: "ods",
    label: "Order display (ODS)",
    description: "Expo / pickup screen for ready orders.",
    group: "service",
    suggestedMonthlyChf: 19,
    addonKey: "ods",
  },
  {
    key: "loyalty",
    label: "Loyalty",
    description: "Earn and redeem on POS, shop, and website.",
    group: "guest",
    suggestedMonthlyChf: 29,
    addonKey: "guest_crm",
  },
  {
    key: "gift_cards",
    label: "Gift cards",
    description: "Sell and redeem e-gift cards in shop and POS.",
    group: "guest",
    suggestedMonthlyChf: 19,
  },
  {
    key: "delivery_platforms",
    label: "Just Eat / Uber Eats",
    description: "Aggregator orders land on POS and the same KDS.",
    group: "service",
    suggestedMonthlyChf: 25,
    addonKey: "just_eat",
  },
];
