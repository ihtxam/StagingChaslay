import { useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { formatCHF } from '@/lib/money';
import { receiptLabels } from '@/lib/receipt-labels';
import {
  buildDigitalReceiptTotals,
  resolveReceiptTaxRateForOrder,
  type PosOrderForReceipt,
} from '@/lib/webpos-receipt';

type OrderTotalsInput = Pick<
  PosOrderForReceipt,
  | 'subtotal'
  | 'taxAmount'
  | 'taxRate'
  | 'discountAmount'
  | 'tipAmount'
  | 'roundingAmount'
  | 'total'
  | 'items'
  | 'channel'
  | 'fulfillmentChannel'
>;

type Props = {
  order: OrderTotalsInput;
  taxIncludedInPrice?: boolean;
  vatAfterDiscount?: boolean;
  className?: string;
  /** Side panel uses smaller text; modal uses default sizing. */
  compact?: boolean;
};

function TotalsRow({
  label,
  value,
  bold,
  muted,
  accent,
  compact,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  accent?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-3 ${
        bold
          ? compact
            ? 'border-t border-stone-200 pt-2 text-base font-bold'
            : 'border-t border-[var(--border)] pt-2 text-sm font-extrabold'
          : muted
            ? compact
              ? 'text-xs text-stone-500'
              : 'text-xs text-[var(--text-muted)]'
            : accent
              ? 'text-emerald-700'
              : compact
                ? 'text-sm text-stone-600'
                : 'text-sm'
      }`}
    >
      <span>{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

export default function OrderDetailTotals({
  order,
  taxIncludedInPrice,
  vatAfterDiscount = true,
  className = '',
  compact = false,
}: Props) {
  const { t, locale } = useI18n();
  const L = receiptLabels(locale);

  const taxRate = useMemo(() => resolveReceiptTaxRateForOrder(order), [order]);

  const totals = useMemo(
    () =>
      buildDigitalReceiptTotals({
        items: (order.items || []).map((item) => ({
          name: item.name || item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.totalPrice,
        })),
        subtotal: order.subtotal ?? 0,
        taxAmount: order.taxAmount ?? 0,
        discountAmount: order.discountAmount,
        tipAmount: order.tipAmount,
        roundingAmount: order.roundingAmount,
        total: order.total,
        taxRate,
        vatIncludedInPrice: taxIncludedInPrice,
        vatAfterDiscount,
      }),
    [order, taxRate, taxIncludedInPrice, vatAfterDiscount]
  );

  const taxLabel =
    totals.taxRate > 0
      ? t('webPosTax').replace('{rate}', String(totals.taxRate))
      : t('webPosTax').replace('{rate}', '0');

  return (
    <div className={`space-y-1 ${className}`}>
      {totals.discount > 0 ? (
        <TotalsRow
          label={t('discount')}
          value={`-${formatCHF(totals.discount)}`}
          accent
          compact={compact}
        />
      ) : null}
      {totals.vatIncluded && totals.showVatBreakdown ? (
        <p className={compact ? 'pb-0.5 text-[11px] text-stone-500' : 'pb-0.5 text-xs text-[var(--text-muted)]'}>
          {L.vatIncludedNote}
        </p>
      ) : null}
      <TotalsRow label={t('webPosSubtotal')} value={formatCHF(totals.net)} compact={compact} />
      {totals.showVatBreakdown ? (
        <TotalsRow label={taxLabel} value={formatCHF(totals.tax)} muted compact={compact} />
      ) : null}
      {totals.tip > 0 ? (
        <TotalsRow label={t('webPosTip')} value={formatCHF(totals.tip)} compact={compact} />
      ) : null}
      {Math.abs(totals.rounding) > 0.001 ? (
        <TotalsRow
          label={t('rounding')}
          value={`${totals.rounding > 0 ? '+' : ''}${formatCHF(totals.rounding)}`}
          muted
          compact={compact}
        />
      ) : null}
      <TotalsRow label={t('webPosTotal')} value={formatCHF(totals.total)} bold compact={compact} />
    </div>
  );
}
