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
exports.DeliveryPlatformService = void 0;
const crypto_1 = require("crypto");
const uuid_1 = require("uuid");
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const money_1 = require("@/lib/money");
const delivery_platform_settings_1 = require("@/lib/delivery-platform-settings");
const delivery_platform_webhook_mappers_1 = require("@/lib/delivery-platform-webhook-mappers");
const pos_checkout_settings_1 = require("@/lib/pos-checkout-settings");
const pos_print_settings_1 = require("@/lib/pos-print-settings");
const merchant_settings_service_1 = require("@/services/merchant-settings.service");
const chaslay_floor_service_1 = require("@/services/chaslay-floor.service");
function verifyWebhookSecret(provided, expected, testMode) {
    if (testMode && process.env.DELIVERY_PLATFORMS_ALLOW_TEST_WEBHOOKS !== "false") {
        return true;
    }
    if (!expected)
        return false;
    const a = Buffer.from(String(provided || ""));
    const b = Buffer.from(expected);
    if (a.length !== b.length)
        return false;
    return (0, crypto_1.timingSafeEqual)(a, b);
}
/** JET Connect: X-JET-Connect-Hash = HMAC-SHA256(raw body, webhook HMAC secret) as lowercase hex. */
function verifyJetConnectHash(rawBody, hash, secret) {
    if (!secret || !hash)
        return false;
    const expected = (0, crypto_1.createHmac)("sha256", secret).update(rawBody).digest("hex");
    const provided = hash.trim().toLowerCase();
    try {
        const a = Buffer.from(expected, "hex");
        const b = Buffer.from(provided, "hex");
        if (a.length === b.length)
            return (0, crypto_1.timingSafeEqual)(a, b);
    }
    catch {
        /* fall through to string compare */
    }
    return expected.toLowerCase() === provided;
}
function verifyWebhookAuthorization(provided, expected) {
    if (!expected)
        return true;
    if (!provided)
        return false;
    return provided.trim() === expected.trim();
}
function verifyHmacSignature(rawBody, signature, secret) {
    if (!secret || !signature)
        return false;
    const expected = (0, crypto_1.createHmac)("sha256", secret).update(rawBody).digest("hex");
    const provided = signature.replace(/^sha256=/i, "").trim().toLowerCase();
    try {
        const a = Buffer.from(expected, "hex");
        const b = Buffer.from(provided, "hex");
        if (a.length === b.length)
            return (0, crypto_1.timingSafeEqual)(a, b);
    }
    catch {
        /* fall through to string compare */
    }
    return expected.toLowerCase() === provided;
}
function headerOne(headers, name) {
    const v = headers[name.toLowerCase()] ?? headers[name];
    if (Array.isArray(v))
        return String(v[0] || "");
    return String(v || "");
}
function lineSubtotal(line) {
    const qty = Number(line.quantity) || 0;
    const unit = Number(line.unitPrice) || 0;
    return (0, money_1.roundMoney2)(qty * unit);
}
class DeliveryPlatformService {
    static getPublicSettings(raw) {
        return (0, delivery_platform_settings_1.getDeliveryPlatformPublic)(raw);
    }
    static async updateSettings(merchantId, updates) {
        const db = (0, db_1.getDb)();
        const current = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { deliveryPlatformSettings: true },
        });
        if (!current)
            throw new Error("Merchant not found");
        const merged = (0, delivery_platform_settings_1.mergeDeliveryPlatformSettings)(current.deliveryPlatformSettings, updates);
        const withProd = (0, delivery_platform_settings_1.applyProductionCredentialDefaults)(merged);
        await db
            .update(db_1.schema.merchants)
            .set({ deliveryPlatformSettings: withProd })
            .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        return withProd;
    }
    static async getPlatformConfig(merchantId, platform) {
        const source = (0, delivery_platform_settings_1.orderSourceFromPlatform)(platform);
        if (!source || source === "online_shop") {
            throw new Error("Unknown delivery platform");
        }
        const key = (0, delivery_platform_settings_1.platformKeyFromSource)(source);
        if (!key)
            throw new Error("Unknown delivery platform");
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { deliveryPlatformSettings: true, name: true },
        });
        if (!merchant)
            throw new Error("Merchant not found");
        const settings = (0, delivery_platform_settings_1.normalizeDeliveryPlatformSettings)(merchant.deliveryPlatformSettings);
        const cfg = settings[key] || {};
        return { merchant, source, key, cfg };
    }
    static async verifyWebhook(opts) {
        const { source, cfg } = await DeliveryPlatformService.getPlatformConfig(opts.merchantId, opts.platform);
        if (!cfg.enabled) {
            throw new Error("Delivery platform integration is disabled");
        }
        const platformSlug = String(opts.platform).toLowerCase();
        const webhookSecret = headerOne(opts.headers, "x-webhook-secret") ||
            headerOne(opts.headers, "x-chaslay-webhook-secret");
        const signature = headerOne(opts.headers, "x-uber-signature") ||
            headerOne(opts.headers, "x-signature") ||
            headerOne(opts.headers, "x-hub-signature-256") ||
            headerOne(opts.headers, "x-just-eat-signature") ||
            headerOne(opts.headers, "x-flyt-signature") ||
            headerOne(opts.headers, "x-jet-signature");
        const jetConnectHash = headerOne(opts.headers, "x-jet-connect-hash");
        const authorization = headerOne(opts.headers, "authorization");
        const isJustEat = platformSlug.includes("just");
        const hmacSecret = cfg.webhookSecret || (!isJustEat ? cfg.apiSecret : undefined);
        const signingSecret = cfg.webhookSecret ||
            (platformSlug.includes("uber") ? cfg.clientSecret : cfg.apiSecret) ||
            undefined;
        const secretOk = verifyWebhookSecret(webhookSecret, signingSecret, !!cfg.testMode);
        const hmacOk = verifyHmacSignature(opts.rawBody, signature, signingSecret);
        const jetHashOk = isJustEat
            ? verifyJetConnectHash(opts.rawBody, jetConnectHash, cfg.webhookSecret || undefined)
            : false;
        const jetAuthOk = isJustEat
            ? verifyWebhookAuthorization(authorization, cfg.apiSecret || undefined)
            : true;
        if (!cfg.testMode && isJustEat) {
            const verified = jetHashOk ||
                (cfg.apiSecret ? jetAuthOk && !!authorization : false) ||
                secretOk ||
                hmacOk;
            if (!verified) {
                throw new Error("Invalid webhook signature");
            }
        }
        else if (!cfg.testMode && !secretOk && !hmacOk) {
            throw new Error("Invalid webhook signature");
        }
        return { source, cfg };
    }
    static jetConnectApiBase(testMode) {
        if (testMode && process.env.JET_CONNECT_SANDBOX_API_BASE) {
            return process.env.JET_CONNECT_SANDBOX_API_BASE.replace(/\/$/, "");
        }
        return (process.env.JET_CONNECT_API_BASE || "https://uk-partnerapi.just-eat.io").replace(/\/$/, "");
    }
    /** JET Connect async webhooks expect a callback POST after processing. */
    static async sendJetConnectAsyncCallback(callbackUrl, success, message) {
        try {
            const res = await fetch(callbackUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status: success ? "Success" : "Failure",
                    message,
                    data: {},
                }),
            });
            if (!res.ok) {
                console.warn(`Jet Connect callback ${callbackUrl}: HTTP ${res.status}`);
            }
        }
        catch (err) {
            console.warn("Jet Connect async callback failed:", err);
        }
    }
    /** Resolve Uber notification-only webhooks via Eats API when credentials are configured. */
    static async enrichUberWebhookBody(merchantId, mapped) {
        const o = (mapped && typeof mapped === "object" ? mapped : {});
        if (!(0, delivery_platform_webhook_mappers_1.isUberNotificationOnly)(mapped))
            return mapped;
        const externalOrderId = String(o.externalOrderId || "").trim();
        if (!externalOrderId)
            return mapped;
        try {
            const { cfg } = await DeliveryPlatformService.getPlatformConfig(merchantId, "uber-eats");
            if (!cfg.clientId || !cfg.clientSecret)
                return mapped;
            const token = await DeliveryPlatformService.fetchUberAccessToken(cfg.clientId, cfg.clientSecret);
            const res = await fetch(`https://api.uber.com/v1/eats/orders/${externalOrderId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                console.warn(`Uber order fetch ${externalOrderId}: HTTP ${res.status}`);
                return mapped;
            }
            const order = await res.json();
            return (0, delivery_platform_webhook_mappers_1.mapUberEatsWebhookBody)({ order, externalOrderId });
        }
        catch (err) {
            console.warn("Uber order enrichment failed:", err);
            return mapped;
        }
    }
    static async fetchUberAccessToken(clientId, clientSecret) {
        const res = await fetch("https://login.uber.com/oauth/v2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: "client_credentials",
                scope: "eats.order",
            }),
        });
        if (!res.ok)
            throw new Error(`Uber OAuth failed: HTTP ${res.status}`);
        const data = (await res.json());
        if (!data.access_token)
            throw new Error("Uber OAuth missing access_token");
        return data.access_token;
    }
    /** Notify partner that Reborn accepted the order (best-effort skeleton). */
    static async notifyPartnerOrderAccepted(merchantId, order) {
        const source = order.orderSource;
        const externalId = order.externalOrderId?.trim();
        if (!source || !externalId || source === "online_shop")
            return;
        const platform = source === "justeat" ? "just-eat" : source === "ubereats" ? "uber-eats" : null;
        if (!platform)
            return;
        const { cfg } = await DeliveryPlatformService.getPlatformConfig(merchantId, platform);
        if (cfg.testMode)
            return;
        try {
            if (source === "ubereats" && cfg.clientId && cfg.clientSecret) {
                const token = await DeliveryPlatformService.fetchUberAccessToken(cfg.clientId, cfg.clientSecret);
                const res = await fetch(`https://api.uber.com/v1/eats/orders/${externalId}/accept_pos_order`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ reason: "accepted" }),
                });
                if (!res.ok) {
                    console.warn(`Uber accept ${externalId}: HTTP ${res.status}`);
                }
                return;
            }
            if (source === "justeat" && cfg.apiKey) {
                const base = DeliveryPlatformService.jetConnectApiBase(!!cfg.testMode);
                const res = await fetch(`${base}/orders/${externalId}/accept`, {
                    method: "PUT",
                    headers: {
                        Authorization: `JE-API-KEY ${cfg.apiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({}),
                });
                if (!res.ok) {
                    console.warn(`Just Eat accept ${externalId}: HTTP ${res.status}`);
                }
            }
        }
        catch (err) {
            console.warn("Partner accept callback failed:", err);
        }
    }
    static normalizeWebhookPayload(body) {
        const o = (body && typeof body === "object" ? body : {});
        const externalOrderId = String(o.externalOrderId || o.external_order_id || o.id || o.orderId || o.order_id || "").trim();
        if (!externalOrderId)
            throw new Error("externalOrderId is required");
        const rawItems = Array.isArray(o.items) ? o.items : Array.isArray(o.lineItems) ? o.lineItems : [];
        const items = rawItems.map((row) => {
            const r = (row && typeof row === "object" ? row : {});
            const name = String(r.name || r.productName || r.title || "Item").trim();
            const quantity = Number(r.quantity ?? r.qty ?? 1) || 1;
            const unitPrice = Number(r.unitPrice ?? r.price ?? r.unit_price ?? 0) || 0;
            return {
                productId: r.productId != null ? String(r.productId) : null,
                sku: r.sku != null ? String(r.sku) : null,
                name,
                quantity,
                unitPrice,
                selectedExtras: Array.isArray(r.selectedExtras) ? r.selectedExtras : [],
                comboSelections: Array.isArray(r.comboSelections)
                    ? r.comboSelections
                    : [],
            };
        });
        if (!items.length)
            throw new Error("At least one order item is required");
        const channelRaw = String(o.fulfillmentChannel || o.channel || o.fulfillment || "delivery")
            .trim()
            .toLowerCase();
        const fulfillmentChannel = channelRaw === "pickup" || channelRaw === "takeaway"
            ? "takeaway"
            : channelRaw === "dine_in" || channelRaw === "dine-in"
                ? "dine_in"
                : "delivery";
        const subtotal = o.subtotal != null
            ? (0, money_1.roundMoney2)(Number(o.subtotal))
            : (0, money_1.roundMoney2)(items.reduce((s, i) => s + lineSubtotal(i), 0));
        const taxAmount = o.taxAmount != null ? (0, money_1.roundMoney2)(Number(o.taxAmount)) : 0;
        const deliveryFee = o.deliveryFee != null ? (0, money_1.roundMoney2)(Number(o.deliveryFee)) : 0;
        const tipAmount = o.tipAmount != null ? (0, money_1.roundMoney2)(Number(o.tipAmount)) : 0;
        const total = o.total != null
            ? (0, money_1.roundMoney2)(Number(o.total))
            : (0, money_1.roundMoney2)(subtotal + taxAmount + deliveryFee + tipAmount);
        return {
            externalOrderId,
            fulfillmentChannel,
            customerName: o.customerName != null ? String(o.customerName) : null,
            customerPhone: o.customerPhone != null ? String(o.customerPhone) : null,
            customerEmail: o.customerEmail != null ? String(o.customerEmail) : null,
            shippingAddress: o.shippingAddress != null ? String(o.shippingAddress) : null,
            notes: o.notes != null ? String(o.notes) : null,
            items,
            subtotal,
            taxAmount,
            deliveryFee,
            tipAmount,
            total,
            scheduledFor: o.scheduledFor != null ? String(o.scheduledFor) : null,
        };
    }
    static async ingestOrder(merchantId, source, payload) {
        const db = (0, db_1.getDb)();
        const key = (0, delivery_platform_settings_1.platformKeyFromSource)(source);
        if (!key)
            throw new Error("Unsupported order source");
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        });
        if (!merchant)
            throw new Error("Merchant not found");
        const platformSettings = (0, delivery_platform_settings_1.normalizeDeliveryPlatformSettings)(merchant.deliveryPlatformSettings);
        const cfg = platformSettings[key];
        if (!cfg?.enabled) {
            throw new Error(`${source} integration is disabled`);
        }
        const existing = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.orders.orderSource, source), (0, drizzle_orm_1.eq)(db_1.schema.orders.externalOrderId, payload.externalOrderId)),
        });
        if (existing) {
            return { order: existing, created: false };
        }
        const channel = payload.fulfillmentChannel || "delivery";
        const taxRate = merchant_settings_service_1.MerchantSettingsService.channelTaxRate(merchant, channel);
        const subtotal = payload.subtotal ?? 0;
        let taxAmount = payload.taxAmount ?? 0;
        if (taxAmount <= 0 && subtotal > 0 && taxRate > 0 && merchant.taxIncludedInPrice !== true) {
            taxAmount = (0, money_1.roundMoney2)(subtotal * (taxRate / 100));
        }
        const orderNumber = `${source.toUpperCase()}-${Date.now()}-${(0, uuid_1.v4)().substring(0, 6).toUpperCase()}`;
        const status = cfg.autoAccept ? "preparing" : "pending_approval";
        const platformNote = `[${source}:${payload.externalOrderId}]`;
        const notes = [platformNote, payload.notes].filter(Boolean).join("\n");
        const [order] = await db
            .insert(db_1.schema.orders)
            .values({
            merchantId,
            orderNumber,
            orderType: "web_shop",
            orderSource: source,
            externalOrderId: payload.externalOrderId,
            fulfillmentChannel: channel,
            status,
            subtotal: subtotal.toFixed(2),
            taxAmount: taxAmount.toFixed(2),
            discountAmount: "0",
            deliveryFee: (payload.deliveryFee ?? 0).toFixed(2),
            tipAmount: (payload.tipAmount ?? 0).toFixed(2),
            total: (payload.total ?? subtotal + taxAmount).toFixed(2),
            paymentMethod: "online",
            paymentStatus: "completed",
            notes,
            shippingAddress: payload.shippingAddress,
            scheduledFor: payload.scheduledFor ? new Date(payload.scheduledFor) : null,
            customerName: payload.customerName,
            customerPhone: payload.customerPhone,
            customerEmail: payload.customerEmail,
        })
            .returning();
        for (const line of payload.items) {
            let productId = line.productId || null;
            if (!productId && line.sku) {
                const product = await db.query.products.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.products.sku, line.sku)),
                    columns: { id: true },
                });
                productId = product?.id || null;
            }
            const qty = Number(line.quantity) || 1;
            const unit = Number(line.unitPrice) || 0;
            const lineTotal = lineSubtotal(line);
            const lineTax = taxRate > 0 && merchant.taxIncludedInPrice !== true
                ? (0, money_1.roundMoney2)(lineTotal * (taxRate / 100))
                : 0;
            await db.insert(db_1.schema.orderItems).values({
                orderId: order.id,
                productId,
                productName: line.name,
                quantity: qty.toString(),
                unitPrice: unit.toFixed(2),
                totalPrice: lineTotal.toFixed(2),
                taxAmount: lineTax.toFixed(2),
                selectedExtras: line.selectedExtras || [],
                comboSelections: line.comboSelections || [],
            });
        }
        await DeliveryPlatformService.enqueueAutoPrint(merchantId, order.id, source, {
            printKitchen: status === "preparing",
            printDeliveryReceipt: channel === "delivery",
            printNotification: channel !== "delivery" && status !== "preparing",
            printReceipt: channel !== "delivery" &&
                (order.paymentStatus === "completed" || order.paymentStatus === "paid"),
        });
        if (status === "preparing") {
            void Promise.resolve().then(() => __importStar(require("@/services/kitchen-ingress.service"))).then(({ enterKitchenFromOrder }) => enterKitchenFromOrder(merchantId, order.id, {
                orderSource: source,
            }))
                .catch(() => { });
        }
        return { order, created: true };
    }
    static async enqueueAutoPrint(merchantId, orderId, orderSource, opts) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { posPrintSettings: true, posCheckoutSettings: true },
        });
        if (!merchant)
            return;
        const printSettings = (0, pos_print_settings_1.normalizePosPrintSettings)(merchant.posPrintSettings);
        const printKitchen = opts?.printKitchen === true &&
            !(0, pos_checkout_settings_1.isRetailPosMode)(merchant.posCheckoutSettings) &&
            printSettings.autoPrintKitchen !== false;
        const printReceipt = opts?.printReceipt === true && printSettings.autoPrintReceipt !== false;
        const printDeliveryReceipt = opts?.printDeliveryReceipt === true;
        const printNotification = opts?.printNotification === true;
        if (!printKitchen && !printReceipt && !printDeliveryReceipt && !printNotification)
            return;
        await chaslay_floor_service_1.ChaslayFloorService.createPrintJob(merchantId, {
            jobType: "ESCPOS",
            payload: {
                kind: "auto_print_order",
                orderId,
                printKitchen,
                printReceipt,
                printDeliveryReceipt,
                printNotification,
                orderSource,
            },
            orderId,
            sourceDeviceId: "delivery-platform",
        });
    }
    static webhookUrl(platform, merchantId) {
        const base = process.env.PUBLIC_APP_URL ||
            process.env.MERCHANT_DASHBOARD_URL ||
            "https://app.rebornsense.com";
        const apiBase = base.replace(/\/$/, "").includes("api.")
            ? base.replace(/\/$/, "")
            : `${base.replace(/\/$/, "")}/api`;
        const slug = String(platform).toLowerCase().replace(/_/g, "-");
        return `${apiBase}/webhooks/${slug}/${merchantId}`;
    }
}
exports.DeliveryPlatformService = DeliveryPlatformService;
//# sourceMappingURL=delivery-platform.service.js.map