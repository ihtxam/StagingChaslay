import type { EditionFeatureKey } from "@/lib/edition-features";
import { ALL_EDITION_FEATURES } from "@/lib/edition-features";

/** Merchant commercial package — drives shop, website CMS, and POS surfaces. */
export type MerchantProductSurface =
  | "shop_only"
  | "website_only"
  | "shop_website"
  | "full_pos";

export const MERCHANT_PRODUCT_SURFACES: MerchantProductSurface[] = [
  "shop_only",
  "website_only",
  "shop_website",
  "full_pos",
];

const POS_FEATURES = ALL_EDITION_FEATURES.filter((k) => k.startsWith("pos_"));

const SHOP_FEATURES: EditionFeatureKey[] = [
  "online_shop",
  "online_payments",
  "channel_takeaway",
  "channel_delivery",
  "channel_online_orders",
  "offers",
  "loyalty",
  "gift_cards",
  "reports",
  "staff_roles",
  "reservations",
];

const WEBSITE_FEATURES: EditionFeatureKey[] = ["website_cms"];

export type ProductSurfacePreset = {
  label: string;
  description: string;
  editionName: string;
  shopEnabled: boolean;
  cmsHomepageEnabled: boolean;
  maxPosPosts: number;
  features: EditionFeatureKey[];
};

export const PRODUCT_SURFACE_PRESETS: Record<MerchantProductSurface, ProductSurfacePreset> = {
  shop_only: {
    label: "Shop only",
    description: "Online ordering kiosk/QR — Order Center, no till (WebPOS hidden).",
    editionName: "Shop only (no POS)",
    shopEnabled: true,
    cmsHomepageEnabled: false,
    maxPosPosts: 0,
    features: [...SHOP_FEATURES],
  },
  website_only: {
    label: "Website / CMS only",
    description: "Published homepage and pages — menu ordering optional off.",
    editionName: "Website CMS only",
    shopEnabled: true,
    cmsHomepageEnabled: true,
    maxPosPosts: 0,
    features: [...WEBSITE_FEATURES, "online_shop", "reports", "staff_roles"],
  },
  shop_website: {
    label: "Shop + Website",
    description: "Online shop plus CMS homepage — Order Center, no POS till.",
    editionName: "Shop + Website (no POS)",
    shopEnabled: true,
    cmsHomepageEnabled: true,
    maxPosPosts: 0,
    features: [...SHOP_FEATURES, ...WEBSITE_FEATURES],
  },
  full_pos: {
    label: "Shop + Website + POS",
    description: "Full till (WebPOS), online shop, and website CMS.",
    editionName: "Full POS + Shop",
    shopEnabled: true,
    cmsHomepageEnabled: true,
    maxPosPosts: 1,
    features: [...ALL_EDITION_FEATURES],
  },
};

export function isMerchantProductSurface(raw: unknown): raw is MerchantProductSurface {
  return typeof raw === "string" && MERCHANT_PRODUCT_SURFACES.includes(raw as MerchantProductSurface);
}

/** Guess surface from merchant flags (for display). */
export function inferProductSurface(input: {
  shopEnabled?: boolean | null;
  cmsHomepageEnabled?: boolean | null;
  maxPosPosts?: number | null;
  hasPosEdition?: boolean;
}): MerchantProductSurface | null {
  const hasPos =
    Math.max(0, Number(input.maxPosPosts) || 0) > 0 || !!input.hasPosEdition;
  const shop = !!input.shopEnabled;
  const cms = !!input.cmsHomepageEnabled;
  if (hasPos) return "full_pos";
  if (shop && cms) return "shop_website";
  if (cms) return "website_only";
  if (shop) return "shop_only";
  return null;
}
