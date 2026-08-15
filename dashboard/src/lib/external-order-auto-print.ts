import api from '@/lib/api';
import { printMerchantOrderReceipt } from '@/lib/print-order-receipt';
import {
  generateKitchenTicketEscPos,
  generateReservationTicketEscPos,
  printersForRole,
  resolveReceiptLanguage,
  uint8ToBase64,
  type PosOrderForReceipt,
  type PosPrintSettingsClient,
} from '@/lib/webpos-receipt';
import { printViaAgentOrQueue } from '@/lib/webpos-print-relay';

export type AutoPrintOrderPayload = {
  kind: 'auto_print_order';
  orderId: string;
  printKitchen?: boolean;
  printReceipt?: boolean;
  orderSource?: string;
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

function isExternalOnlineSource(source?: string | null): boolean {
  const s = String(source || '').toLowerCase();
  return s === 'online_shop' || s === 'justeat' || s === 'ubereats';
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

  if (payload.printKitchen !== false && printSettings?.autoPrintKitchen !== false) {
    const kitchenPrinters = printersForRole(printSettings, 'kitchen');
    const targets =
      kitchenPrinters.length > 0
        ? kitchenPrinters
        : [{ name: localStorage.getItem('manupos_webpos_printer') || '', paperWidthMm: 80 }];

    const receiptItems = (order.items || []).map((i) => {
      const extras = (i.selectedExtras || [])
        .map((e) => e.name)
        .filter(Boolean)
        .join(', ');
      const name = String(i.productName || i.name || 'Item');
      return {
        name: extras ? `${name} (${extras})` : name,
        quantity: Number(i.quantity) || 1,
        unitPrice: Number(i.unitPrice) || 0,
        lineTotal: Number(i.totalPrice) || 0,
      };
    });

    for (const printer of targets) {
      const paper = (printer.paperWidthMm === 58 ? 58 : 80) as 58 | 80;
      const escpos = generateKitchenTicketEscPos({
        orderNumber: order.orderNumber || orderId.slice(0, 8),
        orderSource: orderSourceLabel(source),
        userName: order.customerName || '-',
        customerPhone: order.customerPhone || null,
        shippingAddress:
          (order.fulfillmentChannel || order.channel) === 'delivery'
            ? order.shippingAddress || null
            : null,
        scheduledFor: order.scheduledFor || null,
        channel: order.fulfillmentChannel || order.channel || 'takeaway',
        orderedAt: order.createdAt ? Date.parse(order.createdAt) : Date.now(),
        items: receiptItems,
        language: lang,
        paperWidthMm: paper,
        itemTextScale: printSettings?.kitchenItemTextScale || 2,
        headerTextScale: printSettings?.kitchenHeaderTextScale || 2,
        boldText: printSettings?.kitchenBoldText !== false,
      });
      await printViaAgentOrQueue({
        printerName: printer.name || undefined,
        dataBase64: uint8ToBase64(escpos),
        orderId,
      });
    }
  }

  if (
    !isExternalOnlineSource(source) &&
    payload.printReceipt !== false &&
    printSettings?.autoPrintReceipt !== false
  ) {
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
