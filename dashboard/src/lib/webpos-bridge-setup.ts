import {
  isUnsuitableRawPrinter,
  type AgentPrinter,
} from '@/lib/print-agent';
import type { PosPrintSettingsClient } from '@/lib/webpos-receipt';

export type BridgeSetupMode =
  | 'bridge_offline'
  | 'no_printers'
  | 'confirm_single'
  | 'pick_printer';

export function listSuitablePrinters(printers: AgentPrinter[]): AgentPrinter[] {
  return printers.filter((p) => p.name && !isUnsuitableRawPrinter(p.name));
}

export function hasKitchenPrinterProfile(
  printSettings: PosPrintSettingsClient | null | undefined
): boolean {
  return !!printSettings?.printers?.some(
    (p) => p.enabled !== false && p.printKitchenTickets && (p.name || '').trim()
  );
}

export function evaluateBridgeSetupMode(opts: {
  agentOk: boolean;
  printersReady: boolean;
  printers: AgentPrinter[];
  printerName: string;
  printSettings: PosPrintSettingsClient | null | undefined;
}): BridgeSetupMode | null {
  const { agentOk, printersReady, printers, printerName, printSettings } = opts;
  if (!agentOk || !printersReady) return 'bridge_offline';

  const suitable = listSuitablePrinters(printers);
  if (!suitable.length) return 'no_printers';

  const receiptOk = suitable.some((p) => p.name === printerName.trim());
  const kitchenOk = hasKitchenPrinterProfile(printSettings);

  if (suitable.length === 1) {
    const only = suitable[0].name;
    if (!receiptOk || printerName.trim() !== only || !kitchenOk) return 'confirm_single';
    return null;
  }

  if (!receiptOk || !kitchenOk) return 'pick_printer';
  return null;
}

export function buildPrinterProfileUpdate(
  printSettings: PosPrintSettingsClient | null | undefined,
  printerName: string,
  opts?: { kitchen?: boolean; receipt?: boolean }
): PosPrintSettingsClient {
  const base: PosPrintSettingsClient = { ...(printSettings || {}) };
  const profiles = [...(base.printers || [])];
  const trimmed = printerName.trim();
  const idx = profiles.findIndex((p) => p.name === trimmed);
  const kitchen = opts?.kitchen !== false;
  const receipt = opts?.receipt !== false;

  if (idx >= 0) {
    profiles[idx] = {
      ...profiles[idx],
      name: trimmed,
      enabled: true,
      printKitchenTickets: kitchen ? true : profiles[idx].printKitchenTickets,
      printReceipts: receipt ? true : profiles[idx].printReceipts,
      printAllProducts: profiles[idx].printAllProducts !== false,
    };
  } else {
    profiles.push({
      id: `p-${Date.now()}`,
      name: trimmed,
      enabled: true,
      paperWidthMm: 80,
      printReceipts: receipt,
      printKitchenTickets: kitchen,
      printEndOfDayReports: false,
      printLabels: false,
      printAllProducts: true,
    });
  }

  return { ...base, printers: profiles };
}
