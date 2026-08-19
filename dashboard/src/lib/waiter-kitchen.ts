import toast from 'react-hot-toast';
import {
  buildKitchenPrintJobs,
  buildKitchenTicketItemFromLine,
  generateKitchenTicketEscPos,
  generateKitchenTicketText,
  resolveKitchenPaperWidthMm,
  resolveReceiptLanguage,
  uint8ToBase64,
  type PosPrintSettingsClient,
} from '@/lib/webpos-receipt';
import { printViaAgentOrQueue } from '@/lib/webpos-print-relay';
import type { CartLine, PosChannel } from '@/components/webpos/types';

export async function printWaiterKitchen(opts: {
  lines: CartLine[];
  channel: PosChannel;
  printSettings: PosPrintSettingsClient | null | undefined;
  locale: string;
  staffName?: string | null;
  tableLabel?: string | null;
  orderNumber: string;
  t: (key: string) => string;
}): Promise<void> {
  const { lines, channel, printSettings, locale, staffName, tableLabel, orderNumber, t } = opts;
  if (printSettings?.autoPrintKitchen === false) return;

  const filtered = lines.filter(
    (l) => !l.giftCard && !String(l.productId || '').startsWith('__gift_card_')
  );
  if (!filtered.length) return;

  const lang = resolveReceiptLanguage(
    printSettings,
    printSettings?.receiptLanguage === 'panel' ? locale : printSettings?.receiptLanguage || locale
  );

  const receiptItems = filtered.map((l) =>
    buildKitchenTicketItemFromLine({
      name: l.name,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
      weightKg: l.isWeighed ? l.weightKg ?? l.quantity : undefined,
      productId: l.productId,
      categoryId: l.categoryId,
      courseNumber: l.courseNumber,
      selectedExtras: l.selectedExtras,
      comboSelections: l.comboSelections,
      lineNote: l.lineNote,
    })
  );

  const kitchenOpts = {
    channel,
    language: lang,
    orderNumber,
    orderedAt: Date.now(),
    scheduledFor: null as string | null,
    userName: staffName || null,
    orderSource: 'WEBPOS' as const,
    itemTextScale: printSettings?.kitchenItemTextScale || 2,
    headerTextScale: printSettings?.kitchenHeaderTextScale || 2,
    boldText: printSettings?.kitchenBoldText !== false,
    groupByCourse: false,
    tableLabel: tableLabel || null,
    tabNumber: null as string | null,
    cancelled: false,
    cancelReason: null as string | null,
  };

  let queuedAny = false;
  const printJobs = buildKitchenPrintJobs(receiptItems, printSettings);
  if (printJobs.length) {
    for (const job of printJobs) {
      const paperWidthMm = job.paperWidthMm;
      const escpos = generateKitchenTicketEscPos({
        ...kitchenOpts,
        items: job.items,
        paperWidthMm,
      });
      const text = generateKitchenTicketText({
        ...kitchenOpts,
        items: job.items,
        paperWidthMm,
      });
      const mode = await printViaAgentOrQueue({
        printerName: job.printerName || undefined,
        dataBase64: uint8ToBase64(escpos),
        text,
        orderId: orderNumber,
        retryLocally: false,
        jobKind: 'kitchen',
        jobLabel: orderNumber ? `Kitchen · ${orderNumber}` : 'Kitchen',
      });
      if (mode === 'queued') queuedAny = true;
    }
    if (queuedAny) toast.success(t('webPosPrintQueuedMainTill'));
    return;
  }

  const paperWidthMm = resolveKitchenPaperWidthMm(printSettings, printSettings?.paperWidthMm || 80);
  const escpos = generateKitchenTicketEscPos({
    ...kitchenOpts,
    items: receiptItems,
    paperWidthMm,
  });
  const text = generateKitchenTicketText({
    ...kitchenOpts,
    items: receiptItems,
    paperWidthMm,
  });
  const mode = await printViaAgentOrQueue({
    dataBase64: uint8ToBase64(escpos),
    text,
    orderId: orderNumber,
    retryLocally: false,
    jobKind: 'kitchen',
    jobLabel: orderNumber ? `Kitchen · ${orderNumber}` : 'Kitchen',
  });
  if (mode === 'queued') toast.success(t('webPosPrintQueuedMainTill'));
}

export function nextWaiterTicketNumber(): string {
  const key = 'waiter_ticket_seq';
  try {
    const day = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem(key);
    let seq = 1;
    if (raw) {
      const parsed = JSON.parse(raw) as { day?: string; n?: number };
      if (parsed.day === day && parsed.n) seq = parsed.n + 1;
    }
    localStorage.setItem(key, JSON.stringify({ day, n: seq }));
    return `W-${String(seq).padStart(3, '0')}`;
  } catch {
    return `W-${Date.now().toString().slice(-4)}`;
  }
}

export async function persistWaiterHeldOrder(opts: {
  cartLines: CartLine[];
  channel: PosChannel;
  tableId?: string | null;
  tableLabel?: string | null;
  ticketDisplay: string;
  ticketOrderNumber: string;
  staffId?: string | null;
  staffName?: string | null;
  sendToKitchen: boolean;
  orderNote?: string;
  money: (n: number) => string;
}): Promise<void> {
  const {
    cartLines,
    channel,
    tableId,
    tableLabel,
    ticketDisplay,
    ticketOrderNumber,
    staffId,
    staffName,
    sendToKitchen,
    orderNote,
    money,
  } = opts;
  if (!cartLines.length) return;

  const cartSum = cartLines.reduce((s, l) => s + Number(l.lineTotal || 0), 0);
  const heldLabel = [tableLabel, ticketDisplay, channel, money(cartSum)].filter(Boolean).join(' · ');
  const cartJson = {
    cart: cartLines,
    channel,
    tableId: tableId || null,
    tableLabel: tableLabel || null,
    ticketDisplay,
    ticketOrderNumber,
    orderNote: orderNote || '',
  };

  const api = (await import('@/lib/api')).default;

  await api.post('/merchant/pos/held', {
    label: heldLabel,
    channel,
    cartJson,
    staffId,
    staffName,
    sendToKitchen,
  });
}
