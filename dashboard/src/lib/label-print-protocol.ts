import { isTsplLabelPrinterName } from '@/lib/tspl-label-core';

export type LabelPrintProtocol = 'niimbot' | 'tspl' | 'escpos';

function isNiimbotName(name?: string | null): boolean {
  return /niimbot|\bk3\b|\bb21\b|\bd11\b|\bb1\b|\bd110\b|\bb3s\b/.test(String(name || '').toLowerCase());
}

type LabelPrinterRow = {
  name?: string | null;
  enabled?: boolean;
  printLabels?: boolean;
  portName?: string | null;
  matchHint?: string | null;
};

type LabelPrintSettings = {
  printers?: LabelPrinterRow[] | null;
};

function looksLikeEscPosReceiptPrinter(name?: string | null): boolean {
  const n = String(name || '').toLowerCase();
  if (!n) return false;
  if (isNiimbotName(n) || isTsplLabelPrinterName(n)) return false;
  return /pos-?80|xp-80|80mm|receipt|epson\s*tm|star\s*tsp|rpp02|thermal\s*80/.test(n);
}

function labelRoleProfiles(settings?: LabelPrintSettings | null): LabelPrinterRow[] {
  return (settings?.printers || []).filter((p) => p.enabled !== false && p.printLabels && p.name);
}

/**
 * USB sticker printers (Niimbot / LuckyDoor / XP-365B) feed a few mm and print
 * nothing when they receive ESC/POS init+cut. Prefer the real label protocol.
 */
export function resolveLabelPrintProtocol(
  settings?: LabelPrintSettings | null,
  printerName?: string | null
): LabelPrintProtocol {
  const name = String(printerName || '').trim();
  const profiles = labelRoleProfiles(settings);
  const profile =
    profiles.find((p) => p.name === name) ||
    profiles.find((p) => isNiimbotName(p.name)) ||
    profiles.find((p) => isTsplLabelPrinterName(p.name)) ||
    profiles[0];
  const blob = [name, profile?.name, profile?.portName, profile?.matchHint]
    .filter(Boolean)
    .join(' ');

  if (isNiimbotName(blob) || isNiimbotName(name) || isNiimbotName(profile?.name)) {
    return 'niimbot';
  }
  if (isTsplLabelPrinterName(blob) || isTsplLabelPrinterName(name) || isTsplLabelPrinterName(profile?.name)) {
    return 'tspl';
  }
  if (profile && !looksLikeEscPosReceiptPrinter(profile.name) && !looksLikeEscPosReceiptPrinter(name)) {
    return 'tspl';
  }
  return 'escpos';
}
