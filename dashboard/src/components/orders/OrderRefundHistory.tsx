import { useI18n } from '@/lib/i18n';
import { paymentMethodLabel } from '@/lib/payment-breakdown';
import { resolveOrderItemName } from '@/lib/order-item-name';

export type OrderRefundEntry = {
  id?: string;
  kind?: string;
  amount: number;
  reason?: string | null;
  staffName?: string | null;
  createdAt?: string | null;
  items?: Array<{ orderItemId?: string; productName?: string; quantity: number }>;
  allocation?: {
    giftCard?: number;
    cash?: number;
    terminal?: number;
    other?: number;
  } | null;
};

type Props = {
  history: OrderRefundEntry[];
  totalRefunded?: number;
  className?: string;
};

function money(n: number) {
  return `CHF ${Number(n || 0).toFixed(2)}`;
}

export default function OrderRefundHistory({ history, totalRefunded, className = '' }: Props) {
  const { t, formatDateTime } = useI18n();
  if (!history?.length) return null;

  return (
    <section
      className={`rounded-xl border border-rose-200/80 bg-rose-50/40 dark:border-rose-900/50 dark:bg-rose-950/20 overflow-hidden ${className}`}
    >
      <h3 className="px-3 py-2 text-sm font-semibold text-rose-900 dark:text-rose-100">
        {t('orderRefundHistory')}
        {totalRefunded != null && totalRefunded > 0 ? (
          <span className="ml-2 font-bold tabular-nums">−{money(totalRefunded)}</span>
        ) : null}
      </h3>
      <ul className="divide-y divide-rose-200/60 dark:divide-rose-900/40">
        {history.map((entry, idx) => (
          <li key={entry.id || idx} className="px-3 py-2.5 text-sm space-y-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-rose-900 dark:text-rose-100">
                  {entry.kind === 'goodwill' ? t('webPosRefundGoodwill') : t('webPosRefund')}
                  {entry.createdAt ? (
                    <span className="ml-2 text-xs font-normal text-rose-800/80 dark:text-rose-200/80">
                      {formatDateTime(entry.createdAt)}
                    </span>
                  ) : null}
                </p>
                {entry.reason ? (
                  <p className="text-xs text-rose-800/90 dark:text-rose-200/90">{entry.reason}</p>
                ) : null}
                {entry.staffName ? (
                  <p className="text-xs text-rose-800/70 dark:text-rose-200/70">
                    {t('ordersFilterStaff')}: {entry.staffName}
                  </p>
                ) : null}
              </div>
              <p className="font-bold tabular-nums text-rose-700 dark:text-rose-300 shrink-0">
                −{money(entry.amount)}
              </p>
            </div>
            {!!entry.items?.length && (
              <ul className="text-xs text-rose-800/90 dark:text-rose-200/90 space-y-0.5">
                {entry.items.map((it, i) => (
                  <li key={`${it.orderItemId || i}`}>
                    {Number(it.quantity)}× {resolveOrderItemName(it.productName)}
                  </li>
                ))}
              </ul>
            )}
            {entry.allocation ? (
              <p className="text-[11px] text-rose-800/70 dark:text-rose-200/70">
                {[
                  entry.allocation.cash ? `${paymentMethodLabel('cash', t)} ${money(entry.allocation.cash)}` : '',
                  entry.allocation.terminal
                    ? `${paymentMethodLabel('terminal', t)} ${money(entry.allocation.terminal)}`
                    : '',
                  entry.allocation.giftCard
                    ? `${paymentMethodLabel('gift_card', t)} ${money(entry.allocation.giftCard)}`
                    : '',
                  entry.allocation.other
                    ? `${paymentMethodLabel('other', t)} ${money(entry.allocation.other)}`
                    : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
