import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import {
  merchantNewOrderEmailCopy,
  resolveTxLocale,
  shopOrderEmailCopy,
  shopOrderReadyLabel,
  shopOrderTrackLabel,
} from '@/lib/transactional-email-labels';
import { buildGuestOrderTrackingUrl } from '@/lib/delivery-tracking-url';
import { EmailService } from '@/services/email.service';

function formatWhen(value: Date | string | null | undefined, locale: string): string | null {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(locale === 'fr' ? 'fr-CH' : locale === 'de' ? 'de-CH' : 'en-CH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Zurich',
  });
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
      with: { items: true },
    });
    if (!order) return;

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: {
        id: true,
        name: true,
        email: true,
        phone: true,
        shopLanguage: true,
        panelLanguage: true,
        slug: true,
        subdomain: true,
        customDomain: true,
      },
    });
    if (!merchant) return;

    const guestLocale = resolveTxLocale({
      guestLocale: opts?.guestLocale,
      shopLanguage: merchant.shopLanguage,
      panelLanguage: merchant.panelLanguage,
    });
    const shop = String(merchant.name || 'Shop');
    const orderNumber = String(order.orderNumber || order.id.slice(0, 8));
    const copy = shopOrderEmailCopy(kind, shop, orderNumber, guestLocale);
    const readyLabel = shopOrderReadyLabel(guestLocale);
    const trackLabel = shopOrderTrackLabel(guestLocale);

    const readyAtLabel = formatWhen(order.estimatedReadyAt, guestLocale);
    const scheduledLabel = formatWhen(order.scheduledFor, guestLocale);
    const showEta = !!(readyAtLabel && kind !== 'cancelled');
    const etaBlock =
      showEta
        ? `<p style="margin:12px 0;font-size:15px"><strong>${esc(readyLabel)}:</strong> ${esc(readyAtLabel)}</p>`
        : scheduledLabel && kind === 'received'
          ? `<p style="margin:12px 0;font-size:15px"><strong>${esc(readyLabel)}:</strong> ${esc(scheduledLabel)}</p>`
          : '';
    const etaText =
      showEta
        ? `\n${readyLabel}: ${readyAtLabel}`
        : scheduledLabel && kind === 'received'
          ? `\n${readyLabel}: ${scheduledLabel}`
          : '';

    const trackingUrl = buildGuestOrderTrackingUrl(
      merchant,
      order.id,
      order.fulfillmentChannel === 'delivery' ? order.deliveryTrackingToken : null
    );

    const trackBlock = trackingUrl
      ? `<p style="margin:16px 0"><a href="${esc(trackingUrl)}" style="display:inline-block;background:#0d9488;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">${esc(trackLabel)}</a></p>`
      : '';

    const items = Array.isArray(order.items) ? order.items : [];
    const itemsHtml = items.length
      ? `<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px">${items
          .map(
            (item) =>
              `<tr><td style="padding:4px 0">${esc(item.quantity)} × ${esc(item.productName || '')}</td><td style="padding:4px 0;text-align:right">${esc(item.totalPrice)} CHF</td></tr>`
          )
          .join('')}</table>`
      : '';

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1c1917">
        <h1 style="font-size:20px">${esc(copy.subject)}</h1>
        <p>${esc(copy.body)}</p>
        ${etaBlock}
        ${trackBlock}
        ${itemsHtml}
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          <tr><td style="padding:6px 0;color:#78716c">#</td><td style="padding:6px 0;text-align:right"><strong>${esc(orderNumber)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#78716c">Total</td><td style="padding:6px 0;text-align:right">${esc(order.total)} CHF</td></tr>
        </table>
        ${merchant.phone ? `<p style="font-size:13px;color:#78716c">${esc(merchant.phone)}</p>` : ''}
      </div>
    `;

    const textTrack = trackingUrl ? `\n${trackLabel}: ${trackingUrl}` : '';

    if (order.customerEmail) {
      try {
        await EmailService.send({
          to: order.customerEmail,
          subject: copy.subject,
          html,
          text: `${copy.subject}\n${copy.body}${etaText}\n#${orderNumber}\nTotal: ${order.total} CHF${textTrack}`,
          merchantId,
          emailType: 'shop_order',
        });
      } catch (err) {
        console.error('[shop-order-email] guest email failed', err);
      }
    } else {
      console.warn('[shop-order-email] skip guest email — no customerEmail', orderId);
    }

    if (kind === 'received' && merchant.email) {
      const merchantCopy = merchantNewOrderEmailCopy(shop, orderNumber, merchant.panelLanguage);
      const channel = String(order.fulfillmentChannel || '');
      try {
        await EmailService.send({
          to: merchant.email,
          subject: merchantCopy.subject,
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
      } catch (err) {
        console.error('[shop-order-email] merchant email failed', err);
      }
    }
  }
}
