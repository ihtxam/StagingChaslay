"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformShopService = void 0;
const axios_1 = __importDefault(require("axios"));
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const money_1 = require("@/lib/money");
const transactional_email_labels_1 = require("@/lib/transactional-email-labels");
const platform_settings_service_1 = require("@/services/platform-settings.service");
const email_service_1 = require("@/services/email.service");
const media_upload_service_1 = require("@/services/media-upload.service");
const PLATFORM_UPLOAD_MERCHANT = 'platform';
function effectiveUnitPrice(price, discountPercent) {
    const pct = Math.min(100, Math.max(0, Number(discountPercent) || 0));
    if (!pct)
        return (0, money_1.roundMoney2)(price);
    return (0, money_1.roundMoney2)(price * (1 - pct / 100));
}
function platformShopEmailCopy(locale, kind, total) {
    const lang = (0, transactional_email_labels_1.resolveTxLocale)({ panelLanguage: locale });
    const amount = `${total.toFixed(2)} CHF`;
    if (lang === 'fr') {
        return kind === 'merchant'
            ? {
                subject: `Confirmation de commande — boutique Chaslay`,
                html: `<p>Merci ! Nous avons bien reçu votre commande de ${amount}.</p>`,
                text: `Commande reçue — ${amount}`,
            }
            : {
                subject: `Nouvelle commande boutique plateforme`,
                html: `<p>Une commande de ${amount} a été passée.</p>`,
                text: `Nouvelle commande boutique — ${amount}`,
            };
    }
    if (lang === 'de') {
        return kind === 'merchant'
            ? {
                subject: `Bestellbestätigung — Chaslay Shop`,
                html: `<p>Vielen Dank! Wir haben Ihre Bestellung über ${amount} erhalten.</p>`,
                text: `Bestellung erhalten — ${amount}`,
            }
            : {
                subject: `Neue Plattform-Shop-Bestellung`,
                html: `<p>Eine Bestellung über ${amount} wurde aufgegeben.</p>`,
                text: `Neue Plattform-Shop-Bestellung — ${amount}`,
            };
    }
    return kind === 'merchant'
        ? {
            subject: `Order confirmation — Chaslay shop`,
            html: `<p>Thank you! We received your order for ${amount}.</p>`,
            text: `Order received — ${amount}`,
        }
        : {
            subject: `New platform shop order`,
            html: `<p>An order for ${amount} was placed.</p>`,
            text: `New platform shop order — ${amount}`,
        };
}
class PlatformShopService {
    static async listProducts(activeOnly = true) {
        const db = (0, db_1.getDb)();
        return db.query.platformShopProducts.findMany({
            where: activeOnly ? (0, drizzle_orm_1.eq)(db_1.schema.platformShopProducts.isActive, true) : undefined,
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.platformShopProducts.sortOrder), (0, drizzle_orm_1.asc)(db_1.schema.platformShopProducts.name)],
        });
    }
    static async createProduct(input) {
        const db = (0, db_1.getDb)();
        const [row] = await db
            .insert(db_1.schema.platformShopProducts)
            .values({
            name: input.name.trim().slice(0, 255),
            description: input.description?.trim() || null,
            price: String((0, money_1.roundMoney2)(Number(input.price) || 0)),
            discountPercent: input.discountPercent == null ? null : Math.min(100, Math.max(0, Number(input.discountPercent) || 0)),
            imageUrl: input.imageUrl?.trim() || null,
            isActive: input.isActive !== false,
            sortOrder: Number(input.sortOrder) || 0,
        })
            .returning();
        return row;
    }
    static async updateProduct(id, input) {
        const db = (0, db_1.getDb)();
        const patch = { updatedAt: new Date() };
        if (input.name !== undefined)
            patch.name = input.name.trim().slice(0, 255);
        if (input.description !== undefined)
            patch.description = input.description?.trim() || null;
        if (input.price !== undefined)
            patch.price = String((0, money_1.roundMoney2)(Number(input.price) || 0));
        if (input.discountPercent !== undefined) {
            patch.discountPercent =
                input.discountPercent == null
                    ? null
                    : Math.min(100, Math.max(0, Number(input.discountPercent) || 0));
        }
        if (input.imageUrl !== undefined)
            patch.imageUrl = input.imageUrl?.trim() || null;
        if (input.isActive !== undefined)
            patch.isActive = !!input.isActive;
        if (input.sortOrder !== undefined)
            patch.sortOrder = Number(input.sortOrder) || 0;
        const [row] = await db
            .update(db_1.schema.platformShopProducts)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.platformShopProducts.id, id))
            .returning();
        if (!row)
            throw new Error('Product not found');
        return row;
    }
    static async deleteProduct(id) {
        const db = (0, db_1.getDb)();
        const [row] = await db
            .update(db_1.schema.platformShopProducts)
            .set({ isActive: false, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.platformShopProducts.id, id))
            .returning();
        if (!row)
            throw new Error('Product not found');
        return row;
    }
    static async saveProductImage(buffer, mimeType, originalName) {
        return (0, media_upload_service_1.saveMerchantImage)({
            merchantId: PLATFORM_UPLOAD_MERCHANT,
            buffer,
            mimeType,
            originalName,
        });
    }
    static async listVouchers(activeOnly = false) {
        const db = (0, db_1.getDb)();
        return db.query.platformShopVouchers.findMany({
            where: activeOnly ? (0, drizzle_orm_1.eq)(db_1.schema.platformShopVouchers.isActive, true) : undefined,
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.platformShopVouchers.createdAt)],
        });
    }
    static async createVoucher(input) {
        const code = String(input.code || '')
            .trim()
            .toUpperCase()
            .slice(0, 50);
        if (!code)
            throw new Error('Voucher code is required');
        const db = (0, db_1.getDb)();
        const [row] = await db
            .insert(db_1.schema.platformShopVouchers)
            .values({
            code,
            label: input.label?.trim().slice(0, 255) || null,
            discountPercent: input.discountPercent == null
                ? null
                : Math.min(100, Math.max(0, Number(input.discountPercent) || 0)),
            discountAmount: input.discountAmount == null ? null : String((0, money_1.roundMoney2)(Number(input.discountAmount) || 0)),
            isActive: input.isActive !== false,
            maxUses: input.maxUses == null ? null : Math.max(1, Number(input.maxUses) || 1),
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        })
            .returning();
        return row;
    }
    static async updateVoucher(id, input) {
        const db = (0, db_1.getDb)();
        const patch = { updatedAt: new Date() };
        if (input.code !== undefined) {
            patch.code = String(input.code).trim().toUpperCase().slice(0, 50);
        }
        if (input.label !== undefined)
            patch.label = input.label?.trim().slice(0, 255) || null;
        if (input.discountPercent !== undefined) {
            patch.discountPercent =
                input.discountPercent == null
                    ? null
                    : Math.min(100, Math.max(0, Number(input.discountPercent) || 0));
        }
        if (input.discountAmount !== undefined) {
            patch.discountAmount =
                input.discountAmount == null ? null : String((0, money_1.roundMoney2)(Number(input.discountAmount) || 0));
        }
        if (input.isActive !== undefined)
            patch.isActive = !!input.isActive;
        if (input.maxUses !== undefined) {
            patch.maxUses = input.maxUses == null ? null : Math.max(1, Number(input.maxUses) || 1);
        }
        if (input.expiresAt !== undefined) {
            patch.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
        }
        const [row] = await db
            .update(db_1.schema.platformShopVouchers)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.platformShopVouchers.id, id))
            .returning();
        if (!row)
            throw new Error('Voucher not found');
        return row;
    }
    static async resolveVoucher(code) {
        const raw = String(code || '')
            .trim()
            .toUpperCase();
        if (!raw)
            return null;
        const db = (0, db_1.getDb)();
        const voucher = await db.query.platformShopVouchers.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.platformShopVouchers.code, raw), (0, drizzle_orm_1.eq)(db_1.schema.platformShopVouchers.isActive, true)),
        });
        if (!voucher)
            throw new Error('Invalid voucher code');
        if (voucher.expiresAt && voucher.expiresAt < new Date()) {
            throw new Error('Voucher has expired');
        }
        if (voucher.maxUses != null && (voucher.usedCount || 0) >= voucher.maxUses) {
            throw new Error('Voucher has reached its usage limit');
        }
        return voucher;
    }
    static computeCart(items, catalog, voucher) {
        const byId = new Map(catalog.map((p) => [p.id, p]));
        let subtotal = 0;
        const lines = [];
        for (const item of items) {
            const product = byId.get(item.productId);
            if (!product)
                throw new Error('Invalid product in cart');
            const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
            const unit = effectiveUnitPrice(Number(product.price) || 0, product.discountPercent);
            const lineTotal = (0, money_1.roundMoney2)(unit * qty);
            subtotal = (0, money_1.roundMoney2)(subtotal + lineTotal);
            lines.push({
                productId: product.id,
                name: product.name,
                quantity: qty,
                unitPrice: unit,
                lineTotal,
            });
        }
        if (!lines.length)
            throw new Error('Cart is empty');
        let discountAmount = 0;
        if (voucher) {
            if (voucher.discountPercent) {
                discountAmount = (0, money_1.roundMoney2)(subtotal * (Number(voucher.discountPercent) / 100));
            }
            else if (voucher.discountAmount) {
                discountAmount = (0, money_1.roundMoney2)(Number(voucher.discountAmount));
            }
            discountAmount = Math.min(subtotal, discountAmount);
        }
        const total = (0, money_1.roundMoney2)(subtotal - discountAmount);
        return { lines, subtotal, discountAmount, total };
    }
    static async startCheckout(merchantId, items, opts) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: { id: true, name: true, email: true, panelLanguage: true },
        });
        if (!merchant)
            throw new Error('Merchant not found');
        const catalog = await this.listProducts(true);
        const voucher = opts?.voucherCode ? await this.resolveVoucher(opts.voucherCode) : null;
        const { lines, subtotal, discountAmount, total } = this.computeCart(items, catalog, voucher);
        const [order] = await db
            .insert(db_1.schema.platformShopOrders)
            .values({
            merchantId,
            status: 'pending',
            paymentStatus: total <= 0 ? 'paid' : 'pending',
            subtotal: String(subtotal),
            discountAmount: String(discountAmount),
            total: String(total),
            currency: 'CHF',
            voucherCode: voucher?.code || null,
            items: lines,
            notes: opts?.notes?.trim().slice(0, 2000) || null,
            paidAt: total <= 0 ? new Date() : null,
        })
            .returning();
        if (voucher && total <= 0) {
            await db
                .update(db_1.schema.platformShopVouchers)
                .set({ usedCount: (0, drizzle_orm_1.sql) `${db_1.schema.platformShopVouchers.usedCount} + 1`, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.platformShopVouchers.id, voucher.id));
        }
        await this.sendOrderEmails(merchant, order, lines, total);
        if (total <= 0) {
            return { order: order, free: true, paymentSession: null };
        }
        const creds = await platform_settings_service_1.PlatformSettingsService.resolvePlatformAdyenCredentials();
        const reference = `pshop-${merchantId.slice(0, 8)}-${order.id.slice(0, 8)}`;
        const defaultReturn = opts?.returnUrl ||
            `${process.env.MERCHANT_DASHBOARD_URL || process.env.PUBLIC_APP_URL || ''}/merchant/platform-shop?orderId=${order.id}`;
        try {
            const sessionPayload = {
                amount: { value: Math.round(total * 100), currency: 'CHF' },
                merchantAccount: creds.merchantAccount,
                reference,
                returnUrl: defaultReturn,
                channel: 'Web',
                countryCode: 'CH',
                shopperReference: merchantId,
                clientKey: creds.clientKey,
                metadata: {
                    type: 'platform_shop',
                    orderId: order.id,
                    merchantId,
                },
            };
            const response = await axios_1.default.post(`${creds.apiBase}/sessions`, sessionPayload, {
                headers: {
                    'x-api-key': creds.apiKey,
                    'Content-Type': 'application/json',
                },
            });
            const sessionId = response.data?.id;
            const sessionData = response.data?.sessionData;
            if (!sessionId || !sessionData) {
                throw new Error('Adyen session response was incomplete');
            }
            await db
                .update(db_1.schema.platformShopOrders)
                .set({ adyenSessionId: sessionId, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.platformShopOrders.id, order.id));
            return {
                order: order,
                free: false,
                paymentSession: {
                    id: sessionId,
                    sessionData,
                    clientKey: creds.clientKey,
                    environment: creds.dropinEnvironment,
                },
            };
        }
        catch (error) {
            await db
                .update(db_1.schema.platformShopOrders)
                .set({ paymentStatus: 'failed', updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.platformShopOrders.id, order.id));
            const msg = (0, platform_settings_service_1.formatAdyenCheckoutApiError)(error, {
                apiBase: creds.apiBase,
                merchantAccount: creds.merchantAccount,
                phase: 'sessions',
            });
            throw new Error(msg);
        }
    }
    static async confirmPayment(merchantId, orderId, opts) {
        const db = (0, db_1.getDb)();
        const order = await db.query.platformShopOrders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.platformShopOrders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.platformShopOrders.merchantId, merchantId)),
        });
        if (!order)
            throw new Error('Order not found');
        if (order.paymentStatus === 'paid')
            return { alreadyPaid: true, order };
        const resultCode = opts?.resultCode || 'Authorised';
        const ok = ['Authorised', 'Received', 'Pending', 'PresentToShopper'].includes(resultCode);
        if (!ok) {
            await db
                .update(db_1.schema.platformShopOrders)
                .set({
                paymentStatus: 'failed',
                adyenResultCode: resultCode,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.platformShopOrders.id, orderId));
            throw new Error(`Payment not authorised (${resultCode})`);
        }
        const [updated] = await db
            .update(db_1.schema.platformShopOrders)
            .set({
            status: 'paid',
            paymentStatus: 'paid',
            adyenPspReference: opts?.pspReference || order.adyenPspReference,
            adyenResultCode: resultCode,
            paidAt: new Date(),
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.platformShopOrders.id, orderId))
            .returning();
        if (order.voucherCode) {
            const voucher = await this.resolveVoucher(order.voucherCode).catch(() => null);
            if (voucher) {
                await db
                    .update(db_1.schema.platformShopVouchers)
                    .set({ usedCount: (0, drizzle_orm_1.sql) `${db_1.schema.platformShopVouchers.usedCount} + 1`, updatedAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.platformShopVouchers.id, voucher.id));
            }
        }
        return { order: updated };
    }
    static async sendOrderEmails(merchant, order, lines, total) {
        const linesHtml = lines
            .map((l) => `<tr><td style="padding:4px 0">${l.name}</td><td style="padding:4px 0;text-align:right">${l.quantity} × ${l.unitPrice.toFixed(2)}</td></tr>`)
            .join('');
        const merchantCopy = platformShopEmailCopy(merchant.panelLanguage, 'merchant', total);
        const adminCopy = platformShopEmailCopy('en', 'admin', total);
        try {
            if (merchant.email) {
                await email_service_1.EmailService.send({
                    to: merchant.email,
                    subject: merchantCopy.subject,
                    html: `<div style="font-family:system-ui,sans-serif">${merchantCopy.html}</div>`,
                    text: merchantCopy.text,
                    merchantId: merchant.id,
                });
            }
            const adminTo = process.env.PLATFORM_SHOP_ADMIN_EMAIL || process.env.SUPERADMIN_EMAIL;
            if (adminTo) {
                await email_service_1.EmailService.send({
                    to: adminTo,
                    subject: `${adminCopy.subject} — ${merchant.name || 'Merchant'}`,
                    html: `
            <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
              <h1 style="font-size:18px">${adminCopy.subject}</h1>
              <p><strong>${merchant.name}</strong> placed order #${order.id.slice(0, 8)} (${total.toFixed(2)} CHF).</p>
              <table style="width:100%;font-size:14px">${linesHtml}</table>
              ${order.notes ? `<p style="font-size:13px;color:#78716c">Notes: ${order.notes}</p>` : ''}
            </div>`,
                    text: `${adminCopy.text} from ${merchant.name}`,
                });
            }
        }
        catch (err) {
            console.warn('[platform-shop] order email failed', err);
        }
    }
    static async listMerchantOrders(merchantId) {
        const db = (0, db_1.getDb)();
        return db.query.platformShopOrders.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.platformShopOrders.merchantId, merchantId),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.platformShopOrders.createdAt)],
            limit: 50,
        });
    }
    static async listAllOrders(limit = 100) {
        const db = (0, db_1.getDb)();
        return db.query.platformShopOrders.findMany({
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.platformShopOrders.createdAt)],
            limit,
            with: { merchant: { columns: { id: true, name: true, email: true } } },
        });
    }
    static async updateOrderStatus(orderId, status) {
        const db = (0, db_1.getDb)();
        const allowed = ['pending', 'paid', 'fulfilled', 'cancelled'];
        if (!allowed.includes(status))
            throw new Error('Invalid status');
        const [row] = await db
            .update(db_1.schema.platformShopOrders)
            .set({ status, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.platformShopOrders.id, orderId))
            .returning();
        if (!row)
            throw new Error('Order not found');
        return row;
    }
}
exports.PlatformShopService = PlatformShopService;
//# sourceMappingURL=platform-shop.service.js.map