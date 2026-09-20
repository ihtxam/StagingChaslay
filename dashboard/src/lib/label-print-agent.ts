import {
  listAgentPrinters,
  resolveLivePrinterName,
  type AgentPrinter,
} from '@/lib/print-agent';
import { pickPreferredLabelPrinter } from '@/lib/label-print-protocol';
import type { PosPrintSettingsClient } from '@/lib/webpos-receipt';

export type ResolvedLabelPrinter = {
  printerName: string;
  portName: string | null;
  matchHint: string | null;
  livePrinters: AgentPrinter[];
};

/** Map saved Settings label profile → live Bridge / Print Agent queue name. */
export async function resolveLabelPrinterForAgent(
  settings?: PosPrintSettingsClient | null
): Promise<ResolvedLabelPrinter> {
  const preferred = pickPreferredLabelPrinter(settings);
  const configured = String(preferred?.name || '').trim();
  if (!configured) {
    throw new Error(
      'No label printer configured. Open Settings → Receipts & printers, add your label printer, and enable Labels.'
    );
  }
  let livePrinters: AgentPrinter[] = [];
  try {
    livePrinters = await listAgentPrinters();
  } catch {
    livePrinters = [];
  }
  const resolved =
    resolveLivePrinterName(configured, livePrinters, {
      portName: preferred?.portName,
      matchHint: preferred?.matchHint,
    }) || configured;
  return {
    printerName: resolved,
    portName: preferred?.portName ?? null,
    matchHint: preferred?.matchHint ?? null,
    livePrinters,
  };
}
