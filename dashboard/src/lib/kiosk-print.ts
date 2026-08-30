import {
  buildKitchenPrintJobs,
  buildKitchenTicketItemFromLine,
  generateKitchenTicketEscPos,
  uint8ToBase64,
  type PosPrintSettingsClient,
} from '@/lib/webpos-receipt';
import { isPrintAgentAvailable, printViaAgent } from '@/lib/print-agent';
import {
  isKioskPrintContext,
  printKitchenViaAgentOrQueue,
} from '@/lib/webpos-print-relay';
import type { KioskCartLine } from '@/lib/kiosk-api';

export type KioskPrintContext = {
  merchantName: string;
  orderNumber: string;
  orderId: string;
  fulfillmentChannel: 'takeaway' | 'delivery' | 'dine_in';
  cart: KioskCartLine[];
  cartTotal: number;
  tableLabel?: string;
  badgeNumber?: string;
};

function lineTotal(line: KioskCartLine): number {
  const extras = (line.selectedExtras || []).reduce((s, e) => s + e.price, 0);
  return (line.price + extras) * line.quantity;
}

function channelLabel(channel: KioskPrintContext['fulfillmentChannel']): string {
  if (channel === 'delivery') return 'DELIVERY';
  if (channel === 'takeaway') return 'TAKEAWAY';
  return 'DINE IN';
}

/**
 * Queue kitchen tickets to the main till print hub (same relay as waiter WebPOS phones).
 * Does not print locally on the kiosk — main till applies kitchen routing.
 */
export async function printKioskKitchenTicket(
  ctx: KioskPrintContext,
  printSettings: PosPrintSettingsClient | null = null
): Promise<boolean> {
  if (!isKioskPrintContext()) return false;
  const items = ctx.cart.map((line) =>
    buildKitchenTicketItemFromLine({
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.price,
      lineTotal: lineTotal(line),
      productId: line.productId,
      selectedExtras: line.selectedExtras || [],
    })
  );
  const jobs = buildKitchenPrintJobs(items, printSettings);
  let queuedAny = false;
  for (const job of jobs) {
    if (!job.items.length) continue;
    const bytes = generateKitchenTicketEscPos({
      items: job.items,
      orderNumber: ctx.orderNumber || ctx.orderId.slice(0, 8),
      orderSource: 'KIOSK',
      channel: channelLabel(ctx.fulfillmentChannel),
      tableLabel: ctx.tableLabel,
      userName:
        ctx.badgeNumber ? `Badge ${ctx.badgeNumber}` : ctx.tableLabel ? `Table ${ctx.tableLabel}` : undefined,
      paperWidthMm: job.paperWidthMm,
    });
    try {
      const mode = await printKitchenViaAgentOrQueue({
        printerName: job.printerName || undefined,
        dataBase64: uint8ToBase64(bytes),
        orderId: ctx.orderId,
        configuredName: job.printerName,
        retryLocally: false,
        forceQueue: true,
        jobKind: 'kitchen',
        jobLabel: `Kiosk kitchen #${ctx.orderNumber || ctx.orderId.slice(0, 8)}`,
      });
      if (mode === 'queued') queuedAny = true;
    } catch {
      /* queue requires network; backend auto-print may still run on main till */
    }
  }
  return queuedAny || jobs.some((j) => j.items.length > 0);
}

/** Print guest receipt locally on kiosk when Print Bridge is configured. */
export async function printKioskGuestReceipt(ctx: KioskPrintContext): Promise<boolean> {
  if (!(await isPrintAgentAvailable())) return false;
  const lines = [
    ctx.merchantName,
    `Order #${ctx.orderNumber || ctx.orderId.slice(0, 8)}`,
    channelLabel(ctx.fulfillmentChannel),
    '------------------------',
    ...ctx.cart.map(
      (line) =>
        `${line.quantity}x ${line.name}`.padEnd(22) + `CHF ${lineTotal(line).toFixed(2).padStart(8)}`
    ),
    '------------------------',
    `TOTAL`.padEnd(22) + `CHF ${ctx.cartTotal.toFixed(2).padStart(8)}`,
    '',
    'Thank you!',
  ];
  const res = await printViaAgent({ text: lines.join('\n'), jobKind: 'receipt' });
  return res.ok;
}

export async function printKioskOrder(
  ctx: KioskPrintContext,
  opts: { kitchen?: boolean; receipt?: boolean },
  printSettings: PosPrintSettingsClient | null = null
): Promise<{ kitchen: boolean; receipt: boolean; kitchenQueued?: boolean }> {
  const out = { kitchen: false, receipt: false, kitchenQueued: false };
  if (opts.kitchen) {
    out.kitchen = await printKioskKitchenTicket(ctx, printSettings);
    out.kitchenQueued = out.kitchen;
  }
  if (opts.receipt) out.receipt = await printKioskGuestReceipt(ctx);
  return out;
}
