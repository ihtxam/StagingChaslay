import {
  buildKitchenPrintJobs,
  buildKitchenTicketItemFromLine,
  generateKitchenTicketEscPos,
  uint8ToBase64,
  type PosPrintSettingsClient,
} from '@/lib/webpos-receipt';
import { isPrintAgentAvailable, printViaAgent } from '@/lib/print-agent';
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

export async function printKioskKitchenTicket(
  ctx: KioskPrintContext,
  printSettings: PosPrintSettingsClient | null = null
): Promise<boolean> {
  if (!(await isPrintAgentAvailable())) return false;
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
  let ok = true;
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
    const res = await printViaAgent({
      dataBase64: uint8ToBase64(bytes),
      printerName: job.printerName || undefined,
      jobKind: 'kitchen',
    });
    if (!res.ok) ok = false;
  }
  return ok;
}

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
): Promise<{ kitchen: boolean; receipt: boolean }> {
  const out = { kitchen: false, receipt: false };
  if (opts.kitchen) out.kitchen = await printKioskKitchenTicket(ctx, printSettings);
  if (opts.receipt) out.receipt = await printKioskGuestReceipt(ctx);
  return out;
}
