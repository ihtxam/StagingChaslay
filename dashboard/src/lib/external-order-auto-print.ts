import api from '@/lib/api';
import { printDeliveryReceiptForOrder } from '@/lib/print-delivery-slip';
import {
  buildKitchenTicketItemFromLine,
  generateKitchenTicketEscPos,
  generateOrderNotificationTicketEscPos,
  generateReservationTicketEscPos,
  kitchenPrintJobHasTarget,
  printersForRole,
  resolveKitchenPaperWidthMm,
  resolveKitchenPrintJobs,
  resolveReceiptLanguage,
  uint8ToBase64,
  type PosOrderForReceipt,
  type PosPrintSettingsClient,
} from '@/lib/webpos-receipt';
import { isRetailPosMode } from '@/lib/pos-checkout';
import {
  isPrintAgentAvailable,
  listAgentPrinters,
  resolveLivePrinterName,
  syncWebPosLocalPrinterName,
} from '@/lib/print-agent';
import {
  printKitchenViaAgentOrQueue,
  printViaAgentOrQueue,
  isMerchantAutoPrintKitchenEnabled,
  isMerchantAutoPrintReceiptEnabled,
  resolvePrintRetryLocally,
} from '@/lib/webpos-print-relay';

export type AutoPrintOrderPayload = {
  kind: 'auto_print_order';
  orderId: string;
  printKitchen?: boolean;
  printReceipt?: boolean;
  printDeliveryReceipt?: boolean;
  printNotification?: boolean;
  orderSource?: string;
  /** Manual reprint from Order Center — bypass merchant auto-print toggles */
  force?: boolean;
  /** Order Center: kitchen ticket only on this device's printer (never queue to main till). */
  kitchenLocalOnly?: boolean;
};

type MerchantCtx = {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  vatNumber?: string | null;
  taxIncludedInPrice?: boolean;
  vatRate?: string | null;
  shopLogoUrl?: string | null;
  panelLanguage?: string | null;
};

function orderSourceLabel(source?: string | null): string {
  const s = String(source || '').toLowerCase();
  if (s === 'justeat') return 'JUST EAT';
  if (s === 'ubereats') return 'UBER EATS';
  if (s === 'online_shop') return 'ONLINE SHOP';
  return 'ONLINE';
}

function isDeliveryOrder(order: { fulfillmentChannel?: string | null; channel?: string | null }) {
  return (order.fulfillmentChannel || order.channel) === 'delivery';
}

async function printKitchenTickets(
  order: PosOrderForReceipt & {
    items?: Array<{
      productName?: string | null;
      name?: string | null;
      quantity: number | string;
      unitPrice?: number | string;
      totalPrice?: number | string;
      productId?: string | null;
      categoryId?: string | null;
      product?: { categoryId?: string | null } | null;
      selectedExtras?: Array<{ id: string; name: string; price: number }>;
    }>;
    orderSource?: string | null;
    createdAt?: string;
    orderNumber?: string;
    customerName?: string | null;
    customerPhone?: string | null;
    shippingAddress?: string | null;
    scheduledFor?: string | null;
    fulfillmentChannel?: string | null;
    channel?: string | null;
  },
  orderId: string,
  source: string,
  printSettings: PosPrintSettingsClient | null,
  lang: string,
  kitchenLocalOnly?: boolean
) {
  const receiptItems = (order.items || []).map((i) =>
    buildKitchenTicketItemFromLine({
      name: String(i.productName || i.name || 'Item'),
      quantity: Number(i.quantity) || 1,
      unitPrice: Number(i.unitPrice) || 0,
      lineTotal: Number(i.totalPrice) || 0,
      productId: i.productId || null,
      categoryId: i.categoryId || i.product?.categoryId || null,
      selectedExtras: i.selectedExtras || [],
    })
  );

  const kitchenOpts = {
    orderNumber: order.orderNumber || orderId.slice(0, 8),
    orderSource: orderSourceLabel(source),
    userName: order.customerName || '-',
    customerPhone: order.customerPhone || null,
    shippingAddress: isDeliveryOrder(order) ? order.shippingAddress || null : null,
    scheduledFor: order.scheduledFor || null,
    channel: order.fulfillmentChannel || order.channel || 'takeaway',
    orderedAt: order.createdAt ? Date.parse(order.createdAt) : Date.now(),
    language: lang,
    itemTextScale: printSettings?.kitchenItemTextScale ?? 1,
    headerTextScale: printSettings?.kitchenHeaderTextScale ?? 1,
    modifierTextScale: printSettings?.kitchenModifierTextScale ?? 1,
    boldText: printSettings?.kitchenBoldText === true,
  };

  let printedAny = false;
  const agentOnline = await isPrintAgentAvailable();
  let livePrinters: Awaited<ReturnType<typeof listAgentPrinters>> = [];
  if (agentOnline) {
    try {
      livePrinters = await listAgentPrinters();
      syncWebPosLocalPrinterName(livePrinters);
    } catch {
      livePrinters = [];
    }
  }

  const printJobs = kitchenLocalOnly
    ? []
    : resolveKitchenPrintJobs(receiptItems, printSettings).filter((j) => kitchenPrintJobHasTarget(j));
  const fallbackLocal =
    resolveLivePrinterName(
      localStorage.getItem('manupos_webpos_printer') || '',
      livePrinters
    ) ||
    localStorage.getItem('manupos_webpos_printer') ||
    '';
  const targets =
    printJobs.length > 0
      ? printJobs
      : [
          {
            printerName: fallbackLocal,
            paperWidthMm: resolveKitchenPaperWidthMm(printSettings, printSettings?.paperWidthMm || 80),
            items: receiptItems,
          },
        ];

  for (const job of targets) {
    if (!job.items.length) continue;
    const configuredName = (job.printerName || '').trim();
    const resolvedName = resolveLivePrinterName(configuredName, livePrinters, {
      portName: job.portName,
      matchHint: job.matchHint,
    });
    if (!resolvedName) continue;
    const paper = job.paperWidthMm ?? resolveKitchenPaperWidthMm(printSettings, printSettings?.paperWidthMm || 80);
    const escpos = generateKitchenTicketEscPos({
      ...kitchenOpts,
      items: job.items,
      paperWidthMm: paper,
    });
    await printKitchenViaAgentOrQueue({
      printerName: resolvedName,
      dataBase64: uint8ToBase64(escpos),
      orderId,
      configuredName,
      printers: livePrinters,
      retryLocally: kitchenLocalOnly ? true : resolvePrintRetryLocally(agentOnline),
    });
    printedAny = true;
  }

  if (!printedAny && receiptItems.length > 0) {
    const paper = resolveKitchenPaperWidthMm(printSettings, printSettings?.paperWidthMm || 80);
    const escpos = generateKitchenTicketEscPos({
      ...kitchenOpts,
      items: receiptItems,
      paperWidthMm: paper,
    });
    const configuredName = fallbackLocal;
    const resolvedName = resolveLivePrinterName(configuredName, livePrinters) || configuredName;
    if (!resolvedName) return;
    await printKitchenViaAgentOrQueue({
      printerName: resolvedName,
      dataBase64: uint8ToBase64(escpos),
      orderId,
      configuredName,
      printers: livePrinters,
      retryLocally: kitchenLocalOnly ? true : resolvePrintRetryLocally(agentOnline),
    });
  }
}

export async function processAutoPrintOrderJob(payload: AutoPrintOrderPayload): Promise<void> {
  const orderId = String(payload.orderId || '').trim();
  if (!orderId) throw new Error('Missing orderId');

  const [orderRes, settingsRes] = await Promise.all([
    api.get(`/merchant/orders/${orderId}`),
    api.get('/merchant/settings'),
  ]);

  const order = (orderRes.data?.order || orderRes.data) as PosOrderForReceipt & {
    items?: Array<{
      productName?: string | null;
      name?: string | null;
      quantity: number | string;
      unitPrice?: number | string;
      totalPrice?: number | string;
      productId?: string | null;
      categoryId?: string | null;
      product?: { categoryId?: string | null } | null;
      selectedExtras?: Array<{ id: string; name: string; price: number }>;
    }>;
    orderSource?: string | null;
    createdAt?: string;
    orderNumber?: string;
    customerName?: string | null;
    customerPhone?: string | null;
    shippingAddress?: string | null;
    scheduledFor?: string | null;
    fulfillmentChannel?: string | null;
    channel?: string | null;
  };

  const settings = settingsRes.data?.settings || {};
  const merchant: MerchantCtx = settings;
  const printSettings = (settings.posPrintSettings || null) as PosPrintSettingsClient | null;
  const locale = String(settings.panelLanguage || 'en');
  const lang = resolveReceiptLanguage(printSettings, locale);
  const source = payload.orderSource || order.orderSource || 'online_shop';
  const delivery = isDeliveryOrder(order);

  if (
    payload.printKitchen === true &&
    !isRetailPosMode(settings.posCheckoutSettings) &&
    (payload.force || isMerchantAutoPrintKitchenEnabled(printSettings))
  ) {
    await printKitchenTickets(
      order,
      orderId,
      source,
      printSettings,
      lang,
      payload.kitchenLocalOnly === true
    );
  }

  const receiptAutoPrintAllowed =
    payload.force || isMerchantAutoPrintReceiptEnabled(printSettings);

  if (delivery && payload.printDeliveryReceipt === true && receiptAutoPrintAllowed) {
    await printDeliveryReceiptForOrder(orderId, {
      merchant,
      printSettings,
      locale,
      fallbackPrinterName: localStorage.getItem('manupos_webpos_printer') || '',
    });
  } else if (payload.printNotification === true && receiptAutoPrintAllowed) {
    const receiptPrinters = printersForRole(printSettings, 'receipt');
    const targets =
      receiptPrinters.length > 0
        ? receiptPrinters
        : [{ name: localStorage.getItem('manupos_webpos_printer') || '', paperWidthMm: 80 }];
    const notifyItems = (order.items || []).map((i) => {
      const extras = (i.selectedExtras || [])
        .map((e) => e.name)
        .filter(Boolean)
        .join(', ');
      const name = String(i.productName || i.name || 'Item');
      return {
        name: extras ? `${name} (${extras})` : name,
        quantity: Number(i.quantity) || 1,
      };
    });
    for (const printer of targets) {
      const paper = (printer.paperWidthMm === 58 ? 58 : 80) as 58 | 80;
      const escpos = generateOrderNotificationTicketEscPos({
        orderNumber: order.orderNumber || orderId.slice(0, 8),
        orderSource: orderSourceLabel(source),
        customerName: order.customerName || null,
        customerPhone: order.customerPhone || null,
        shippingAddress: delivery ? order.shippingAddress || null : null,
        scheduledFor: order.scheduledFor || null,
        channel: order.fulfillmentChannel || order.channel || 'takeaway',
        total: Number(order.total) || 0,
        items: notifyItems,
        orderedAt: order.createdAt ? Date.parse(order.createdAt) : Date.now(),
        language: lang,
        paperWidthMm: paper,
        businessName: merchant.name || undefined,
      });
      await printViaAgentOrQueue({
        printerName: printer.name || undefined,
        dataBase64: uint8ToBase64(escpos),
        orderId,
      });
    }
  }

  if (
    !delivery &&
    payload.printReceipt === true &&
    receiptAutoPrintAllowed
  ) {
    const { printMerchantOrderReceipt } = await import('@/lib/print-order-receipt');
    await printMerchantOrderReceipt(order, {
      merchant,
      printSettings,
      locale,
      fallbackPrinterName: localStorage.getItem('manupos_webpos_printer') || '',
    });
  }
}

export type AutoPrintReservationPayload = {
  kind: 'auto_print_reservation';
  reservationId: string;
};

export async function processAutoPrintReservationJob(
  payload: AutoPrintReservationPayload
): Promise<void> {
  const reservationId = String(payload.reservationId || '').trim();
  if (!reservationId) throw new Error('Missing reservationId');

  const [reservationRes, settingsRes] = await Promise.all([
    api.get(`/merchant/reservations/${reservationId}`),
    api.get('/merchant/settings'),
  ]);

  const reservation = reservationRes.data?.reservation || reservationRes.data;
  const settings = settingsRes.data?.settings || {};
  const printSettings = (settings.posPrintSettings || null) as PosPrintSettingsClient | null;
  const locale = String(settings.panelLanguage || 'en');
  const lang = resolveReceiptLanguage(printSettings, locale);

  const kitchenPrinters = printersForRole(printSettings, 'kitchen');
  const targets =
    kitchenPrinters.length > 0
      ? kitchenPrinters
      : [{ name: localStorage.getItem('manupos_webpos_printer') || '', paperWidthMm: 80 }];

  for (const printer of targets) {
    const paper = (printer.paperWidthMm === 58 ? 58 : 80) as 58 | 80;
    const escpos = generateReservationTicketEscPos({
      code: reservation.code,
      guestName: reservation.guestName,
      guestPhone: reservation.guestPhone,
      partySize: Number(reservation.partySize) || 1,
      reservedAt: reservation.reservedAt,
      status: reservation.status,
      tableLabel: reservation.tableLabel,
      notes: reservation.notes,
      language: lang,
      paperWidthMm: paper,
      businessName: settings.name,
    });
    await printViaAgentOrQueue({
      printerName: printer.name || undefined,
      dataBase64: uint8ToBase64(escpos),
    });
  }
}
