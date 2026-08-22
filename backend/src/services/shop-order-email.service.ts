import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { resolveTxLocale, shopOrderEmailCopy } from '@/lib/transactional-email-labels';
import { EmailService } from '@/services/email.service';

export class ShopOrderEmailService {
  static async sendGuestOrderEmail(
    merchantId: string,
    orderId: string,
    kind: 'received' | 'confirmed' | 'ready' | 'cancelled' = 'received',
    opts?: { guestLocale?: string | null }
  ) {
    const db = getDb();
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)),
    });
    if (!order?.customerEmail) return;

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { id: true, name: true, phone: true, shopLanguage: true, panelLanguage: true },
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

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1c1917">
        <h1 style="font-size:20px">${copy.subject}</h1>
        <p>${copy.body}</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          <tr><td style="padding:6px 0;color:#78716c">#</td><td style="padding:6px 0;text-align:right"><strong>${orderNumber}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#78716c">Total</td><td style="padding:6px 0;text-align:right">${order.total} CHF</td></tr>
        </table>
        ${merchant.phone ? `<p style="font-size:13px;color:#78716c">${merchant.phone}</p>` : ''}
      </div>
    `;

    try {
      await EmailService.send({
        to: order.customerEmail,
        subject: copy.subject,
        html,
        text: `${copy.subject}\n${copy.body}\n#${orderNumber}\nTotal: ${order.total} CHF`,
        merchantId,
      });
    } catch (err) {
      console.error('[shop-order-email] guest email failed', err);
    }
  }
}
