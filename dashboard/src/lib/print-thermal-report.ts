import toast from 'react-hot-toast';
import {
  isPrintAgentAvailable,
  isUnsuitableRawPrinter,
  printViaAgent,
  unsuitableRawPrinterMessage,
} from '@/lib/print-agent';
import { toastPrintError } from '@/lib/webpos-print-toast';
import {
  logoUrlToEscPos,
  printersForRole,
  resolveReceiptLogoWidthPx,
  textToEscPos,
  uint8ToBase64,
  type PosPrintSettingsClient,
} from '@/lib/webpos-receipt';

/**
 * Send plain-text report to a thermal printer via the print agent.
 * Prefers receipt-role printers, then EOD-role, then the saved WebPOS printer name.
 * Does not open the browser PDF dialog.
 */
export async function printThermalReportText(opts: {
  text: string;
  printSettings?: PosPrintSettingsClient | null;
  logoUrl?: string | null;
  t: (key: string) => string;
}): Promise<void> {
  const receiptTargets = printersForRole(opts.printSettings, 'receipt');
  const eodTargets = printersForRole(opts.printSettings, 'eod');
  const targets = receiptTargets.length ? receiptTargets : eodTargets;
  const paperWidthMm =
    targets[0]?.paperWidthMm || opts.printSettings?.paperWidthMm || 80;
  const names =
    targets.length > 0
      ? targets.map((x) => x.name)
      : [localStorage.getItem('manupos_webpos_printer') || ''];
  const named = names.map((n) => (n || '').trim()).filter(Boolean);

  if (named.length === 0) {
    toast.error(opts.t('webPosStartPrintAgent'));
    return;
  }
  if (named.every((n) => isUnsuitableRawPrinter(n))) {
    toast.error(opts.t('webPosStartPrintAgent'));
    return;
  }

  const agentOk = await isPrintAgentAvailable();
  if (!agentOk) {
    toast.error(opts.t('webPosStartPrintAgent'));
    return;
  }

  const logoWidth = resolveReceiptLogoWidthPx(opts.printSettings, paperWidthMm === 58 ? 58 : 80);
  const logo = opts.logoUrl ? await logoUrlToEscPos(String(opts.logoUrl), logoWidth) : null;
  const escpos = textToEscPos(opts.text, undefined, logo);
  const dataBase64 = uint8ToBase64(escpos);

  for (const name of names) {
    const label = (name || '').trim();
    if (label && isUnsuitableRawPrinter(label)) {
      throw new Error(unsuitableRawPrinterMessage(label));
    }
    await printViaAgent({ printerName: label || undefined, dataBase64, text: opts.text });
  }
  toast.success(opts.t('reportsPrinted'));
}

export async function printThermalReportTextSafe(opts: {
  text: string;
  printSettings?: PosPrintSettingsClient | null;
  logoUrl?: string | null;
  t: (key: string) => string;
}): Promise<void> {
  try {
    await printThermalReportText(opts);
  } catch (e: unknown) {
    toastPrintError(e, opts.t, 'webPosPrintFailed');
  }
}
