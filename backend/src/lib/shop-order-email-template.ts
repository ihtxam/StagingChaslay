import type { ShopOrderEmailLabels, TxLocale } from '@/lib/transactional-email-labels';
import {
  shopOrderEmailLabels,
  shopOrderFulfillmentLabel,
  shopOrderPaymentLabel,
} from '@/lib/transactional-email-labels';

export type ShopOrderEmailKind =
  | 'received'
  | 'confirmed'
  | 'ready'
  | 'out_for_delivery'
  | 'cancelled';

export type ShopOrderEmailItem = {
  quantity: string;
  name: string;
  unitPrice: string;
  totalPrice: string;
};

export type ShopOrderEmailTemplateInput = {
  kind: ShopOrderEmailKind;
  locale: TxLocale;
  shopName: string;
  orderNumber: string;
  customerName: string;
  body: string;
  fulfillmentChannel: string | null | undefined;
  paymentMethod: string | null | undefined;
  subtotal: string;
  discountTotal: string;
  total: string;
  items: ShopOrderEmailItem[];
  scheduledLabel: string | null;
  etaMinutes: number | null;
  pickupLines: string[];
  merchantPhone: string | null;
  merchantEmail: string | null;
  notes: string | null;
  trackingUrl: string | null;
  trackLabel: string;
};

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(value: string | number | null | undefined): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 'CHF0.00';
  return `CHF${n.toFixed(2)}`;
}

function box(title: string, bodyHtml: string): string {
  return `
    <div style="border:1px solid #e7e5e4;border-radius:10px;padding:14px 16px;margin:12px 0;background:#fff">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#78716c;margin-bottom:8px">${title}</div>
      ${bodyHtml}
    </div>
  `;
}

function statusBanner(
  labels: ShopOrderEmailLabels,
  kind: ShopOrderEmailKind
): string {
  const map: Record<
    Exclude<ShopOrderEmailKind, 'received'>,
    { bg: string; text: string }
  > = {
    confirmed: { bg: '#16a34a', text: labels.statusAccepted },
    ready: { bg: '#16a34a', text: labels.statusReady },
    out_for_delivery: { bg: '#2563eb', text: labels.statusOnTheWay },
    cancelled: { bg: '#b91c1c', text: labels.statusCancelled },
  };
  const entry = kind === 'received' ? null : map[kind];
  if (!entry) return '';
  return `
    <div style="background:${entry.bg};color:#fff;padding:14px 16px;text-align:center">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.92">${esc(labels.orderStatusLabel)}</div>
      <div style="font-size:22px;font-weight:800;margin-top:4px">✓ ${esc(entry.text)}</div>
    </div>
  `;
}

function headlineForKind(labels: ShopOrderEmailLabels, kind: ShopOrderEmailKind): string {
  if (kind === 'confirmed') return labels.headlineAccepted;
  if (kind === 'ready') return labels.headlineReady;
  if (kind === 'out_for_delivery') return labels.headlineOnTheWay;
  if (kind === 'cancelled') return labels.headlineCancelled;
  return '';
}

function itemsTable(labels: ShopOrderEmailLabels, items: ShopOrderEmailItem[]): string {
  if (!items.length) return '';
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f5f5f4;font-weight:700;width:48px">${esc(item.quantity)}×</td>
          <td style="padding:10px 8px;border-bottom:1px solid #f5f5f4">${esc(item.name)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #f5f5f4;text-align:right;white-space:nowrap;color:#57534e">${money(item.unitPrice)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #f5f5f4;text-align:right;white-space:nowrap;font-weight:700">${money(item.totalPrice)}</td>
        </tr>
      `
    )
    .join('');
  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#1c1917">
      <thead>
        <tr style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#78716c">
          <th style="text-align:left;padding:0 0 8px">${esc(labels.qty)}</th>
          <th style="text-align:left;padding:0 8px 8px">${esc(labels.item)}</th>
          <th style="text-align:right;padding:0 0 8px">${esc(labels.unit)}</th>
          <th style="text-align:right;padding:0 0 8px">${esc(labels.lineTotal)}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function totalsBlock(
  labels: ShopOrderEmailLabels,
  subtotal: string,
  discountTotal: string,
  total: string
): string {
  const discount = Number(discountTotal || 0);
  const discountRow =
    discount > 0
      ? `
        <tr>
          <td style="padding:8px 0;color:#15803d;font-weight:600">${esc(labels.discount)}</td>
          <td style="padding:8px 0;text-align:right;color:#15803d;font-weight:600">-${money(discountTotal)}</td>
        </tr>
      `
      : '';
  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px">
      <tr>
        <td style="padding:8px 0;color:#57534e">${esc(labels.subtotal)}</td>
        <td style="padding:8px 0;text-align:right">${money(subtotal)}</td>
      </tr>
      ${discountRow}
      <tr>
        <td style="padding:14px 0 0;font-size:18px;font-weight:800">${esc(labels.total)}</td>
        <td style="padding:14px 0 0;text-align:right;font-size:18px;font-weight:800">${money(total)}</td>
      </tr>
    </table>
  `;
}

function helpBlock(
  labels: ShopOrderEmailLabels,
  phone: string | null,
  email: string | null
): string {
  const links: string[] = [];
  if (phone) {
    links.push(
      `<a href="tel:${esc(phone)}" style="color:#92400e;text-decoration:none;font-weight:600">${esc(labels.call)} ${esc(phone)}</a>`
    );
  }
  if (email) {
    links.push(
      `<a href="mailto:${esc(email)}" style="color:#92400e;text-decoration:none;font-weight:600">${esc(labels.email)} ${esc(email)}</a>`
    );
  }
  if (!links.length) return '';
  return `
    <div style="margin:20px 0 8px">
      <div style="font-size:18px;font-weight:800;margin-bottom:8px">${esc(labels.needHelp)}</div>
      <p style="margin:0 0 10px;font-size:14px;line-height:1.5;color:#44403c">${esc(labels.needHelpBody)}</p>
      <div style="font-size:14px;line-height:1.8">${links.join('<br/>')}</div>
    </div>
  `;
}

function footerBlock(labels: ShopOrderEmailLabels, shopName: string, addressLine: string): string {
  const year = new Date().getFullYear();
  return `
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e7e5e4;text-align:center;font-size:12px;line-height:1.6;color:#78716c">
      <p style="margin:0 0 8px">${esc(labels.autoMessage)}</p>
      ${addressLine ? `<p style="margin:0 0 8px">${esc(addressLine)}</p>` : ''}
      <p style="margin:0">© ${year} ${esc(shopName)}</p>
    </div>
  `;
}

export function buildShopOrderGuestEmailHtml(input: ShopOrderEmailTemplateInput): string {
  const labels = shopOrderEmailLabels(input.locale);
  const customerFirst = String(input.customerName || 'Guest').trim().split(/\s+/)[0] || 'Guest';
  const paymentLabel = shopOrderPaymentLabel(input.paymentMethod, input.locale);
  const fulfillmentLabel = shopOrderFulfillmentLabel(input.fulfillmentChannel, input.locale);
  const addressLine = input.pickupLines.join(', ');
  const discount = Number(input.discountTotal || 0);
  const headline = headlineForKind(labels, input.kind);
  const etaSuffix =
    input.etaMinutes != null && input.etaMinutes > 0 && input.kind === 'confirmed'
      ? ` ${labels.etaMinutes(input.etaMinutes)}`
      : '';

  const quickInfoBar = `
    <table style="width:100%;border-collapse:collapse;margin:18px 0;background:#fff;border:1px solid #e7e5e4;border-radius:10px;overflow:hidden">
      <tr>
        <td style="width:33.33%;padding:14px 12px;border-right:1px solid #e7e5e4;vertical-align:top">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#78716c">${esc(labels.orderType)}</div>
          <div style="font-size:15px;font-weight:800;margin-top:6px">${esc(fulfillmentLabel)}</div>
        </td>
        <td style="width:33.33%;padding:14px 12px;border-right:1px solid #e7e5e4;vertical-align:top">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#78716c">${esc(labels.payment)}</div>
          <div style="font-size:15px;font-weight:800;margin-top:6px">${esc(paymentLabel)}</div>
        </td>
        <td style="width:33.33%;padding:14px 12px;vertical-align:top">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#78716c">${esc(labels.total)}</div>
          <div style="font-size:15px;font-weight:800;margin-top:6px">${money(input.total)}</div>
        </td>
      </tr>
    </table>
  `;

  const receivedIntro =
    input.kind === 'received'
      ? `
        <div style="font-size:28px;font-weight:800;margin:18px 0 8px;line-height:1.2">${esc(labels.thankYou(customerFirst))}</div>
        <p style="margin:0 0 4px;font-size:15px;line-height:1.55;color:#44403c">${esc(input.body)}</p>
        ${quickInfoBar}
      `
      : '';

  const statusIntro =
    input.kind !== 'received'
      ? `
        ${headline ? `<div style="font-size:22px;font-weight:800;margin:18px 0 8px;line-height:1.25">${esc(headline)}</div>` : ''}
        <p style="margin:0 0 4px;font-size:15px;line-height:1.55;color:#44403c">${esc(input.body)}${esc(etaSuffix)}</p>
      `
      : '';

  const locationTitle =
    String(input.fulfillmentChannel || '').toLowerCase() === 'delivery'
      ? labels.deliverTo
      : labels.pickupAt;
  const locationBody = input.pickupLines
    .map(
      (line, idx) =>
        `<div style="font-size:${idx === 0 ? '15px' : '14px'};font-weight:${idx === 0 ? '700' : '400'};line-height:1.5;color:#1c1917">${esc(line)}</div>`
    )
    .join('');

  const locationBlock =
    input.pickupLines.length > 0 ? box(locationTitle, locationBody) : '';

  const scheduledBlock =
    input.scheduledLabel && input.kind === 'received'
      ? box(
          labels.scheduledFor,
          `<div style="font-size:15px;font-weight:700">${esc(input.scheduledLabel)}</div>`
        )
      : '';

  const paymentBlock =
    input.kind === 'received'
      ? box(
          labels.payment,
          `<div style="font-size:15px;font-weight:700">${esc(paymentLabel)}</div>`
        )
      : '';

  const recapBlock =
    input.kind !== 'received'
      ? box(
          labels.summary,
          `${itemsTable(labels, input.items)}${totalsBlock(labels, input.subtotal, input.discountTotal, input.total)}`
        )
      : `${itemsTable(labels, input.items)}${totalsBlock(labels, input.subtotal, input.discountTotal, input.total)}`;

  const notesBlock =
    input.notes && input.kind !== 'received'
      ? `
        <div style="border:1px solid #fde68a;background:#fffbeb;border-radius:10px;padding:14px 16px;margin:12px 0">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#92400e;margin-bottom:8px">⚠ ${esc(labels.orderInstructions)}</div>
          <div style="font-size:14px;line-height:1.5;color:#1c1917;white-space:pre-wrap">${esc(input.notes)}</div>
        </div>
      `
      : '';

  const trackBlock = input.trackingUrl
    ? `<p style="margin:16px 0"><a href="${esc(input.trackingUrl)}" style="display:inline-block;background:#111827;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">${esc(input.trackLabel)}</a></p>`
    : '';

  const confirmedBadge =
    input.kind === 'received'
      ? `<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#d6d3d1;margin-top:6px">✓ ${esc(labels.orderConfirmedBadge)}</div>`
      : '';

  return `
    <div style="background:#f5f5f4;padding:24px 12px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1917">
      <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e7e5e4;border-radius:12px;overflow:hidden">
        <div style="background:#111827;color:#fff;padding:16px 18px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div>
            <div style="font-size:18px;font-weight:800;line-height:1.2">${esc(input.shopName)}</div>
            ${confirmedBadge}
          </div>
          <div style="font-size:18px;font-weight:800;white-space:nowrap"># ${esc(input.orderNumber)}</div>
        </div>
        ${statusBanner(labels, input.kind)}
        <div style="padding:18px">
          ${receivedIntro}
          ${statusIntro}
          ${recapBlock}
          ${paymentBlock}
          ${scheduledBlock}
          ${locationBlock}
          ${notesBlock}
          ${trackBlock}
          ${helpBlock(labels, input.merchantPhone, input.merchantEmail)}
          ${footerBlock(labels, input.shopName, addressLine)}
        </div>
      </div>
    </div>
  `.trim();
}

export function buildShopOrderGuestEmailText(input: ShopOrderEmailTemplateInput): string {
  const labels = shopOrderEmailLabels(input.locale);
  const lines: string[] = [
    `# ${input.orderNumber}`,
    input.shopName,
    '',
    input.body,
  ];
  if (input.etaMinutes != null && input.etaMinutes > 0 && input.kind === 'confirmed') {
    lines.push(labels.etaMinutes(input.etaMinutes));
  }
  lines.push('', `${labels.orderType}: ${shopOrderFulfillmentLabel(input.fulfillmentChannel, input.locale)}`);
  lines.push(`${labels.payment}: ${shopOrderPaymentLabel(input.paymentMethod, input.locale)}`);
  lines.push(`${labels.total}: ${money(input.total)}`);
  if (input.scheduledLabel) lines.push(`${labels.scheduledFor}: ${input.scheduledLabel}`);
  if (input.pickupLines.length) {
    lines.push('', `${labels.pickupAt}:`);
    lines.push(...input.pickupLines);
  }
  if (input.items.length) {
    lines.push('', labels.summary);
    for (const item of input.items) {
      lines.push(`${item.quantity}× ${item.name} — ${money(item.totalPrice)}`);
    }
  }
  lines.push(`${labels.subtotal}: ${money(input.subtotal)}`);
  if (Number(input.discountTotal || 0) > 0) {
    lines.push(`${labels.discount}: -${money(input.discountTotal)}`);
  }
  lines.push(`${labels.total}: ${money(input.total)}`);
  if (input.notes) lines.push('', `${labels.orderInstructions}: ${input.notes}`);
  if (input.trackingUrl) lines.push('', `${input.trackLabel}: ${input.trackingUrl}`);
  if (input.merchantPhone) lines.push('', `${labels.call} ${input.merchantPhone}`);
  if (input.merchantEmail) lines.push(`${labels.email} ${input.merchantEmail}`);
  lines.push('', labels.autoMessage);
  return lines.join('\n');
}

export function cleanOrderNotes(raw: string | null | undefined): string | null {
  const cleaned = String(raw || '')
    .replace(/\[Rounding[^\]]*\]/gi, '')
    .trim();
  return cleaned || null;
}

export function etaMinutesFromReadyAt(
  estimatedReadyAt: Date | string | null | undefined
): number | null {
  const target = estimatedReadyAt ? new Date(estimatedReadyAt) : null;
  if (!target || Number.isNaN(target.getTime())) return null;
  const diff = Math.round((target.getTime() - Date.now()) / 60000);
  return diff > 0 ? diff : null;
}

export function buildPickupLines(opts: {
  shopName: string;
  merchantAddress?: string | null;
  merchantCity?: string | null;
  merchantCountry?: string | null;
  locationName?: string | null;
  locationAddress?: string | null;
  locationCity?: string | null;
  locationCountry?: string | null;
  shippingAddress?: string | null;
  fulfillmentChannel?: string | null;
}): string[] {
  const channel = String(opts.fulfillmentChannel || '').toLowerCase();
  if (channel === 'delivery' && opts.shippingAddress) {
    return [opts.shippingAddress.trim()];
  }
  const lines: string[] = [];
  const name = opts.locationName || opts.shopName;
  if (name) lines.push(name);
  const street = opts.locationAddress || opts.merchantAddress;
  const city = opts.locationCity || opts.merchantCity;
  const country = opts.locationCountry || opts.merchantCountry;
  const locality = [street, city, country].filter(Boolean).join(', ');
  if (locality) lines.push(locality);
  return lines;
}
