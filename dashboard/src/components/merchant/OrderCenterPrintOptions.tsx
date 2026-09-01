import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Printer } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  DEFAULT_ORDER_CENTER_PRINT_PREFS,
  readOrderCenterPrintPrefs,
  saveOrderCenterPrintPrefs,
  type OrderCenterKitchenRoute,
  type OrderCenterPrintPrefs,
} from '@/lib/order-center-print-prefs';

type Props = {
  className?: string;
};

export default function OrderCenterPrintOptions({ className = '' }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<OrderCenterPrintPrefs>(() => readOrderCenterPrintPrefs());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const patch = (next: Partial<OrderCenterPrintPrefs>) => {
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    saveOrderCenterPrintPrefs(merged);
  };

  const setRoute = (kitchenRoute: OrderCenterKitchenRoute) => patch({ kitchenRoute });

  const activeCount = [prefs.kitchen, prefs.customerReceipt, prefs.deliverySlip].filter(Boolean).length;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        className="btn-secondary inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Printer className="h-4 w-4" />
        <span className="hidden sm:inline">{t('orderCenterPrintOptions')}</span>
        <span className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 text-[10px] tabular-nums">
          {activeCount}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-3 shadow-lg">
          <p className="text-xs font-semibold">{t('orderCenterPrintOptionsTitle')}</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{t('orderCenterPrintOptionsHint')}</p>

          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={prefs.kitchen}
                  onChange={(e) => patch({ kitchen: e.target.checked })}
                />
                <span>
                  <span className="font-medium">{t('orderCenterTicketKitchen')}</span>
                  <span className="block text-xs text-[var(--text-muted)]">
                    {t('orderCenterTicketKitchenHint')}
                  </span>
                </span>
              </label>
            </li>
            <li>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={prefs.customerReceipt}
                  onChange={(e) => patch({ customerReceipt: e.target.checked })}
                />
                <span>
                  <span className="font-medium">{t('orderCenterTicketCustomerReceipt')}</span>
                  <span className="block text-xs text-[var(--text-muted)]">
                    {t('orderCenterTicketCustomerReceiptHint')}
                  </span>
                </span>
              </label>
            </li>
            <li>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={prefs.deliverySlip}
                  onChange={(e) => patch({ deliverySlip: e.target.checked })}
                />
                <span>
                  <span className="font-medium">{t('orderCenterTicketDeliverySlip')}</span>
                  <span className="block text-xs text-[var(--text-muted)]">
                    {t('orderCenterTicketDeliverySlipHint')}
                  </span>
                </span>
              </label>
            </li>
          </ul>

          {prefs.kitchen ? (
            <div className="mt-3 border-t border-[var(--border)] pt-3">
              <p className="text-xs font-semibold">{t('orderCenterKitchenRoute')}</p>
              <div className="mt-2 flex flex-col gap-1.5">
                <button
                  type="button"
                  className={`rounded-lg border px-2.5 py-2 text-left text-xs ${
                    prefs.kitchenRoute === 'local'
                      ? 'border-teal-500 bg-teal-50 text-teal-950 dark:bg-teal-950/40 dark:text-teal-100'
                      : 'border-[var(--border)]'
                  }`}
                  onClick={() => setRoute('local')}
                >
                  <span className="font-semibold">{t('orderCenterKitchenRouteLocal')}</span>
                  <span className="mt-0.5 block text-[var(--text-muted)]">
                    {t('orderCenterKitchenRouteLocalHint')}
                  </span>
                </button>
                <button
                  type="button"
                  className={`rounded-lg border px-2.5 py-2 text-left text-xs ${
                    prefs.kitchenRoute === 'till'
                      ? 'border-teal-500 bg-teal-50 text-teal-950 dark:bg-teal-950/40 dark:text-teal-100'
                      : 'border-[var(--border)]'
                  }`}
                  onClick={() => setRoute('till')}
                >
                  <span className="font-semibold">{t('orderCenterKitchenRouteTill')}</span>
                  <span className="mt-0.5 block text-[var(--text-muted)]">
                    {t('orderCenterKitchenRouteTillHint')}
                  </span>
                </button>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            className="mt-3 w-full text-xs text-[var(--text-muted)] underline"
            onClick={() => {
              setPrefs({ ...DEFAULT_ORDER_CENTER_PRINT_PREFS });
              saveOrderCenterPrintPrefs(DEFAULT_ORDER_CENTER_PRINT_PREFS);
            }}
          >
            {t('orderCenterPrintOptionsReset')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
