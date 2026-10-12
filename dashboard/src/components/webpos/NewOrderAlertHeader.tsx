import { Bell, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  isPaidOrder,
  orderAlertFulfillmentKey,
  orderAlertFulfillmentLabel,
  orderAlertPaidLabel,
} from '@/lib/order-management';

type Props = {
  titleId: string;
  platform?: string;
  platformClass?: string;
  queueCount?: number;
  fulfillmentChannel?: string | null;
  channel?: string | null;
  paymentStatus?: string | null;
  onDismiss?: () => void;
};

const TYPE_CLASS: Record<'delivery' | 'dine_in' | 'takeaway', string> = {
  takeaway: 'text-sky-800 dark:text-sky-200',
  delivery: 'text-orange-700 dark:text-orange-300',
  dine_in: 'text-emerald-800 dark:text-emerald-200',
};

export default function NewOrderAlertHeader({
  titleId,
  platform,
  platformClass,
  queueCount = 1,
  fulfillmentChannel,
  channel,
  paymentStatus,
  onDismiss,
}: Props) {
  const { t } = useI18n();
  const typeKey = orderAlertFulfillmentKey({ fulfillmentChannel, channel });
  const typeLabel = orderAlertFulfillmentLabel({ fulfillmentChannel, channel }, t);
  const paid = isPaidOrder({ paymentStatus });
  const paidLabel = orderAlertPaidLabel({ paymentStatus }, t);

  return (
    <div className="flex items-start gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
          <Bell size={26} className="animate-pulse" aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={titleId} className="text-xl font-bold text-[var(--webpos-text,var(--text))]">
              {t('webPosNewOrderAlert')}
            </h2>
            {platform ? (
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${platformClass || ''}`}
              >
                {platform}
              </span>
            ) : null}
          </div>
          {queueCount > 1 ? (
            <p className="mt-0.5 text-xs font-semibold text-violet-700">
              {t('webPosNewOrderAlertQueue').replace('{n}', String(queueCount))}
            </p>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p
          className={`text-2xl font-black uppercase leading-none tracking-tight sm:text-3xl ${TYPE_CLASS[typeKey]}`}
        >
          {typeLabel}
        </p>
        <p
          className={`mt-1.5 text-sm font-black uppercase tracking-[0.16em] sm:text-base ${
            paid ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'
          }`}
        >
          {paidLabel}
        </p>
      </div>

      {onDismiss ? (
        <button
          type="button"
          className="rounded-lg p-2 text-[var(--webpos-text-muted,var(--text-muted))] hover:bg-[var(--webpos-surface-2,var(--bg-muted))]"
          aria-label={t('close')}
          onClick={onDismiss}
        >
          <X className="h-5 w-5" />
        </button>
      ) : null}
    </div>
  );
}
