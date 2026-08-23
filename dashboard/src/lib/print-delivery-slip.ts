import api from '@/lib/api';
import {
  generateDeliveryReceiptEscPos,
  generateDeliverySlipEscPos,
  printersForRole,
  resolveReceiptLanguage,
  uint8ToBase64,
  type PosPrintSettingsClient,
} from '@/lib/webpos-receipt';
import { printViaAgentOrQueue } from '@/lib/webpos-print-relay';
import { resolveOrderItemName } from '@/lib/order-item-name';

type MerchantCtx = {
  name?: string | null;
  address?: string | null;
  city?: string | null;
};

type OrderDetail = {
  orderNumber?: string;
  orderSource?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  scheduledFor?: string | null;
  total?: number | string;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  fulfillmentChannel?: string | null;
  channel?: string | null;
  notes?: string | null;
  items?: Array<{
    productName?: string | null;
    name?: string | null;
    quantity: number | string;
    notes?: string | null;
    product?: { category?: { name?: string } | null };
    selectedExtras?: Array<{ name: string }>;
  }>;
};

function mapOrderItems(order: OrderDetail) {
  return (order.items || []).map((i) => {
    const base = resolveOrderItemName(i.productName, i.name);
    const extras = (i.selectedExtras || [])
      .map((e) => e.name)
      .filter(Boolean)
      .join(', ');
    return {
      name: extras ? `${base} (${extras})` : base,
      quantity: Number(i.quantity) || 1,
      categoryLabel: i.product?.category?.name || null,
      note: i.notes || null,
    };
  });
}

async function loadOrder(orderId: string): Promise<OrderDetail> {
  const orderRes = await api.get(`/merchant/orders/${orderId}`);
  return (orderRes.data?.order || orderRes.data) as OrderDetail;
}

export async function printDeliveryReceiptForOrder(
  orderId: string,
  ctx: {
    merchant: MerchantCtx;
    printSettings?: PosPrintSettingsClient | null;
    locale?: string;
    fallbackPrinterName?: string;
  }
): Promise<void> {
  const order = await loadOrder(orderId);
  const printSettings = ctx.printSettings || null;
  const lang = resolveReceiptLanguage(printSettings, ctx.locale || 'en');
  const paper = (printSettings?.paperWidthMm === 58 ? 58 : 80) as 58 | 80;

  const escpos = generateDeliveryReceiptEscPos({
    businessName: ctx.merchant.name || 'Store',
    orderNumber: order.orderNumber || orderId.slice(0, 8),
    orderSource: order.orderSource,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    shippingAddress: order.shippingAddress,
    orderNotes: order.notes,
    scheduledFor: order.scheduledFor || null,
    total: Number(order.total) || 0,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    items: mapOrderItems(order),
    language: lang,
    paperWidthMm: paper,
  });

  const targets = printersForRole(printSettings, 'receipt');
  const printers =
    targets.length > 0
      ? targets
      : [{ name: ctx.fallbackPrinterName || '', paperWidthMm: paper }];

  for (const printer of printers) {
    await printViaAgentOrQueue({
      printerName: printer.name || undefined,
      dataBase64: uint8ToBase64(escpos),
      orderId,
    });
  }
}

export async function printDeliverySlipForOrder(
  orderId: string,
  ctx: {
    merchant: MerchantCtx;
    printSettings?: PosPrintSettingsClient | null;
    locale?: string;
    fallbackPrinterName?: string;
  }
): Promise<void> {
  const [slipRes, order] = await Promise.all([
    api.get(`/merchant/delivery/orders/${orderId}/slip`),
    loadOrder(orderId),
  ]);

  const driverClaimUrl = String(slipRes.data?.driverClaimUrl || '');
  if (!driverClaimUrl) throw new Error('Missing driver claim URL');

  const printSettings = ctx.printSettings || null;
  const lang = resolveReceiptLanguage(printSettings, ctx.locale || 'en');
  const paper = (printSettings?.paperWidthMm === 58 ? 58 : 80) as 58 | 80;

  const escpos = await generateDeliverySlipEscPos({
    businessName: ctx.merchant.name || 'Store',
    address: [ctx.merchant.address, ctx.merchant.city].filter(Boolean).join(', '),
    orderNumber: order.orderNumber || orderId.slice(0, 8),
    orderSource: order.orderSource,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    shippingAddress: order.shippingAddress,
    orderNotes: order.notes,
    scheduledFor: order.scheduledFor || null,
    total: Number(order.total) || 0,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    items: mapOrderItems(order),
    language: lang,
    paperWidthMm: paper,
    driverClaimUrl,
  });

  const targets = printersForRole(printSettings, 'receipt');
  const printers =
    targets.length > 0
      ? targets
      : [{ name: ctx.fallbackPrinterName || '', paperWidthMm: paper }];

  for (const printer of printers) {
    await printViaAgentOrQueue({
      printerName: printer.name || undefined,
      dataBase64: uint8ToBase64(escpos),
      orderId,
    });
  }
}
