import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import {
  buildGiftCardBarcodePayload,
  buildGiftCardRedeemQrPayload,
  qrImageUrl,
} from '@/lib/qr';
import { useI18n } from '@/lib/i18n';

type Props = {
  code: string;
  qrPayload?: string | null;
  barcodePayload?: string | null;
  compact?: boolean;
};

export default function ShopGiftCardVoucher({ code, qrPayload, barcodePayload, compact }: Props) {
  const { t } = useI18n();
  const barcodeRef = useRef<SVGSVGElement>(null);

  const qrData = qrPayload || buildGiftCardRedeemQrPayload(code);
  const barData = barcodePayload || buildGiftCardBarcodePayload(code);

  useEffect(() => {
    if (!barcodeRef.current || !barData) return;
    try {
      JsBarcode(barcodeRef.current, barData, {
        format: 'CODE128',
        displayValue: true,
        fontSize: compact ? 12 : 14,
        height: compact ? 48 : 64,
        margin: 8,
        width: 1.6,
      });
    } catch {
      /* invalid payload */
    }
  }, [barData, compact]);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wide text-stone-500 mb-2">
          {t('shopGiftCardScanAtPos')}
        </p>
        <img
          src={qrImageUrl(qrData, compact ? 140 : 180)}
          alt={t('shopGiftCardQrAlt')}
          className="mx-auto rounded-lg border border-stone-100 bg-white p-2"
          width={compact ? 140 : 180}
          height={compact ? 140 : 180}
        />
      </div>
      <div className="rounded-xl border border-stone-200 bg-white px-3 py-4">
        <svg ref={barcodeRef} className="mx-auto max-w-full" role="img" aria-label={barData} />
      </div>
      <p className="text-center font-mono text-sm tracking-wide text-stone-700">{code}</p>
    </div>
  );
}
