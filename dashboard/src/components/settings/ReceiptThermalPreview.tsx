import { useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { generateWebPosReceiptText, type PosPrintSettingsClient } from '@/lib/webpos-receipt';
import { receiptHeaderContentToPlainText } from '@/lib/receipt-header-html';

type MerchantPreviewSettings = {
  businessName?: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  vatNumber?: string | null;
  posPrintSettings?: PosPrintSettingsClient | null;
};

export default function ReceiptThermalPreview({ settings }: { settings: MerchantPreviewSettings }) {
  const { t, locale } = useI18n();
  const ps = settings.posPrintSettings || {};

  const previewText = useMemo(() => {
    const headerPlain = receiptHeaderContentToPlainText(
      ps.receiptHeader || settings.businessName || 'Demo'
    );
    const headerLines = headerPlain.split(/\r?\n/).filter(Boolean);
    const businessName = headerLines[0] || settings.businessName || 'Demo';
    const receiptLang = ps.receiptLanguage === 'panel' ? locale : ps.receiptLanguage || locale;

    return generateWebPosReceiptText(
      {
        businessName,
        address: settings.address || undefined,
        city: settings.city || undefined,
        phone: settings.phone || undefined,
        vatNumber: settings.vatNumber || undefined,
        id: 'preview',
        orderDisplay: '#1032',
        completedAt: Date.now(),
        paymentMethod: 'cash',
        items: [
          { name: 'Burger classique', quantity: 1, unitPrice: 12, lineTotal: 12 },
          { name: 'Frites maison', quantity: 1, unitPrice: 4.5, lineTotal: 4.5 },
          { name: 'Eau plate', quantity: 1, unitPrice: 2, lineTotal: 2 },
        ],
        subtotal: 18.5,
        discount: 0,
        taxAmount: 1.57,
        taxRate: 8.1,
        rounding: 0,
        total: 20.07,
        staffName: 'Admin',
        footer: ps.receiptFooter || undefined,
        header: ps.receiptHeader || undefined,
        headerAlign: ps.receiptHeaderAlign,
        headerBold: ps.receiptHeaderBold,
        headerTitle: ps.receiptHeaderTitle,
        headerLines: ps.receiptHeaderLines,
        showVat: ps.receiptShowVatTable !== false,
        showStaff: ps.receiptShowStaffLine !== false,
        includeQr: false,
        includeGoogleReviewQr: false,
        paperWidthMm: ps.paperWidthMm === 58 ? 58 : 80,
        vatIncludedInPrice: true,
      },
      receiptLang
    );
  }, [locale, ps, settings]);

  return (
    <div className="sticky top-4 space-y-2">
      <p className="text-sm font-semibold text-[var(--text)]">{t('receiptPreviewTitle')}</p>
      <p className="text-xs text-[var(--text-muted)]">{t('receiptPreviewHint')}</p>
      <div
        className="mx-auto w-full max-w-[320px] rounded-sm border border-[var(--border)] bg-[#fafafa] px-3 py-4 shadow-sm"
        style={{
          backgroundImage:
            'repeating-linear-gradient(180deg, transparent, transparent 3px, rgba(0,0,0,.03) 3px, rgba(0,0,0,.03) 4px)',
        }}
      >
        <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[11px] leading-snug text-[var(--text)]">
          {previewText}
        </pre>
      </div>
    </div>
  );
}
