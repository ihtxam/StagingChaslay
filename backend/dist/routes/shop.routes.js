"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const merchant_settings_service_1 = require("@/services/merchant-settings.service");
const geo_1 = require("@/lib/geo");
const money_1 = require("@/lib/money");
const tax_discount_1 = require("@/lib/tax-discount");
const shop_customer_service_1 = require("@/services/shop-customer.service");
const shop_loyalty_service_1 = require("@/services/shop-loyalty.service");
const adyen_service_1 = require("@/services/adyen.service");
const auth_service_1 = require("@/services/auth.service");
const modifier_service_1 = require("@/services/modifier.service");
const cms_service_1 = require("@/services/cms.service");
const combo_1 = require("@/lib/combo");
const vacation_1 = require("@/lib/vacation");
const geocode_1 = require("@/lib/geocode");
const offers_service_1 = require("@/services/offers.service");
const voucher_service_1 = require("@/services/voucher.service");
const shop_gift_card_service_1 = require("@/services/shop-gift-card.service");
const web_order_number_1 = require("@/lib/web-order-number");
const router = (0, express_1.Router)();
function serializeShopModifierGroup(g) {
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
            .filter((o) => (o.saleStatus || "in_stock") !== "out_of_stock")
            .map((o) => ({
            id: o.id,
            name: o.name,
            price: pricingType === "free" ? 0 : parseFloat(o.price?.toString() || "0"),
            isDefault: !!o.isDefault,
        })),
    };
}
function mapShopProduct(p, modifierGroups, catalogById, groupsByProduct) {
    const extras = Array.isArray(p.extras) ? p.extras : [];
    const isCombo = p.productType === "combo";
    const slots = isCombo ? (0, combo_1.normalizeComboSlots)(p.comboItems) : [];
    const comboSlots = slots.map((slot) => ({
        id: slot.id,
        name: slot.name,
        minPick: slot.minPick,
        maxPick: slot.maxPick,
        options: slot.options
            .map((opt) => {
            const child = catalogById?.get(opt.productId);
            if (!child || child.isActive === false)
                return null;
            const childGroups = groupsByProduct?.get(child.id) || [];
            const childExtras = Array.isArray(child.extras) ? child.extras : [];
            return {
                productId: child.id,
                name: child.name,
                image: child.imageUrl,
                description: child.description,
                extraPrice: (0, money_1.roundMoney2)(opt.extraPrice),
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
            .filter((s) => s?.name?.trim() && (s.saleStatus || "in_stock") !== "out_of_stock")
            .map((s, i) => ({
            id: s.id || `spec-${i + 1}`,
            name: s.name.trim(),
            price: (0, money_1.roundMoney2)(Number(s.price) || 0),
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
        loyaltyRewardPoints: rewardPts != null && Number.isFinite(rewardPts) && rewardPts >= 1 ? Math.floor(rewardPts) : null,
    };
}
async function earnLoyaltyForOrder(merchant, order) {
    if (!order.customerId)
        return order;
    if ((order.pointsEarned || 0) > 0)
        return order;
    const program = shop_loyalty_service_1.ShopLoyaltyService.programFromMerchant(merchant);
    if (!program.enabled)
        return order;
    const subtotal = parseFloat(order.subtotal?.toString() || "0");
    const pointsDiscount = parseFloat(order.pointsDiscount?.toString() || "0");
    const paidFood = Math.max(0, subtotal - pointsDiscount);
    const points = shop_loyalty_service_1.ShopLoyaltyService.computeEarnPoints(paidFood, program.earnPointsPerChf);
    if (points <= 0) {
        const db = (0, db_1.getDb)();
        const [updated] = await db
            .update(db_1.schema.orders)
            .set({ pointsEarned: 0 })
            .where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, order.id))
            .returning();
        return updated || order;
    }
    await shop_loyalty_service_1.ShopLoyaltyService.earnPoints({
        merchantId: merchant.id,
        customerId: order.customerId,
        orderId: order.id,
        points,
        expiryDays: program.expiryDays,
        source: "earn",
    });
    const db = (0, db_1.getDb)();
    const [updated] = await db
        .update(db_1.schema.orders)
        .set({ pointsEarned: points })
        .where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, order.id))
        .returning();
    return updated || { ...order, pointsEarned: points };
}
async function resolveShopComboSelections(merchantId, comboProduct, requested) {
    const rawSlots = (0, combo_1.normalizeComboSlots)(comboProduct.comboItems);
    if (!rawSlots.length) {
        return { selections: [], surcharge: 0 };
    }
    // Drop options for inactive/missing products (same as public menu), then skip empty slots
    const db = (0, db_1.getDb)();
    const allOptionIds = [...new Set(rawSlots.flatMap((s) => s.options.map((o) => o.productId)))];
    const activeChildren = allOptionIds.length === 0
        ? []
        : await db.query.products.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.products.id, allOptionIds), (0, drizzle_orm_1.eq)(db_1.schema.products.isActive, true)),
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
    const usedPickIndexes = new Set();
    const takePicksForSlot = (slot) => {
        const byId = [];
        picks.forEach((pick, idx) => {
            if (usedPickIndexes.has(idx))
                return;
            if (pick.slotId && pick.slotId === slot.id) {
                byId.push(pick);
                usedPickIndexes.add(idx);
            }
        });
        if (byId.length)
            return byId;
        const byName = [];
        const slotNameKey = slot.name.trim().toLowerCase();
        picks.forEach((pick, idx) => {
            if (usedPickIndexes.has(idx))
                return;
            const name = String(pick.slotName || "").trim().toLowerCase();
            if (name && name === slotNameKey) {
                byName.push(pick);
                usedPickIndexes.add(idx);
            }
        });
        if (byName.length)
            return byName;
        // Last resort: productId unique to this slot among remaining picks
        const optionIds = new Set(slot.options.map((o) => o.productId));
        const unique = [];
        picks.forEach((pick, idx) => {
            if (usedPickIndexes.has(idx))
                return;
            if (!optionIds.has(pick.productId))
                return;
            const alsoInOther = slots.some((other) => other.id !== slot.id && other.options.some((o) => o.productId === pick.productId));
            if (!alsoInOther) {
                unique.push(pick);
                usedPickIndexes.add(idx);
            }
        });
        return unique;
    };
    const selections = [];
    let surcharge = 0;
    const childById = new Map(activeChildren.map((p) => [p.id, p]));
    for (const slot of slots) {
        const slotPicks = takePicksForSlot(slot);
        if (slotPicks.length < slot.minPick) {
            return {
                selections: [],
                surcharge: 0,
                error: `For "${comboProduct.name}": please choose ${slot.minPick === 1 ? "an option" : `${slot.minPick} options`} for "${slot.name}"`,
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
            const extraPrice = (0, money_1.roundMoney2)(opt.extraPrice);
            const extrasTotal = (0, money_1.roundMoney2)(extrasResolved.extras.reduce((s, e) => s + e.price, 0));
            surcharge = (0, money_1.roundMoney2)(surcharge + extraPrice + extrasTotal);
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
async function loadModifierGroupsByProduct(merchantId, productIds) {
    const byProduct = new Map();
    if (!productIds.length)
        return byProduct;
    const db = (0, db_1.getDb)();
    const links = await db.query.productModifierGroups.findMany({
        where: (0, drizzle_orm_1.inArray)(db_1.schema.productModifierGroups.productId, productIds),
        with: {
            group: {
                with: {
                    options: { orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.modifierOptions.sortOrder)] },
                },
            },
        },
        orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.productModifierGroups.sortOrder)],
    });
    for (const link of links) {
        const g = link.group;
        if (!g || g.merchantId !== merchantId || g.isActive === false)
            continue;
        const list = byProduct.get(link.productId) || [];
        list.push(serializeShopModifierGroup(g));
        byProduct.set(link.productId, list);
    }
    return byProduct;
}
/** Resolve and price selected extras from DB (never trust client prices). */
async function resolveShopLineExtras(merchantId, product, requested, opts) {
    const groups = await modifier_service_1.ModifierService.getGroupsForProduct(merchantId, product.id);
    const optionById = new Map();
    const optionsByGroup = new Map();
    for (const g of groups) {
        const list = [];
        for (const o of g.options) {
            if (o.saleStatus === "out_of_stock")
                continue;
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
            if (!e?.id)
                continue;
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
    const extras = [];
    const countsByGroup = new Map();
    const seen = new Set();
    for (const id of reqIds) {
        const opt = optionById.get(id);
        if (!opt) {
            // Ignore stale combo-flattened ids if they leaked into parent extras
            if (String(id).startsWith("combo:"))
                continue;
            return { extras: [], error: `Invalid extra selected for ${product.name}` };
        }
        if (seen.has(opt.id))
            continue;
        seen.add(opt.id);
        extras.push({ id: opt.id, name: opt.name, price: (0, money_1.roundMoney2)(opt.price) });
        countsByGroup.set(opt.groupId, (countsByGroup.get(opt.groupId) || 0) + 1);
    }
    for (const g of groups) {
        let count = countsByGroup.get(g.id) || 0;
        const min = g.selectionType === "required"
            ? Math.max(1, Number(g.minSelectable) || 1)
            : Math.max(0, Number(g.minSelectable) || 0);
        const max = Math.max(min, Number(g.maxSelectable) || 1);
        if (count < min && opts?.fillDefaultsIfMissing) {
            const pool = optionsByGroup.get(g.id) || [];
            const defaults = pool.filter((o) => o.isDefault);
            const fillFrom = defaults.length ? defaults : pool;
            for (const o of fillFrom) {
                if (count >= min)
                    break;
                if (seen.has(o.id))
                    continue;
                seen.add(o.id);
                extras.push({ id: o.id, name: o.name, price: (0, money_1.roundMoney2)(o.price) });
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
async function resolveMerchant(slugOrHost) {
    const merchant = await merchant_settings_service_1.MerchantSettingsService.resolveByShopHost(slugOrHost);
    if (!merchant)
        return null;
    if (merchant.status === "suspended" || merchant.status === "expired")
        return null;
    return merchant;
}
function channelEnabled(merchant, channel) {
    if (channel === "delivery")
        return merchant.deliveryEnabled;
    if (channel === "dine_in")
        return merchant.dineInEnabled;
    return merchant.pickupEnabled;
}
function mapChannelKey(channel) {
    return channel === "dine_in" ? "dine_in" : channel === "delivery" ? "delivery" : "takeaway";
}
async function findMatchingZone(merchantId, lng, lat, zip) {
    const db = (0, db_1.getDb)();
    const zones = await db.query.deliveryZones.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.deliveryZones.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.deliveryZones.isActive, true)),
        orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.deliveryZones.sortOrder)],
    });
    if (lng != null && lat != null && Number.isFinite(lng) && Number.isFinite(lat)) {
        const hit = zones.find((z) => (0, geo_1.pointInPolygon)(lng, lat, (z.polygon || [])));
        if (hit)
            return hit;
    }
    if (zip) {
        const normalized = String(zip).trim().toLowerCase();
        const hit = zones.find((z) => (z.zipCodes || []).some((c) => String(c).trim().toLowerCase() === normalized));
        if (hit)
            return hit;
    }
    return null;
}
/**
 * GET /api/shop/tls-ask?domain=
 */
router.get("/tls-ask", async (req, res) => {
    try {
        const domain = String(req.query.domain || "").toLowerCase().split(":")[0];
        if (!domain)
            return res.status(400).end();
        const merchant = await resolveMerchant(domain);
        if (merchant?.shopEnabled &&
            (merchant.subdomain || merchant.customDomain === domain || merchant.slug)) {
            return res.status(200).end();
        }
        return res.status(404).end();
    }
    catch {
        return res.status(404).end();
    }
});
/**
 * GET /api/shop/:slug
 */
router.get("/:slug", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant || !merchant.shopEnabled) {
            return res.status(404).json({ error: "Shop not found or closed" });
        }
        const hours = (merchant.storeHours || {});
        const channels = {
            takeaway: {
                enabled: merchant.pickupEnabled,
                ...(0, geo_1.isChannelOpenNow)(hours, "takeaway"),
                etaMinutes: merchant.pickupEtaMinutes ?? 25,
            },
            dine_in: {
                enabled: merchant.dineInEnabled,
                ...(0, geo_1.isChannelOpenNow)(hours, "dine_in"),
                etaMinutes: merchant.pickupEtaMinutes ?? 25,
            },
            delivery: {
                enabled: merchant.deliveryEnabled,
                ...(0, geo_1.isChannelOpenNow)(hours, "delivery"),
                etaMinutes: merchant.deliveryEtaMinutes ?? 45,
            },
        };
        const displayHours = (0, geo_1.getDisplayHoursNow)(hours, "takeaway");
        const cmsTheme = merchant.cmsHomepageEnabled
            ? await cms_service_1.CmsService.getPublishedTheme(merchant.id)
            : null;
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
                shopLogoUrl: merchant.shopLogoUrl,
                shopBannerUrl: merchant.shopBannerUrl,
                taxTakeawayRate: merchant.taxTakeawayRate,
                taxDineInRate: merchant.taxDineInRate,
                taxDeliveryRate: merchant.taxDeliveryRate,
                vatRate: merchant.vatRate,
                taxIncludedInPrice: merchant.taxIncludedInPrice === true,
                vatAfterDiscount: merchant.vatAfterDiscount !== false,
                deliveryMenuMarkup: merchant.deliveryMenuMarkup ?? "0",
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
                loyalty: shop_loyalty_service_1.ShopLoyaltyService.programFromMerchant(merchant),
                giftCards: shop_gift_card_service_1.ShopGiftCardService.publicSettings(shop_gift_card_service_1.ShopGiftCardService.settingsFromMerchant(merchant)),
                reservationsEnabled: !!merchant.reservationsEnabled,
                acceptingOrders: merchant.acceptingOrders !== false,
                acceptingReservations: merchant.acceptingReservations !== false,
                vacation: (0, vacation_1.vacationPublicPayload)(merchant.vacationSettings),
                /** Merchant panel language — used as shop default when customer has no preference */
                language: merchant.shopLanguage || merchant.panelLanguage || "en",
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load shop" });
    }
});
/**
 * GET /api/shop/:slug/pages/home — published CMS homepage
 */
router.get("/:slug/pages/home", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled) {
            return res.status(404).json({ error: "Shop not found or closed" });
        }
        const page = await cms_service_1.CmsService.getPublishedHomepage(merchant.id);
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
                    vacation: (0, vacation_1.vacationPublicPayload)(merchant.vacationSettings),
                    language: merchant.shopLanguage || merchant.panelLanguage || "en",
                },
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load homepage" });
    }
});
/**
 * GET /api/shop/:slug/pages/:pageSlug — published CMS page by slug
 */
router.get("/:slug/pages/:pageSlug", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled) {
            return res.status(404).json({ error: "Shop not found or closed" });
        }
        if (req.params.pageSlug === "home") {
            const home = await cms_service_1.CmsService.getPublishedHomepage(merchant.id);
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
        const page = await cms_service_1.CmsService.getPublishedBySlug(merchant.id, req.params.pageSlug);
        if (!page)
            return res.status(404).json({ error: "Page not found" });
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
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load page" });
    }
});
/**
 * GET /api/shop/:slug/loyalty — public program + rewards; full summary when customer Bearer present
 */
router.get("/:slug/loyalty", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
        const { customerId } = optionalCustomer(req);
        if (customerId) {
            const summary = await shop_loyalty_service_1.ShopLoyaltyService.getCustomerLoyaltySummary(merchant.id, customerId);
            return res.json({ success: true, ...summary });
        }
        const pub = await shop_loyalty_service_1.ShopLoyaltyService.getPublicLoyalty(merchant.id);
        res.json({ success: true, ...pub });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load loyalty" });
    }
});
/**
 * GET /api/shop/:slug/my-orders — authenticated customer web_shop order history
 */
router.get("/:slug/my-orders", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
        const { customerId } = optionalCustomer(req);
        if (!customerId)
            return res.status(401).json({ error: "Not logged in" });
        const db = (0, db_1.getDb)();
        const orders = await db.query.orders.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchant.id), (0, drizzle_orm_1.eq)(db_1.schema.orders.customerId, customerId), (0, drizzle_orm_1.eq)(db_1.schema.orders.orderType, "web_shop")),
            with: { items: true },
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.orders.createdAt)],
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
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load orders" });
    }
});
/**
 * GET /api/shop/:slug/menu
 */
router.get("/:slug/menu", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant || !merchant.shopEnabled) {
            return res.status(404).json({ error: "Shop not found or closed" });
        }
        const db = (0, db_1.getDb)();
        const [categories, products] = await Promise.all([
            db.query.categories.findMany({
                where: (0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchant.id),
                orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.categories.sortOrder)],
            }),
            db.query.products.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchant.id), (0, drizzle_orm_1.eq)(db_1.schema.products.isActive, true)),
                orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.products.sortOrder), (0, drizzle_orm_1.asc)(db_1.schema.products.name)],
            }),
        ]);
        const groupsByProduct = await loadModifierGroupsByProduct(merchant.id, products.map((p) => p.id));
        const catalogById = new Map(products.map((p) => [p.id, p]));
        const toItem = (p) => mapShopProduct(p, groupsByProduct.get(p.id) || [], catalogById, groupsByProduct);
        const menu = categories.map((cat) => ({
            id: cat.id,
            name: cat.name,
            image: cat.imageUrl || null,
            isOffersCategory: !!cat.isOffersCategory,
            items: products.filter((p) => p.categoryId === cat.id).map(toItem),
        }));
        const uncategorized = products.filter((p) => !p.categoryId);
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
        const activeOffers = await offers_service_1.OffersService.listActivePublic(merchant.id);
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
        });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load menu" });
    }
});
/**
 * GET /api/shop/:slug/delivery-zones
 */
router.get("/:slug/delivery-zones", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant || !merchant.shopEnabled) {
            return res.status(404).json({ error: "Shop not found or closed" });
        }
        const db = (0, db_1.getDb)();
        const zones = await db.query.deliveryZones.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.deliveryZones.merchantId, merchant.id), (0, drizzle_orm_1.eq)(db_1.schema.deliveryZones.isActive, true)),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.deliveryZones.sortOrder)],
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
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load zones" });
    }
});
/**
 * GET /api/shop/:slug/postal-suggest?q=80
 * Swiss PLZ autocomplete → zip + city name(s)
 */
router.get("/:slug/postal-suggest", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant || !merchant.shopEnabled) {
            return res.status(404).json({ error: "Shop not found" });
        }
        const { suggestSwissPostal, cityForSwissPostal } = await Promise.resolve().then(() => __importStar(require("@/data/swiss-postal")));
        const q = String(req.query.q || "");
        const suggestions = suggestSwissPostal(q, 15);
        const exact = cityForSwissPostal(q);
        res.json({
            success: true,
            suggestions,
            city: exact,
        });
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Postal lookup failed",
        });
    }
});
/**
 * POST /api/shop/:slug/geocode
 * Body: { query }
 */
router.post("/:slug/geocode", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant || !merchant.shopEnabled) {
            return res.status(404).json({ error: "Shop not found" });
        }
        const query = String(req.body.query || "").trim();
        if (!query)
            return res.status(400).json({ error: "query required" });
        const result = await (0, geocode_1.geocodeQuery)(query);
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
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Geocode failed" });
    }
});
/**
 * POST /api/shop/:slug/check-delivery
 * Body: { lat, lng, zipCode?, subtotal? }
 */
router.post("/:slug/check-delivery", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant || !merchant.shopEnabled || !merchant.deliveryEnabled) {
            return res.status(404).json({ error: "Delivery not available" });
        }
        const hours = (0, geo_1.isChannelOpenNow)((merchant.storeHours || {}), "delivery");
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
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Check failed" });
    }
});
function optionalCustomer(req) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer "))
            return {};
        const payload = auth_service_1.AuthService.verifyToken(authHeader.slice(7));
        if (payload.role === "customer" && payload.customerId) {
            return { customerId: payload.customerId };
        }
    }
    catch {
        /* guest */
    }
    return {};
}
/**
 * POST /api/shop/:slug/auth/register
 */
router.post("/:slug/auth/register", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
        const result = await shop_customer_service_1.ShopCustomerService.register(merchant.id, req.body);
        res.status(201).json({ success: true, ...result });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Register failed" });
    }
});
/**
 * POST /api/shop/:slug/auth/login
 */
router.post("/:slug/auth/login", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
        const { email, password } = req.body;
        const result = await shop_customer_service_1.ShopCustomerService.login(merchant.id, email, password);
        res.json({ success: true, ...result });
    }
    catch (error) {
        res.status(401).json({ error: error instanceof Error ? error.message : "Login failed" });
    }
});
/**
 * GET /api/shop/:slug/auth/me
 */
router.get("/:slug/auth/me", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
        const { customerId } = optionalCustomer(req);
        if (!customerId)
            return res.status(401).json({ error: "Not logged in" });
        const customer = await shop_customer_service_1.ShopCustomerService.getProfile(customerId, merchant.id);
        res.json({ success: true, customer });
    }
    catch (error) {
        res.status(401).json({ error: error instanceof Error ? error.message : "Unauthorized" });
    }
});
/**
 * PUT /api/shop/:slug/auth/me
 */
router.put("/:slug/auth/me", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
        const { customerId } = optionalCustomer(req);
        if (!customerId)
            return res.status(401).json({ error: "Not logged in" });
        const customer = await shop_customer_service_1.ShopCustomerService.updateProfile(customerId, merchant.id, req.body);
        res.json({ success: true, customer });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Update failed" });
    }
});
/**
 * GET /api/shop/:slug/auth/addresses
 */
router.get("/:slug/auth/addresses", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
        const { customerId } = optionalCustomer(req);
        if (!customerId)
            return res.status(401).json({ error: "Not logged in" });
        const addresses = await shop_customer_service_1.ShopCustomerService.listAddresses(customerId, merchant.id);
        res.json({ success: true, addresses });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * POST /api/shop/:slug/auth/addresses
 */
router.post("/:slug/auth/addresses", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
        const { customerId } = optionalCustomer(req);
        if (!customerId)
            return res.status(401).json({ error: "Not logged in" });
        const address = await shop_customer_service_1.ShopCustomerService.createAddress(customerId, merchant.id, req.body || {});
        res.status(201).json({ success: true, address });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Save failed" });
    }
});
/**
 * PUT /api/shop/:slug/auth/addresses/:addressId
 */
router.put("/:slug/auth/addresses/:addressId", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
        const { customerId } = optionalCustomer(req);
        if (!customerId)
            return res.status(401).json({ error: "Not logged in" });
        const address = await shop_customer_service_1.ShopCustomerService.updateAddress(customerId, merchant.id, req.params.addressId, req.body || {});
        res.json({ success: true, address });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Update failed" });
    }
});
/**
 * DELETE /api/shop/:slug/auth/addresses/:addressId
 */
router.delete("/:slug/auth/addresses/:addressId", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
        const { customerId } = optionalCustomer(req);
        if (!customerId)
            return res.status(401).json({ error: "Not logged in" });
        await shop_customer_service_1.ShopCustomerService.deleteAddress(customerId, merchant.id, req.params.addressId);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Delete failed" });
    }
});
/**
 * GET /api/shop/:slug/reservations/config
 */
router.get("/:slug/reservations/config", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
        const { ReservationService } = await Promise.resolve().then(() => __importStar(require("@/services/reservation.service")));
        const config = ReservationService.getSettingsForMerchant(merchant);
        if (!config.enabled)
            return res.status(404).json({ error: "Reservations are not enabled" });
        const vacation = (0, vacation_1.vacationPublicPayload)(merchant.vacationSettings);
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
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * GET /api/shop/:slug/reservations/slots?date=YYYY-MM-DD&partySize=2
 */
router.get("/:slug/reservations/slots", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled || !merchant.reservationsEnabled) {
            return res.status(404).json({ error: "Reservations not available" });
        }
        const date = String(req.query.date || "");
        const notAccepting = merchant.acceptingReservations === false;
        const vacation = (0, vacation_1.isVacationActive)(merchant.vacationSettings) ||
            (!!date && (0, vacation_1.isDateInVacationPeriods)(merchant.vacationSettings, date));
        const { ReservationService } = await Promise.resolve().then(() => __importStar(require("@/services/reservation.service")));
        const partySize = Number(req.query.partySize) || 2;
        const result = await ReservationService.getSlots(merchant.id, date, partySize);
        res.json({
            success: true,
            ...result,
            notAccepting,
            vacation,
            message: notAccepting
                ? vacation_1.NOT_ACCEPTING_RESERVATIONS_MESSAGE
                : vacation
                    ? vacation_1.VACATION_BLOCK_MESSAGE
                    : undefined,
        });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * POST /api/shop/:slug/reservations
 */
router.post("/:slug/reservations", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled || !merchant.reservationsEnabled) {
            return res.status(404).json({ error: "Reservations not available" });
        }
        if (merchant.acceptingReservations === false) {
            return res.status(400).json({ error: vacation_1.NOT_ACCEPTING_RESERVATIONS_MESSAGE });
        }
        if ((0, vacation_1.isVacationActive)(merchant.vacationSettings)) {
            return res.status(400).json({ error: vacation_1.VACATION_BLOCK_MESSAGE });
        }
        const { ReservationService, zurichLocalToDate } = await Promise.resolve().then(() => __importStar(require("@/services/reservation.service")));
        const auth = optionalCustomer(req);
        let reservedAt;
        if (req.body.date && req.body.time) {
            reservedAt = zurichLocalToDate(String(req.body.date), String(req.body.time));
        }
        else {
            reservedAt = new Date(req.body.reservedAt);
        }
        const reservedYmd = String(req.body.date || "").slice(0, 10);
        if ((reservedYmd && (0, vacation_1.isDateInVacationPeriods)(merchant.vacationSettings, reservedYmd)) ||
            (!reservedYmd &&
                (0, vacation_1.isDateInVacationPeriods)(merchant.vacationSettings, new Intl.DateTimeFormat("en-CA", {
                    timeZone: "Europe/Zurich",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                }).format(reservedAt)))) {
            return res.status(400).json({ error: vacation_1.VACATION_BLOCK_MESSAGE });
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
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to book" });
    }
});
/**
 * POST /api/shop/:slug/vouchers/validate
 * Body: { code, subtotal }
 */
router.post("/:slug/vouchers/validate", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
        const code = String(req.body?.code || "");
        const subtotal = Number(req.body?.subtotal || 0);
        const authCustomer = optionalCustomer(req);
        const result = await voucher_service_1.VoucherService.validateForShop(merchant.id, code, subtotal, authCustomer.customerId);
        res.json({ success: true, ...result });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Invalid voucher" });
    }
});
/**
 * POST /api/shop/:slug/offers/preview
 * Estimate promotional discount for the current cart.
 */
router.post("/:slug/offers/preview", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
        const channel = String(req.body?.channel || "takeaway");
        const at = req.body?.scheduledFor ? new Date(req.body.scheduledFor) : new Date();
        const lines = Array.isArray(req.body?.items) ? req.body.items : [];
        const offers = await offers_service_1.OffersService.list(merchant.id);
        // Resolve missing categoryIds from catalog so % category offers preview correctly
        const productIds = [
            ...new Set(lines
                .map((l) => String(l.productId || ""))
                .filter((id) => !!id)),
        ];
        const categoryByProduct = new Map();
        if (productIds.length) {
            const db = (0, db_1.getDb)();
            const products = await db.query.products.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchant.id), (0, drizzle_orm_1.inArray)(db_1.schema.products.id, productIds)),
                columns: { id: true, categoryId: true },
            });
            for (const p of products)
                categoryByProduct.set(p.id, p.categoryId || null);
        }
        const result = offers_service_1.OffersService.evaluateCart(offers, lines.map((l) => {
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
        }), Number.isNaN(at.getTime()) ? new Date() : at, channel);
        const publicOffers = await offers_service_1.OffersService.listActivePublic(merchant.id, Number.isNaN(at.getTime()) ? new Date() : at, channel);
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
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * GET /api/shop/:slug/payment-options
 */
router.get("/:slug/payment-options", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
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
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * GET /api/shop/:slug/gift-cards/settings — public gift card purchase settings
 */
router.get("/:slug/gift-cards/settings", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
        res.json({
            success: true,
            settings: shop_gift_card_service_1.ShopGiftCardService.publicSettings(shop_gift_card_service_1.ShopGiftCardService.settingsFromMerchant(merchant)),
        });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * GET /api/shop/:slug/gift-cards/balance/:code — public balance lookup
 */
router.get("/:slug/gift-cards/balance/:code", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
        const data = await shop_gift_card_service_1.ShopGiftCardService.lookupPublicBalance(merchant.id, req.params.code);
        res.json({ success: true, ...data });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Card not found" });
    }
});
/**
 * POST /api/shop/:slug/gift-cards/purchase — start online e-gift purchase
 */
router.post("/:slug/gift-cards/purchase", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
        const body = req.body || {};
        const result = await shop_gift_card_service_1.ShopGiftCardService.createOnlinePurchase(merchant, req.params.slug, {
            amount: Number(body.amount),
            recipientEmail: body.recipientEmail,
            recipientName: body.recipientName,
            senderName: body.senderName,
            senderEmail: body.senderEmail,
            message: body.message,
        });
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
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Purchase failed" });
    }
});
/**
 * GET /api/shop/:slug/gift-cards/purchase/:purchaseId
 */
router.get("/:slug/gift-cards/purchase/:purchaseId", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
        const purchase = await shop_gift_card_service_1.ShopGiftCardService.getPurchase(merchant.id, req.params.purchaseId);
        let card = null;
        if (purchase.cardId) {
            const db = (0, db_1.getDb)();
            card = await db.query.giftCards.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.giftCards.id, purchase.cardId),
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
    }
    catch (error) {
        res.status(404).json({ error: error instanceof Error ? error.message : "Not found" });
    }
});
/**
 * POST /api/shop/:slug/gift-cards/purchase/:purchaseId/confirm-payment
 */
router.post("/:slug/gift-cards/purchase/:purchaseId/confirm-payment", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
        const result = await shop_gift_card_service_1.ShopGiftCardService.confirmPurchasePayment(merchant.id, req.params.purchaseId, req.body?.pspReference || req.body?.adyenReference);
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
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Confirm failed" });
    }
});
/**
 * POST /api/shop/:slug/orders — checkout create
 */
router.post("/:slug/orders", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant || !merchant.shopEnabled) {
            return res.status(404).json({ error: "Shop not found or closed" });
        }
        if ((0, vacation_1.isVacationActive)(merchant.vacationSettings)) {
            return res.status(400).json({ error: vacation_1.VACATION_BLOCK_MESSAGE });
        }
        if (merchant.acceptingOrders === false) {
            return res.status(400).json({ error: vacation_1.NOT_ACCEPTING_ORDERS_MESSAGE });
        }
        const { items, customerEmail, customerPhone, customerName, notes, shippingAddress, city, fulfillmentChannel = "takeaway", lat, lng, zipCode, paymentMethod = "cash", tipAmount = 0, scheduledFor, guestCheckout = true, pointsToRedeem = 0, voucherCode, giftCardCode, } = req.body;
        if (scheduledFor) {
            const when = new Date(scheduledFor);
            if (!Number.isNaN(when.getTime())) {
                const ymd = new Intl.DateTimeFormat("en-CA", {
                    timeZone: "Europe/Zurich",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                }).format(when);
                if ((0, vacation_1.isDateInVacationPeriods)(merchant.vacationSettings, ymd)) {
                    return res.status(400).json({ error: vacation_1.VACATION_BLOCK_MESSAGE });
                }
            }
        }
        if (!items?.length) {
            return res.status(400).json({ error: "Order items are required" });
        }
        if (!customerName?.trim() || !customerPhone?.trim()) {
            return res.status(400).json({ error: "Name and phone are required" });
        }
        const rawPay = String(paymentMethod || "cash").toLowerCase().replace(/-/g, "_");
        const payMethod = rawPay === "card" ? "card" : rawPay === "pay_later" ? "pay_later" : "cash";
        const channel = fulfillmentChannel === "dine_in" || fulfillmentChannel === "takeaway" || fulfillmentChannel === "delivery"
            ? fulfillmentChannel
            : "takeaway";
        if (!channelEnabled(merchant, channel)) {
            return res.status(400).json({ error: "This order type is not available" });
        }
        // ASAP orders must be within open hours; scheduled orders must fall inside opening hours
        const isScheduled = !!scheduledFor;
        const allowScheduled = merchant.scheduledOrdersEnabled !== false;
        const channelKey = mapChannelKey(channel);
        const hours = (merchant.storeHours || {});
        if (isScheduled && !allowScheduled) {
            return res.status(400).json({
                error: "Scheduled orders are not available. Please order during opening hours.",
            });
        }
        if (!isScheduled) {
            const openState = (0, geo_1.isChannelOpenNow)(hours, channelKey);
            if (!openState.open) {
                return res.status(400).json({
                    error: allowScheduled
                        ? `Store is closed for ${channel.replace("_", " ")} (${openState.todayLabel}). Please schedule for later.`
                        : `Store is closed for ${channel.replace("_", " ")} (${openState.todayLabel}). Orders are only accepted during opening hours.`,
                });
            }
        }
        else {
            const when = new Date(scheduledFor);
            if (Number.isNaN(when.getTime())) {
                return res.status(400).json({ error: "Invalid scheduled time" });
            }
            if (when.getTime() < Date.now() - 60000) {
                return res.status(400).json({ error: "Scheduled time must be in the future" });
            }
            // Allow up to 3 days ahead
            if (when.getTime() > Date.now() + 3 * 24 * 60 * 60 * 1000) {
                return res.status(400).json({ error: "Scheduled time is too far in the future" });
            }
            if (!(0, geo_1.isWithinChannelHours)(hours, channelKey, when)) {
                return res.status(400).json({
                    error: "Selected time is outside opening hours. Choose another slot.",
                });
            }
        }
        if (channel === "delivery") {
            const addr = typeof shippingAddress === "string"
                ? shippingAddress
                : shippingAddress
                    ? JSON.stringify(shippingAddress)
                    : "";
            if (!addr.trim()) {
                return res.status(400).json({ error: "Delivery address is required" });
            }
        }
        const taxRate = merchant_settings_service_1.MerchantSettingsService.channelTaxRate(merchant, channel);
        const db = (0, db_1.getDb)();
        const authCustomer = optionalCustomer(req);
        const loyaltyProgram = shop_loyalty_service_1.ShopLoyaltyService.programFromMerchant(merchant);
        let subtotal = 0;
        let taxAmount = 0;
        let rewardPointsNeeded = 0;
        const rewardLines = [];
        const lineItems = [];
        for (const item of items) {
            const product = await db.query.products.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.id, item.productId), (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchant.id)),
            });
            if (!product) {
                return res.status(400).json({ error: `Product ${item.productId} not found` });
            }
            const qty = Number(item.quantity) || 0;
            if (qty <= 0)
                continue;
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
                const flatExtras = [
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
            let comboSelections = [];
            let comboSurcharge = 0;
            if (product.productType === "combo") {
                const comboResolved = await resolveShopComboSelections(merchant.id, product, item.comboSelections);
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
            const extrasTotal = (0, money_1.roundMoney2)(resolved.extras.reduce((s, e) => s + e.price, 0));
            const deliveryMarkup = channel === "delivery" ? Math.max(0, Number(merchant.deliveryMenuMarkup || 0) || 0) : 0;
            const unitPrice = (0, money_1.roundMoney2)(parseFloat(product.price.toString()) + deliveryMarkup + extrasTotal + comboSurcharge);
            const totalPrice = (0, money_1.roundMoney2)(unitPrice * qty);
            const lineTax = product.isTaxable ? (0, money_1.roundMoney2)((totalPrice * taxRate) / 100) : 0;
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
        const offerAt = scheduledFor ? new Date(scheduledFor) : new Date();
        const activeOffers = await offers_service_1.OffersService.list(merchant.id);
        const offerEval = offers_service_1.OffersService.evaluateCart(activeOffers, lineItems.map((l) => ({
            productId: l.productId,
            categoryId: l.categoryId,
            name: l.productName,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            loyaltyReward: l.loyaltyReward,
        })), Number.isNaN(offerAt.getTime()) ? new Date() : offerAt, channel);
        let offerDiscount = (0, money_1.roundMoney2)(offerEval.discount);
        let voucherDiscount = 0;
        let appliedVoucher = null;
        const trimmedVoucher = String(voucherCode || "").trim();
        if (trimmedVoucher) {
            try {
                const voucherBase = (0, money_1.roundMoney2)(Math.max(0, subtotal - offerDiscount));
                const validated = await voucher_service_1.VoucherService.validateForShop(merchant.id, trimmedVoucher, voucherBase, authCustomer.customerId);
                voucherDiscount = (0, money_1.roundMoney2)(Math.min(validated.discount, voucherBase));
                appliedVoucher = {
                    voucherId: validated.voucherId,
                    code: validated.code,
                    name: validated.name,
                };
            }
            catch (error) {
                return res.status(400).json({
                    error: error instanceof Error ? error.message : "Invalid voucher",
                });
            }
        }
        let deliveryFee = 0;
        let deliveryZoneId;
        if (channel === "delivery") {
            const zone = await findMatchingZone(merchant.id, lng != null ? Number(lng) : undefined, lat != null ? Number(lat) : undefined, zipCode);
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
        const feeTaxPreview = (0, money_1.roundMoney2)((deliveryFee * taxRate) / 100);
        const taxDiscountOpts = {
            taxIncludedInPrice: merchant.taxIncludedInPrice === true,
            vatAfterDiscount: merchant.vatAfterDiscount !== false,
        };
        let taxPreview = (0, money_1.roundMoney2)(taxAmount + feeTaxPreview);
        taxPreview = (0, tax_discount_1.adjustTaxForOrderDiscount)(taxPreview, subtotal + deliveryFee, offerDiscount + voucherDiscount, taxDiscountOpts);
        const redeemableBase = (0, money_1.roundMoney2)(Math.max(0, subtotal - offerDiscount - voucherDiscount) + deliveryFee + taxPreview);
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
            const balance = await shop_loyalty_service_1.ShopLoyaltyService.getBalance(merchant.id, authCustomer.customerId);
            if (balance < rewardPointsNeeded) {
                return res.status(400).json({ error: "Insufficient loyalty points for free rewards" });
            }
            const balanceAfterRewards = balance - rewardPointsNeeded;
            if (requestedCashPoints > 0) {
                const maxPts = shop_loyalty_service_1.ShopLoyaltyService.maxRedeemablePoints(redeemableBase, balanceAfterRewards, loyaltyProgram.redeemPointsPerChf);
                const usePts = Math.min(requestedCashPoints, maxPts);
                const { discountChf, pointsUsed } = shop_loyalty_service_1.ShopLoyaltyService.computeCashDiscount(usePts, loyaltyProgram.redeemPointsPerChf);
                pointsDiscount = discountChf;
                cashPointsUsed = pointsUsed;
            }
        }
        const totalPointsRedeemed = rewardPointsNeeded + cashPointsUsed;
        const trimmedGiftCode = String(giftCardCode || "").trim();
        let giftCardDiscount = 0;
        let giftCardPreviewBalance = 0;
        if (trimmedGiftCode) {
            const gcSettings = shop_gift_card_service_1.ShopGiftCardService.settingsFromMerchant(merchant);
            if (!gcSettings.enabled) {
                return res.status(400).json({ error: "Gift cards are not enabled" });
            }
            try {
                const preview = await shop_gift_card_service_1.ShopGiftCardService.lookupPublicBalance(merchant.id, trimmedGiftCode);
                giftCardPreviewBalance = preview.balance;
            }
            catch (error) {
                return res.status(400).json({
                    error: error instanceof Error ? error.message : "Invalid gift card",
                });
            }
        }
        let customerId = authCustomer.customerId;
        const emailNorm = customerEmail?.trim().toLowerCase();
        if (!customerId && emailNorm) {
            let customer = await db.query.customers.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.customers.merchantId, merchant.id), (0, drizzle_orm_1.eq)(db_1.schema.customers.email, emailNorm)),
            });
            if (!customer) {
                const [created] = await db
                    .insert(db_1.schema.customers)
                    .values({
                    merchantId: merchant.id,
                    email: emailNorm,
                    phone: customerPhone,
                    firstName: customerName?.split(" ")[0],
                    lastName: customerName?.split(" ").slice(1).join(" ") || undefined,
                    defaultAddress: typeof shippingAddress === "string" ? shippingAddress : undefined,
                    defaultZip: zipCode,
                    defaultCity: city,
                })
                    .returning();
                customer = created;
            }
            else if (guestCheckout) {
                await db
                    .update(db_1.schema.customers)
                    .set({
                    phone: customerPhone || customer.phone,
                    firstName: customerName?.split(" ")[0] || customer.firstName,
                    lastName: customerName?.split(" ").slice(1).join(" ") || customer.lastName,
                    updatedAt: new Date(),
                })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.customers.id, customer.id));
            }
            customerId = customer.id;
        }
        const tip = (0, money_1.roundTo005)(Math.max(0, Number(tipAmount) || 0));
        const feeTax = (0, money_1.roundMoney2)((deliveryFee * taxRate) / 100);
        const grossTaxAmount = (0, money_1.roundMoney2)(taxAmount + feeTax);
        subtotal = (0, money_1.roundMoney2)(subtotal);
        deliveryFee = (0, money_1.roundMoney2)(deliveryFee);
        offerDiscount = (0, money_1.roundMoney2)(Math.min(offerDiscount, subtotal));
        voucherDiscount = (0, money_1.roundMoney2)(Math.min(voucherDiscount, Math.max(0, subtotal - offerDiscount)));
        const taxAfterOffer = (0, tax_discount_1.adjustTaxForOrderDiscount)(grossTaxAmount, subtotal + deliveryFee, offerDiscount + voucherDiscount, taxDiscountOpts);
        pointsDiscount = (0, money_1.roundMoney2)(Math.min(pointsDiscount, Math.max(0, subtotal - offerDiscount - voucherDiscount) + deliveryFee + taxAfterOffer));
        taxAmount = (0, tax_discount_1.adjustTaxForOrderDiscount)(grossTaxAmount, subtotal + deliveryFee, offerDiscount + voucherDiscount + pointsDiscount, taxDiscountOpts);
        const preGiftTotal = (0, money_1.roundMoney2)(Math.max(0, subtotal + deliveryFee + taxAmount - offerDiscount - voucherDiscount - pointsDiscount) + tip);
        if (trimmedGiftCode && giftCardPreviewBalance > 0) {
            giftCardDiscount = (0, money_1.roundMoney2)(Math.min(giftCardPreviewBalance, preGiftTotal));
        }
        const orderNumber = await (0, web_order_number_1.generateWebOrderNumber)(db, merchant.id);
        // Offer + voucher + points + gift card discount apply to food (+ delivery/tax for points); tip and card fee remain payable
        const preCardTotal = Math.max(0, preGiftTotal - giftCardDiscount);
        const cardFeeFixed = Number(merchant.onlineCardFeeFixed || 0) || 0;
        const cardFeePercent = Number(merchant.onlineCardFeePercent || 0) || 0;
        const cardFee = payMethod === "card"
            ? (0, money_1.roundTo005)(Math.max(0, cardFeeFixed + (preCardTotal * cardFeePercent) / 100))
            : 0;
        const rawTotal = preCardTotal + cardFee;
        const roundAdj = (0, money_1.roundingAdjustment)(rawTotal);
        const total = (0, money_1.roundTo005)(rawTotal);
        const notesWithRounding = [
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
        const addressText = typeof shippingAddress === "string"
            ? [shippingAddress, zipCode, city].filter(Boolean).join(", ")
            : shippingAddress
                ? JSON.stringify(shippingAddress)
                : channel === "takeaway" || channel === "dine_in"
                    ? `Pickup: ${merchant.address || merchant.name}${merchant.city ? `, ${merchant.city}` : ""}`
                    : null;
        const paymentStatus = payMethod === "card" || payMethod === "pay_later"
            ? "awaiting_payment"
            : giftCardDiscount > 0 && preCardTotal <= 0
                ? "completed"
                : "cash";
        const prepMinutes = channel === "delivery"
            ? Number(merchant.deliveryEtaMinutes ?? 45)
            : Number(merchant.pickupEtaMinutes ?? 25);
        const estimatedReadyAt = scheduledFor
            ? new Date(scheduledFor)
            : new Date(Date.now() + prepMinutes * 60 * 1000);
        let deliveryLat = null;
        let deliveryLng = null;
        let deliveryTrackingToken = null;
        if (channel === "delivery") {
            const { generateDeliveryTrackingToken } = await Promise.resolve().then(() => __importStar(require("@/lib/delivery-tracking-url")));
            deliveryTrackingToken = generateDeliveryTrackingToken();
            const latNum = lat != null ? Number(lat) : NaN;
            const lngNum = lng != null ? Number(lng) : NaN;
            if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
                deliveryLat = String(latNum);
                deliveryLng = String(lngNum);
            }
            else if (addressText) {
                try {
                    const geo = await (0, geocode_1.geocodeQuery)(addressText);
                    if (geo?.lat != null && geo?.lng != null) {
                        deliveryLat = String(geo.lat);
                        deliveryLng = String(geo.lng);
                    }
                }
                catch {
                    /* geocode optional */
                }
            }
        }
        // Prefer logged-in customer for loyalty redemptions
        if ((totalPointsRedeemed > 0 || requestedCashPoints > 0) && authCustomer.customerId) {
            customerId = authCustomer.customerId;
        }
        const { normalizeDeliveryPlatformSettings } = await Promise.resolve().then(() => __importStar(require("@/lib/delivery-platform-settings")));
        const shopAutoAccept = normalizeDeliveryPlatformSettings(merchant.deliveryPlatformSettings)
            .onlineShopAutoAccept;
        const initialOrderStatus = shopAutoAccept ? "preparing" : "pending_approval";
        const [order] = await db
            .insert(db_1.schema.orders)
            .values({
            merchantId: merchant.id,
            orderNumber,
            customerId,
            orderType: "web_shop",
            orderSource: "online_shop",
            fulfillmentChannel: channel,
            status: initialOrderStatus,
            subtotal: subtotal.toFixed(2),
            taxAmount: taxAmount.toFixed(2),
            discountAmount: (0, money_1.roundMoney2)(offerDiscount + voucherDiscount + pointsDiscount + giftCardDiscount).toFixed(2),
            deliveryFee: deliveryFee.toFixed(2),
            tipAmount: tip.toFixed(2),
            cardFee: cardFee.toFixed(2),
            pointsDiscount: pointsDiscount.toFixed(2),
            pointsEarned: 0,
            pointsRedeemed: totalPointsRedeemed,
            total: total.toFixed(2),
            paymentMethod: giftCardDiscount > 0 && preCardTotal <= 0 ? "gift_card" : payMethod,
            paymentStatus,
            paymentBreakdown: giftCardDiscount > 0
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
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            customerEmail: emailNorm || null,
            deliveryLatitude: deliveryLat,
            deliveryLongitude: deliveryLng,
            deliveryTrackingToken,
        })
            .returning();
        try {
            const { MarketingService } = await Promise.resolve().then(() => __importStar(require("@/services/marketing.service")));
            await MarketingService.touchLastOrder(merchant.id, {
                customerId,
                email: emailNorm || null,
                at: new Date(),
            });
        }
        catch {
            /* non-fatal */
        }
        for (const line of lineItems) {
            await db.insert(db_1.schema.orderItems).values({
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
                await voucher_service_1.VoucherService.redeem(merchant.id, appliedVoucher.voucherId, {
                    orderId: order.id,
                    customerId: customerId || authCustomer.customerId || null,
                    discountAmount: voucherDiscount,
                    code: appliedVoucher.code,
                });
            }
            catch (error) {
                await db.delete(db_1.schema.orders).where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, order.id));
                return res.status(400).json({
                    error: error instanceof Error ? error.message : "Voucher could not be applied",
                });
            }
        }
        if (giftCardDiscount > 0 && trimmedGiftCode) {
            try {
                await shop_gift_card_service_1.ShopGiftCardService.redeemForOrder(merchant.id, trimmedGiftCode, giftCardDiscount, order.id);
            }
            catch (error) {
                await db.delete(db_1.schema.orderItems).where((0, drizzle_orm_1.eq)(db_1.schema.orderItems.orderId, order.id));
                await db.delete(db_1.schema.orders).where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, order.id));
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
                    await shop_loyalty_service_1.ShopLoyaltyService.redeemPoints({
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
                    await shop_loyalty_service_1.ShopLoyaltyService.redeemPoints({
                        merchantId: merchant.id,
                        customerId,
                        points: cashPointsUsed,
                        orderId: order.id,
                        eventType: "redeem_cash",
                        meta: { discountChf: pointsDiscount },
                    });
                    burnedSoFar += cashPointsUsed;
                }
            }
            catch (redeemErr) {
                if (burnedSoFar > 0) {
                    try {
                        await shop_loyalty_service_1.ShopLoyaltyService.earnPoints({
                            merchantId: merchant.id,
                            customerId,
                            points: burnedSoFar,
                            expiryDays: loyaltyProgram.expiryDays,
                            source: "adjustment",
                            orderId: order.id,
                        });
                    }
                    catch {
                        /* best-effort restore */
                    }
                }
                await db.delete(db_1.schema.orderItems).where((0, drizzle_orm_1.eq)(db_1.schema.orderItems.orderId, order.id));
                await db.delete(db_1.schema.orders).where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, order.id));
                throw redeemErr;
            }
        }
        let finalOrder = order;
        // Earn immediately on cash; card earns on confirm-payment; pay_later earns on collect
        if (payMethod === "cash" && customerId && loyaltyProgram.enabled) {
            finalOrder = (await earnLoyaltyForOrder(merchant, order));
        }
        if (shopAutoAccept) {
            const { enterKitchenFromOrder } = await Promise.resolve().then(() => __importStar(require("@/services/kitchen-ingress.service")));
            void enterKitchenFromOrder(merchant.id, order.id, {
                printKitchen: true,
                orderSource: "online_shop",
            });
        }
        // Till notification on arrival; kitchen ticket when auto-accept or on manual Accept.
        try {
            const { DeliveryPlatformService } = await Promise.resolve().then(() => __importStar(require("@/services/delivery-platform.service")));
            await DeliveryPlatformService.enqueueAutoPrint(merchant.id, order.id, "online_shop", {
                printDeliveryReceipt: order.fulfillmentChannel === "delivery",
                printNotification: !shopAutoAccept && order.fulfillmentChannel !== "delivery",
                printKitchen: false,
                printReceipt: false,
            });
        }
        catch (printErr) {
            console.warn("Shop order notification print enqueue failed:", printErr);
        }
        try {
            const { ShopOrderEmailService } = await Promise.resolve().then(() => __importStar(require("@/services/shop-order-email.service")));
            const guestLocale = String(req.body?.locale || req.headers["x-shop-locale"] || "");
            await ShopOrderEmailService.sendGuestOrderEmail(merchant.id, order.id, "received", {
                guestLocale: guestLocale || null,
            });
        }
        catch (mailErr) {
            console.warn("Shop order confirmation email failed:", mailErr);
        }
        let paymentSession = null;
        if (payMethod === "card" && preCardTotal > 0) {
            try {
                const domain = process.env.DOMAIN || "manupos.webprintmedia.swiss";
                const returnUrl = `https://${domain}/shop/${merchant.slug || req.params.slug}/order/${order.id}?paid=1`;
                const session = await adyen_service_1.AdyenService.initializePaymentSession(merchant.id, order.id, parseFloat(finalOrder.total.toString()), "CHF", returnUrl);
                paymentSession = {
                    id: session.id,
                    sessionData: session.sessionData,
                    clientKey: merchant.adyenClientId,
                    environment: (process.env.ADYEN_ENVIRONMENT || "test").toLowerCase() === "live" ? "live" : "test",
                };
            }
            catch (e) {
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
    }
    catch (error) {
        console.error("Shop order error:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create order" });
    }
});
/**
 * GET /api/shop/:slug/orders/:orderId/tracking?token= — guest live driver map
 */
router.get("/:slug/orders/:orderId/tracking", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
        const token = String(req.query.token || "").trim();
        if (!token)
            return res.status(400).json({ error: "Tracking token required" });
        const { DeliveryTrackingService } = await Promise.resolve().then(() => __importStar(require("@/services/delivery-tracking.service")));
        const payload = await DeliveryTrackingService.getPublicTracking(merchant.id, req.params.orderId, token);
        res.json({ success: true, ...payload });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : "Failed to load tracking";
        res.status(msg.includes("Invalid") ? 403 : 404).json({ error: msg });
    }
});
/**
 * GET /api/shop/:slug/orders/:orderId — confirmation / tracking
 */
router.get("/:slug/orders/:orderId", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
        const db = (0, db_1.getDb)();
        const order = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, req.params.orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchant.id)),
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
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load order" });
    }
});
/**
 * POST /api/shop/:slug/orders/:orderId/payment-session
 */
router.post("/:slug/orders/:orderId/payment-session", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
        const db = (0, db_1.getDb)();
        const order = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, req.params.orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchant.id)),
        });
        if (!order)
            return res.status(404).json({ error: "Order not found" });
        if (order.paymentStatus === "completed") {
            return res.json({ success: true, alreadyPaid: true });
        }
        const domain = process.env.DOMAIN || "manupos.webprintmedia.swiss";
        const returnUrl = `https://${domain}/shop/${merchant.slug || req.params.slug}/order/${order.id}?paid=1`;
        const session = await adyen_service_1.AdyenService.initializePaymentSession(merchant.id, order.id, parseFloat(order.total.toString()), "CHF", returnUrl);
        res.json({
            success: true,
            paymentSession: {
                id: session.id,
                sessionData: session.sessionData,
                clientKey: merchant.adyenClientId,
                environment: (process.env.ADYEN_ENVIRONMENT || "test").toLowerCase() === "live" ? "live" : "test",
            },
        });
    }
    catch (error) {
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
router.post("/:slug/orders/:orderId/confirm-payment", async (req, res) => {
    try {
        const merchant = await resolveMerchant(req.params.slug);
        if (!merchant?.shopEnabled)
            return res.status(404).json({ error: "Shop not found" });
        const db = (0, db_1.getDb)();
        const order = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, req.params.orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchant.id)),
        });
        if (!order)
            return res.status(404).json({ error: "Order not found" });
        const [updated] = await db
            .update(db_1.schema.orders)
            .set({
            paymentStatus: "completed",
            paymentMethod: "card",
            adyenReference: req.body.pspReference || req.body.adyenReference || order.adyenReference,
            // Keep kitchen lifecycle — paid card orders still need staff accept
            status: order.status === "awaiting_payment" || order.status === "pending"
                ? "pending_approval"
                : order.status,
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, order.id))
            .returning();
        try {
            await adyen_service_1.AdyenService.recordPaymentTransaction(merchant.id, order.id, parseFloat(order.total.toString()), "card", String(req.body.pspReference || `DEMO-${order.orderNumber}`), "completed");
        }
        catch {
            /* optional */
        }
        let finalOrder = updated;
        try {
            finalOrder = (await earnLoyaltyForOrder(merchant, updated));
        }
        catch (earnErr) {
            console.error("Loyalty earn on confirm-payment failed:", earnErr);
        }
        try {
            const { DeliveryPlatformService } = await Promise.resolve().then(() => __importStar(require("@/services/delivery-platform.service")));
            await DeliveryPlatformService.enqueueAutoPrint(merchant.id, order.id, "online_shop", {
                printKitchen: false,
                printDeliveryReceipt: updated.fulfillmentChannel === "delivery",
                printNotification: false,
                printReceipt: updated.fulfillmentChannel !== "delivery",
            });
        }
        catch (printErr) {
            console.warn("Confirm-payment receipt print enqueue failed:", printErr);
        }
        res.json({ success: true, order: finalOrder });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Confirm failed" });
    }
});
exports.default = router;
//# sourceMappingURL=shop.routes.js.map