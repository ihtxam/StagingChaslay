import { isTsplLabelPrinterName } from './tspl-label-core';

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

function looksLikeGenericUsbLabelPort(name?: string | null): boolean {
  return /\busb\d+\b|\busb00|usbprint/i.test(String(name || '').toLowerCase());
}

function labelRoleProfiles(settings?: LabelPrintSettings | null): LabelPrinterRow[] {
  return (settings?.printers || []).filter((p) => p.enabled !== false && p.printLabels && p.name);
}

/**
 * Prefer a real sticker printer over a receipt profile that also has Labels ticked.
 * Hold-order used printers[0] and sent ESC/POS to USB00x / XP-365B when a receipt
 * printer was first in the list.
 */
export function pickPreferredLabelPrinter(
  settings?: LabelPrintSettings | null
): LabelPrinterRow | null {
  const profiles = labelRoleProfiles(settings);
  if (!profiles.length) return null;
  return (
    profiles.find((p) => isNiimbotName(p.name) || isNiimbotName(p.portName) || isNiimbotName(p.matchHint)) ||
    profiles.find(
      (p) =>
        isTsplLabelPrinterName(p.name) ||
        isTsplLabelPrinterName(p.portName) ||
        isTsplLabelPrinterName(p.matchHint)
    ) ||
    profiles.find(
      (p) =>
        looksLikeGenericUsbLabelPort(p.name) ||
        looksLikeGenericUsbLabelPort(p.portName) ||
        looksLikeGenericUsbLabelPort(p.matchHint)
    ) ||
    profiles.find((p) => !looksLikeEscPosReceiptPrinter(p.name)) ||
    profiles[0] ||
    null
  );
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
  const preferred = pickPreferredLabelPrinter(settings);
  const profile =
    (name ? profiles.find((p) => p.name === name) : null) ||
    preferred ||
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
  if (
    looksLikeGenericUsbLabelPort(blob) ||
    looksLikeGenericUsbLabelPort(name) ||
    looksLikeGenericUsbLabelPort(profile?.name) ||
    looksLikeGenericUsbLabelPort(profile?.portName)
  ) {
    if (!looksLikeEscPosReceiptPrinter(profile?.name) && !looksLikeEscPosReceiptPrinter(name)) {
      return 'tspl';
    }
  }
  if (profile && !looksLikeEscPosReceiptPrinter(profile.name) && !looksLikeEscPosReceiptPrinter(name)) {
    return 'tspl';
  }
  return 'escpos';
}

/** Receipt/kitchen ESC/POS must not be sent to sticker printers (blank feed). */
export function printerUsesLabelProtocol(
  settings?: LabelPrintSettings | null,
  printerName?: string | null
): boolean {
  return resolveLabelPrintProtocol(settings, printerName) !== 'escpos';
}
