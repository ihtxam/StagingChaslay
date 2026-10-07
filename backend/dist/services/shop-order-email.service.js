"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopOrderEmailService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const transactional_email_labels_1 = require("@/lib/transactional-email-labels");
const shop_order_email_template_1 = require("@/lib/shop-order-email-template");
const delivery_tracking_url_1 = require("@/lib/delivery-tracking-url");
const email_service_1 = require("@/services/email.service");
function formatWhen(value, locale) {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime()))
        return null;
    return d.toLocaleString(locale === 'fr' ? 'fr-CH' : locale === 'de' ? 'de-CH' : 'en-CH', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Europe/Zurich',
    });
}
function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function discountTotal(order) {
    const discount = Number(order.discountAmount || 0);
    const points = Number(order.pointsDiscount || 0);
    return String(Math.max(0, discount + points));
}
class ShopOrderEmailService {
    static async sendGuestOrderEmail(merchantId, orderId, kind = 'received', opts) {
        const db = (0, db_1.getDb)();
        const order = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
            with: { items: true },
        });
        if (!order)
            return;
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: {
                id: true,
                name: true,
                email: true,
                phone: true,
                address: true,
                city: true,
                country: true,
                shopLanguage: true,
                panelLanguage: true,
                slug: true,
                subdomain: true,
                customDomain: true,
            },
        });
        if (!merchant)
            return;
        const location = order.locationId
            ? await db.query.locations.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.locations.id, order.locationId),
                columns: {
                    name: true,
                    address: true,
                    city: true,
                    country: true,
                },
            })
            : null;
        const guestLocale = (0, transactional_email_labels_1.resolveTxLocale)({
            guestLocale: opts?.guestLocale,
            shopLanguage: merchant.shopLanguage,
            panelLanguage: merchant.panelLanguage,
        });
        const shop = String(merchant.name || 'Shop');
        const orderNumber = String(order.orderNumber || order.id.slice(0, 8));
        const copy = (0, transactional_email_labels_1.shopOrderEmailCopy)(kind, shop, orderNumber, guestLocale);
        const trackLabel = (0, transactional_email_labels_1.shopOrderTrackLabel)(guestLocale);
        const scheduledLabel = formatWhen(order.scheduledFor, guestLocale);
        const etaMinutes = kind === 'confirmed' ? (0, shop_order_email_template_1.etaMinutesFromReadyAt)(order.estimatedReadyAt) : null;
        const trackingUrl = (0, delivery_tracking_url_1.buildGuestOrderTrackingUrl)(merchant, order.id, order.fulfillmentChannel === 'delivery' ? order.deliveryTrackingToken : null);
        const items = Array.isArray(order.items) ? order.items : [];
        const emailItems = items.map((item) => ({
            quantity: String(Number(item.quantity || 0)),
            name: String(item.productName || ''),
            unitPrice: String(item.unitPrice || 0),
            totalPrice: String(item.totalPrice || 0),
        }));
        const pickupLines = (0, shop_order_email_template_1.buildPickupLines)({
            shopName: shop,
            merchantAddress: merchant.address,
            merchantCity: merchant.city,
            merchantCountry: merchant.country,
            locationName: location?.name,
            locationAddress: location?.address,
            locationCity: location?.city,
            locationCountry: location?.country,
            shippingAddress: order.shippingAddress,
            fulfillmentChannel: order.fulfillmentChannel,
        });
        const templateInput = {
            kind,
            locale: guestLocale,
            shopName: shop,
            orderNumber,
            customerName: String(order.customerName || 'Guest'),
            body: copy.body,
            fulfillmentChannel: order.fulfillmentChannel,
            paymentMethod: order.paymentMethod,
            subtotal: String(order.subtotal || 0),
            discountTotal: discountTotal(order),
            total: String(order.total || 0),
            items: emailItems,
            scheduledLabel,
            etaMinutes,
            pickupLines,
            merchantPhone: merchant.phone,
            merchantEmail: merchant.email,
            notes: (0, shop_order_email_template_1.cleanOrderNotes)(order.notes),
            trackingUrl,
            trackLabel,
        };
        const html = (0, shop_order_email_template_1.buildShopOrderGuestEmailHtml)(templateInput);
        const text = (0, shop_order_email_template_1.buildShopOrderGuestEmailText)(templateInput);
        if (order.customerEmail) {
            try {
                await email_service_1.EmailService.send({
                    to: order.customerEmail,
                    subject: copy.subject,
                    html,
                    text,
                    merchantId,
                    orderId,
                    emailType: 'shop_order',
                });
            }
            catch (err) {
                console.error('[shop-order-email] guest email failed', err);
            }
        }
        else {
            console.warn('[shop-order-email] skip guest email — no customerEmail', orderId);
        }
        if (kind === 'received' && merchant.email) {
            const merchantCopy = (0, transactional_email_labels_1.merchantNewOrderEmailCopy)(shop, orderNumber, merchant.panelLanguage);
            const channel = String(order.fulfillmentChannel || '');
            const itemsHtml = emailItems.length
                ? `<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px">${emailItems
                    .map((item) => `<tr><td style="padding:4px 0">${esc(item.quantity)} × ${esc(item.name)}</td><td style="padding:4px 0;text-align:right">${esc(item.totalPrice)} CHF</td></tr>`)
                    .join('')}</table>`
                : '';
            try {
                await email_service_1.EmailService.send({
                    to: merchant.email,
                    subject: merchantCopy.subject,
                    orderId,
                    html: `
            <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1c1917">
              <h1 style="font-size:20px">${esc(merchantCopy.subject)}</h1>
              <p>${esc(merchantCopy.body)}</p>
              ${itemsHtml}
              <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
                <tr><td style="padding:6px 0;color:#78716c">#</td><td style="padding:6px 0;text-align:right"><strong>${esc(orderNumber)}</strong></td></tr>
                <tr><td style="padding:6px 0;color:#78716c">Channel</td><td style="padding:6px 0;text-align:right">${esc(channel)}</td></tr>
                <tr><td style="padding:6px 0;color:#78716c">Customer</td><td style="padding:6px 0;text-align:right">${esc(order.customerName || '—')}</td></tr>
                <tr><td style="padding:6px 0;color:#78716c">Email</td><td style="padding:6px 0;text-align:right">${esc(order.customerEmail || '—')}</td></tr>
                <tr><td style="padding:6px 0;color:#78716c">Phone</td><td style="padding:6px 0;text-align:right">${esc(order.customerPhone || '—')}</td></tr>
                <tr><td style="padding:6px 0;color:#78716c">Total</td><td style="padding:6px 0;text-align:right">${esc(order.total)} CHF</td></tr>
              </table>
            </div>
          `,
                    text: `${merchantCopy.subject}\n${merchantCopy.body}\n#${orderNumber}\n${order.customerName || ''}\n${order.customerEmail || ''}\n${order.customerPhone || ''}\nTotal: ${order.total} CHF`,
                    merchantId,
                    emailType: 'shop_order',
                });
            }
            catch (err) {
                console.error('[shop-order-email] merchant email failed', err);
            }
        }
    }
}
exports.ShopOrderEmailService = ShopOrderEmailService;
//# sourceMappingURL=shop-order-email.service.js.map