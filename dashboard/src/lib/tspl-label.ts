import type { LabelPrintOptions, LabelProduct } from '@/lib/barcode-labels';
import { labelMetaLine, normalizeLabelOptions } from '@/lib/barcode-labels';
import type { PosPrintSettingsClient } from '@/lib/webpos-receipt';
import {
  buildTsplCommandList,
  encodeTsplCommands,
  isTsplLabelPrinterName,
} from '@/lib/tspl-label-core';

export {
  encodeWin1252,
  isTsplLabelPrinterName,
  TSPL_DPMM,
} from '@/lib/tspl-label-core';

export function labelPrinterUsesTspl(
  settings?: PosPrintSettingsClient | null,
  printerName?: string | null
): boolean {
  const profiles = (settings?.printers || []).filter((p) => p.enabled !== false && p.printLabels);
  const profile =
    profiles.find((p) => p.name === printerName) ||
    profiles.find((p) => isTsplLabelPrinterName(p.name)) ||
    profiles[0];
  if (profile && isTsplLabelPrinterName(profile.name)) return true;
  return isTsplLabelPrinterName(printerName);
}

/**
 * One product label as TSPL (LuckyDoor EML / TSC). Sent RAW via Print Agent.
 */
export function buildLabelTspl(product: LabelProduct, opts: LabelPrintOptions): Uint8Array {
  const o = normalizeLabelOptions(opts);
  return encodeTsplCommands(
    buildTsplCommandList({
      widthMm: o.widthMm,
      heightMm: o.heightMm,
      storeName: o.storeName,
      productName: product.name,
      meta: labelMetaLine(product, o),
      barcode: product.barcode,
      showStoreName: o.showStoreName,
      showProductName: o.showProductName,
      showBarcodeNumber: o.showBarcodeNumber,
      copies: o.copies,
    })
  );
}

export function buildTsplTestLabel(opts?: Partial<LabelPrintOptions> & { printerName?: string }): Uint8Array {
  return buildLabelTspl(
    {
      id: 'test',
      name: opts?.printerName || 'LuckyDoor TSPL',
      barcode: 'TEST1234',
    },
    {
      widthMm: opts?.widthMm,
      heightMm: opts?.heightMm,
      storeName: opts?.storeName || 'Chaslay',
      showStoreName: true,
      showProductName: true,
      showBarcodeNumber: true,
      showPrice: false,
      showSku: false,
      copies: 1,
    }
  );
}
