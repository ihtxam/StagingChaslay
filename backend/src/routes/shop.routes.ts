import { Router, Request, Response } from "express";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { MerchantSettingsService, type FulfillmentChannel } from "@/services/merchant-settings.service";
import {
  getDisplayHoursNow,
  isChannelOpenNow,
  isWithinChannelHours,
  pointInPolygon,
  type StoreHours,
} from "@/lib/geo";
import { roundMoney2, roundTo005, roundingAdjustment } from "@/lib/money";
import { adjustTaxForOrderDiscount } from "@/lib/tax-discount";
import { ShopCustomerService } from "@/services/shop-customer.service";
import { ShopLoyaltyService } from "@/services/shop-loyalty.service";
import { AdyenService } from "@/services/adyen.service";
import { AuthService } from "@/services/auth.service";
import { ModifierService } from "@/services/modifier.service";
import { CmsService } from "@/services/cms.service";
import { normalizeComboSlots } from "@/lib/combo";
import { isVacationActive, isDateInVacationPeriods, vacationPublicPayload, VACATION_BLOCK_MESSAGE, NOT_ACCEPTING_ORDERS_MESSAGE, NOT_ACCEPTING_RESERVATIONS_MESSAGE } from "@/lib/vacation";
import { geocodeQuery } from "@/lib/geocode";
import { OffersService } from "@/services/offers.service";
import { VoucherService } from "@/services/voucher.service";
import { ShopGiftCardService } from "@/services/shop-gift-card.service";
import { generateWebOrderNumber } from "@/lib/web-order-number";
import {
  filterCatalogForChannel,
  shopMenuCatalogChannel,
} from "@/lib/catalog-visibility";
import {
  buildCategoryDeliveryPricingMap,
  resolveShopItemDeliveryMarkup,
} from "@/lib/shop-delivery-pricing";
import { normalizeTableQrSettings } from "@/lib/table-qr-settings";
import { TableSessionService } from "@/services/table-session.service";
import { resolvePublicAssetUrl } from "@/lib/public-url";

const router = Router();

type ShopExtraSelection = { id: string; name?: string; price?: number };
type ShopComboSelectionInput = {
  slotId: string;
  /** Optional — used as fallback when slotId no longer matches (renamed/re-saved slots) */
  slotName?: string;
  productId: string;
  selectedExtras?: ShopExtraSelection[];
};

function serializeShopModifierGroup(g: any) {
  const pricingType = g.pricingType || "fixed";
  return {
    id: g.id,
    title: g.title,
    pricingType,
    selectionType: g.selectionType || "optional",
    minSelectable: Number(g.minSelectable) || 0,
    maxSelectable: Number(g.maxSelectable) || 1,
    allowMultipleSameItem: !!g.allowMultipleSameItem,
    options: (g.options || [])
      .filter((o: any) => (o.saleStatus || "in_stock") !== "out_of_stock")
      .map((o: any) => ({
        id: o.id,
        name: o.name,
        price: pricingType === "free" ? 0 : parseFloat(o.price?.toString() || "0"),
        isDefault: !!o.isDefault,
      })),
  };
}

function mapShopProduct(
  p: typeof schema.products.$inferSelect,
  modifierGroups: ReturnType<typeof serializeShopModifierGroup>[],
  catalogById?: Map<string, typeof schema.products.$inferSelect>,
  groupsByProduct?: Map<string, ReturnType<typeof serializeShopModifierGroup>[]>
) {
  const extras = Array.isArray(p.extras) ? p.extras : [];
  const isCombo = p.productType === "combo";
  const slots = isCombo ? normalizeComboSlots(p.comboItems) : [];

  const comboSlots = slots.map((slot) => ({
    id: slot.id,
    name: slot.name,
    minPick: slot.minPick,
    maxPick: slot.maxPick,
    options: slot.options
      .map((opt) => {
        const child = catalogById?.get(opt.productId);
        if (!child || child.isActive === false) return null;
        const childGroups = groupsByProduct?.get(child.id) || [];
        const childExtras = Array.isArray(child.extras) ? child.extras : [];
        return {
          productId: child.id,
          name: child.name,
          image: child.imageUrl,
          description: child.description,
          extraPrice: roundMoney2(opt.extraPrice),
          allowExtras: !!child.allowExtras || childGroups.length > 0 || childExtras.length > 0,
          extras: childExtras.map((e) => ({
            id: e.id,
            name: e.name,
            price: Number(e.price) || 0,
          })),
          modifierGroups: childGroups,
        };
      })
      .filter(Boolean),
  })).filter((s) => s.options.length > 0);

  const rewardPts = p.loyaltyRewardPoints != null ? Number(p.loyaltyRewardPoints) : null;
  const specifications = Array.isArray(p.specifications)
    ? p.specifications
        .filter((s: any) => s?.name?.trim() && (s.saleStatus || "in_stock") !== "out_of_stock")
        .map((s: any, i: number) => ({
          id: s.id || `spec-${i + 1}`,
          name: s.name.trim(),
          price: roundMoney2(Number(s.price) || 0),
          saleStatus: s.saleStatus || "in_stock",
          isDefault: !!s.isDefault,
          sortOrder: Number(s.sortOrder) || i,
        }))
    : [];
  return {
    id: p.id,
    name: p.name,
    price: parseFloat(p.price.toString()),
    description: p.description,
    image: p.imageUrl,
    categoryId: p.categoryId || null,
    productType: p.productType || "standard",
    allowExtras: !!p.allowExtras || modifierGroups.length > 0 || extras.length > 0,
    extras: extras.map((e) => ({
      id: e.id,
      name: e.name,
      price: Number(e.price) || 0,
    })),
    specifications,
    modifierGroups,
    comboSlots: isCombo ? comboSlots : [],
    loyaltyRewardPoints:
      rewardPts != null && Number.isFinite(rewardPts) && rewardPts >= 1 ? Math.floor(rewardPts) : null,
  };
}

function withPublicShopImageUrls(
  req: Request,
  item: ReturnType<typeof mapShopProduct>
): ReturnType<typeof mapShopProduct> {
  const comboSlots = item.comboSlots?.map((slot) => ({
    ...slot,
    options: slot.options.map((opt) => ({
      ...opt,
      image: resolvePublicAssetUrl(req, opt.image) || opt.image,
    })),
  }));
  return {
    ...item,
    image: resolvePublicAssetUrl(req, item.image) || item.image,
    comboSlots: comboSlots ?? item.comboSlots,
  };
}

async function earnLoyaltyForOrder(
  merchant: typeof schema.merchants.$inferSelect,
  order: typeof schema.orders.$inferSelect
) {
  if (!order.customerId) return order;
  if ((order.pointsEarned || 0) > 0) return order;
  const program = ShopLoyaltyService.programFromMerchant(merchant);
  if (!program.enabled) return order;

  const subtotal = parseFloat(order.subtotal?.toString() || "0");
  const pointsDiscount = parseFloat(order.pointsDiscount?.toString() || "0");
  const paidFood = Math.max(0, subtotal - pointsDiscount);
  const points = ShopLoyaltyService.computeEarnPoints(paidFood, program.earnPointsPerChf);
  if (points <= 0) {
    const db = getDb();
    const [updated] = await db
      .update(schema.orders)
      .set({ pointsEarned: 0 })
      .where(eq(schema.orders.id, order.id))
      .returning();
    return updated || order;
  }

  await ShopLoyaltyService.earnPoints({
    merchantId: merchant.id,
    customerId: order.customerId,
    orderId: order.id,
    points,
    expiryDays: program.expiryDays,
    source: "earn",
  });

  const db = getDb();
  const [updated] = await db
    .update(schema.orders)
    .set({ pointsEarned: points })
    .where(eq(schema.orders.id, order.id))
    .returning();
  return updated || { ...order, pointsEarned: points };
}

async function resolveShopComboSelections(
  merchantId: string,
  comboProduct: typeof schema.products.$inferSelect,
  requested: ShopComboSelectionInput[] | undefined
): Promise<{
  selections: Array<{
    slotId: string;
    slotName: string;
    productId: string;
    productName: string;
    extraPrice: number;
    selectedExtras: Array<{ id: string; name: string; price: number }>;
  }>;
  surcharge: number;
  error?: string;
}> {
  const rawSlots = normalizeComboSlots(comboProduct.comboItems);
  if (!rawSlots.length) {
    return { selections: [], surcharge: 0 };
  }

  // Drop options for inactive/missing products (same as public menu), then skip empty slots
  const db = getDb();
  const allOptionIds = [...new Set(rawSlots.flatMap((s) => s.options.map((o) => o.productId)))];
  const activeChildren =
    allOptionIds.length === 0
      ? []
      : await db.query.products.findMany({
          where: and(
            eq(schema.products.merchantId, merchantId),
            inArray(schema.products.id, allOptionIds),
            eq(schema.products.isActive, true)
          ),
        });
  const activeIds = new Set(activeChildren.map((p) => p.id));
  const slots = rawSlots
    .map((s) => ({
      ...s,
      options: s.options.filter((o) => activeIds.has(o.productId)),
    }))
    .filter((s) => s.options.length > 0);
  if (!slots.length) {
    return { selections: [], surcharge: 0, error: "This combo is currently unavailable" };
  }

  const picks = (Array.isArray(requested) ? requested : []).filter((p) => p?.productId);
  const usedPickIndexes = new Set<number>();

  const takePicksForSlot = (slot: (typeof slots)[number]): ShopComboSelectionInput[] => {
    const byId: ShopComboSelectionInput[] = [];
    picks.forEach((pick, idx) => {
      if (usedPickIndexes.has(idx)) return;
      if (pick.slotId && pick.slotId === slot.id) {
        byId.push(pick);
        usedPickIndexes.add(idx);
      }
    });
    if (byId.length) return byId;

    const byName: ShopComboSelectionInput[] = [];
    const slotNameKey = slot.name.trim().toLowerCase();
    picks.forEach((pick, idx) => {
      if (usedPickIndexes.has(idx)) return;
      const name = String(pick.slotName || "").trim().toLowerCase();
      if (name && name === slotNameKey) {
        byName.push(pick);
        usedPickIndexes.add(idx);
      }
    });
    if (byName.length) return byName;

    // Last resort: productId unique to this slot among remaining picks
    const optionIds = new Set(slot.options.map((o) => o.productId));
    const unique: ShopComboSelectionInput[] = [];
    picks.forEach((pick, idx) => {
      if (usedPickIndexes.has(idx)) return;
      if (!optionIds.has(pick.productId)) return;
      const alsoInOther = slots.some(
        (other) =>
          other.id !== slot.id && other.options.some((o) => o.productId === pick.productId)
      );
      if (!alsoInOther) {
        unique.push(pick);
        usedPickIndexes.add(idx);
      }
    });
    return unique;
  };

  const selections: Array<{
    slotId: string;
    slotName: string;
    productId: string;
    productName: string;
    extraPrice: number;
    selectedExtras: Array<{ id: string; name: string; price: number }>;
  }> = [];
  let surcharge = 0;
  const childById = new Map(activeChildren.map((p) => [p.id, p]));

  for (const slot of slots) {
    const slotPicks = takePicksForSlot(slot);
    if (slotPicks.length < slot.minPick) {
      return {
        selections: [],
        surcharge: 0,
        error: `For "${comboProduct.name}": please choose ${
          slot.minPick === 1 ? "an option" : `${slot.minPick} options`
        } for "${slot.name}"`,
      };
    }
    if (slotPicks.length > slot.maxPick) {
      return {
        selections: [],
        surcharge: 0,
        error: `For "${comboProduct.name}": too many options selected for "${slot.name}"`,
      };
    }

    const optionById = new Map(slot.options.map((o) => [o.productId, o]));
    for (const pick of slotPicks) {
      const opt = optionById.get(pick.productId);
      if (!opt) {
        return {
          selections: [],
          surcharge: 0,
          error: `For "${comboProduct.name}": invalid choice for "${slot.name}"`,
        };
      }
      const child = childById.get(pick.productId);
      if (!child) {
        return {
          selections: [],
          surcharge: 0,
          error: `For "${comboProduct.name}": product unavailable in "${slot.name}"`,
        };
      }
      const extrasResolved = await resolveShopLineExtras(merchantId, child, pick.selectedExtras, {
        fillDefaultsIfMissing: true,
      });
      if (extrasResolved.error) {
        return { selections: [], surcharge: 0, error: extrasResolved.error };
      }
      const extraPrice = roundMoney2(opt.extraPrice);
      const extrasTotal = roundMoney2(extrasResolved.extras.reduce((s, e) => s + e.price, 0));
      surcharge = roundMoney2(surcharge + extraPrice + extrasTotal);
      selections.push({
        slotId: slot.id,
        slotName: slot.name,
        productId: child.id,
        productName: child.name,
        extraPrice,
        selectedExtras: extrasResolved.extras,
      });
    }
  }

  return { selections, surcharge };
}

async function loadModifierGroupsByProduct(merchantId: string, productIds: string[]) {
  const byProduct = new Map<string, ReturnType<typeof serializeShopModifierGroup>[]>();
  if (!productIds.length) return byProduct;

  const db = getDb();
  const links = await db.query.productModifierGroups.findMany({
    where: inArray(schema.productModifierGroups.productId, productIds),
    with: {
      group: {
        with: {
          options: { orderBy: [asc(schema.modifierOptions.sortOrder)] },
        },
      },
    },
    orderBy: [asc(schema.productModifierGroups.sortOrder)],
  });

  for (const link of links) {
    const g = link.group as any;
    if (!g || g.merchantId !== merchantId || g.isActive === false) continue;
    const list = byProduct.get(link.productId) || [];
    list.push(serializeShopModifierGroup(g));
    byProduct.set(link.productId, list);
  }
  return byProduct;
}

/** Resolve and price selected extras from DB (never trust client prices). */
async function resolveShopLineExtras(
  merchantId: string,
  product: typeof schema.products.$inferSelect,
  requested: ShopExtraSelection[] | undefined,
  opts?: { fillDefaultsIfMissing?: boolean }
): Promise<{ extras: Array<{ id: string; name: string; price: number }>; error?: string }> {
  const groups = await ModifierService.getGroupsForProduct(merchantId, product.id);
  const optionById = new Map<
    string,
    { id: string; name: string; price: number; groupId: string; groupTitle: string }
  >();
  const optionsByGroup = new Map<
    string,
    Array<{ id: string; name: string; price: number; isDefault: boolean }>
  >();

  for (const g of groups) {
    const list: Array<{ id: string; name: string; price: number; isDefault: boolean }> = [];
    for (const o of g.options) {
      if (o.saleStatus === "out_of_stock") continue;
      const price = g.pricingType === "free" ? 0 : Number(o.price) || 0;
      optionById.set(o.id, {
        id: o.id,
        name: o.name,
        price,
        groupId: g.id,
        groupTitle: g.title,
      });
      list.push({ id: o.id, name: o.name, price, isDefault: !!o.isDefault });
    }
    optionsByGroup.set(g.id, list);
  }

  // Legacy flat extras (no groups)
  if (!groups.length && Array.isArray(product.extras)) {
    for (const e of product.extras) {
      if (!e?.id) continue;
      optionById.set(e.id, {
        id: e.id,
        name: e.name,
        price: Number(e.price) || 0,
        groupId: "__legacy__",
        groupTitle: "Extras",
      });
    }
  }

  const reqIds = (requested || []).map((r) => r.id).filter(Boolean);
  const extras: Array<{ id: string; name: string; price: number }> = [];
  const countsByGroup = new Map<string, number>();
  const seen = new Set<string>();

  for (const id of reqIds) {
    const opt = optionById.get(id);
    if (!opt) {
      // Ignore stale combo-flattened ids if they leaked into parent extras
      if (String(id).startsWith("combo:")) continue;
      return { extras: [], error: `Invalid extra selected for ${product.name}` };
    }
    if (seen.has(opt.id)) continue;
    seen.add(opt.id);
    extras.push({ id: opt.id, name: opt.name, price: roundMoney2(opt.price) });
    countsByGroup.set(opt.groupId, (countsByGroup.get(opt.groupId) || 0) + 1);
  }

  for (const g of groups) {
    let count = countsByGroup.get(g.id) || 0;
    const min =
      g.selectionType === "required"
        ? Math.max(1, Number(g.minSelectable) || 1)
        : Math.max(0, Number(g.minSelectable) || 0);
    const max = Math.max(min, Number(g.maxSelectable) || 1);

    if (count < min && opts?.fillDefaultsIfMissing) {
      const pool = optionsByGroup.get(g.id) || [];
      const defaults = pool.filter((o) => o.isDefault);
      const fillFrom = defaults.length ? defaults : pool;
      for (const o of fillFrom) {
        if (count >= min) break;
        if (seen.has(o.id)) continue;
        seen.add(o.id);
        extras.push({ id: o.id, name: o.name, price: roundMoney2(o.price) });
        count += 1;
      }
      countsByGroup.set(g.id, count);
    }

    if (count < min) {
      return {
        extras: [],
        error: `Please choose ${min === 1 ? "an option" : `${min} options`} for "${g.title}" on ${product.name}`,
      };
    }
    if (count > max) {
      return {
        extras: [],
        error: `Too many options selected for "${g.title}" on ${product.name}`,
      };
    }
  }

  return { extras };
}

async function resolveMerchant(slugOrHost: string) {
  const merchant = await MerchantSettingsService.resolveByShopHost(slugOrHost);
  if (!merchant) return null;
  if (merchant.status === "suspended" || merchant.status === "expired") return null;
  return merchant;
}

function channelEnabled(merchant: typeof schema.merchants.$inferSelect, channel: FulfillmentChannel) {
  if (channel === "delivery") return merchant.deliveryEnabled;
  if (channel === "dine_in") return merchant.dineInEnabled;
  return merchant.pickupEnabled;
}

function mapChannelKey(channel: FulfillmentChannel): "takeaway" | "dine_in" | "delivery" {
  return channel === "dine_in" ? "dine_in" : channel === "delivery" ? "delivery" : "takeaway";
}

async function findMatchingZone(merchantId: string, lng?: number, lat?: number, zip?: string) {
  const db = getDb();
  const zones = await db.query.deliveryZones.findMany({
    where: and(eq(schema.deliveryZones.merchantId, merchantId), eq(schema.deliveryZones.isActive, true)),
    orderBy: [asc(schema.deliveryZones.sortOrder)],
  });

  if (lng != null && lat != null && Number.isFinite(lng) && Number.isFinite(lat)) {
    const hit = zones.find((z) => pointInPolygon(lng, lat, (z.polygon || []) as Array<[number, number]>));
    if (hit) return hit;
  }

  if (zip) {
    const normalized = String(zip).trim().toLowerCase();
    const hit = zones.find((z) =>
      (z.zipCodes || []).some((c) => String(c).trim().toLowerCase() === normalized)
    );
    if (hit) return hit;
  }

  return null;
}

/**
 * GET /api/shop/tls-ask?domain=
 */
router.get("/tls-ask", async (req: Request, res: Response) => {
  try {
    const domain = String(req.query.domain || "").toLowerCase().split(":")[0];
    if (!domain) return res.status(400).end();
    const merchant = await resolveMerchant(domain);
    if (
      merchant?.shopEnabled &&
      (merchant.subdomain || merchant.customDomain === domain || merchant.slug)
    ) {
      return res.status(200).end();
    }
    return res.status(404).end();
  } catch {
    return res.status(404).end();
  }
});

/**
 * GET /api/shop/:slug
 */
router.get("/:slug", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant || !merchant.shopEnabled) {
      return res.status(404).json({ error: "Shop not found or closed" });
    }

    const hours = (merchant.storeHours || {}) as StoreHours;
    const channels = {
      takeaway: {
        enabled: merchant.pickupEnabled,
        ...isChannelOpenNow(hours, "takeaway"),
        etaMinutes: merchant.pickupEtaMinutes ?? 25,
      },
      dine_in: {
        enabled: merchant.dineInEnabled,
        ...isChannelOpenNow(hours, "dine_in"),
        etaMinutes: merchant.pickupEtaMinutes ?? 25,
      },
      delivery: {
        enabled: merchant.deliveryEnabled,
        ...isChannelOpenNow(hours, "delivery"),
        etaMinutes: merchant.deliveryEtaMinutes ?? 45,
      },
    };
    const displayHours = getDisplayHoursNow(hours, "takeaway");

    const cmsTheme =
      merchant.cmsHomepageEnabled
        ? await CmsService.getPublishedTheme(merchant.id)
        : null;

    const db = getDb();
    const categoryRows = await db.query.categories.findMany({
      where: eq(schema.categories.merchantId, merchant.id),
      columns: {
        id: true,
        deliveryPricingEnabled: true,
        extraDeliveryPrice: true,
      },
    });

    res.json({
      success: true,
      data: {
        id: merchant.id,
        name: merchant.name,
        slug: merchant.slug,
        subdomain: merchant.subdomain,
        customDomain: merchant.customDomain,
        cmsHomepageEnabled: !!merchant.cmsHomepageEnabled,
        cmsTheme,
        address: merchant.address,
        city: merchant.city,
        phone: merchant.phone,
        latitude: merchant.latitude,
        longitude: merchant.longitude,
        shopLogoUrl: resolvePublicAssetUrl(req, merchant.shopLogoUrl) || merchant.shopLogoUrl,
        shopBannerUrl: resolvePublicAssetUrl(req, merchant.shopBannerUrl) || merchant.shopBannerUrl,
        taxTakeawayRate: merchant.taxTakeawayRate,
        taxDineInRate: merchant.taxDineInRate,
        taxDeliveryRate: merchant.taxDeliveryRate,
        vatRate: merchant.vatRate,
        taxIncludedInPrice: merchant.taxIncludedInPrice === true,
        vatAfterDiscount: merchant.vatAfterDiscount !== false,
        deliveryMenuMarkup: merchant.deliveryMenuMarkup ?? "0",
        categoryPricingEnabled: merchant.categoryPricingEnabled === true,
        categoryDeliveryPricing: categoryRows.map((c) => ({
          id: c.id,
          deliveryPricingEnabled: c.deliveryPricingEnabled === true,
          extraDeliveryPrice: Number(c.extraDeliveryPrice ?? 0) || 0,
        })),
        storeHours: hours,
        /** Homepage banner hours (display channel or takeaway fallback) */
        displayHours,
        channels,
        channelSelectMode: (() => {
          const v = String(merchant.channelSelectMode || "")
            .trim()
            .toLowerCase();
          return v === "popup_start" || v === "menu" || v === "checkout" ? v : "checkout";
        })(),
        menuShowProductImages: merchant.menuShowProductImages !== false,
        menuShowCategoryBanners: merchant.menuShowCategoryBanners !== false,
        cartLayout: (() => {
          const v = String(merchant.cartLayout || "")
            .trim()
            .toLowerCase();
          return v === "sticky_right" ? "sticky_right" : "hidden_slide";
        })(),
        scheduledOrdersEnabled: merchant.scheduledOrdersEnabled !== false,
        minPreOrderDelayMinutes: merchant.minPreOrderDelayMinutes ?? 30,
        payment: {
          cash: true,
          card: true,
          cardReady: !!(merchant.adyenMerchantAccount && merchant.adyenApiKey && merchant.adyenClientId),
          currency: "CHF",
        },
        loyalty: ShopLoyaltyService.programFromMerchant(merchant),
        giftCards: ShopGiftCardService.publicSettings(
          ShopGiftCardService.settingsFromMerchant(merchant)
        ),
        reservationsEnabled: !!merchant.reservationsEnabled,
        acceptingOrders: merchant.acceptingOrders !== false,
        acceptingReservations: merchant.acceptingReservations !== false,
        vacation: vacationPublicPayload(merchant.vacationSettings),
        /** Merchant panel language — used as shop default when customer has no preference */
        language: merchant.shopLanguage || merchant.panelLanguage || "en",
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load shop" });
  }
});

/**
 * GET /api/shop/:slug/pages/home — published CMS homepage
 */
router.get("/:slug/pages/home", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) {
      return res.status(404).json({ error: "Shop not found or closed" });
    }
    const page = await CmsService.getPublishedHomepage(merchant.id);
    if (!page || !merchant.cmsHomepageEnabled) {
      return res.status(404).json({ error: "Homepage not published" });
    }
    res.json({
      success: true,
      data: {
        id: page.id,
        title: page.title,
        slug: page.slug,
        isHomepage: page.isHomepage,
        blocks: page.blocks || [],
        theme: page.theme || null,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        publishedAt: page.publishedAt,
        merchant: {
          id: merchant.id,
          name: merchant.name,
          slug: merchant.slug,
          subdomain: merchant.subdomain,
          customDomain: merchant.customDomain,
          shopLogoUrl: merchant.shopLogoUrl,
          shopBannerUrl: merchant.shopBannerUrl,
          storeHours: merchant.storeHours || {},
          address: merchant.address,
          city: merchant.city,
          phone: merchant.phone,
          reservationsEnabled: !!merchant.reservationsEnabled,
          acceptingOrders: merchant.acceptingOrders !== false,
          acceptingReservations: merchant.acceptingReservations !== false,
          vacation: vacationPublicPayload(merchant.vacationSettings),
          language: merchant.shopLanguage || merchant.panelLanguage || "en",
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load homepage" });
  }
});

/**
 * GET /api/shop/:slug/pages/:pageSlug — published CMS page by slug
 */
router.get("/:slug/pages/:pageSlug", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) {
      return res.status(404).json({ error: "Shop not found or closed" });
    }
    if (req.params.pageSlug === "home") {
      const home = await CmsService.getPublishedHomepage(merchant.id);
      if (!home || !merchant.cmsHomepageEnabled) {
        return res.status(404).json({ error: "Page not found" });
      }
      return res.json({
        success: true,
        data: {
          id: home.id,
          title: home.title,
          slug: home.slug,
          isHomepage: home.isHomepage,
          blocks: home.blocks || [],
          theme: home.theme || null,
          seoTitle: home.seoTitle,
          seoDescription: home.seoDescription,
          publishedAt: home.publishedAt,
        },
      });
    }
    const page = await CmsService.getPublishedBySlug(merchant.id, req.params.pageSlug);
    if (!page) return res.status(404).json({ error: "Page not found" });
    res.json({
      success: true,
      data: {
        id: page.id,
        title: page.title,
        slug: page.slug,
        isHomepage: page.isHomepage,
        blocks: page.blocks || [],
        theme: page.theme || null,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        publishedAt: page.publishedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load page" });
  }
});

/**
 * GET /api/shop/:slug/loyalty — public program + rewards; full summary when customer Bearer present
 */
router.get("/:slug/loyalty", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const { customerId } = optionalCustomer(req);
    if (customerId) {
      const summary = await ShopLoyaltyService.getCustomerLoyaltySummary(merchant.id, customerId);
      return res.json({ success: true, ...summary });
    }
    const pub = await ShopLoyaltyService.getPublicLoyalty(merchant.id);
    res.json({ success: true, ...pub });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load loyalty" });
  }
});

/**
 * GET /api/shop/:slug/my-orders — authenticated customer web_shop order history
 */
router.get("/:slug/my-orders", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const { customerId } = optionalCustomer(req);
    if (!customerId) return res.status(401).json({ error: "Not logged in" });

    const db = getDb();
    const orders = await db.query.orders.findMany({
      where: and(
        eq(schema.orders.merchantId, merchant.id),
        eq(schema.orders.customerId, customerId),
        eq(schema.orders.orderType, "web_shop")
      ),
      with: { items: true },
      orderBy: [desc(schema.orders.createdAt)],
      limit: 50,
    });

    res.json({
      success: true,
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        fulfillmentChannel: o.fulfillmentChannel,
        subtotal: o.subtotal,
        taxAmount: o.taxAmount,
        deliveryFee: o.deliveryFee,
        tipAmount: o.tipAmount,
        pointsDiscount: o.pointsDiscount,
        pointsEarned: o.pointsEarned,
        pointsRedeemed: o.pointsRedeemed,
        total: o.total,
        createdAt: o.createdAt,
        items: (o.items || []).map((it) => ({
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          selectedExtras: it.selectedExtras,
        })),
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load orders" });
  }
});

/**
 * GET /api/shop/:slug/menu
 */
router.get("/:slug/menu", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant || !merchant.shopEnabled) {
      return res.status(404).json({ error: "Shop not found or closed" });
    }

    const db = getDb();
    const catalogChannel = shopMenuCatalogChannel(
      String(req.query.channel || ""),
      typeof req.query.table === "string" ? req.query.table : null
    );
    const [categories, products] = await Promise.all([
      db.query.categories.findMany({
        where: eq(schema.categories.merchantId, merchant.id),
        orderBy: [asc(schema.categories.sortOrder)],
      }),
      db.query.products.findMany({
        where: and(eq(schema.products.merchantId, merchant.id), eq(schema.products.isActive, true)),
        orderBy: [asc(schema.products.sortOrder), asc(schema.products.name)],
      }),
    ]);

    const filtered = filterCatalogForChannel(products, categories, catalogChannel);
    const visibleProducts = filtered.products;
    const visibleCategories = filtered.categories;

    const groupsByProduct = await loadModifierGroupsByProduct(
      merchant.id,
      visibleProducts.map((p) => p.id)
    );
    const catalogById = new Map(visibleProducts.map((p) => [p.id, p]));

    const toItem = (p: (typeof visibleProducts)[number]) =>
      withPublicShopImageUrls(
        req,
        mapShopProduct(p, groupsByProduct.get(p.id) || [], catalogById, groupsByProduct)
      );

    const menu = visibleCategories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      image: resolvePublicAssetUrl(req, (cat as { imageUrl?: string | null }).imageUrl) || null,
      isOffersCategory: !!(cat as { isOffersCategory?: boolean }).isOffersCategory,
      deliveryPricingEnabled: cat.deliveryPricingEnabled === true,
      extraDeliveryPrice: Number(cat.extraDeliveryPrice ?? 0) || 0,
      items: visibleProducts.filter((p) => p.categoryId === cat.id).map(toItem),
    }));

    const uncategorized = visibleProducts.filter((p) => !p.categoryId);
    if (uncategorized.length) {
      menu.push({
        id: "uncategorized",
        name: "Other",
        image: null,
        isOffersCategory: false,
        items: uncategorized.map(toItem),
      });
    }

    // Active featured offers for the Offers shelf badges
    const activeOffers = await OffersService.listActivePublic(merchant.id);
    const featured = activeOffers
      .filter((o) => o.featured)
      .map((o) => ({
        id: o.id,
        name: o.name,
        description: o.description,
        badgeLabel: o.badgeLabel,
        offerType: o.offerType,
        rules: o.rules,
        productIds: o.productIds || [],
        categoryIds: o.categoryIds || [],
        channels: o.channels,
        daysOfWeek: o.daysOfWeek,
        timeStart: o.timeStart,
        timeEnd: o.timeEnd,
        scheduleMode: o.scheduleMode,
        validFrom: o.validFrom,
        validTo: o.validTo,
      }));

    res.json({
      success: true,
      data: menu.filter((c) => c.items.length > 0 || c.isOffersCategory),
      offers: featured,
      catalogChannel,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load menu" });
  }
});

/**
 * GET /api/shop/:slug/table/:tableId/session — open/resume QR table session + order history
 */
router.get("/:slug/table/:tableId/session", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant || !merchant.shopEnabled) {
      return res.status(404).json({ error: "Shop not found or closed" });
    }
    const tableId = String(req.params.tableId || "").trim();
    if (!tableId) return res.status(400).json({ error: "Table is required" });

    const { session, table } = await TableSessionService.openOrResume(merchant.id, tableId);
    const summary = await TableSessionService.sessionSummary(merchant.id, session.id);
    const qrSettings = normalizeTableQrSettings(merchant.tableQrSettings);

    res.json({
      success: true,
      session: {
        id: session.id,
        token: session.sessionToken,
        status: session.status,
        tableId: table.id,
        tableLabel: table.label,
      },
      table: { id: table.id, label: table.label, capacity: table.capacity },
      orders: summary.orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: Number(o.total),
        createdAt: o.createdAt,
        items: (o.items || []).map((i) => ({
          name: i.productName,
          quantity: Number(i.quantity),
          totalPrice: Number(i.totalPrice),
        })),
      })),
      runningTotal: summary.total,
      settings: {
        qrAutoApprove: qrSettings.qrAutoApprove,
        qrPayAtTableEnabled: qrSettings.qrPayAtTableEnabled,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to open table session" });
  }
});

/**
 * GET /api/shop/:slug/delivery-zones
 */
router.get("/:slug/delivery-zones", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant || !merchant.shopEnabled) {
      return res.status(404).json({ error: "Shop not found or closed" });
    }
    const db = getDb();
    const zones = await db.query.deliveryZones.findMany({
      where: and(eq(schema.deliveryZones.merchantId, merchant.id), eq(schema.deliveryZones.isActive, true)),
      orderBy: [asc(schema.deliveryZones.sortOrder)],
    });
    res.json({
      success: true,
      data: zones.map((z) => ({
        id: z.id,
        name: z.name,
        polygon: z.polygon,
        minOrderAmount: z.minOrderAmount,
        deliveryFee: z.deliveryFee,
        estimatedMinutes: z.estimatedMinutes,
        color: z.color,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load zones" });
  }
});

/**
 * GET /api/shop/:slug/postal-suggest?q=80
 * Swiss PLZ autocomplete → zip + city name(s)
 */
router.get("/:slug/postal-suggest", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant || !merchant.shopEnabled) {
      return res.status(404).json({ error: "Shop not found" });
    }
    const { suggestSwissPostal, cityForSwissPostal } = await import("@/data/swiss-postal");
    const q = String(req.query.q || "");
    const suggestions = suggestSwissPostal(q, 15);
    const exact = cityForSwissPostal(q);
    res.json({
      success: true,
      suggestions,
      city: exact,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Postal lookup failed",
    });
  }
});

/**
 * POST /api/shop/:slug/geocode
 * Body: { query }
 */
router.post("/:slug/geocode", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant || !merchant.shopEnabled) {
      return res.status(404).json({ error: "Shop not found" });
    }
    const query = String(req.body.query || "").trim();
    if (!query) return res.status(400).json({ error: "query required" });

    const result = await geocodeQuery(query);
    if (!result.found) {
      return res.json({ success: true, found: false });
    }
    res.json({
      success: true,
      found: true,
      lat: result.lat,
      lng: result.lng,
      displayName: result.displayName,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Geocode failed" });
  }
});

/**
 * POST /api/shop/:slug/check-delivery
 * Body: { lat, lng, zipCode?, subtotal? }
 */
router.post("/:slug/check-delivery", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant || !merchant.shopEnabled || !merchant.deliveryEnabled) {
      return res.status(404).json({ error: "Delivery not available" });
    }

    const hours = isChannelOpenNow((merchant.storeHours || {}) as StoreHours, "delivery");
    const lat = req.body.lat != null ? Number(req.body.lat) : undefined;
    const lng = req.body.lng != null ? Number(req.body.lng) : undefined;
    const zipCode = req.body.zipCode ? String(req.body.zipCode) : undefined;
    const subtotal = Number(req.body.subtotal || 0);

    const zone = await findMatchingZone(merchant.id, lng, lat, zipCode);
    if (!zone) {
      return res.json({
        success: true,
        deliverable: false,
        open: hours.open,
        todayLabel: hours.todayLabel,
        error: "Address is outside delivery zones",
      });
    }

    const minOrder = parseFloat(zone.minOrderAmount?.toString() || "0");
    const fee = parseFloat(zone.deliveryFee?.toString() || "0");
    const meetsMin = subtotal >= minOrder;

    res.json({
      success: true,
      deliverable: true,
      open: hours.open,
      todayLabel: hours.todayLabel,
      zone: {
        id: zone.id,
        name: zone.name,
        minOrderAmount: minOrder,
        deliveryFee: fee,
        estimatedMinutes: zone.estimatedMinutes,
      },
      meetsMinOrder: meetsMin,
      message: meetsMin
        ? undefined
        : `Minimum order for this zone is CHF ${minOrder.toFixed(2)}`,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Check failed" });
  }
});

function optionalCustomer(req: Request): { customerId?: string } {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return {};
    const payload = AuthService.verifyToken(authHeader.slice(7));
    if (payload.role === "customer" && payload.customerId) {
      return { customerId: payload.customerId };
    }
  } catch {
    /* guest */
  }
  return {};
}

/**
 * POST /api/shop/:slug/auth/register
 */
router.post("/:slug/auth/register", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const result = await ShopCustomerService.register(merchant.id, req.body);
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Register failed" });
  }
});

/**
 * POST /api/shop/:slug/auth/login
 */
router.post("/:slug/auth/login", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const { email, password } = req.body;
    const result = await ShopCustomerService.login(merchant.id, email, password);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "Login failed" });
  }
});

/**
 * GET /api/shop/:slug/auth/me
 */
router.get("/:slug/auth/me", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const { customerId } = optionalCustomer(req);
    if (!customerId) return res.status(401).json({ error: "Not logged in" });
    const customer = await ShopCustomerService.getProfile(customerId, merchant.id);
    res.json({ success: true, customer });
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "Unauthorized" });
  }
});

/**
 * PUT /api/shop/:slug/auth/me
 */
router.put("/:slug/auth/me", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const { customerId } = optionalCustomer(req);
    if (!customerId) return res.status(401).json({ error: "Not logged in" });
    const customer = await ShopCustomerService.updateProfile(customerId, merchant.id, req.body);
    res.json({ success: true, customer });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Update failed" });
  }
});

/**
 * GET /api/shop/:slug/auth/addresses
 */
router.get("/:slug/auth/addresses", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const { customerId } = optionalCustomer(req);
    if (!customerId) return res.status(401).json({ error: "Not logged in" });
    const addresses = await ShopCustomerService.listAddresses(customerId, merchant.id);
    res.json({ success: true, addresses });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * POST /api/shop/:slug/auth/addresses
 */
router.post("/:slug/auth/addresses", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const { customerId } = optionalCustomer(req);
    if (!customerId) return res.status(401).json({ error: "Not logged in" });
    const address = await ShopCustomerService.createAddress(customerId, merchant.id, req.body || {});
    res.status(201).json({ success: true, address });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Save failed" });
  }
});

/**
 * PUT /api/shop/:slug/auth/addresses/:addressId
 */
router.put("/:slug/auth/addresses/:addressId", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const { customerId } = optionalCustomer(req);
    if (!customerId) return res.status(401).json({ error: "Not logged in" });
    const address = await ShopCustomerService.updateAddress(
      customerId,
      merchant.id,
      req.params.addressId,
      req.body || {}
    );
    res.json({ success: true, address });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Update failed" });
  }
});

/**
 * DELETE /api/shop/:slug/auth/addresses/:addressId
 */
router.delete("/:slug/auth/addresses/:addressId", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const { customerId } = optionalCustomer(req);
    if (!customerId) return res.status(401).json({ error: "Not logged in" });
    await ShopCustomerService.deleteAddress(customerId, merchant.id, req.params.addressId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Delete failed" });
  }
});

/**
 * GET /api/shop/:slug/reservations/config
 */
router.get("/:slug/reservations/config", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const { ReservationService } = await import("@/services/reservation.service");
    const config = ReservationService.getSettingsForMerchant(merchant);
    if (!config.enabled) return res.status(404).json({ error: "Reservations are not enabled" });
    const vacation = vacationPublicPayload(merchant.vacationSettings);
    res.json({
      success: true,
      config: {
        enabled: config.enabled,
        settings: config.settings,
        hours: config.hours,
        shopName: config.shopName,
        address: config.address,
        phone: config.phone,
        acceptingReservations: merchant.acceptingReservations !== false,
        vacation,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * GET /api/shop/:slug/reservations/slots?date=YYYY-MM-DD&partySize=2
 */
router.get("/:slug/reservations/slots", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled || !merchant.reservationsEnabled) {
      return res.status(404).json({ error: "Reservations not available" });
    }
    const date = String(req.query.date || "");
    const notAccepting = merchant.acceptingReservations === false;
    const vacation =
      isVacationActive(merchant.vacationSettings) ||
      (!!date && isDateInVacationPeriods(merchant.vacationSettings, date));
    const { ReservationService } = await import("@/services/reservation.service");
    const partySize = Number(req.query.partySize) || 2;
    const result = await ReservationService.getSlots(merchant.id, date, partySize);
    res.json({
      success: true,
      ...result,
      notAccepting,
      vacation,
      message: notAccepting
        ? NOT_ACCEPTING_RESERVATIONS_MESSAGE
        : vacation
          ? VACATION_BLOCK_MESSAGE
          : undefined,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * POST /api/shop/:slug/reservations
 */
router.post("/:slug/reservations", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled || !merchant.reservationsEnabled) {
      return res.status(404).json({ error: "Reservations not available" });
    }
    if (merchant.acceptingReservations === false) {
      return res.status(400).json({ error: NOT_ACCEPTING_RESERVATIONS_MESSAGE });
    }
    if (isVacationActive(merchant.vacationSettings)) {
      return res.status(400).json({ error: VACATION_BLOCK_MESSAGE });
    }
    const { ReservationService, zurichLocalToDate } = await import("@/services/reservation.service");
    const auth = optionalCustomer(req);
    let reservedAt: Date;
    if (req.body.date && req.body.time) {
      reservedAt = zurichLocalToDate(String(req.body.date), String(req.body.time));
    } else {
      reservedAt = new Date(req.body.reservedAt);
    }
    const reservedYmd = String(req.body.date || "").slice(0, 10);
    if (
      (reservedYmd && isDateInVacationPeriods(merchant.vacationSettings, reservedYmd)) ||
      (!reservedYmd &&
        isDateInVacationPeriods(
          merchant.vacationSettings,
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "Europe/Zurich",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(reservedAt)
        ))
    ) {
      return res.status(400).json({ error: VACATION_BLOCK_MESSAGE });
    }
    const reservation = await ReservationService.create(merchant.id, {
      guestName: req.body.guestName,
      guestEmail: req.body.guestEmail,
      guestPhone: req.body.guestPhone,
      partySize: req.body.partySize,
      reservedAt,
      notes: req.body.notes,
      source: "web",
      customerId: auth.customerId || null,
    });
    res.status(201).json({
      success: true,
      reservation: {
        id: reservation.id,
        code: reservation.code,
        status: reservation.status,
        guestName: reservation.guestName,
        partySize: reservation.partySize,
        reservedAt: reservation.reservedAt,
        durationMinutes: reservation.durationMinutes,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to book" });
  }
});

/**
 * POST /api/shop/:slug/vouchers/validate
 * Body: { code, subtotal }
 */
router.post("/:slug/vouchers/validate", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const code = String(req.body?.code || "");
    const subtotal = Number(req.body?.subtotal || 0);
    const authCustomer = optionalCustomer(req);
    const result = await VoucherService.validateForShop(
      merchant.id,
      code,
      subtotal,
      authCustomer.customerId
    );
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid voucher" });
  }
});

/**
 * POST /api/shop/:slug/offers/preview
 * Estimate promotional discount for the current cart.
 */
router.post("/:slug/offers/preview", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const channel = String(req.body?.channel || "takeaway");
    const at = req.body?.scheduledFor ? new Date(req.body.scheduledFor) : new Date();
    const lines = Array.isArray(req.body?.items) ? req.body.items : [];
    const offers = await OffersService.list(merchant.id);

    // Resolve missing categoryIds from catalog so % category offers preview correctly
    const productIds = [
      ...new Set(
        lines
          .map((l: any) => String(l.productId || ""))
          .filter((id: string) => !!id)
      ),
    ];
    const categoryByProduct = new Map<string, string | null>();
    if (productIds.length) {
      const db = getDb();
      const products = await db.query.products.findMany({
        where: and(
          eq(schema.products.merchantId, merchant.id),
          inArray(schema.products.id, productIds)
        ),
        columns: { id: true, categoryId: true },
      });
      for (const p of products) categoryByProduct.set(p.id, p.categoryId || null);
    }

    const result = OffersService.evaluateCart(
      offers,
      lines.map((l: any) => {
        const productId = String(l.productId || "");
        return {
          productId,
          categoryId: l.categoryId || categoryByProduct.get(productId) || null,
          name: String(l.name || ""),
          unitPrice: Number(l.unitPrice || l.price || 0),
          quantity: Math.max(1, Math.floor(Number(l.quantity) || 1)),
          loyaltyReward: !!l.loyaltyReward,
          // When client already baked this offer into line prices, skip re-applying it
          offerId: l.offerId ? String(l.offerId) : null,
        };
      }),
      Number.isNaN(at.getTime()) ? new Date() : at,
      channel
    );
    const publicOffers = await OffersService.listActivePublic(
      merchant.id,
      Number.isNaN(at.getTime()) ? new Date() : at,
      channel
    );
    res.json({
      success: true,
      discount: result.discount,
      applied: result.applied,
      activeOffers: publicOffers.map((o) => ({
        id: o.id,
        name: o.name,
        badgeLabel: o.badgeLabel,
        offerType: o.offerType,
        description: o.description,
      })),
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * GET /api/shop/:slug/payment-options
 */
router.get("/:slug/payment-options", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const cardReady = !!(merchant.adyenMerchantAccount && merchant.adyenApiKey && merchant.adyenClientId);
    res.json({
      success: true,
      options: {
        cash: true,
        payLater: true,
        card: true,
        cardReady,
        currency: "CHF",
        clientKey: cardReady ? merchant.adyenClientId : null,
        environment: (process.env.ADYEN_ENVIRONMENT || "test").toLowerCase() === "live" ? "live" : "test",
        cardFeeFixed: Number(merchant.onlineCardFeeFixed || 0) || 0,
        cardFeePercent: Number(merchant.onlineCardFeePercent || 0) || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * GET /api/shop/:slug/gift-cards/settings — public gift card purchase settings
 */
router.get("/:slug/gift-cards/settings", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    res.json({
      success: true,
      settings: ShopGiftCardService.publicSettings(
        ShopGiftCardService.settingsFromMerchant(merchant)
      ),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * GET /api/shop/:slug/gift-cards/balance/:code — public balance lookup
 */
router.get("/:slug/gift-cards/balance/:code", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const data = await ShopGiftCardService.lookupPublicBalance(
      merchant.id,
      req.params.code
    );
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Card not found" });
  }
});

/**
 * POST /api/shop/:slug/gift-cards/purchase — start online e-gift purchase
 */
router.post("/:slug/gift-cards/purchase", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });

    const body = req.body || {};
    const result = await ShopGiftCardService.createOnlinePurchase(
      merchant,
      req.params.slug,
      {
        amount: Number(body.amount),
        recipientEmail: body.recipientEmail,
        recipientName: body.recipientName,
        senderName: body.senderName,
        senderEmail: body.senderEmail,
        message: body.message,
      }
    );

    res.status(201).json({
      success: true,
      purchase: {
        id: result.purchase.id,
        amount: result.amount,
        recipientEmail: result.purchase.recipientEmail,
        paymentStatus: result.purchase.paymentStatus,
      },
      paymentSession: result.paymentSession,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Purchase failed" });
  }
});

/**
 * GET /api/shop/:slug/gift-cards/purchase/:purchaseId
 */
router.get("/:slug/gift-cards/purchase/:purchaseId", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const purchase = await ShopGiftCardService.getPurchase(
      merchant.id,
      req.params.purchaseId
    );
    let card: { ecardCode?: string | null; balance?: string | null } | null = null;
    if (purchase.cardId) {
      const db = getDb();
      card = await db.query.giftCards.findFirst({
        where: eq(schema.giftCards.id, purchase.cardId),
        columns: { ecardCode: true, balance: true },
      });
    }
    res.json({
      success: true,
      purchase: {
        id: purchase.id,
        amount: purchase.amount,
        recipientEmail: purchase.recipientEmail,
        recipientName: purchase.recipientName,
        senderName: purchase.senderName,
        message: purchase.message,
        paymentStatus: purchase.paymentStatus,
        fulfilledAt: purchase.fulfilledAt,
        cardCode: card?.ecardCode || null,
        cardBalance: card?.balance || null,
      },
    });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Not found" });
  }
});

/**
 * POST /api/shop/:slug/gift-cards/purchase/:purchaseId/confirm-payment
 */
router.post(
  "/:slug/gift-cards/purchase/:purchaseId/confirm-payment",
  async (req: Request, res: Response) => {
    try {
      const merchant = await resolveMerchant(req.params.slug);
      if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
      const result = await ShopGiftCardService.confirmPurchasePayment(
        merchant.id,
        req.params.purchaseId,
        req.body?.pspReference || req.body?.adyenReference
      );
      res.json({
        success: true,
        alreadyFulfilled: result.alreadyFulfilled,
        purchase: {
          id: result.purchase.id,
          paymentStatus: result.purchase.paymentStatus,
        },
        card: {
          code: result.card.ecardCode || result.card.cardNumber,
          balance: result.card.balance,
        },
      });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Confirm failed" });
    }
  }
);

/**
 * POST /api/shop/:slug/orders — checkout create
 */
router.post("/:slug/orders", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant || !merchant.shopEnabled) {
      return res.status(404).json({ error: "Shop not found or closed" });
    }
    if (isVacationActive(merchant.vacationSettings)) {
      return res.status(400).json({ error: VACATION_BLOCK_MESSAGE });
    }
    if (merchant.acceptingOrders === false) {
      return res.status(400).json({ error: NOT_ACCEPTING_ORDERS_MESSAGE });
    }

    const {
      items,
      customerEmail,
      customerPhone,
      customerName,
      notes,
      shippingAddress,
      city,
      fulfillmentChannel = "takeaway",
      lat,
      lng,
      zipCode,
      paymentMethod = "cash",
      tipAmount = 0,
      scheduledFor,
      guestCheckout = true,
      pointsToRedeem = 0,
      voucherCode,
      giftCardCode,
      tableId,
      tableSessionToken,
      orderSource: requestedOrderSource,
    } = req.body as {
      items: Array<{
        productId: string;
        quantity: number;
        selectedExtras?: ShopExtraSelection[];
        comboSelections?: ShopComboSelectionInput[];
        loyaltyReward?: boolean;
      }>;
      customerEmail?: string;
      customerPhone?: string;
      customerName?: string;
      notes?: string;
      shippingAddress?: string | Record<string, string>;
      city?: string;
      fulfillmentChannel?: FulfillmentChannel;
      lat?: number;
      lng?: number;
      zipCode?: string;
      paymentMethod?: "cash" | "card" | "pay_later";
      tipAmount?: number;
      scheduledFor?: string | null;
      guestCheckout?: boolean;
      pointsToRedeem?: number;
      voucherCode?: string;
      giftCardCode?: string;
      tableId?: string;
      tableSessionToken?: string;
      orderSource?: string;
    };

    if (scheduledFor) {
      const when = new Date(scheduledFor);
      if (!Number.isNaN(when.getTime())) {
        const ymd = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Zurich",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(when);
        if (isDateInVacationPeriods(merchant.vacationSettings, ymd)) {
          return res.status(400).json({ error: VACATION_BLOCK_MESSAGE });
        }
      }
    }

    if (!items?.length) {
      return res.status(400).json({ error: "Order items are required" });
    }

    const qrTableId = String(tableId || "").trim() || null;
    const isQrTableOrder = !!qrTableId;
    let resolvedTableSession: Awaited<ReturnType<typeof TableSessionService.assertOpenSession>> | null =
      null;
    let resolvedTableLabel: string | null = null;
    if (isQrTableOrder) {
      try {
        resolvedTableSession = await TableSessionService.assertOpenSession(
          merchant.id,
          qrTableId,
          tableSessionToken
        );
        const table = await TableSessionService.resolveTable(merchant.id, qrTableId);
        resolvedTableLabel = table?.label || null;
      } catch (err) {
        return res.status(400).json({
          error: err instanceof Error ? err.message : "Invalid table session",
        });
      }
    }

    if (!isQrTableOrder && (!customerName?.trim() || !customerPhone?.trim())) {
      return res.status(400).json({ error: "Name and phone are required" });
    }

    const rawPay = String(paymentMethod || "cash").toLowerCase().replace(/-/g, "_");
    const payMethod =
      rawPay === "card" ? "card" : rawPay === "pay_later" ? "pay_later" : "cash";
    const channel: FulfillmentChannel = isQrTableOrder
      ? "dine_in"
      : fulfillmentChannel === "dine_in" || fulfillmentChannel === "takeaway" || fulfillmentChannel === "delivery"
        ? fulfillmentChannel
        : "takeaway";

    if (!channelEnabled(merchant, channel)) {
      return res.status(400).json({ error: "This order type is not available" });
    }

    // ASAP orders must be within open hours; scheduled orders must fall inside opening hours
    const isScheduled = !!scheduledFor;
    const allowScheduled = merchant.scheduledOrdersEnabled !== false;
    const channelKey = mapChannelKey(channel);
    const hours = (merchant.storeHours || {}) as StoreHours;
    if (isScheduled && !allowScheduled) {
      return res.status(400).json({
        error: "Scheduled orders are not available. Please order during opening hours.",
      });
    }
    if (!isScheduled) {
      const openState = isChannelOpenNow(hours, channelKey);
      if (!openState.open) {
        return res.status(400).json({
          error: allowScheduled
            ? `Store is closed for ${channel.replace("_", " ")} (${openState.todayLabel}). Please schedule for later.`
            : `Store is closed for ${channel.replace("_", " ")} (${openState.todayLabel}). Orders are only accepted during opening hours.`,
        });
      }
    } else {
      const when = new Date(scheduledFor as string);
      if (Number.isNaN(when.getTime())) {
        return res.status(400).json({ error: "Invalid scheduled time" });
      }
      if (when.getTime() < Date.now() - 60_000) {
        return res.status(400).json({ error: "Scheduled time must be in the future" });
      }
      // Allow up to 3 days ahead
      if (when.getTime() > Date.now() + 3 * 24 * 60 * 60 * 1000) {
        return res.status(400).json({ error: "Scheduled time is too far in the future" });
      }
      if (!isWithinChannelHours(hours, channelKey, when)) {
        return res.status(400).json({
          error: "Selected time is outside opening hours. Choose another slot.",
        });
      }
    }

    if (channel === "delivery") {
      const addr =
        typeof shippingAddress === "string"
          ? shippingAddress
          : shippingAddress
            ? JSON.stringify(shippingAddress)
            : "";
      if (!addr.trim()) {
        return res.status(400).json({ error: "Delivery address is required" });
      }
    }

    const taxRate = MerchantSettingsService.channelTaxRate(merchant, channel);
    const db = getDb();
    const authCustomer = optionalCustomer(req);
    const loyaltyProgram = ShopLoyaltyService.programFromMerchant(merchant);

    const merchantCategories = await db.query.categories.findMany({
      where: eq(schema.categories.merchantId, merchant.id),
      columns: {
        id: true,
        deliveryPricingEnabled: true,
        extraDeliveryPrice: true,
      },
    });
    const categoryDeliveryMap = buildCategoryDeliveryPricingMap(merchantCategories);
    const deliveryPricingConfig = {
      categoryPricingEnabled: merchant.categoryPricingEnabled === true,
      deliveryMenuMarkup: merchant.deliveryMenuMarkup,
    };

    let subtotal = 0;
    let taxAmount = 0;
    let rewardPointsNeeded = 0;
    const rewardLines: Array<{ productId: string; points: number; quantity: number }> = [];
    const lineItems: Array<{
      productId: string;
      categoryId?: string | null;
      productName: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      taxAmount: number;
      loyaltyReward: boolean;
      rewardPointsCost: number;
      selectedExtras: Array<{ id: string; name: string; price: number }>;
      comboSelections: Array<{
        slotId: string;
        slotName: string;
        productId: string;
        productName: string;
        extraPrice: number;
        selectedExtras?: Array<{ id: string; name: string; price: number }>;
      }>;
    }> = [];

    for (const item of items) {
      const product = await db.query.products.findFirst({
        where: and(eq(schema.products.id, item.productId), eq(schema.products.merchantId, merchant.id)),
      });
      if (!product) {
        return res.status(400).json({ error: `Product ${item.productId} not found` });
      }
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) continue;

      const wantsReward = !!item.loyaltyReward;
      if (wantsReward) {
        if (!loyaltyProgram.enabled) {
          return res.status(400).json({ error: "Loyalty program is not enabled" });
        }
        if (!authCustomer.customerId) {
          return res.status(401).json({ error: "Login required to redeem free rewards" });
        }
        const cost = Number(product.loyaltyRewardPoints) || 0;
        if (cost < 1) {
          return res.status(400).json({ error: `${product.name} is not available as a free reward` });
        }
        const lineCost = cost * qty;
        rewardPointsNeeded += lineCost;
        rewardLines.push({ productId: product.id, points: lineCost, quantity: qty });

        const flatExtras: Array<{ id: string; name: string; price: number }> = [
          { id: "loyalty_reward", name: `Free reward (${cost} pts)`, price: 0 },
        ];
        lineItems.push({
          productId: product.id,
          productName: product.name,
          quantity: qty,
          unitPrice: 0,
          totalPrice: 0,
          taxAmount: 0,
          loyaltyReward: true,
          rewardPointsCost: cost,
          selectedExtras: flatExtras,
          comboSelections: [],
        });
        continue;
      }

      let comboSelections: (typeof lineItems)[number]["comboSelections"] = [];
      let comboSurcharge = 0;
      if (product.productType === "combo") {
        const comboResolved = await resolveShopComboSelections(
          merchant.id,
          product,
          item.comboSelections
        );
        if (comboResolved.error) {
          return res.status(400).json({ error: comboResolved.error });
        }
        comboSelections = comboResolved.selections;
        comboSurcharge = comboResolved.surcharge;
      }

      const resolved = await resolveShopLineExtras(merchant.id, product, item.selectedExtras);
      if (resolved.error) {
        return res.status(400).json({ error: resolved.error });
      }

      const extrasTotal = roundMoney2(resolved.extras.reduce((s, e) => s + e.price, 0));
      const deliveryMarkup = resolveShopItemDeliveryMarkup(
        deliveryPricingConfig,
        channel,
        product.categoryId,
        categoryDeliveryMap
      );
      const unitPrice = roundMoney2(
        parseFloat(product.price.toString()) + deliveryMarkup + extrasTotal + comboSurcharge
      );
      const totalPrice = roundMoney2(unitPrice * qty);
      const lineTax = product.isTaxable ? roundMoney2((totalPrice * taxRate) / 100) : 0;
      subtotal += totalPrice;
      taxAmount += lineTax;

      // Flatten combo picks into selectedExtras for receipts/POS that only read extras
      const flatExtras = [
        ...resolved.extras,
        ...comboSelections.flatMap((sel) => [
          {
            id: `combo:${sel.slotId}:${sel.productId}`,
            name: `${sel.slotName}: ${sel.productName}`,
            price: sel.extraPrice,
          },
          ...(sel.selectedExtras || []).map((e) => ({
            id: e.id,
            name: `${sel.productName} · ${e.name}`,
            price: e.price,
          })),
        ]),
      ];

      lineItems.push({
        productId: product.id,
        categoryId: product.categoryId,
        productName: product.name,
        quantity: qty,
        unitPrice,
        totalPrice,
        taxAmount: lineTax,
        loyaltyReward: false,
        rewardPointsCost: 0,
        selectedExtras: flatExtras,
        comboSelections,
      });
    }

    if (!lineItems.length) {
      return res.status(400).json({ error: "No valid items" });
    }

    // Promotional offers (before loyalty points)
    const offerAt = scheduledFor ? new Date(scheduledFor as string) : new Date();
    const activeOffers = await OffersService.list(merchant.id);
    const offerEval = OffersService.evaluateCart(
      activeOffers,
      lineItems.map((l) => ({
        productId: l.productId,
        categoryId: l.categoryId,
        name: l.productName,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        loyaltyReward: l.loyaltyReward,
      })),
      Number.isNaN(offerAt.getTime()) ? new Date() : offerAt,
      channel
    );
    let offerDiscount = roundMoney2(offerEval.discount);

    let voucherDiscount = 0;
    let appliedVoucher: { voucherId: string; code: string; name: string } | null = null;
    const trimmedVoucher = String(voucherCode || "").trim();
    if (trimmedVoucher) {
      try {
        const voucherBase = roundMoney2(Math.max(0, subtotal - offerDiscount));
        const validated = await VoucherService.validateForShop(
          merchant.id,
          trimmedVoucher,
          voucherBase,
          authCustomer.customerId
        );
        voucherDiscount = roundMoney2(Math.min(validated.discount, voucherBase));
        appliedVoucher = {
          voucherId: validated.voucherId,
          code: validated.code,
          name: validated.name,
        };
      } catch (error) {
        return res.status(400).json({
          error: error instanceof Error ? error.message : "Invalid voucher",
        });
      }
    }

    let deliveryFee = 0;
    let deliveryZoneId: string | undefined;
    if (channel === "delivery") {
      const zone = await findMatchingZone(
        merchant.id,
        lng != null ? Number(lng) : undefined,
        lat != null ? Number(lat) : undefined,
        zipCode
      );
      if (!zone) {
        return res.status(400).json({ error: "Address is outside delivery zones" });
      }
      const minOrder = parseFloat(zone.minOrderAmount?.toString() || "0");
      if (subtotal < minOrder) {
        return res.status(400).json({
          error: `Minimum order for this zone is CHF ${minOrder.toFixed(2)}`,
        });
      }
      deliveryFee = parseFloat(zone.deliveryFee?.toString() || "0");
      deliveryZoneId = zone.id;
    }

    // Points can cover food + delivery + tax after offer discount (not tip / card fee)
    const feeTaxPreview = roundMoney2((deliveryFee * taxRate) / 100);
    const taxDiscountOpts = {
      taxIncludedInPrice: merchant.taxIncludedInPrice === true,
      vatAfterDiscount: merchant.vatAfterDiscount !== false,
    };
    let taxPreview = roundMoney2(taxAmount + feeTaxPreview);
    taxPreview = adjustTaxForOrderDiscount(
      taxPreview,
      subtotal + deliveryFee,
      offerDiscount + voucherDiscount,
      taxDiscountOpts
    );
    const redeemableBase = roundMoney2(
      Math.max(0, subtotal - offerDiscount - voucherDiscount) + deliveryFee + taxPreview
    );

    let pointsDiscount = 0;
    let cashPointsUsed = 0;
    const requestedCashPoints = Math.max(0, Math.floor(Number(pointsToRedeem) || 0));
    if (requestedCashPoints > 0 || rewardPointsNeeded > 0) {
      if (!loyaltyProgram.enabled) {
        return res.status(400).json({ error: "Loyalty program is not enabled" });
      }
      if (!authCustomer.customerId) {
        return res.status(401).json({ error: "Login required to redeem points" });
      }
      const balance = await ShopLoyaltyService.getBalance(merchant.id, authCustomer.customerId);
      if (balance < rewardPointsNeeded) {
        return res.status(400).json({ error: "Insufficient loyalty points for free rewards" });
      }
      const balanceAfterRewards = balance - rewardPointsNeeded;
      if (requestedCashPoints > 0) {
        const maxPts = ShopLoyaltyService.maxRedeemablePoints(
          redeemableBase,
          balanceAfterRewards,
          loyaltyProgram.redeemPointsPerChf
        );
        const usePts = Math.min(requestedCashPoints, maxPts);
        const { discountChf, pointsUsed } = ShopLoyaltyService.computeCashDiscount(
          usePts,
          loyaltyProgram.redeemPointsPerChf
        );
        pointsDiscount = discountChf;
        cashPointsUsed = pointsUsed;
      }
    }
    const totalPointsRedeemed = rewardPointsNeeded + cashPointsUsed;

    const trimmedGiftCode = String(giftCardCode || "").trim();
    let giftCardDiscount = 0;
    let giftCardPreviewBalance = 0;
    if (trimmedGiftCode) {
      const gcSettings = ShopGiftCardService.settingsFromMerchant(merchant);
      if (!gcSettings.enabled) {
        return res.status(400).json({ error: "Gift cards are not enabled" });
      }
      try {
        const preview = await ShopGiftCardService.lookupPublicBalance(
          merchant.id,
          trimmedGiftCode
        );
        giftCardPreviewBalance = preview.balance;
      } catch (error) {
        return res.status(400).json({
          error: error instanceof Error ? error.message : "Invalid gift card",
        });
      }
    }

    let customerId = authCustomer.customerId;
    const emailNorm = customerEmail?.trim().toLowerCase();
    try {
      const { CustomerService } = await import("@/services/customer.service");
      const upserted = await CustomerService.upsertFromGuest(merchant.id, {
        name: customerName,
        phone: customerPhone,
        email: emailNorm,
        address: typeof shippingAddress === "string" ? shippingAddress : undefined,
        zip: zipCode,
        city,
      });
      if (!customerId && upserted?.id) customerId = upserted.id;
    } catch (custErr) {
      console.warn("Shop order customer upsert failed:", custErr);
    }

    const tip = roundTo005(Math.max(0, Number(tipAmount) || 0));
    const feeTax = roundMoney2((deliveryFee * taxRate) / 100);
    const grossTaxAmount = roundMoney2(taxAmount + feeTax);
    subtotal = roundMoney2(subtotal);
    deliveryFee = roundMoney2(deliveryFee);
    offerDiscount = roundMoney2(Math.min(offerDiscount, subtotal));
    voucherDiscount = roundMoney2(
      Math.min(voucherDiscount, Math.max(0, subtotal - offerDiscount))
    );
    const taxAfterOffer = adjustTaxForOrderDiscount(
      grossTaxAmount,
      subtotal + deliveryFee,
      offerDiscount + voucherDiscount,
      taxDiscountOpts
    );
    pointsDiscount = roundMoney2(
      Math.min(
        pointsDiscount,
        Math.max(0, subtotal - offerDiscount - voucherDiscount) + deliveryFee + taxAfterOffer
      )
    );
    taxAmount = adjustTaxForOrderDiscount(
      grossTaxAmount,
      subtotal + deliveryFee,
      offerDiscount + voucherDiscount + pointsDiscount,
      taxDiscountOpts
    );
    const preGiftTotal = roundMoney2(
      Math.max(
        0,
        subtotal + deliveryFee + taxAmount - offerDiscount - voucherDiscount - pointsDiscount
      ) + tip
    );
    if (trimmedGiftCode && giftCardPreviewBalance > 0) {
      giftCardDiscount = roundMoney2(Math.min(giftCardPreviewBalance, preGiftTotal));
    }
    const orderNumber = await generateWebOrderNumber(db, merchant.id);
    // Offer + voucher + points + gift card discount apply to food (+ delivery/tax for points); tip and card fee remain payable
    const preCardTotal = Math.max(0, preGiftTotal - giftCardDiscount);
    const cardFeeFixed = Number(merchant.onlineCardFeeFixed || 0) || 0;
    const cardFeePercent = Number(merchant.onlineCardFeePercent || 0) || 0;
    const cardFee =
      payMethod === "card"
        ? roundTo005(Math.max(0, cardFeeFixed + (preCardTotal * cardFeePercent) / 100))
        : 0;
    const rawTotal = preCardTotal + cardFee;
    const roundAdj = roundingAdjustment(rawTotal);
    const total = roundTo005(rawTotal);
    const notesWithRounding =
      [
        notes || "",
        offerEval.applied.length
          ? `[Offers: ${offerEval.applied.map((a) => `${a.name} −CHF ${a.discount.toFixed(2)}`).join("; ")}]`
          : "",
        appliedVoucher
          ? `[Voucher ${appliedVoucher.code}: −CHF ${voucherDiscount.toFixed(2)}]`
          : "",
        giftCardDiscount > 0
          ? `[Gift card: −CHF ${giftCardDiscount.toFixed(2)}]`
          : "",
        roundAdj !== 0 ? `[Rounding ${roundAdj > 0 ? "+" : ""}${roundAdj.toFixed(2)}]` : "",
      ]
        .filter(Boolean)
        .join("\n") || null;
    const addressText =
      typeof shippingAddress === "string"
        ? [shippingAddress, zipCode, city].filter(Boolean).join(", ")
        : shippingAddress
          ? JSON.stringify(shippingAddress)
          : channel === "takeaway" || channel === "dine_in"
            ? `Pickup: ${merchant.address || merchant.name}${merchant.city ? `, ${merchant.city}` : ""}`
            : null;

    const paymentStatus =
      payMethod === "card" || payMethod === "pay_later"
        ? "awaiting_payment"
        : giftCardDiscount > 0 && preCardTotal <= 0
          ? "completed"
          : "cash";

    const prepMinutes =
      channel === "delivery"
        ? Number(merchant.deliveryEtaMinutes ?? 45)
        : Number(merchant.pickupEtaMinutes ?? 25);
    const estimatedReadyAt = scheduledFor
      ? new Date(scheduledFor)
      : new Date(Date.now() + prepMinutes * 60 * 1000);

    let deliveryLat: string | null = null;
    let deliveryLng: string | null = null;
    let deliveryTrackingToken: string | null = null;
    if (channel === "delivery") {
      const { generateDeliveryTrackingToken } = await import("@/lib/delivery-tracking-url");
      deliveryTrackingToken = generateDeliveryTrackingToken();
      const latNum = lat != null ? Number(lat) : NaN;
      const lngNum = lng != null ? Number(lng) : NaN;
      if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
        deliveryLat = String(latNum);
        deliveryLng = String(lngNum);
      } else if (addressText) {
        try {
          const geo = await geocodeQuery(addressText);
          if (geo?.lat != null && geo?.lng != null) {
            deliveryLat = String(geo.lat);
            deliveryLng = String(geo.lng);
          }
        } catch {
          /* geocode optional */
        }
      }
    }

    // Prefer logged-in customer for loyalty redemptions
    if ((totalPointsRedeemed > 0 || requestedCashPoints > 0) && authCustomer.customerId) {
      customerId = authCustomer.customerId;
    }

    const { normalizeDeliveryPlatformSettings } = await import("@/lib/delivery-platform-settings");
    const deliverySettings = normalizeDeliveryPlatformSettings(merchant.deliveryPlatformSettings);
    const qrSettings = normalizeTableQrSettings(merchant.tableQrSettings);
    const shopAutoAccept = deliverySettings.onlineShopAutoAccept;
    const qrAutoAccept = isQrTableOrder && qrSettings.qrAutoApprove;
    const initialOrderStatus = shopAutoAccept || qrAutoAccept ? "preparing" : "pending_approval";
    const resolvedOrderSource = isQrTableOrder
      ? "qr_table"
      : requestedOrderSource === "qr_table"
        ? "qr_table"
        : "online_shop";
    const resolvedCustomerName =
      customerName?.trim() ||
      (resolvedTableLabel ? `Table ${resolvedTableLabel}` : isQrTableOrder ? "Table guest" : "");
    const resolvedCustomerPhone = customerPhone?.trim() || (isQrTableOrder ? "QR" : "");

    const [order] = await db
      .insert(schema.orders)
      .values({
        merchantId: merchant.id,
        orderNumber,
        customerId,
        orderType: "web_shop",
        orderSource: resolvedOrderSource,
        fulfillmentChannel: channel,
        status: initialOrderStatus,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        discountAmount: roundMoney2(offerDiscount + voucherDiscount + pointsDiscount + giftCardDiscount).toFixed(2),
        deliveryFee: deliveryFee.toFixed(2),
        tipAmount: tip.toFixed(2),
        cardFee: cardFee.toFixed(2),
        pointsDiscount: pointsDiscount.toFixed(2),
        pointsEarned: 0,
        pointsRedeemed: totalPointsRedeemed,
        total: total.toFixed(2),
        paymentMethod: giftCardDiscount > 0 && preCardTotal <= 0 ? "gift_card" : payMethod,
        paymentStatus,
        paymentBreakdown:
          giftCardDiscount > 0
            ? [
                { method: "gift_card", amount: giftCardDiscount },
                ...(preCardTotal > 0 ? [{ method: payMethod, amount: preCardTotal }] : []),
              ]
            : null,
        notes: notesWithRounding || null,
        shippingAddress: addressText,
        deliveryZoneId,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        estimatedReadyAt,
        customerName: resolvedCustomerName,
        customerPhone: resolvedCustomerPhone,
        customerEmail: emailNorm || null,
        tableId: qrTableId,
        tableLabel: resolvedTableLabel,
        tableSessionId: resolvedTableSession?.id ?? null,
        deliveryLatitude: deliveryLat,
        deliveryLongitude: deliveryLng,
        deliveryTrackingToken,
      })
      .returning();

    try {
      const { MarketingService } = await import("@/services/marketing.service");
      await MarketingService.touchLastOrder(merchant.id, {
        customerId,
        email: emailNorm || null,
        at: new Date(),
      });
    } catch {
      /* non-fatal */
    }

    for (const line of lineItems) {
      await db.insert(schema.orderItems).values({
        orderId: order.id,
        productId: line.productId,
        productName: line.productName,
        quantity: line.quantity.toString(),
        unitPrice: line.unitPrice.toFixed(2),
        totalPrice: line.totalPrice.toFixed(2),
        taxAmount: line.taxAmount.toFixed(2),
        selectedExtras: line.selectedExtras,
        comboSelections: line.comboSelections,
      });
    }

    if (appliedVoucher && voucherDiscount > 0) {
      try {
        await VoucherService.redeem(merchant.id, appliedVoucher.voucherId, {
          orderId: order.id,
          customerId: customerId || authCustomer.customerId || null,
          discountAmount: voucherDiscount,
          code: appliedVoucher.code,
        });
      } catch (error) {
        await db.delete(schema.orders).where(eq(schema.orders.id, order.id));
        return res.status(400).json({
          error: error instanceof Error ? error.message : "Voucher could not be applied",
        });
      }
    }

    if (giftCardDiscount > 0 && trimmedGiftCode) {
      try {
        await ShopGiftCardService.redeemForOrder(
          merchant.id,
          trimmedGiftCode,
          giftCardDiscount,
          order.id
        );
      } catch (error) {
        await db.delete(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
        await db.delete(schema.orders).where(eq(schema.orders.id, order.id));
        return res.status(400).json({
          error: error instanceof Error ? error.message : "Gift card could not be applied",
        });
      }
    }

    // Redeem after insert so events carry orderId; roll back order on failure
    if (totalPointsRedeemed > 0 && customerId) {
      let burnedSoFar = 0;
      try {
        for (const rl of rewardLines) {
          await ShopLoyaltyService.redeemPoints({
            merchantId: merchant.id,
            customerId,
            points: rl.points,
            orderId: order.id,
            productId: rl.productId,
            eventType: "redeem_product",
            meta: { quantity: rl.quantity },
          });
          burnedSoFar += rl.points;
        }
        if (cashPointsUsed > 0) {
          await ShopLoyaltyService.redeemPoints({
            merchantId: merchant.id,
            customerId,
            points: cashPointsUsed,
            orderId: order.id,
            eventType: "redeem_cash",
            meta: { discountChf: pointsDiscount },
          });
          burnedSoFar += cashPointsUsed;
        }
      } catch (redeemErr) {
        if (burnedSoFar > 0) {
          try {
            await ShopLoyaltyService.earnPoints({
              merchantId: merchant.id,
              customerId,
              points: burnedSoFar,
              expiryDays: loyaltyProgram.expiryDays,
              source: "adjustment",
              orderId: order.id,
            });
          } catch {
            /* best-effort restore */
          }
        }
        await db.delete(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
        await db.delete(schema.orders).where(eq(schema.orders.id, order.id));
        throw redeemErr;
      }
    }

    let finalOrder = order;
    // Earn immediately on cash; card earns on confirm-payment; pay_later earns on collect
    if (payMethod === "cash" && customerId && loyaltyProgram.enabled) {
      finalOrder = (await earnLoyaltyForOrder(merchant, order)) as typeof order;
    }

    if (shopAutoAccept) {
      const { enterKitchenFromOrder } = await import("@/services/kitchen-ingress.service");
      void enterKitchenFromOrder(merchant.id, order.id, {
        printKitchen: true,
        orderSource: "online_shop",
      });
    }

    // Till notification on arrival; kitchen ticket when auto-accept, on-arrival setting, or later on Accept.
    const { normalizePosPrintSettings } = await import("@/lib/pos-print-settings");
    const arrivalPrint = normalizePosPrintSettings(merchant.posPrintSettings);
    const kitchenOnArrival =
      !shopAutoAccept && arrivalPrint.autoPrintOnlineOrdersOnArrival === true;

    try {
      const { DeliveryPlatformService } = await import("@/services/delivery-platform.service");
      await DeliveryPlatformService.enqueueAutoPrint(merchant.id, order.id, "online_shop", {
        printDeliveryReceipt: order.fulfillmentChannel === "delivery",
        printNotification: !shopAutoAccept && order.fulfillmentChannel !== "delivery",
        printKitchen: kitchenOnArrival,
        printReceipt: false,
      });
    } catch (printErr) {
      console.warn("Shop order notification print enqueue failed:", printErr);
    }

    try {
      const { ShopOrderEmailService } = await import("@/services/shop-order-email.service");
      const guestLocale = String((req.body as { locale?: string })?.locale || req.headers["x-shop-locale"] || "");
      await ShopOrderEmailService.sendGuestOrderEmail(merchant.id, order.id, "received", {
        guestLocale: guestLocale || null,
      });
    } catch (mailErr) {
      console.warn("Shop order confirmation email failed:", mailErr);
    }

    let paymentSession: unknown = null;
    if (payMethod === "card" && preCardTotal > 0) {
      try {
        const domain = process.env.DOMAIN || "manupos.webprintmedia.swiss";
        const returnUrl = `https://${domain}/shop/${merchant.slug || req.params.slug}/order/${order.id}?paid=1`;
        const session = await AdyenService.initializePaymentSession(
          merchant.id,
          order.id,
          parseFloat(finalOrder.total.toString()),
          "CHF",
          returnUrl
        );
        paymentSession = {
          id: session.id,
          sessionData: session.sessionData,
          clientKey: merchant.adyenClientId,
          environment:
            (process.env.ADYEN_ENVIRONMENT || "test").toLowerCase() === "live" ? "live" : "test",
        };
      } catch (e) {
        // Card selected but Adyen not ready — keep order awaiting_payment; client can retry or switch
        paymentSession = {
          error: e instanceof Error ? e.message : "Adyen not configured",
          demoConfirmAvailable: true,
        };
      }
    }

    res.status(201).json({
      success: true,
      order: {
        id: finalOrder.id,
        orderNumber: finalOrder.orderNumber,
        status: finalOrder.status,
        fulfillmentChannel: finalOrder.fulfillmentChannel,
        paymentMethod: finalOrder.paymentMethod,
        paymentStatus: finalOrder.paymentStatus,
        subtotal: finalOrder.subtotal,
        deliveryFee: finalOrder.deliveryFee,
        tipAmount: finalOrder.tipAmount,
        cardFee: finalOrder.cardFee,
        taxAmount: finalOrder.taxAmount,
        pointsDiscount: finalOrder.pointsDiscount,
        pointsEarned: finalOrder.pointsEarned,
        pointsRedeemed: finalOrder.pointsRedeemed,
        total: finalOrder.total,
        scheduledFor: finalOrder.scheduledFor,
        shippingAddress: finalOrder.shippingAddress,
        customerName: finalOrder.customerName,
        customerPhone: finalOrder.customerPhone,
        customerEmail: finalOrder.customerEmail,
        notes: finalOrder.notes,
      },
      paymentSession,
    });
  } catch (error) {
    console.error("Shop order error:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create order" });
  }
});

/**
 * GET /api/shop/:slug/orders/:orderId/tracking?token= — guest live driver map
 */
router.get("/:slug/orders/:orderId/tracking", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const token = String(req.query.token || "").trim();
    if (!token) return res.status(400).json({ error: "Tracking token required" });
    const { DeliveryTrackingService } = await import("@/services/delivery-tracking.service");
    const payload = await DeliveryTrackingService.getPublicTracking(
      merchant.id,
      req.params.orderId,
      token
    );
    res.json({ success: true, ...payload });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to load tracking";
    res.status(msg.includes("Invalid") ? 403 : 404).json({ error: msg });
  }
});

/**
 * GET /api/shop/:slug/orders/:orderId — confirmation / tracking
 */
router.get("/:slug/orders/:orderId", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, req.params.orderId), eq(schema.orders.merchantId, merchant.id)),
      with: { items: true },
    });
    if (!order || order.orderType !== "web_shop") {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        fulfillmentChannel: order.fulfillmentChannel,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        tipAmount: order.tipAmount,
        cardFee: order.cardFee,
        taxAmount: order.taxAmount,
        pointsDiscount: order.pointsDiscount,
        pointsEarned: order.pointsEarned,
        pointsRedeemed: order.pointsRedeemed,
        total: order.total,
        scheduledFor: order.scheduledFor,
        estimatedReadyAt: order.estimatedReadyAt,
        shippingAddress: order.shippingAddress,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail,
        notes: order.notes,
        createdAt: order.createdAt,
        items: order.items,
        store: {
          name: merchant.name,
          address: merchant.address,
          city: merchant.city,
          phone: merchant.phone,
          shopLogoUrl: merchant.shopLogoUrl || null,
          cmsHomepageEnabled: !!merchant.cmsHomepageEnabled,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load order" });
  }
});

/**
 * POST /api/shop/:slug/orders/:orderId/payment-session
 */
router.post("/:slug/orders/:orderId/payment-session", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, req.params.orderId), eq(schema.orders.merchantId, merchant.id)),
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.paymentStatus === "completed") {
      return res.json({ success: true, alreadyPaid: true });
    }

    const domain = process.env.DOMAIN || "manupos.webprintmedia.swiss";
    const returnUrl = `https://${domain}/shop/${merchant.slug || req.params.slug}/order/${order.id}?paid=1`;
    const session = await AdyenService.initializePaymentSession(
      merchant.id,
      order.id,
      parseFloat(order.total.toString()),
      "CHF",
      returnUrl
    );
    res.json({
      success: true,
      paymentSession: {
        id: session.id,
        sessionData: session.sessionData,
        clientKey: merchant.adyenClientId,
        environment:
          (process.env.ADYEN_ENVIRONMENT || "test").toLowerCase() === "live" ? "live" : "test",
      },
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Payment session failed",
      demoConfirmAvailable: true,
    });
  }
});

/**
 * POST /api/shop/:slug/orders/:orderId/confirm-payment
 * Marks card order paid after Adyen success (or demo confirm when Adyen unavailable).
 */
router.post("/:slug/orders/:orderId/confirm-payment", async (req: Request, res: Response) => {
  try {
    const merchant = await resolveMerchant(req.params.slug);
    if (!merchant?.shopEnabled) return res.status(404).json({ error: "Shop not found" });
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, req.params.orderId), eq(schema.orders.merchantId, merchant.id)),
    });
    if (!order) return res.status(404).json({ error: "Order not found" });

    const [updated] = await db
      .update(schema.orders)
      .set({
        paymentStatus: "completed",
        paymentMethod: "card",
        adyenReference: req.body.pspReference || req.body.adyenReference || order.adyenReference,
        // Keep kitchen lifecycle — paid card orders still need staff accept
        status:
          order.status === "awaiting_payment" || order.status === "pending"
            ? "pending_approval"
            : order.status,
      })
      .where(eq(schema.orders.id, order.id))
      .returning();

    try {
      await AdyenService.recordPaymentTransaction(
        merchant.id,
        order.id,
        parseFloat(order.total.toString()),
        "card",
        String(req.body.pspReference || `DEMO-${order.orderNumber}`),
        "completed"
      );
    } catch {
      /* optional */
    }

    let finalOrder = updated;
    try {
      finalOrder = (await earnLoyaltyForOrder(merchant, updated)) as typeof updated;
    } catch (earnErr) {
      console.error("Loyalty earn on confirm-payment failed:", earnErr);
    }

    try {
      const { DeliveryPlatformService } = await import("@/services/delivery-platform.service");
      await DeliveryPlatformService.enqueueAutoPrint(merchant.id, order.id, "online_shop", {
        printKitchen: false,
        printDeliveryReceipt: updated.fulfillmentChannel === "delivery",
        printNotification: false,
        printReceipt: updated.fulfillmentChannel !== "delivery",
      });
    } catch (printErr) {
      console.warn("Confirm-payment receipt print enqueue failed:", printErr);
    }

    res.json({ success: true, order: finalOrder });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Confirm failed" });
  }
});

export default router;
