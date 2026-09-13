import axios from 'axios';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { roundMoney2 } from '@/lib/money';
import { resolveTxLocale } from '@/lib/transactional-email-labels';
import {
  PlatformSettingsService,
  formatAdyenCheckoutApiError,
} from '@/services/platform-settings.service';
import { EmailService } from '@/services/email.service';
import { saveMerchantImage } from '@/services/media-upload.service';

export type PlatformShopProductInput = {
  name: string;
  description?: string | null;
  price: number | string;
  discountPercent?: number | null;
  imageUrl?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};

export type PlatformShopVoucherInput = {
  code: string;
  label?: string | null;
  discountPercent?: number | null;
  discountAmount?: number | string | null;
  isActive?: boolean;
  maxUses?: number | null;
  expiresAt?: string | Date | null;
};

const PLATFORM_UPLOAD_MERCHANT = 'platform';

function escapeHtml(value: string) {
  return String(value).replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

/** Accept only http(s) tracking links for storage and email. */
export function sanitizeTrackingUrl(raw?: string | null): string | null {
  const url = String(raw || '').trim().slice(0, 500);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString().slice(0, 500);
  } catch {
    return null;
  }
}

function adminNotifyEmail() {
  return (
    process.env.PLATFORM_SHOP_ADMIN_EMAIL ||
    process.env.SUPERADMIN_EMAIL ||
    process.env.SEED_SUPERADMIN_EMAIL ||
    ''
  ).trim();
}

function effectiveUnitPrice(price: number, discountPercent?: number | null) {
  const pct = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  if (!pct) return roundMoney2(price);
  return roundMoney2(price * (1 - pct / 100));
}

function platformShopStatusCopy(
  locale: string | null | undefined,
  status: string,
  trackingUrl?: string | null
) {
  const lang = resolveTxLocale({ panelLanguage: locale });
  const labels: Record<string, { en: string; fr: string; de: string }> = {
    accepted: { en: "accepted", fr: "acceptée", de: "akzeptiert" },
    processing: { en: "in processing", fr: "en cours de traitement", de: "in Bearbeitung" },
    shipped: { en: "sent by post", fr: "expédiée par la poste", de: "per Post versendet" },
    fulfilled: { en: "fulfilled", fr: "livrée", de: "erfüllt" },
    cancelled: { en: "cancelled", fr: "annulée", de: "storniert" },
    paid: { en: "paid", fr: "payée", de: "bezahlt" },
  };
  const label = labels[status]?.[lang] || labels[status]?.en || status;
  const safeTrack = trackingUrl ? escapeHtml(trackingUrl) : "";
  const track =
    trackingUrl && status === "shipped"
      ? lang === "fr"
        ? `<p>Suivi : <a href="${safeTrack}">${safeTrack}</a></p>`
        : lang === "de"
          ? `<p>Sendungsverfolgung: <a href="${safeTrack}">${safeTrack}</a></p>`
          : `<p>Tracking: <a href="${safeTrack}">${safeTrack}</a></p>`
      : "";
  if (lang === "fr") {
    return {
      subject: `Mise à jour de commande — ${label}`,
      html: `<p>Le statut de votre commande boutique Reborn est désormais <strong>${label}</strong>.</p>${track}`,
      text: `Statut : ${label}${trackingUrl ? ` — ${trackingUrl}` : ""}`,
    };
  }
  if (lang === "de") {
    return {
      subject: `Bestellupdate — ${label}`,
      html: `<p>Der Status Ihrer Reborn-Shop-Bestellung ist jetzt <strong>${label}</strong>.</p>${track}`,
      text: `Status: ${label}${trackingUrl ? ` — ${trackingUrl}` : ""}`,
    };
  }
  return {
    subject: `Order update — ${label}`,
    html: `<p>Your Reborn shop order is now <strong>${label}</strong>.</p>${track}`,
    text: `Status: ${label}${trackingUrl ? ` — ${trackingUrl}` : ""}`,
  };
}

function platformShopEmailCopy(
  locale: string | null | undefined,
  kind: 'merchant' | 'admin',
  total: number
) {
  const lang = resolveTxLocale({ panelLanguage: locale });
  const amount = `${total.toFixed(2)} CHF`;
  if (lang === 'fr') {
    return kind === 'merchant'
      ? {
          subject: `Confirmation de commande — boutique Reborn`,
          intro: `Merci ! Nous avons bien reçu votre commande de ${amount}.`,
          text: `Commande reçue — ${amount}`,
        }
      : {
          subject: `Nouvelle commande boutique plateforme`,
          intro: `Une commande de ${amount} a été passée.`,
          text: `Nouvelle commande boutique — ${amount}`,
        };
  }
  if (lang === 'de') {
    return kind === 'merchant'
      ? {
          subject: `Bestellbestätigung — Reborn Shop`,
          intro: `Vielen Dank! Wir haben Ihre Bestellung über ${amount} erhalten.`,
          text: `Bestellung erhalten — ${amount}`,
        }
      : {
          subject: `Neue Plattform-Shop-Bestellung`,
          intro: `Eine Bestellung über ${amount} wurde aufgegeben.`,
          text: `Neue Plattform-Shop-Bestellung — ${amount}`,
        };
  }
  return kind === 'merchant'
    ? {
        subject: `Order confirmation — Reborn shop`,
        intro: `Thank you! We received your order for ${amount}.`,
        text: `Order received — ${amount}`,
      }
    : {
        subject: `New platform shop order`,
        intro: `An order for ${amount} was placed.`,
        text: `New platform shop order — ${amount}`,
      };
}

export class PlatformShopService {
  static async listProducts(activeOnly = true) {
    const db = getDb();
    return db.query.platformShopProducts.findMany({
      where: activeOnly ? eq(schema.platformShopProducts.isActive, true) : undefined,
      orderBy: [asc(schema.platformShopProducts.sortOrder), asc(schema.platformShopProducts.name)],
    });
  }

  static async createProduct(input: PlatformShopProductInput) {
    const db = getDb();
    const [row] = await db
      .insert(schema.platformShopProducts)
      .values({
        name: input.name.trim().slice(0, 255),
        description: input.description?.trim() || null,
        price: String(roundMoney2(Number(input.price) || 0)),
        discountPercent:
          input.discountPercent == null ? null : Math.min(100, Math.max(0, Number(input.discountPercent) || 0)),
        imageUrl: input.imageUrl?.trim() || null,
        isActive: input.isActive !== false,
        sortOrder: Number(input.sortOrder) || 0,
      })
      .returning();
    return row!;
  }

  static async updateProduct(id: string, input: Partial<PlatformShopProductInput>) {
    const db = getDb();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name.trim().slice(0, 255);
    if (input.description !== undefined) patch.description = input.description?.trim() || null;
    if (input.price !== undefined) patch.price = String(roundMoney2(Number(input.price) || 0));
    if (input.discountPercent !== undefined) {
      patch.discountPercent =
        input.discountPercent == null
          ? null
          : Math.min(100, Math.max(0, Number(input.discountPercent) || 0));
    }
    if (input.imageUrl !== undefined) patch.imageUrl = input.imageUrl?.trim() || null;
    if (input.isActive !== undefined) patch.isActive = !!input.isActive;
    if (input.sortOrder !== undefined) patch.sortOrder = Number(input.sortOrder) || 0;
    const [row] = await db
      .update(schema.platformShopProducts)
      .set(patch)
      .where(eq(schema.platformShopProducts.id, id))
      .returning();
    if (!row) throw new Error('Product not found');
    return row;
  }

  static async deleteProduct(id: string) {
    const db = getDb();
    const [row] = await db
      .update(schema.platformShopProducts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.platformShopProducts.id, id))
      .returning();
    if (!row) throw new Error('Product not found');
    return row;
  }

  static async saveProductImage(buffer: Buffer, mimeType: string, originalName?: string) {
    return saveMerchantImage({
      merchantId: PLATFORM_UPLOAD_MERCHANT,
      buffer,
      mimeType,
      originalName,
    });
  }

  static async listVouchers(activeOnly = false) {
    const db = getDb();
    return db.query.platformShopVouchers.findMany({
      where: activeOnly ? eq(schema.platformShopVouchers.isActive, true) : undefined,
      orderBy: [desc(schema.platformShopVouchers.createdAt)],
    });
  }

  static async createVoucher(input: PlatformShopVoucherInput) {
    const code = String(input.code || '')
      .trim()
      .toUpperCase()
      .slice(0, 50);
    if (!code) throw new Error('Voucher code is required');
    const db = getDb();
    const [row] = await db
      .insert(schema.platformShopVouchers)
      .values({
        code,
        label: input.label?.trim().slice(0, 255) || null,
        discountPercent:
          input.discountPercent == null
            ? null
            : Math.min(100, Math.max(0, Number(input.discountPercent) || 0)),
        discountAmount:
          input.discountAmount == null ? null : String(roundMoney2(Number(input.discountAmount) || 0)),
        isActive: input.isActive !== false,
        maxUses: input.maxUses == null ? null : Math.max(1, Number(input.maxUses) || 1),
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      })
      .returning();
    return row!;
  }

  static async updateVoucher(id: string, input: Partial<PlatformShopVoucherInput>) {
    const db = getDb();
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.code !== undefined) {
      patch.code = String(input.code).trim().toUpperCase().slice(0, 50);
    }
    if (input.label !== undefined) patch.label = input.label?.trim().slice(0, 255) || null;
    if (input.discountPercent !== undefined) {
      patch.discountPercent =
        input.discountPercent == null
          ? null
          : Math.min(100, Math.max(0, Number(input.discountPercent) || 0));
    }
    if (input.discountAmount !== undefined) {
      patch.discountAmount =
        input.discountAmount == null ? null : String(roundMoney2(Number(input.discountAmount) || 0));
    }
    if (input.isActive !== undefined) patch.isActive = !!input.isActive;
    if (input.maxUses !== undefined) {
      patch.maxUses = input.maxUses == null ? null : Math.max(1, Number(input.maxUses) || 1);
    }
    if (input.expiresAt !== undefined) {
      patch.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    }
    const [row] = await db
      .update(schema.platformShopVouchers)
      .set(patch)
      .where(eq(schema.platformShopVouchers.id, id))
      .returning();
    if (!row) throw new Error('Voucher not found');
    return row;
  }

  static async resolveVoucher(code?: string | null) {
    const raw = String(code || '')
      .trim()
      .toUpperCase();
    if (!raw) return null;
    const db = getDb();
    const voucher = await db.query.platformShopVouchers.findFirst({
      where: and(
        eq(schema.platformShopVouchers.code, raw),
        eq(schema.platformShopVouchers.isActive, true)
      ),
    });
    if (!voucher) throw new Error('Invalid voucher code');
    if (voucher.expiresAt && voucher.expiresAt < new Date()) {
      throw new Error('Voucher has expired');
    }
    if (voucher.maxUses != null && (voucher.usedCount || 0) >= voucher.maxUses) {
      throw new Error('Voucher has reached its usage limit');
    }
    return voucher;
  }

  static computeCart(
    items: Array<{ productId: string; quantity: number }>,
    catalog: Array<typeof schema.platformShopProducts.$inferSelect>,
    voucher?: typeof schema.platformShopVouchers.$inferSelect | null
  ) {
    const byId = new Map(catalog.map((p) => [p.id, p]));
    let subtotal = 0;
    const lines: Array<{
      productId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }> = [];

    for (const item of items) {
      const product = byId.get(item.productId);
      if (!product) throw new Error('Invalid product in cart');
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const unit = effectiveUnitPrice(Number(product.price) || 0, product.discountPercent);
      const lineTotal = roundMoney2(unit * qty);
      subtotal = roundMoney2(subtotal + lineTotal);
      lines.push({
        productId: product.id,
        name: product.name,
        quantity: qty,
        unitPrice: unit,
        lineTotal,
      });
    }
    if (!lines.length) throw new Error('Cart is empty');

    let discountAmount = 0;
    if (voucher) {
      if (voucher.discountPercent) {
        discountAmount = roundMoney2(subtotal * (Number(voucher.discountPercent) / 100));
      } else if (voucher.discountAmount) {
        discountAmount = roundMoney2(Number(voucher.discountAmount));
      }
      discountAmount = Math.min(subtotal, discountAmount);
    }
    const total = roundMoney2(subtotal - discountAmount);
    return { lines, subtotal, discountAmount, total, voucherCode: voucher?.code || null };
  }

  static async quote(
    items: Array<{ productId: string; quantity: number }>,
    voucherCode?: string
  ) {
    const catalog = await this.listProducts(true);
    const voucher = voucherCode ? await this.resolveVoucher(voucherCode) : null;
    return this.computeCart(items, catalog, voucher);
  }

  static async startCheckout(
    merchantId: string,
    items: Array<{ productId: string; quantity: number }>,
    opts?: { notes?: string; voucherCode?: string; returnUrl?: string }
  ) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { id: true, name: true, email: true, panelLanguage: true },
    });
    if (!merchant) throw new Error('Merchant not found');

    const catalog = await this.listProducts(true);
    const voucher = opts?.voucherCode ? await this.resolveVoucher(opts.voucherCode) : null;
    const { lines, subtotal, discountAmount, total } = this.computeCart(items, catalog, voucher);

    const [order] = await db
      .insert(schema.platformShopOrders)
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
        .update(schema.platformShopVouchers)
        .set({ usedCount: sql`${schema.platformShopVouchers.usedCount} + 1`, updatedAt: new Date() })
        .where(eq(schema.platformShopVouchers.id, voucher.id));
    }

    if (total <= 0) {
      await this.sendOrderEmails(merchant, order!, lines, total);
      return { order: order!, free: true, paymentSession: null };
    }

    const creds = await PlatformSettingsService.resolvePlatformAdyenCredentials();
    const reference = `pshop-${merchantId.slice(0, 8)}-${order!.id.slice(0, 8)}`;
    const defaultReturn =
      opts?.returnUrl ||
      `${process.env.MERCHANT_DASHBOARD_URL || process.env.PUBLIC_APP_URL || ''}/merchant/platform-shop?orderId=${order!.id}`;

    try {
      const sessionPayload: Record<string, unknown> = {
        amount: { value: Math.round(total * 100), currency: 'CHF' },
        merchantAccount: creds.merchantAccount,
        reference,
        returnUrl: defaultReturn,
        channel: 'Web',
        countryCode: 'CH',
        shopperReference: merchantId,
        // Do NOT send clientKey here — Adyen CreateCheckoutSessionRequest rejects it.
        // clientKey is returned separately below for Drop-in config only.
        metadata: {
          type: 'platform_shop',
          orderId: order!.id,
          merchantId,
        },
      };

      const response = await axios.post(`${creds.apiBase}/sessions`, sessionPayload, {
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
        .update(schema.platformShopOrders)
        .set({ adyenSessionId: sessionId, updatedAt: new Date() })
        .where(eq(schema.platformShopOrders.id, order!.id));

      return {
        order: order!,
        free: false,
        paymentSession: {
          id: sessionId,
          sessionData,
          clientKey: creds.clientKey,
          environment: creds.dropinEnvironment,
        },
      };
    } catch (error: unknown) {
      await db
        .update(schema.platformShopOrders)
        .set({ paymentStatus: 'failed', updatedAt: new Date() })
        .where(eq(schema.platformShopOrders.id, order!.id));

      const msg = formatAdyenCheckoutApiError(error as Parameters<typeof formatAdyenCheckoutApiError>[0], {
        apiBase: creds.apiBase,
        merchantAccount: creds.merchantAccount,
        phase: 'sessions',
      });
      throw new Error(msg);
    }
  }

  static async confirmPayment(
    merchantId: string,
    orderId: string,
    opts?: { resultCode?: string; pspReference?: string }
  ) {
    const db = getDb();
    const order = await db.query.platformShopOrders.findFirst({
      where: and(
        eq(schema.platformShopOrders.id, orderId),
        eq(schema.platformShopOrders.merchantId, merchantId)
      ),
    });
    if (!order) throw new Error('Order not found');
    if (order.paymentStatus === 'paid') return { alreadyPaid: true, order };

    const resultCode = opts?.resultCode || 'Authorised';
    const ok = ['Authorised', 'Received', 'Pending', 'PresentToShopper'].includes(resultCode);
    if (!ok) {
      await db
        .update(schema.platformShopOrders)
        .set({
          paymentStatus: 'failed',
          adyenResultCode: resultCode,
          updatedAt: new Date(),
        })
        .where(eq(schema.platformShopOrders.id, orderId));
      throw new Error(`Payment not authorised (${resultCode})`);
    }

    const [updated] = await db
      .update(schema.platformShopOrders)
      .set({
        status: 'paid',
        paymentStatus: 'paid',
        adyenPspReference: opts?.pspReference || order.adyenPspReference,
        adyenResultCode: resultCode,
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.platformShopOrders.id, orderId))
      .returning();

    if (order.voucherCode) {
      const voucher = await this.resolveVoucher(order.voucherCode).catch(() => null);
      if (voucher) {
        await db
          .update(schema.platformShopVouchers)
          .set({ usedCount: sql`${schema.platformShopVouchers.usedCount} + 1`, updatedAt: new Date() })
          .where(eq(schema.platformShopVouchers.id, voucher.id));
      }
    }

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { id: true, name: true, email: true, panelLanguage: true },
    });
    const lines = Array.isArray(updated!.items) ? updated!.items : [];
    if (merchant) {
      await this.sendOrderEmails(merchant, updated!, lines, Number(updated!.total) || 0);
    }

    return { order: updated! };
  }

  static async sendOrderEmails(
    merchant: { id: string; name?: string | null; email?: string | null; panelLanguage?: string | null },
    order: typeof schema.platformShopOrders.$inferSelect,
    lines: Array<{ name: string; quantity: number; unitPrice: number }>,
    total: number
  ) {
    const orderRef = order.id.slice(0, 8);
    const linesHtml = lines
      .map(
        (l) =>
          `<tr><td style="padding:4px 0">${escapeHtml(l.name)}</td><td style="padding:4px 0;text-align:right">${l.quantity} × ${l.unitPrice.toFixed(2)}</td></tr>`
      )
      .join('');
    const notesHtml = order.notes
      ? `<p style="font-size:13px;color:#78716c">Notes: ${escapeHtml(order.notes)}</p>`
      : '';
    const merchantCopy = platformShopEmailCopy(merchant.panelLanguage, 'merchant', total);
    const adminCopy = platformShopEmailCopy('en', 'admin', total);
    const itemsTable = `<table style="width:100%;font-size:14px">${linesHtml}</table>`;

    try {
      if (merchant.email) {
        await EmailService.send({
          to: merchant.email,
          subject: merchantCopy.subject,
          html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
            <p>${merchantCopy.intro}</p>
            <p>Order #${escapeHtml(orderRef)}</p>
            ${itemsTable}
            ${notesHtml}
          </div>`,
          text: `${merchantCopy.text} (#${orderRef})`,
          merchantId: merchant.id,
          emailType: "platform_shop_order",
        });
      }
      const adminTo = adminNotifyEmail();
      if (adminTo) {
        await EmailService.send({
          to: adminTo,
          subject: `${adminCopy.subject} — ${merchant.name || 'Merchant'}`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
              <h1 style="font-size:18px">${escapeHtml(adminCopy.subject)}</h1>
              <p><strong>${escapeHtml(merchant.name || 'Merchant')}</strong> placed order #${escapeHtml(orderRef)} (${total.toFixed(2)} CHF).</p>
              ${itemsTable}
              ${notesHtml}
            </div>`,
          text: `${adminCopy.text} from ${merchant.name || 'Merchant'} (#${orderRef})`,
          emailType: "platform_shop_order",
        });
      }
    } catch (err) {
      console.warn('[platform-shop] order email failed', err);
    }
  }

  static async listMerchantOrders(merchantId: string) {
    const db = getDb();
    return db.query.platformShopOrders.findMany({
      where: eq(schema.platformShopOrders.merchantId, merchantId),
      orderBy: [desc(schema.platformShopOrders.createdAt)],
      limit: 50,
    });
  }

  static async getMerchantOrder(merchantId: string, orderId: string) {
    const db = getDb();
    const order = await db.query.platformShopOrders.findFirst({
      where: and(eq(schema.platformShopOrders.id, orderId), eq(schema.platformShopOrders.merchantId, merchantId)),
    });
    if (!order) throw new Error("Order not found");
    return order;
  }

  static async listAllOrders(limit = 100) {
    const db = getDb();
    return db.query.platformShopOrders.findMany({
      orderBy: [desc(schema.platformShopOrders.createdAt)],
      limit,
      with: { merchant: { columns: { id: true, name: true, email: true } } },
    });
  }

  static async updateOrderStatus(
    orderId: string,
    status: string,
    trackingUrl?: string | null
  ) {
    const db = getDb();
    const allowed = ["pending", "paid", "accepted", "processing", "shipped", "fulfilled", "cancelled"];
    if (!allowed.includes(status)) throw new Error("Invalid status");
    const existing = await db.query.platformShopOrders.findFirst({
      where: eq(schema.platformShopOrders.id, orderId),
    });
    if (!existing) throw new Error("Order not found");

    const patch: Record<string, unknown> = { status, updatedAt: new Date() };
    if (trackingUrl !== undefined) {
      const trimmed = String(trackingUrl || "").trim();
      if (trimmed && !sanitizeTrackingUrl(trimmed)) {
        throw new Error("Tracking link must be a valid http(s) URL");
      }
      patch.trackingUrl = sanitizeTrackingUrl(trimmed);
    }

    const [row] = await db
      .update(schema.platformShopOrders)
      .set(patch)
      .where(eq(schema.platformShopOrders.id, orderId))
      .returning();
    if (!row) throw new Error("Order not found");

    const statusChanged = row.status !== existing.status;
    const trackingChanged = row.trackingUrl !== existing.trackingUrl;
    const shouldEmail =
      status !== "pending" &&
      (statusChanged || (trackingChanged && row.status === "shipped"));
    if (shouldEmail) {
      await this.sendStatusEmails(row);
    }
    return row;
  }

  static async sendStatusEmails(order: typeof schema.platformShopOrders.$inferSelect) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, order.merchantId),
      columns: { id: true, name: true, email: true, panelLanguage: true },
    });
    const copy = platformShopStatusCopy(merchant?.panelLanguage, order.status, order.trackingUrl);
    const orderRef = order.id.slice(0, 8);
    try {
      if (merchant?.email) {
        await EmailService.send({
          to: merchant.email,
          subject: copy.subject,
          html: `<div style="font-family:system-ui,sans-serif">${copy.html}<p>Order #${escapeHtml(orderRef)}</p></div>`,
          text: copy.text,
          merchantId: merchant.id,
          emailType: "platform_shop_status",
        });
      }
      const adminTo = adminNotifyEmail();
      if (adminTo) {
        const safeTrack = order.trackingUrl ? escapeHtml(order.trackingUrl) : "";
        await EmailService.send({
          to: adminTo,
          subject: `${copy.subject} — ${merchant?.name || "Merchant"}`,
          html: `<p>${escapeHtml(merchant?.name || "Merchant")} order #${escapeHtml(orderRef)} is now <strong>${escapeHtml(order.status)}</strong>.</p>${
            safeTrack ? `<p>Tracking: <a href="${safeTrack}">${safeTrack}</a></p>` : ""
          }`,
          text: `${merchant?.name || "Merchant"} order ${order.status}${order.trackingUrl ? ` — ${order.trackingUrl}` : ""}`,
          emailType: "platform_shop_status",
        });
      }
    } catch (err) {
      console.warn("[platform-shop] status email failed", err);
    }
  }
}
