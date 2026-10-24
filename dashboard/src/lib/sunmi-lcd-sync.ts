import type { CustomerDisplayPhase } from '@/lib/customer-display-sync';
import { pushBridgeCustomerLcd, probeDeviceBridgeHealth } from '@/lib/device-bridge';
import { isAndroidWebPosTill } from '@/lib/print-agent';
import { formatSunmiLcdLines, type SunmiLcdCartLine } from '@/lib/sunmi-lcd-format';

export type { SunmiLcdCartLine };
export { formatSunmiLcdLines };

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
