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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChaslayCompatService = void 0;
exports.normalizeChaslayDeviceId = normalizeChaslayDeviceId;
exports.deriveShortDeviceId = deriveShortDeviceId;
exports.normalizeActivationCode = normalizeActivationCode;
exports.generateSyncApiKey = generateSyncApiKey;
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("@/db");
const text_encoding_1 = require("@/lib/text-encoding");
const order_item_name_1 = require("@/lib/order-item-name");
const drizzle_orm_1 = require("drizzle-orm");
const auth_service_1 = require("./auth.service");
const merchant_settings_service_1 = require("./merchant-settings.service");
const receipt_public_url_1 = require("@/lib/receipt-public-url");
const combo_1 = require("@/lib/combo");
const money_1 = require("@/lib/money");
const modifier_service_1 = require("./modifier.service");
function normalizeChaslayDeviceId(deviceId) {
    if (!deviceId)
        return "";
    const clean = deviceId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length === 8) {
        return `${clean.slice(0, 4)}-${clean.slice(4, 8)}`;
    }
    return deviceId.trim().toUpperCase();
}
function deriveShortDeviceId(raw) {
    const clean = String(raw ?? "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
    if (clean.length === 8)
        return normalizeChaslayDeviceId(clean);
    const hash = crypto_1.default.createHash("sha256").update(clean).digest();
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let body = "";
    for (let i = 0; i < 8; i += 1) {
        body += chars[hash[i] % chars.length];
    }
    return `${body.slice(0, 4)}-${body.slice(4, 8)}`;
}
function normalizeActivationCode(code) {
    return code.trim().toUpperCase().replace(/\s+/g, "");
}
function generateSyncApiKey() {
    return crypto_1.default.randomBytes(24).toString("hex");
}
class ChaslayCompatService {
    static async activateLicense(input) {
        const db = (0, db_1.getDb)();
        const normalizedDeviceId = normalizeChaslayDeviceId(input.deviceId);
        const licenseKey = normalizeActivationCode(input.activationCode);
        let merchant = input.tenantSlug
            ? await db.query.merchants.findFirst({ where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.slug, input.tenantSlug) })
            : null;
        const license = await db.query.licenses.findFirst({
            where: merchant
                ? (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.licenses.licenseKey, licenseKey), (0, drizzle_orm_1.eq)(db_1.schema.licenses.merchantId, merchant.id))
                : (0, drizzle_orm_1.eq)(db_1.schema.licenses.licenseKey, licenseKey),
            with: { merchant: true, device: true },
        });
        if (!license || !license.merchant) {
            throw new Error("Invalid or already used activation code. Generate a fresh code in admin and try again.");
        }
        merchant = license.merchant;
        const now = new Date();
        if (license.expiresAt <= now || license.status !== "active") {
            throw new Error("License expired or inactive");
        }
        let device = license.device;
        if (!device) {
            const externalId = `POS-${merchant.id.substring(0, 6).toUpperCase()}-${normalizedDeviceId.replace(/-/g, "")}`;
            const inserted = await db
                .insert(db_1.schema.devices)
                .values({
                merchantId: merchant.id,
                deviceId: externalId,
                deviceName: input.deviceModel || `Chaslay ${normalizedDeviceId}`,
                deviceType: "tablet",
                osVersion: input.deviceModel,
                appVersion: input.appVersion,
                isActive: true,
            })
                .returning();
            device = inserted[0];
            await db
                .update(db_1.schema.licenses)
                .set({ deviceId: device.id, updatedAt: now })
                .where((0, drizzle_orm_1.eq)(db_1.schema.licenses.id, license.id));
        }
        else {
            await db
                .update(db_1.schema.devices)
                .set({
                appVersion: input.appVersion,
                osVersion: input.deviceModel,
                lastSync: now,
                isActive: true,
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.devices.id, device.id));
        }
        await db
            .update(db_1.schema.merchants)
            .set({ status: "active", updatedAt: now })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchant.id));
        return {
            status: "ACTIVE",
            expiresAt: license.expiresAt.getTime(),
            customerName: merchant.name,
            planLabel: license.licenseType === "trial" ? "Trial license" : `${license.licenseType} license`,
            tenantSlug: merchant.slug,
        };
    }
    static async validateLicense(input) {
        const db = (0, db_1.getDb)();
        const normalized = normalizeChaslayDeviceId(input.deviceId);
        const short = deriveShortDeviceId(input.deviceId);
        let merchant = input.tenantSlug
            ? await db.query.merchants.findFirst({ where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.slug, input.tenantSlug) })
            : null;
        const devices = await db.query.devices.findMany({
            where: merchant ? (0, drizzle_orm_1.eq)(db_1.schema.devices.merchantId, merchant.id) : undefined,
            with: { licenses: true, merchant: true },
        });
        const device = devices.find((d) => {
            const ext = d.deviceId.toUpperCase();
            return (ext.includes(normalized.replace(/-/g, "")) ||
                ext.endsWith(normalized.replace(/-/g, "")) ||
                deriveShortDeviceId(d.deviceId) === normalized ||
                deriveShortDeviceId(d.deviceId) === short);
        });
        if (!device) {
            throw new Error("Device not licensed");
        }
        merchant = device.merchant;
        const license = device.licenses?.find((l) => l.status === "active");
        if (!license || license.expiresAt <= new Date()) {
            throw new Error("License expired");
        }
        await db
            .update(db_1.schema.devices)
            .set({ appVersion: input.appVersion, lastSync: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.devices.id, device.id));
        return {
            status: "ACTIVE",
            expiresAt: license.expiresAt.getTime(),
            customerName: merchant?.name,
            planLabel: license.licenseType,
        };
    }
    static async posLogin(email, password, tenantSlug) {
        void tenantSlug; // accepted for API compat; not used to reject login
        try {
            return await this.posLoginOwner(email, password);
        }
        catch (ownerError) {
            try {
                return await this.posLoginStaff(email, password);
            }
            catch {
                throw ownerError;
            }
        }
    }
    static async ensureMerchantSyncKey(merchantId, existingKey) {
        const db = (0, db_1.getDb)();
        let syncApiKey = existingKey?.trim() || "";
        if (!syncApiKey) {
            syncApiKey = generateSyncApiKey();
            await db
                .update(db_1.schema.merchants)
                .set({ syncApiKey })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        }
        return syncApiKey;
    }
    static async posLoginOwner(email, password) {
        const db = (0, db_1.getDb)();
        const normalizedEmail = String(email || "").trim().toLowerCase();
        // Match by email only (case-insensitive). A stale device tenantSlug must not
        // block a valid merchant login — slug is updated from the returned user.
        const merchants = await db
            .select()
            .from(db_1.schema.merchants)
            .where((0, drizzle_orm_1.sql) `lower(${db_1.schema.merchants.email}) = ${normalizedEmail}`)
            .limit(1);
        const merchant = merchants[0];
        if (!merchant) {
            throw new Error("Invalid credentials");
        }
        const valid = await auth_service_1.AuthService.comparePassword(password, merchant.passwordHash);
        if (!valid) {
            throw new Error("Invalid credentials");
        }
        if (merchant.status !== "active" && merchant.status !== "trial") {
            throw new Error(`Account is ${merchant.status}`);
        }
        const syncApiKey = await this.ensureMerchantSyncKey(merchant.id, merchant.syncApiKey);
        // Same JWT the merchant dashboard uses, so Android can open Settings in a WebView.
        const dashboardToken = auth_service_1.AuthService.generateToken({
            id: merchant.id,
            email: merchant.email,
            role: "merchant",
            merchantId: merchant.id,
            name: merchant.name,
        });
        const dashboardUser = {
            id: merchant.id,
            email: merchant.email,
            name: merchant.name,
            role: "merchant",
            merchantId: merchant.id,
            isOwner: true,
            roleName: "Owner",
        };
        return {
            user: {
                id: merchant.id,
                email: merchant.email,
                name: merchant.name,
                role: "MERCHANT",
                roleName: "Owner",
                tenantSlug: merchant.slug,
            },
            merchantId: merchant.id,
            syncApiKey,
            dashboardToken,
            dashboardUser,
            dashboardUrl: process.env.MERCHANT_DASHBOARD_URL ||
                process.env.PUBLIC_APP_URL ||
                "https://app.chaslay.com",
        };
    }
    static async posLoginStaff(email, password) {
        const { StaffService } = await Promise.resolve().then(() => __importStar(require("@/services/staff.service")));
        const { toAndroidPermissions } = await Promise.resolve().then(() => __importStar(require("@/lib/permissions")));
        const { staff, role, permissions } = await StaffService.loginStaff(email, password);
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, staff.merchantId),
        });
        if (!merchant) {
            throw new Error("Invalid credentials");
        }
        if (merchant.status !== "active" && merchant.status !== "trial") {
            throw new Error(`Account is ${merchant.status}`);
        }
        const syncApiKey = await this.ensureMerchantSyncKey(merchant.id, merchant.syncApiKey);
        const roleName = role?.name || "Staff";
        const androidPermissions = toAndroidPermissions(permissions);
        const dashboardToken = auth_service_1.AuthService.generateToken({
            id: staff.id,
            email: staff.email || email,
            role: "staff",
            merchantId: staff.merchantId,
            staffId: staff.id,
            name: staff.name,
            roleName,
            permissions,
        });
        const dashboardUser = {
            id: staff.id,
            email: staff.email || email,
            name: staff.name,
            role: "staff",
            merchantId: staff.merchantId,
            staffId: staff.id,
            isOwner: false,
            roleName,
            permissions,
        };
        return {
            user: {
                id: staff.id,
                email: staff.email || email,
                name: staff.name,
                role: roleName.toUpperCase().replace(/\s+/g, "_"),
                roleName,
                permissions: androidPermissions,
                tenantSlug: merchant.slug,
            },
            merchantId: merchant.id,
            syncApiKey,
            dashboardToken,
            dashboardUser,
            dashboardUrl: process.env.MERCHANT_DASHBOARD_URL ||
                process.env.PUBLIC_APP_URL ||
                "https://app.chaslay.com",
        };
    }
    static async syncBootstrap(merchantId) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        });
        if (!merchant)
            throw new Error("Merchant not found");
        const categories = await db.query.categories.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId),
        });
        const allProducts = await db.query.products.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId),
        });
        const products = allProducts.filter((p) => p.isActive !== false);
        const { FloorPlanService } = await Promise.resolve().then(() => __importStar(require("@/services/floor-plan.service")));
        const { ReservationService } = await Promise.resolve().then(() => __importStar(require("@/services/reservation.service")));
        const floorPlans = await FloorPlanService.list(merchantId);
        const reservedRows = await ReservationService.listForSync(merchantId);
        const reservedTableIds = [
            ...new Set(reservedRows
                .map((r) => r.tableId)
                .filter((id) => !!id)),
        ];
        const categoryClientById = new Map(categories.map((c) => [c.id, c.clientId || c.id]));
        const productClientById = new Map(allProducts.map((p) => [p.id, p.clientId || p.id]));
        const catalogById = new Map(allProducts.map((p) => [p.id, p]));
        const groupsByProduct = await modifier_service_1.ModifierService.getGroupsForProducts(merchantId, allProducts.map((p) => p.id));
        const addressParts = [merchant.address, merchant.city, merchant.country].filter(Boolean);
        const { receiptPublicBaseUrl } = await Promise.resolve().then(() => __importStar(require("@/lib/receipt-public-url")));
        return {
            serverTime: Date.now(),
            tenant: {
                id: merchant.id,
                slug: merchant.slug,
                name: merchant.name,
                currency_symbol: "CHF",
            },
            business: {
                name: merchant.name,
                phone: merchant.phone || null,
                email: merchant.email,
                address: addressParts.join(", ") || null,
                vat_number: merchant.vatNumber || null,
                vat_rate: Number(merchant.vatRate || 0),
                tax_takeaway_rate: Number(merchant.taxTakeawayRate || merchant.vatRate || 0),
                tax_dine_in_rate: Number(merchant.taxDineInRate || merchant.vatRate || 0),
                tax_delivery_rate: Number(merchant.taxDeliveryRate || merchant.vatRate || 0),
                tax_included_in_price: merchant.taxIncludedInPrice === true,
                vat_after_discount: merchant.vatAfterDiscount !== false,
                default_language: merchant.panelLanguage || "en",
                store_hours: merchant.storeHours || {},
                receipt_base_url: receiptPublicBaseUrl(),
            },
            categories: categories.map((c) => this.mapCategory(c)),
            products: products.map((p) => this.mapProduct(p, false, categoryClientById, productClientById, groupsByProduct, catalogById)),
            paymentConfig: await this.getPaymentConfigPayload(merchantId),
            floor_plans: floorPlans.map((p) => ({
                id: p.id,
                name: p.name,
                canvas_width: p.canvasWidth,
                canvas_height: p.canvasHeight,
                sort_order: p.sortOrder,
                tables: (p.tables || []).map((t) => ({
                    id: t.id,
                    label: t.label,
                    capacity: t.capacity ?? 4,
                    shape: t.shape ?? "rect",
                    pos_x: t.posX ?? 40,
                    pos_y: t.posY ?? 40,
                    width: t.width ?? 100,
                    height: t.height ?? 80,
                    rotation: t.rotation ?? 0,
                    sort_order: t.sortOrder ?? 0,
                })),
            })),
            reserved_table_ids: reservedTableIds,
        };
    }
    static async getPaymentConfig(merchantId) {
        return {
            serverTime: Date.now(),
            ...(await this.getPaymentConfigPayload(merchantId)),
        };
    }
    static async getPaymentConfigPayload(merchantId) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        });
        if (!merchant)
            throw new Error("Merchant not found");
        const terminals = await db.query.paymentTerminals.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.paymentTerminals.merchantId, merchantId),
        });
        const active = terminals.filter((t) => t.status === "active");
        const defaultTerminal = active[0] || terminals[0];
        const terminalReady = !!merchant.adyenApiKey &&
            !!merchant.adyenMerchantAccount &&
            active.length > 0;
        const { normalizePosPrintSettings } = await Promise.resolve().then(() => __importStar(require("@/lib/pos-print-settings")));
        const { receiptPublicBaseUrl } = await Promise.resolve().then(() => __importStar(require("@/lib/receipt-public-url")));
        const posPrintSettings = normalizePosPrintSettings(merchant.posPrintSettings);
        return {
            adyen: {
                merchant_account: merchant.adyenMerchantAccount || null,
                api_key: merchant.adyenApiKey || null,
                client_id: merchant.adyenClientId || null,
            },
            default_terminal_id: defaultTerminal?.terminalId || null,
            terminals: terminals.map((t) => ({
                id: t.id,
                terminal_id: t.terminalId,
                terminal_name: t.terminalName,
                serial_number: t.serialNumber,
                status: t.status,
            })),
            terminal_ready: terminalReady,
            methods: {
                express: merchant.webposExpressEnabled !== false,
                cash: merchant.webposCashEnabled !== false,
                card: merchant.webposCardEnabled !== false,
                terminal: merchant.webposTerminalEnabled !== false && terminalReady,
                giftCard: merchant.webposGiftCardEnabled === true &&
                    !!merchant.giftCardSettings?.enabled,
                invoice: merchant.webposInvoiceEnabled !== false,
            },
            loyalty: (await Promise.resolve().then(() => __importStar(require("@/services/shop-loyalty.service")))).ShopLoyaltyService.programFromMerchant(merchant),
            features: {
                courses_enabled: !!merchant.coursesEnabled,
                floor_plan_enabled: !!merchant.floorPlanEnabled,
                pax_ordering_enabled: !!merchant.paxOrderingEnabled,
                shifts_enabled: !!merchant.shiftsEnabled,
            },
            checkout: {
                ...(await Promise.resolve().then(() => __importStar(require("@/lib/pos-checkout-settings")))).normalizePosCheckoutSettings(merchant.posCheckoutSettings),
                vatIncludedInPrice: merchant.taxIncludedInPrice === true,
                vatAfterDiscount: merchant.vatAfterDiscount !== false,
            },
            receipt_base_url: receiptPublicBaseUrl(),
            scale: {
                enabled: posPrintSettings.scaleEnabled === true,
                com_port: posPrintSettings.scaleComPort || null,
                usb_address: posPrintSettings.scaleUsbAddress || null,
            },
            print: {
                adyen_receipt_digital_only: posPrintSettings.adyenReceiptDigitalOnly === true,
                receipt_delivery_directions_qr: posPrintSettings.receiptDeliveryDirectionsQr !== false,
                auto_print_kitchen: posPrintSettings.autoPrintKitchen !== false,
            },
        };
    }
    static async pushTerminalsFromDevice(merchantId, input) {
        const db = (0, db_1.getDb)();
        const now = new Date();
        const adyenPatch = {};
        if (input.adyenMerchantAccount?.trim()) {
            adyenPatch.adyenMerchantAccount = input.adyenMerchantAccount.trim();
        }
        if (input.adyenApiKey?.trim()) {
            adyenPatch.adyenApiKey = input.adyenApiKey.trim();
        }
        if (input.adyenClientId?.trim()) {
            adyenPatch.adyenClientId = input.adyenClientId.trim();
        }
        if (Object.keys(adyenPatch).length > 0) {
            await merchant_settings_service_1.MerchantSettingsService.updateMerchantSettings(merchantId, adyenPatch);
        }
        const rows = input.terminals?.length
            ? input.terminals
            : input.defaultTerminalId?.trim()
                ? [{ terminalId: input.defaultTerminalId.trim() }]
                : [];
        let upserted = 0;
        for (const row of rows) {
            const terminalId = String(row.terminalId || "").trim();
            if (!terminalId)
                continue;
            const terminalName = String(row.terminalName || input.deviceLabel || terminalId).trim() || terminalId;
            const serialNumber = String(row.serialNumber || terminalId).trim() || null;
            const status = input.adyenTerminalEnabled === false
                ? "inactive"
                : String(row.status || "active").trim() || "active";
            const existing = await db.query.paymentTerminals.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.paymentTerminals.terminalId, terminalId),
            });
            if (existing) {
                if (existing.merchantId !== merchantId) {
                    throw new Error(`Terminal ${terminalId} belongs to another merchant`);
                }
                await db
                    .update(db_1.schema.paymentTerminals)
                    .set({
                    terminalName: existing.terminalName?.trim() ? existing.terminalName : terminalName,
                    serialNumber: serialNumber || existing.serialNumber,
                    status,
                    lastHeartbeat: now,
                })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.paymentTerminals.id, existing.id));
            }
            else {
                await db.insert(db_1.schema.paymentTerminals).values({
                    merchantId,
                    terminalId,
                    terminalName,
                    serialNumber,
                    status,
                    lastHeartbeat: now,
                });
            }
            upserted += 1;
        }
        return { ok: true, upserted, serverTime: Date.now() };
    }
    static async syncMenuChanges(merchantId, sinceMs) {
        const db = (0, db_1.getDb)();
        const sinceDate = sinceMs > 0 ? new Date(sinceMs) : new Date(0);
        const categories = await db.query.categories.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId), (0, drizzle_orm_1.gt)(db_1.schema.categories.updatedAt, sinceDate)),
        });
        const products = await db.query.products.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.gt)(db_1.schema.products.updatedAt, sinceDate)),
        });
        // Full category map so product.category_id matches mapCategory ids (clientId || id).
        const allCategories = await db.query.categories.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId),
        });
        const categoryClientById = new Map(allCategories.map((c) => [c.id, c.clientId || c.id]));
        const allProducts = await db.query.products.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId),
        });
        const productClientById = new Map(allProducts.map((p) => [p.id, p.clientId || p.id]));
        const catalogById = new Map(allProducts.map((p) => [p.id, p]));
        const groupsByProduct = await modifier_service_1.ModifierService.getGroupsForProducts(merchantId, allProducts.map((p) => p.id));
        return {
            serverTime: Date.now(),
            categories: categories.map((c) => this.mapCategory(c, true)),
            products: products.map((p) => this.mapProduct(p, true, categoryClientById, productClientById, groupsByProduct, catalogById)),
        };
    }
    static async incomingOrders(merchantId, sinceMs) {
        const db = (0, db_1.getDb)();
        const sinceDate = sinceMs > 0 ? new Date(sinceMs) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const orders = await db.query.orders.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.orders.orderType, "web_shop"), (0, drizzle_orm_1.inArray)(db_1.schema.orders.status, [
                "pending",
                "pending_approval",
                "accepted",
                "preparing",
                "ready",
            ]), (0, drizzle_orm_1.gt)(db_1.schema.orders.createdAt, sinceDate)),
            with: { items: true },
            limit: 200,
        });
        return {
            serverTime: Date.now(),
            orders: orders.map((o) => ({
                id: o.id,
                order_number: o.orderNumber,
                source: "ONLINE",
                status: o.status?.toUpperCase(),
                service_type: (o.fulfillmentChannel || "takeaway").toUpperCase(),
                fulfillment_type: o.fulfillmentChannel === "delivery" ? "DELIVERY" : "PICKUP",
                customer_name: o.customerName,
                customer_phone: o.customerPhone,
                delivery_address: o.shippingAddress,
                pickup_time_ms: o.scheduledFor ? o.scheduledFor.getTime() : null,
                subtotal: parseFloat(String(o.subtotal)),
                tax_total: parseFloat(String(o.taxAmount)),
                total: parseFloat(String(o.total)),
                notes: o.notes,
                payload: {
                    items: (o.items || []).map((i) => ({
                        productName: (0, order_item_name_1.resolveOrderItemName)(i.productName),
                        quantity: Number(i.quantity),
                        unitPrice: parseFloat(String(i.unitPrice)),
                        lineTotal: parseFloat(String(i.totalPrice)),
                    })),
                },
                created_at: o.createdAt?.toISOString(),
            })),
        };
    }
    static async ackOrder(merchantId, orderId) {
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.orders)
            .set({ status: "accepted" })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)));
        return { ok: true };
    }
    static mapCategory(c, includeDeleted = false) {
        return {
            id: c.clientId || c.id,
            name: (0, text_encoding_1.repairCatalogText)(c.name),
            sort_order: c.sortOrder ?? 0,
            color_hex: c.color || null,
            online_visible: true,
            kiosk_visible: true,
            updated_at: c.updatedAt?.toISOString(),
            ...(includeDeleted && false ? { deleted_at: c.updatedAt?.toISOString() } : {}),
        };
    }
    static mapProduct(p, includeDeleted = false, categoryClientById, productClientById, groupsByProduct, catalogById) {
        const categoryId = p.categoryId
            ? categoryClientById?.get(p.categoryId) || p.categoryId
            : null;
        const modifierGroups = groupsByProduct?.get(p.id) || [];
        const extras = Array.isArray(p.extras) ? p.extras : [];
        const comboItems = (0, combo_1.normalizeComboSlots)(p.comboItems).map((slot) => ({
            id: slot.id,
            name: slot.name,
            minPick: slot.minPick,
            maxPick: slot.maxPick,
            options: slot.options.map((o) => this.mapComboOption(o, productClientById, groupsByProduct, catalogById)),
        }));
        const specifications = Array.isArray(p.specifications) ? p.specifications : [];
        const variants = specifications
            .filter((s) => s?.name?.trim() && (s.saleStatus || "in_stock") !== "out_of_stock")
            .map((s, i) => ({
            id: s.id || `spec-${i + 1}`,
            name: (0, text_encoding_1.repairCatalogText)(s.name || ""),
            price: (0, money_1.roundMoney2)(Number(s.price) || 0),
            is_default: !!s.isDefault,
            sort_order: Number(s.sortOrder) || i,
            sale_status: s.saleStatus || "in_stock",
        }));
        // stock defaults to 0 in DB — that means "not tracking inventory", not unavailable.
        // Use isActive for POS/menu availability; only hide when merchant deactivated the item.
        return {
            id: p.clientId || p.id,
            category_id: categoryId,
            name: (0, text_encoding_1.repairCatalogText)(p.name),
            description: p.description ? (0, text_encoding_1.repairCatalogText)(p.description) : p.description,
            price: parseFloat(String(p.price)),
            tax_rate: parseFloat(String(p.isTaxable ? 8.1 : 0)),
            sku: p.sku,
            barcode: p.barcode,
            image_url: p.imageUrl,
            sort_order: p.sortOrder ?? 0,
            in_stock: p.isActive !== false,
            is_open_price: !!p.isOpenPrice,
            sold_by_weight: !!p.soldByWeight,
            product_type: p.productType || "standard",
            allow_extras: !!p.allowExtras || modifierGroups.length > 0 || extras.length > 0,
            extras: extras.map((e) => ({
                id: e.id,
                name: (0, text_encoding_1.repairCatalogText)(e.name || ""),
                price: Number(e.price) || 0,
            })),
            modifier_groups: modifierGroups,
            combo_items: comboItems,
            specifications,
            variants,
            online_visible: p.isActive,
            kiosk_visible: p.isActive,
            updated_at: p.updatedAt?.toISOString(),
            ...(includeDeleted && !p.isActive ? { deleted_at: p.updatedAt?.toISOString() } : {}),
        };
    }
    static mapComboOption(o, productClientById, groupsByProduct, catalogById) {
        const mapped = productClientById?.get(o.productId) || o.productId;
        const source = catalogById?.get(o.productId);
        const childGroups = groupsByProduct?.get(o.productId) || [];
        const childExtras = Array.isArray(source?.extras) ? source.extras : [];
        return {
            productId: mapped,
            product_id: mapped,
            sourceProductId: o.productId,
            extraPrice: o.extraPrice,
            name: source?.name ? (0, text_encoding_1.repairCatalogText)(source.name) : undefined,
            image: source?.imageUrl || undefined,
            allow_extras: !!source?.allowExtras || childGroups.length > 0 || childExtras.length > 0,
            extras: childExtras.map((e) => ({
                id: e.id,
                name: (0, text_encoding_1.repairCatalogText)(e.name || ""),
                price: Number(e.price) || 0,
            })),
            modifier_groups: childGroups,
        };
    }
    static receiptPublicUrl(ref) {
        return (0, receipt_public_url_1.receiptPublicUrl)(ref);
    }
}
exports.ChaslayCompatService = ChaslayCompatService;
//# sourceMappingURL=chaslay-compat.service.js.map