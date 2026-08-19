import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { formatDateTimeDDMMYYYY } from '@/lib/date-format';
import { publicApi } from '@/lib/api';
import { APP_NAME } from '@/lib/brand';
import { useI18n, type Locale } from '@/lib/i18n';
import { normalizeReceiptDomain, qrImageUrl } from '@/lib/qr';
import { paymentLabel, receiptLabels } from '@/lib/receipt-labels';
import { buildDigitalReceiptTotals, formatQtyArticlePrefix, splitReceiptArticle } from '@/lib/webpos-receipt';

type Receipt = {
  id: string;
  orderNumber: string;
  businessName?: string;
  address?: string;
  phone?: string;
  vatNumber?: string;
  channel?: string;
  paymentMethod?: string;
  subtotal: string | number;
  taxAmount: string | number;
  taxRate?: number;
  vatIncludedInPrice?: boolean;
  vatAfterDiscount?: boolean;
  discountAmount?: string | number;
  tipAmount?: string | number;
  roundingAmount?: string | number;
  total: string | number;
  tableLabel?: string | null;
  guestCount?: number | null;
  customerName?: string | null;
  memberName?: string | null;
  pointsEarned?: number | null;
  pointsBalance?: number | null;
  completedAt?: string;
  adyenPaymentReceiptText?: string | null;
  items: Array<{
    name?: string;
    quantity: string | number;
    unitPrice: string | number;
    lineTotal: string | number;
    selectedExtras?: Array<{ name?: string | null }> | null;
    comboSelections?: Array<{
      slotName?: string | null;
      productName?: string | null;
      selectedExtras?: Array<{ name?: string | null }>;
    }> | null;
  }>;
};

function money(v: string | number | undefined) {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v || 0);
  return `CHF ${n.toFixed(2)}`;
}

function decodeSaleRef(raw: string | undefined): string {
  if (!raw) return '';
  let ref = raw.trim();
  try {
    ref = decodeURIComponent(ref);
  } catch {
    /* keep raw */
  }
  if (ref.includes('://')) {
    const parts = ref.replace(/\/$/, '').split('/');
    ref = parts[parts.length - 1] || ref;
  }
  return ref.trim();
}

function TotalsRow({
  label,
  value,
  bold,
  muted,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-3 ${
        bold ? 'text-lg font-bold pt-2' : muted ? 'text-stone-500' : accent ? 'text-emerald-700' : ''
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums shrink-0">{value}</span>
    </div>
  );
}

export default function ReceiptPage() {
  const { saleId: rawSaleId } = useParams();
  const saleId = decodeSaleRef(rawSaleId);
  const { t, locale } = useI18n();
  const L = receiptLabels(locale as Locale);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const host = window.location.hostname.toLowerCase().replace(/chasly\.com/gi, 'chaslay.com');
    if (host.startsWith('app.')) {
      const target = `https://pay.chaslay.com${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.location.replace(target);
    }
  }, []);

  useEffect(() => {
    if (!saleId) return;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const res = await publicApi.get(`/receipts/${encodeURIComponent(saleId)}`, {
          headers: { Authorization: undefined },
        });
        setReceipt(res.data.receipt);
      } catch (e: any) {
        const status = e.response?.status;
        const apiError = e.response?.data?.error;
        if (status === 404) {
          setError(t('receiptNotFoundHint'));
        } else if (status === 401 || /unauthorized/i.test(String(apiError || ''))) {
          setError(t('receiptLoadRejected'));
        } else {
          setError(apiError || e.message || t('receiptNotFoundHint'));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [saleId, t]);

  const totals = useMemo(
    () =>
      receipt
        ? buildDigitalReceiptTotals({
            items: receipt.items,
            subtotal: receipt.subtotal,
            taxAmount: receipt.taxAmount,
            discountAmount: receipt.discountAmount,
            tipAmount: receipt.tipAmount,
            roundingAmount: receipt.roundingAmount,
            total: receipt.total,
            taxRate: receipt.taxRate,
            vatIncludedInPrice: receipt.vatIncludedInPrice,
            vatAfterDiscount: receipt.vatAfterDiscount,
          })
        : null,
    [receipt]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        {t('receiptLoading')}
      </div>
    );
  }

  if (error || !receipt || !totals) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold mb-2">{t('receiptUnavailable')}</h1>
          <p className="text-gray-600">{error || t('receiptNotFoundHint')}</p>
          <p className="text-xs text-gray-400 mt-4 font-mono">{saleId}</p>
        </div>
      </div>
    );
  }

  const url = normalizeReceiptDomain(typeof window !== 'undefined' ? window.location.href : '');
  const taxLabel =
    totals.taxRate > 0
      ? `${L.tva} (${totals.taxRate}%)`
      : L.tax;

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow p-6">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold">{receipt.businessName || APP_NAME}</h1>
          {receipt.address && <p className="text-sm text-gray-600">{receipt.address}</p>}
          {receipt.phone && (
            <p className="text-sm text-gray-600">
              {t('receiptTel')}: {receipt.phone}
            </p>
          )}
          {receipt.vatNumber && (
            <p className="text-sm text-gray-600">
              {t('receiptVatNo')}: {receipt.vatNumber}
            </p>
          )}
        </div>
        <div className="text-sm space-y-1 border-y py-3 mb-3">
          <p>
            <span className="text-gray-500">{t('receiptOrder')}:</span> {receipt.orderNumber}
          </p>
          {receipt.completedAt && (
            <p>
              <span className="text-gray-500">{t('receiptDate')}:</span>{' '}
              {formatDateTimeDDMMYYYY(receipt.completedAt)}
            </p>
          )}
          {receipt.channel && (
            <p>
              <span className="text-gray-500">{t('receiptChannel')}:</span> {receipt.channel}
            </p>
          )}
          {receipt.tableLabel && (
            <p>
              <span className="text-gray-500">{L.table}:</span> {receipt.tableLabel}
              {receipt.guestCount ? ` · ${receipt.guestCount} ${L.pax}` : ''}
            </p>
          )}
          {receipt.memberName ? (
            <p>
              <span className="text-gray-500">{t('receiptMember')}:</span> {receipt.memberName}
            </p>
          ) : receipt.customerName &&
            (Number(receipt.pointsEarned || 0) > 0 || receipt.pointsBalance != null) ? (
            <p>
              <span className="text-gray-500">{t('receiptMember')}:</span> {receipt.customerName}
            </p>
          ) : null}
        </div>
        <ul className="space-y-2 text-sm mb-4">
          {receipt.items.map((item, idx) => {
            const extraNames = [
              ...(item.comboSelections || []).flatMap((c) => {
                const pick = String(c.productName || '').trim();
                const comboExtras = (c.selectedExtras || [])
                  .map((e) => String(e.name || '').trim())
                  .filter(Boolean);
                const label = c.slotName?.trim() && pick ? `${c.slotName.trim()}: ${pick}` : pick;
                return [label, ...comboExtras].filter(Boolean);
              }),
              ...(item.selectedExtras || []).map((e) => String(e.name || '').trim()).filter(Boolean),
            ];
            const { product, modifiers } = splitReceiptArticle(
              item.name || t('receiptItemFallback'),
              extraNames
            );
            const qtyPrefix = formatQtyArticlePrefix({ quantity: item.quantity });
            return (
              <li key={idx} className="space-y-0.5">
                <div className="flex justify-between gap-3">
                  <span>
                    {qtyPrefix}
                    {product}
                  </span>
                  <span className="font-medium tabular-nums shrink-0">{money(item.lineTotal)}</span>
                </div>
                {modifiers.map((mod) => (
                  <div key={mod} className="pl-[2.25rem] text-stone-600">
                    - {mod}
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
        <div className="text-sm space-y-1 border-t pt-3">
          {totals.discount > 0 ? (
            <TotalsRow label={L.discount} value={`-${money(totals.discount)}`} accent />
          ) : null}
          {totals.vatIncluded && totals.showVatBreakdown ? (
            <p className="text-xs text-stone-500 pb-1">{L.vatIncludedNote}</p>
          ) : null}
          <TotalsRow label={L.subtotal} value={money(totals.net)} />
          {totals.showVatBreakdown ? (
            <TotalsRow label={taxLabel} value={money(totals.tax)} />
          ) : null}
          {totals.tip > 0 ? <TotalsRow label={L.tip} value={money(totals.tip)} /> : null}
          {Math.abs(totals.rounding) > 0.001 ? (
            <TotalsRow
              label={L.rounding}
              value={`${totals.rounding > 0 ? '+' : ''}${money(totals.rounding)}`}
            />
          ) : null}
          <TotalsRow label={L.total} value={money(totals.total)} bold />
          {receipt.paymentMethod ? (
            <p className="text-gray-500 pt-1">
              {L.payment}: {paymentLabel(L, receipt.paymentMethod)}
            </p>
          ) : null}
          {Number(receipt.pointsEarned || 0) > 0 || receipt.pointsBalance != null ? (
            <div className="pt-2 space-y-1">
              {Number(receipt.pointsEarned || 0) > 0 ? (
                <TotalsRow
                  label={t('receiptPointsEarned')}
                  value={`+${Math.floor(Number(receipt.pointsEarned))}`}
                  accent
                />
              ) : null}
              {receipt.pointsBalance != null ? (
                <TotalsRow
                  label={t('receiptPointsBalance')}
                  value={String(Math.max(0, Math.floor(Number(receipt.pointsBalance))))}
                />
              ) : null}
            </div>
          ) : null}
        </div>
        {receipt.adyenPaymentReceiptText ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              {t('receiptCardPayment')}
            </p>
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-800">
              {receipt.adyenPaymentReceiptText}
            </pre>
          </div>
        ) : null}
        {url && (
          <div className="text-center mt-6">
            <img
              src={qrImageUrl(url, 180, { ecc: 'M', margin: 8 })}
              alt="QR"
              className="mx-auto"
              width={180}
              height={180}
              style={{ imageRendering: 'pixelated' }}
            />
            <p className="text-xs text-gray-500 mt-2">{t('webPosDigitalReceipt')}</p>
          </div>
        )}
        <button className="btn-primary w-full mt-6" onClick={() => window.print()}>
          {t('receiptPrint')}
        </button>
        <p className="mt-3 text-center text-xs text-gray-400">
          {t('receiptPosByPrefix')}{' '}
          <a
            href="https://chaslay.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-violet-600 hover:underline"
          >
            chaslay.com
          </a>
        </p>
      </div>
    </div>
  );
}
