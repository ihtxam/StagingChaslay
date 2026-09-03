import toast from 'react-hot-toast';
import {
  buildKitchenPrintJobs,
  buildKitchenTicketItemFromLine,
  generateKitchenTicketEscPos,
  generateKitchenTicketText,
  kitchenPrintJobHasTarget,
  resolveKitchenPrintJobsWithFallback,
  resolveKitchenPaperWidthMm,
  resolveReceiptLanguage,
  uint8ToBase64,
  type PosPrintSettingsClient,
} from '@/lib/webpos-receipt';
import {
  isLocalPrintStation,
  printKitchenViaAgentOrQueue,
  resolvePrintRetryLocally,
  shouldAutoPrintKitchen,
} from '@/lib/webpos-print-relay';
import { isPrintAgentAvailable, listAgentPrinters, resolveLivePrinterName } from '@/lib/print-agent';
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
  if (!shouldAutoPrintKitchen(printSettings)) return;

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
    itemTextScale: printSettings?.kitchenItemTextScale ?? 1,
    headerTextScale: printSettings?.kitchenHeaderTextScale ?? 1,
    modifierTextScale: printSettings?.kitchenModifierTextScale ?? 1,
    boldText: printSettings?.kitchenBoldText === true,
    groupByCourse: false,
    tableLabel: tableLabel || null,
    tabNumber: null as string | null,
    cancelled: false,
    cancelReason: null as string | null,
  };

  let queuedAny = false;
  const receiptPrinterName =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('manupos_webpos_printer') || ''
      : '';
  const printJobs = resolveKitchenPrintJobsWithFallback(receiptItems, printSettings, {
    receiptPrinterName,
  }).filter((j) => kitchenPrintJobHasTarget(j));
  const agentOnline = await isPrintAgentAvailable();
  const retryLocally = resolvePrintRetryLocally(agentOnline);
  const forceQueue = !isLocalPrintStation(agentOnline);
  let livePrinters: Awaited<ReturnType<typeof listAgentPrinters>> = [];
  if (agentOnline) {
    try {
      livePrinters = await listAgentPrinters();
    } catch {
      livePrinters = [];
    }
  }
  if (printJobs.length) {
    let printedAny = false;
    const results = await Promise.all(
      printJobs.map(async (job) => {
        const configuredName = (job.printerName || '').trim();
        const resolvedName =
          resolveLivePrinterName(configuredName, livePrinters, {
            portName: job.portName,
            matchHint: job.matchHint,
          }) || configuredName;
        if (!resolvedName) return { skipped: true as const };
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
        const mode = await printKitchenViaAgentOrQueue({
          printerName: resolvedName,
          dataBase64: uint8ToBase64(escpos),
          text,
          orderId: orderNumber,
          retryLocally,
          forceQueue,
          jobKind: 'kitchen',
          jobLabel: orderNumber ? `Kitchen · ${orderNumber}` : 'Kitchen',
          printers: livePrinters,
          configuredName,
        });
        return { skipped: false as const, mode };
      })
    );
    for (const result of results) {
      if (result.skipped) continue;
      printedAny = true;
      if (result.mode === 'queued') queuedAny = true;
    }
    if (!printedAny) {
      toast.error(t('webPosNoKitchenPrinterConfigured'));
      return;
    }
    if (queuedAny) toast.success(t('webPosPrintQueuedMainTill'));
    return;
  }

  toast.error(t('webPosNoKitchenPrinterConfigured'));
}

export async function persistWaiterHeldOrder(opts: {
  heldId?: string | null;
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
}): Promise<string | null> {
  const {
    heldId,
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
  if (!cartLines.length) return null;

  const persistChannel = tableId ? 'dine_in' : channel;
  const cartSum = cartLines.reduce((s, l) => s + Number(l.lineTotal || 0), 0);
  const heldLabel = [tableLabel, ticketDisplay, persistChannel, money(cartSum)].filter(Boolean).join(' · ');
  const cartJson = {
    cart: cartLines,
    channel: persistChannel,
    tableId: tableId || null,
    tableLabel: tableLabel || null,
    ticketDisplay,
    ticketOrderNumber,
    kitchenTicketKey: ticketDisplay,
    orderNote: orderNote || '',
  };

  const api = (await import('@/lib/api')).default;

  const res = await api.post('/merchant/pos/held', {
    id: heldId || undefined,
    label: heldLabel,
    channel: persistChannel,
    cartJson,
    staffId,
    staffName,
    sendToKitchen,
  });
  return (res.data?.held as { id?: string } | undefined)?.id || null;
}
