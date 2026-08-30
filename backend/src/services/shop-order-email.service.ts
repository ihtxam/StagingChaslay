import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { resolveTxLocale, shopOrderEmailCopy } from '@/lib/transactional-email-labels';
import { buildGuestOrderTrackingUrl } from '@/lib/delivery-tracking-url';
import { EmailService } from '@/services/email.service';

export class ShopOrderEmailService {
  static async sendGuestOrderEmail(
    merchantId: string,
    orderId: string,
    kind: 'received' | 'confirmed' | 'ready' | 'out_for_delivery' | 'cancelled' = 'received',
    opts?: { guestLocale?: string | null }
  ) {
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
    });
    if (!order?.customerEmail) return;

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
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
    if (!merchant) return;

    const locale = resolveTxLocale({
      guestLocale: opts?.guestLocale,
      shopLanguage: merchant.shopLanguage,
      panelLanguage: merchant.panelLanguage,
    });
    const shop = String(merchant.name || 'Shop');
    const orderNumber = String(order.orderNumber || order.id.slice(0, 8));
    const copy = shopOrderEmailCopy(kind, shop, orderNumber, locale);

    const readyAt = order.estimatedReadyAt ? new Date(order.estimatedReadyAt) : null;
    const readyAtLabel =
      readyAt && !Number.isNaN(readyAt.getTime())
        ? readyAt.toLocaleString(locale === 'fr' ? 'fr-CH' : locale === 'de' ? 'de-CH' : 'en-CH', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Europe/Zurich',
          })
        : null;
    const etaBlock =
      readyAtLabel && (kind === 'confirmed' || kind === 'ready')
        ? `<p style="margin:12px 0;font-size:15px"><strong>${locale === 'fr' ? 'Prête estimée' : locale === 'de' ? 'Geschätzte Fertigstellung' : 'Estimated ready'}:</strong> ${readyAtLabel}</p>`
        : '';
    const etaText =
      readyAtLabel && (kind === 'confirmed' || kind === 'ready')
        ? `\n${locale === 'fr' ? 'Prête estimée' : locale === 'de' ? 'Geschätzte Fertigstellung' : 'Estimated ready'}: ${readyAtLabel}`
        : '';

    const trackingUrl =
      order.fulfillmentChannel === 'delivery' && order.deliveryTrackingToken
        ? buildGuestOrderTrackingUrl(merchant, order.id, order.deliveryTrackingToken)
        : null;

    const trackBlock = trackingUrl
      ? `<p style="margin:16px 0"><a href="${trackingUrl}" style="display:inline-block;background:#0d9488;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Track your delivery</a></p>`
      : '';

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1c1917">
        <h1 style="font-size:20px">${copy.subject}</h1>
        <p>${copy.body}</p>
        ${etaBlock}
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
      await EmailService.send({
        to: order.customerEmail,
        subject: copy.subject,
        html,
        text: `${copy.subject}\n${copy.body}${etaText}\n#${orderNumber}\nTotal: ${order.total} CHF${textTrack}`,
        merchantId,
        emailType: "shop_order",
      });
    } catch (err) {
      console.error('[shop-order-email] guest email failed', err);
    }
  }
}
