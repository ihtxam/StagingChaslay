import api from '@/lib/api';
import {
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

export async function printDeliverySlipForOrder(
  orderId: string,
  ctx: {
    merchant: MerchantCtx;
    printSettings?: PosPrintSettingsClient | null;
    locale?: string;
    fallbackPrinterName?: string;
  }
): Promise<void> {
  const [slipRes, orderRes] = await Promise.all([
    api.get(`/merchant/delivery/orders/${orderId}/slip`),
    api.get(`/merchant/orders/${orderId}`),
  ]);

  const order = (orderRes.data?.order || orderRes.data) as {
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
    items?: Array<{
      productName?: string | null;
      name?: string | null;
      quantity: number | string;
      product?: { category?: { name?: string } | null };
    }>;
  };

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
    scheduledFor: order.scheduledFor || null,
    total: Number(order.total) || 0,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    items: (order.items || []).map((i) => ({
      name: resolveOrderItemName(i.productName, i.name),
      quantity: Number(i.quantity) || 1,
      categoryLabel: i.product?.category?.name || null,
    })),
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
