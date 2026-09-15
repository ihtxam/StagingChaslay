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
exports.KioskService = exports.KioskLicenseError = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const catalog_visibility_1 = require("@/lib/catalog-visibility");
const kiosk_addon_1 = require("@/lib/kiosk-addon");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const kiosk_settings_1 = require("@/lib/kiosk-settings");
const combo_1 = require("@/lib/combo");
const money_1 = require("@/lib/money");
const adyen_terminal_poi_service_1 = require("@/services/adyen-terminal-poi.service");
const floor_plan_service_1 = require("@/services/floor-plan.service");
const gift_card_service_1 = require("@/services/gift-card.service");
class KioskLicenseError extends Error {
    constructor() {
        super("Self-order kiosk addon is not enabled for this merchant");
        this.code = "KIOSK_ADDON_REQUIRED";
    }
}
exports.KioskLicenseError = KioskLicenseError;
async function loadMerchantByToken(token) {
    await (0, ensure_merchant_schema_1.ensureKioskAddonColumn)();
    await (0, ensure_merchant_schema_1.ensureKioskSettingsColumn)();
    const rows = await (0, ensure_merchant_schema_1.queryRaw)(`SELECT id, name, slug, shop_enabled, kiosk_settings
     FROM merchants
     WHERE kiosk_settings IS NOT NULL
       AND kiosk_settings->>'accessToken' = $1
     LIMIT 1`, [token]);
    const merchant = rows[0];
    if (!merchant)
        throw new Error("Kiosk not found");
    const enabled = await (0, kiosk_addon_1.readKioskAddonEnabled)(merchant.id);
    if (!enabled)
        throw new KioskLicenseError();
    const settings = (0, kiosk_settings_1.normalizeKioskSettings)(merchant.kiosk_settings);
    if (settings.accessToken !== token)
        throw new Error("Kiosk not found");
    return { merchant, settings };
}
class KioskService {
    static async getPublicConfig(token) {
        const { merchant, settings } = await loadMerchantByToken(token);
        const shopEnabled = merchant.shop_enabled ?? merchant.shopEnabled;
        if (!shopEnabled)
            throw new Error("Shop is not enabled for this merchant");
        let tables = [];
        try {
            const list = await floor_plan_service_1.FloorPlanService.listTablesForSync(merchant.id);
            tables = list.map((t) => ({ id: t.id, label: t.label || t.id }));
        }
        catch {
            tables = [];
        }
        return {
            merchant: {
                id: merchant.id,
                name: merchant.name,
                slug: merchant.slug,
            },
            settings: {
                name: settings.name,
                promoSlides: settings.promoSlides || [],
                slideBannerText: settings.slideBannerText,
                enabledLanguages: settings.enabledLanguages || ["en"],
                defaultLanguage: settings.defaultLanguage || "en",
                tableMode: settings.tableMode || "both",
                membershipScanEnabled: settings.membershipScanEnabled !== false,
                idleTimeoutSeconds: settings.idleTimeoutSeconds ?? 120,
                locationSlug: settings.locationSlug,
                cashPaymentEnabled: settings.cashPaymentEnabled !== false,
                cardPaymentEnabled: settings.cardPaymentEnabled !== false,
                takeawayEnabled: settings.takeawayEnabled !== false,
                deliveryEnabled: settings.deliveryEnabled === true,
                dineInEnabled: settings.dineInEnabled !== false,
                attractHeadline: settings.attractHeadline,
                attractSubheadline: settings.attractSubheadline,
                brandPrimaryColor: settings.brandPrimaryColor,
                brandSecondaryColor: settings.brandSecondaryColor,
                brandButtonTextColor: settings.brandButtonTextColor,
                autoPrintKitchen: settings.autoPrintKitchen !== false,
                autoPrintReceipt: settings.autoPrintReceipt === true,
                screenSizeIn: settings.screenSizeIn === 27 ? 27 : 23,
                kioskLayout: settings.kioskLayout === "grocery" ? "grocery" : "restaurant",
                categoryNav: settings.kioskLayout === "grocery"
                    ? settings.categoryNav === "left"
                        ? "left"
                        : "bottom"
                    : settings.categoryNav === "top"
                        ? "top"
                        : "left",
            },
            tables,
        };
    }
    static async getMenu(token) {
        const { merchant, settings } = await loadMerchantByToken(token);
        const db = (0, db_1.getDb)();
        const catalogChannel = "kiosk";
        const { LocationsService } = await Promise.resolve().then(() => __importStar(require("@/services/locations.service")));
        let locationId = null;
        if (settings.locationSlug) {
            try {
                const resolved = await LocationsService.resolveBySlug(merchant.id, settings.locationSlug);
                locationId = resolved?.id ?? (await LocationsService.getDefaultId(merchant.id));
            }
            catch {
                locationId = await LocationsService.getDefaultId(merchant.id);
            }
        }
        else {
            locationId = await LocationsService.getDefaultId(merchant.id);
        }
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
        const { CatalogLocationService } = await Promise.resolve().then(() => __importStar(require("@/services/catalog-location.service")));
        const { HqMenuService } = await Promise.resolve().then(() => __importStar(require("@/services/hq-menu.service")));
        const withOverrides = await CatalogLocationService.applyLocationOverrides(merchant.id, locationId, products);
        const filtered = (0, catalog_visibility_1.filterCatalogForKioskChannel)(withOverrides, categories);
        const menuProductIds = await HqMenuService.resolveActiveProductIds(merchant.id, locationId, catalogChannel);
        const visibleProducts = CatalogLocationService.filterByHqMenuProductIds(filtered.products, menuProductIds);
        const categoryIdsWithProducts = new Set(visibleProducts.map((p) => p.categoryId).filter(Boolean));
        const visibleCategories = filtered.categories.filter((c) => categoryIdsWithProducts.has(c.id) || c.isOffersCategory);
        const comboChildIds = new Set();
        for (const p of visibleProducts) {
            if (String(p.productType || "") !== "combo")
                continue;
            for (const slot of (0, combo_1.normalizeComboSlots)(p.comboItems)) {
                for (const opt of slot.options)
                    comboChildIds.add(opt.productId);
            }
        }
        const { ModifierService } = await Promise.resolve().then(() => __importStar(require("@/services/modifier.service")));
        const groupsByProduct = await ModifierService.getGroupsForProducts(merchant.id, [
            ...new Set([...visibleProducts.map((p) => p.id), ...comboChildIds]),
        ]);
        const serializeGroup = (g) => ({
            id: g.id,
            title: g.title,
            selectionType: g.selectionType || "optional",
            minSelectable: Number(g.minSelectable) || 0,
            maxSelectable: Number(g.maxSelectable) || 1,
            pricingType: g.pricingType || "paid",
            options: (g.options || [])
                .filter((o) => o.saleStatus !== "out_of_stock")
                .map((o) => ({
                id: o.id,
                name: o.name,
                price: Number(o.price) || 0,
                isDefault: !!o.isDefault,
                image: o.imageUrl || null,
            })),
        });
        const catalogById = new Map(withOverrides.map((p) => [p.id, p]));
        const serializeProduct = (p) => {
            const extras = Array.isArray(p.extras)
                ? (p.extras)
                : [];
            const productType = String(p.productType || "standard");
            const isCombo = productType === "combo";
            const slots = isCombo ? (0, combo_1.normalizeComboSlots)(p.comboItems) : [];
            const comboSlots = slots
                .map((slot) => ({
                id: slot.id,
                name: slot.name,
                minPick: slot.minPick,
                maxPick: slot.maxPick,
                options: slot.options
                    .map((opt) => {
                    const child = catalogById.get(opt.productId);
                    if (!child || child.isActive === false)
                        return null;
                    const childGroups = (groupsByProduct.get(child.id) || []).map(serializeGroup);
                    const childExtras = Array.isArray(child.extras)
                        ? (child.extras)
                        : [];
                    return {
                        productId: child.id,
                        name: child.name,
                        image: child.imageUrl || null,
                        description: child.description || null,
                        extraPrice: (0, money_1.roundMoney2)(opt.extraPrice),
                        allowExtras: !!child.allowExtras || childGroups.length > 0 || childExtras.length > 0,
                        extras: childExtras.map((e) => ({
                            id: String(e.id || ""),
                            name: String(e.name || ""),
                            price: Number(e.price) || 0,
                        })),
                        modifierGroups: childGroups,
                    };
                })
                    .filter(Boolean),
            }))
                .filter((s) => s.options.length > 0);
            const specifications = Array.isArray(p.specifications)
                ? (p.specifications)
                    .filter((s) => String(s?.name || "").trim() && String(s.saleStatus || "in_stock") !== "out_of_stock")
                    .map((s, i) => ({
                    id: String(s.id || `spec-${i + 1}`),
                    name: String(s.name).trim(),
                    price: (0, money_1.roundMoney2)(Number(s.price) || 0),
                    saleStatus: String(s.saleStatus || "in_stock"),
                    isDefault: !!s.isDefault,
                    sortOrder: Number(s.sortOrder) || i,
                }))
                : [];
            const modifierGroups = (groupsByProduct.get(p.id) || []).map(serializeGroup);
            return {
                id: p.id,
                name: p.name,
                price: Number(p.price || 0),
                description: p.description || undefined,
                image: p.imageUrl || undefined,
                barcode: p.barcode || undefined,
                sku: p.sku || undefined,
                productType,
                allowExtras: !!p.allowExtras || modifierGroups.length > 0 || extras.length > 0,
                extras: extras.map((e) => ({
                    id: String(e.id || ""),
                    name: String(e.name || ""),
                    price: Number(e.price) || 0,
                })),
                specifications,
                modifierGroups,
                comboSlots: isCombo ? comboSlots : [],
            };
        };
        const menu = visibleCategories.map((cat) => ({
            id: cat.id,
            name: cat.name,
            image: cat.imageUrl || undefined,
            color: cat.color || undefined,
            items: visibleProducts.filter((p) => p.categoryId === cat.id).map(serializeProduct),
        }));
        let bestsellerIds = [];
        try {
            const { PosReportsService } = await Promise.resolve().then(() => __importStar(require("@/services/pos-reports.service")));
            bestsellerIds = await PosReportsService.getBestsellerProductIds(merchant.id, {
                limit: 16,
                days: 30,
            });
        }
        catch {
            bestsellerIds = [];
        }
        return { menu, locationId, bestsellerIds };
    }
    static async lookupMembership(token, code) {
        const { merchant } = await loadMerchantByToken(token);
        const card = await gift_card_service_1.GiftCardService.lookup(merchant.id, code);
        return card;
    }
    static async payOrderAtTerminal(token, orderId) {
        const { merchant, settings } = await loadMerchantByToken(token);
        const db = (0, db_1.getDb)();
        const order = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchant.id)),
        });
        if (!order)
            throw new Error("Order not found");
        if (order.orderSource !== "kiosk")
            throw new Error("Not a kiosk order");
        const amount = Number(order.total || 0);
        if (!Number.isFinite(amount) || amount <= 0)
            throw new Error("Invalid order total");
        const result = await adyen_terminal_poi_service_1.AdyenTerminalPoiService.processTerminalPayment(merchant.id, amount, {
            terminalId: settings.terminalId || undefined,
            currency: "CHF",
        });
        if (result.status !== "approved") {
            throw new Error(result.errorMessage || "Terminal payment declined");
        }
        const autoAccept = settings.kioskAutoAcceptCard !== false;
        await db
            .update(db_1.schema.orders)
            .set({
            paymentStatus: "paid",
            paymentMethod: "card",
            status: autoAccept ? "preparing" : "pending_approval",
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId));
        return {
            approved: true,
            reference: result.reference,
            customerReceipt: result.customerReceipt ?? null,
        };
    }
    static async readSettingsForMerchant(merchantId) {
        await (0, ensure_merchant_schema_1.ensureKioskSettingsColumn)();
        const rows = await (0, ensure_merchant_schema_1.queryRaw)(`SELECT kiosk_settings FROM merchants WHERE id = $1 LIMIT 1`, [merchantId]);
        if (rows[0]?.kiosk_settings == null) {
            const defaults = (0, kiosk_settings_1.normalizeKioskSettings)(null);
            const db = (0, db_1.getDb)();
            await db
                .update(db_1.schema.merchants)
                .set({ kioskSettings: defaults, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
            return defaults;
        }
        return (0, kiosk_settings_1.normalizeKioskSettings)(rows[0]?.kiosk_settings);
    }
    static async writeSettingsForMerchant(merchantId, raw) {
        await (0, ensure_merchant_schema_1.ensureKioskSettingsColumn)();
        const existing = await this.readSettingsForMerchant(merchantId);
        const incoming = (0, kiosk_settings_1.normalizeKioskSettings)({ ...existing, ...raw });
        incoming.accessToken = existing.accessToken || incoming.accessToken;
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.merchants)
            .set({ kioskSettings: incoming, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        return incoming;
    }
    static async regenerateToken(merchantId) {
        const settings = await this.readSettingsForMerchant(merchantId);
        settings.accessToken = (0, kiosk_settings_1.normalizeKioskSettings)({}).accessToken;
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.merchants)
            .set({ kioskSettings: settings, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        return settings;
    }
    static validateTokenForMerchant(merchantId, token) {
        return String(token || "").trim().length > 0;
    }
    static async assertTokenForMerchant(merchantId, token) {
        const settings = await this.readSettingsForMerchant(merchantId);
        if (settings.accessToken !== String(token || "").trim()) {
            throw new Error("Invalid kiosk token");
        }
        const enabled = await (0, kiosk_addon_1.readKioskAddonEnabled)(merchantId);
        if (!enabled)
            throw new KioskLicenseError();
        return settings;
    }
    static verifyAdminPin(settings, pin) {
        const expected = String(settings.adminPin || "1234").replace(/\D/g, "");
        const given = String(pin || "").replace(/\D/g, "");
        return expected.length >= 4 && given === expected;
    }
    static async getDiagnostics(merchantId) {
        const settings = await this.readSettingsForMerchant(merchantId);
        const db = (0, db_1.getDb)();
        const terminals = await db.query.paymentTerminals.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.paymentTerminals.merchantId, merchantId),
        });
        const terminalId = settings.terminalId?.trim() || "";
        const terminal = terminals.find((t) => t.id === terminalId ||
            String(t.terminalId || "") === terminalId ||
            String(t.poiId || "") === terminalId);
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { adyenApiKey: true, adyenMerchantAccount: true },
        });
        const adyenConfigured = !!(merchant?.adyenApiKey && merchant?.adyenMerchantAccount);
        return {
            terminalConfigured: !!terminalId,
            terminalRegistered: !!terminal,
            terminalLabel: terminal?.terminalName || terminal?.terminalId || null,
            adyenConfigured,
            cashPaymentEnabled: settings.cashPaymentEnabled !== false,
            cardPaymentEnabled: settings.cardPaymentEnabled !== false,
            selectedTerminalId: terminalId || null,
            terminals: terminals.map((t) => ({
                id: t.id,
                terminalId: t.terminalId,
                terminalName: t.terminalName,
                status: t.status,
            })),
            printAgentNote: "Print Bridge is checked on this device at http://127.0.0.1:9101/health when you run Test connections.",
        };
    }
}
exports.KioskService = KioskService;
//# sourceMappingURL=kiosk.service.js.map