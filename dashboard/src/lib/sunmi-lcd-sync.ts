import type { CustomerDisplayPhase } from '@/lib/customer-display-sync';
import { pushBridgeCustomerLcd, probeDeviceBridgeHealth } from '@/lib/device-bridge';
import { isAndroidWebPosTill } from '@/lib/print-agent';

export type SunmiLcdCartLine = {
  name: string;
  qty: number;
};

const LCD_LINE_MAX = 20;

function truncateLcdLine(value: string): string {
  const collapsed = String(value || '').replace(/\s+/g, ' ').trim();
  if (collapsed.length <= LCD_LINE_MAX) return collapsed;
  return `${collapsed.slice(0, LCD_LINE_MAX - 1)}…`;
}

function formatMoney(currency: string, amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  if (currency === 'CHF') return `CHF ${n.toFixed(2)}`;
  return `${currency} ${n.toFixed(2)}`;
}

export function formatSunmiLcdLines(input: {
  phase: CustomerDisplayPhase;
  currency: string;
  total: number;
  lines: SunmiLcdCartLine[];
  merchantName?: string;
}): { topText: string; bottomText: string; clear?: boolean } {
  const { phase, currency, total, lines, merchantName } = input;
  const totalLabel = formatMoney(currency, total);
  const last = lines.length > 0 ? lines[lines.length - 1] : null;

  if (phase === 'idle' && lines.length === 0) {
    const welcome = truncateLcdLine(merchantName || 'Welcome');
    return { topText: welcome, bottomText: formatMoney(currency, 0) };
  }

  if (phase === 'thankyou') {
    return { topText: 'Thank you', bottomText: totalLabel };
  }

  if (phase === 'payment') {
    return { topText: 'TOTAL', bottomText: totalLabel };
  }

  if (last) {
    const qtyPrefix = last.qty > 1 ? `${last.qty}x ` : '';
    const top = truncateLcdLine(`${qtyPrefix}${last.name}`);
    return { topText: top, bottomText: totalLabel };
  }

  return { topText: 'TOTAL', bottomText: totalLabel };
}

let lcdBridgeReady: boolean | null = null;

async function bridgeSupportsCustomerLcd(): Promise<boolean> {
  if (!isAndroidWebPosTill()) return false;
  if (lcdBridgeReady === true) return true;
  const health = await probeDeviceBridgeHealth(2);
  lcdBridgeReady = health.ok && health.customerLcdAvailable === true;
  return lcdBridgeReady;
}

/** Push two-line cart summary to Sunmi D3 Mini 7-segment customer display (Bridge ≥ 0.4.51). */
export async function publishSunmiCustomerLcd(input: {
  phase: CustomerDisplayPhase;
  currency: string;
  total: number;
  lines: SunmiLcdCartLine[];
  merchantName?: string;
}): Promise<void> {
  if (!(await bridgeSupportsCustomerLcd())) return;
  const { topText, bottomText, clear } = formatSunmiLcdLines(input);
  await pushBridgeCustomerLcd({ topText, bottomText, clear });
}
