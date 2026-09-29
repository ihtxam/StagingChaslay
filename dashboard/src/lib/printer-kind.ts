/**
 * Receipt/kitchen tickets are ESC/POS. Label printers (Niimbot / TSPL / XP-365B)
 * feed a few mm and print nothing when they receive ESC/POS init+cut.
 */

const NIIMBOT_RE = /niimbot|\bk3\b|\bb21\b|\bd11\b|\bb1\b|\bd110\b|\bb3s\b/;
const TSPL_LABEL_RE =
  /eml-?\d|emlabel|luckydoor|lucky\s*door|\btspl\b|gprinter|\btsc[-\s]|zd\d{3}|4inch|4-inch|4 inch|lp-80[hn]|lp-400|xp-?3[5-9]\d|xp-?4[0-2]\d|hprt|godex|argox|\blabel\b|\bsticker\b|barcode\s*printer/;

export function looksLikeLabelPrinterName(name?: string | null): boolean {
  const n = String(name || '').toLowerCase();
  if (!n.trim()) return false;
  if (NIIMBOT_RE.test(n)) return true;
  return TSPL_LABEL_RE.test(n);
}

/**
 * Realtek USB 10/100 LAN (0BDA:8152 / decimal 3034:33106) is an ethernet dongle.
 * A saved WebPOS printer with that name must not be reused for receipts.
 */
export function isStaleUsbEthernetPrinterName(name?: string | null): boolean {
  const raw = String(name || '').trim();
  if (!raw) return false;
  if (/0bda\s*:\s*8152/i.test(raw)) return true;
  if (/3034\s*:\s*33106/.test(raw)) return true;
  if (/10\s*\/\s*100\s*lan/i.test(raw)) return true;
  return false;
}
