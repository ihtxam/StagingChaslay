import { APP_NAME } from '@/lib/brand';
import {
  browserPrintText,
  isPrintAgentAvailable,
  isUnsuitableRawPrinter,
  unsuitableRawPrinterMessage,
} from '@/lib/print-agent';
import {
  generateRefundReceiptText,
  generateWebPosReceiptText,
  logoUrlToEscPos,
  posOrderToWebPosReceipt,
  printersForRole,
  resolveReceiptLanguage,
  textToEscPos,
  uint8ToBase64,
  type PosOrderForReceipt,
  type PosPrintSettingsClient,
  type RefundReceiptPrint,
} from '@/lib/webpos-receipt';
import { printViaAgentOrQueue } from '@/lib/webpos-print-relay';

type MerchantPrintCtx = {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  vatNumber?: string | null;
  taxIncludedInPrice?: boolean;
  vatRate?: string | null;
  shopLogoUrl?: string | null;
};

async function printReceiptText(
  text: string,
  opts: {
    printSettings?: PosPrintSettingsClient | null;
    fallbackPrinterName?: string | null;
    qrUrl?: string;
    logoUrl?: string | null;
  }
): Promise<void> {
  const targets = printersForRole(opts.printSettings, 'receipt');
  const names =
    targets.length > 0
      ? targets.map((x) => x.name)
      : [opts.fallbackPrinterName || localStorage.getItem('manupos_webpos_printer') || ''];
  const named = names.map((n) => (n || '').trim()).filter(Boolean);
  if (named.length > 0 && named.every((n) => isUnsuitableRawPrinter(n))) {
    browserPrintText(text);
    return;
  }
  const agentOk = await isPrintAgentAvailable();
  if (!agentOk && named.length === 0) {
    browserPrintText(text);
    return;
  }
  const paper = targets[0]?.paperWidthMm || opts.printSettings?.paperWidthMm || 80;
  const logo = opts.logoUrl
    ? await logoUrlToEscPos(String(opts.logoUrl), paper === 58 ? 240 : 384)
    : null;
  const escpos = textToEscPos(text, opts.qrUrl, logo);
  const dataBase64 = uint8ToBase64(escpos);
  for (const name of names) {
    const label = (name || '').trim();
    if (label && isUnsuitableRawPrinter(label)) {
      throw new Error(unsuitableRawPrinterMessage(label));
    }
    try {
      await printViaAgentOrQueue({ printerName: label || undefined, dataBase64, text });
    } catch (err: unknown) {
      const msg = String((err as Error)?.message || '');
      if (/OneNote|PDF|XPS|ESC-POS|virtual|receipt\/ESC-POS|corrupted|agent|offline/i.test(msg)) {
        browserPrintText(text);
        return;
      }
      throw err;
    }
  }
}

export async function printMerchantOrderReceipt(
  order: PosOrderForReceipt,
  opts: {
    merchant: MerchantPrintCtx;
    printSettings?: PosPrintSettingsClient | null;
    locale: string;
    splitLabel?: string | null;
    fallbackPrinterName?: string | null;
  }
): Promise<void> {
  const taxRate = opts.merchant.vatRate != null ? Number(opts.merchant.vatRate) : 8.1;
  const receiptPayload = posOrderToWebPosReceipt(order, {
    businessName: opts.merchant.name || APP_NAME,
    address: [opts.merchant.address, opts.merchant.city].filter(Boolean).join(', '),
    phone: opts.merchant.phone || undefined,
    vatNumber: opts.merchant.vatNumber || undefined,
    taxRate,
    vatIncludedInPrice: opts.merchant.taxIncludedInPrice === true,
    printSettings: opts.printSettings,
    panelLang: opts.locale,
    splitLabel: opts.splitLabel,
  });
  const text = generateWebPosReceiptText(receiptPayload, opts.locale);
  await printReceiptText(text, {
    printSettings: opts.printSettings,
    fallbackPrinterName: opts.fallbackPrinterName,
    qrUrl:
      opts.printSettings?.receiptShowQrCode !== false ? receiptPayload.receiptUrl : undefined,
    logoUrl: opts.printSettings?.receiptLogoUrl || opts.merchant.shopLogoUrl || null,
  });
}

export async function printRefundReceipt(
  payload: RefundReceiptPrint,
  opts: {
    merchant: MerchantPrintCtx;
    printSettings?: PosPrintSettingsClient | null;
    locale: string;
    fallbackPrinterName?: string | null;
  }
): Promise<void> {
  const lang = resolveReceiptLanguage(opts.printSettings, opts.locale);
  const text = generateRefundReceiptText(
    {
      ...payload,
      businessName: payload.businessName || opts.merchant.name || APP_NAME,
      address: payload.address || [opts.merchant.address, opts.merchant.city].filter(Boolean).join(', '),
      phone: payload.phone || opts.merchant.phone || undefined,
      language: lang,
      paperWidthMm: opts.printSettings?.paperWidthMm || 80,
      header: opts.printSettings?.receiptHeader,
      footer: opts.printSettings?.receiptFooter,
    },
    opts.locale
  );
  await printReceiptText(text, {
    printSettings: opts.printSettings,
    fallbackPrinterName: opts.fallbackPrinterName,
    logoUrl: opts.printSettings?.receiptLogoUrl || opts.merchant.shopLogoUrl || null,
  });
}
