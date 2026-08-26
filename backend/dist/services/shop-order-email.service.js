"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopOrderEmailService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const transactional_email_labels_1 = require("@/lib/transactional-email-labels");
const delivery_tracking_url_1 = require("@/lib/delivery-tracking-url");
const email_service_1 = require("@/services/email.service");
class ShopOrderEmailService {
    static async sendGuestOrderEmail(merchantId, orderId, kind = 'received', opts) {
        const db = (0, db_1.getDb)();
        const order = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
        });
        if (!order?.customerEmail)
            return;
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: {
                id: true,
                name: true,
                phone: true,
                shopLanguage: true,
                panelLanguage: true,
                slug: true,
                subdomain: true,
                customDomain: true,
            },
        });
        if (!merchant)
            return;
        const locale = (0, transactional_email_labels_1.resolveTxLocale)({
            guestLocale: opts?.guestLocale,
            shopLanguage: merchant.shopLanguage,
            panelLanguage: merchant.panelLanguage,
        });
        const shop = String(merchant.name || 'Shop');
        const orderNumber = String(order.orderNumber || order.id.slice(0, 8));
        const copy = (0, transactional_email_labels_1.shopOrderEmailCopy)(kind, shop, orderNumber, locale);
        const trackingUrl = order.fulfillmentChannel === 'delivery' && order.deliveryTrackingToken
            ? (0, delivery_tracking_url_1.buildGuestOrderTrackingUrl)(merchant, order.id, order.deliveryTrackingToken)
            : null;
        const trackBlock = trackingUrl
            ? `<p style="margin:16px 0"><a href="${trackingUrl}" style="display:inline-block;background:#0d9488;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Track your delivery</a></p>`
            : '';
        const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1c1917">
        <h1 style="font-size:20px">${copy.subject}</h1>
        <p>${copy.body}</p>
        ${trackBlock}
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          <tr><td style="padding:6px 0;color:#78716c">#</td><td style="padding:6px 0;text-align:right"><strong>${orderNumber}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#78716c">Total</td><td style="padding:6px 0;text-align:right">${order.total} CHF</td></tr>
        </table>
        ${merchant.phone ? `<p style="font-size:13px;color:#78716c">${merchant.phone}</p>` : ''}
      </div>
    `;
        const textTrack = trackingUrl ? `\nTrack: ${trackingUrl}` : '';
        try {
            await email_service_1.EmailService.send({
                to: order.customerEmail,
                subject: copy.subject,
                html,
                text: `${copy.subject}\n${copy.body}\n#${orderNumber}\nTotal: ${order.total} CHF${textTrack}`,
                merchantId,
                emailType: "shop_order",
            });
        }
        catch (err) {
            console.error('[shop-order-email] guest email failed', err);
        }
    }
}
exports.ShopOrderEmailService = ShopOrderEmailService;
//# sourceMappingURL=shop-order-email.service.js.map