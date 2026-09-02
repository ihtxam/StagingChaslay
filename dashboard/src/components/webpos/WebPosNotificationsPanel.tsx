import { createPortal } from 'react-dom';
import { Bell, BookOpen, ClipboardList } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { formatOrderNumberDisplay } from '@/lib/order-number';
import { resolveOrderItemName } from '@/lib/order-item-name';
import type { OnlineOrder } from '@/components/WebPosOnlineOrdersPanel';

export type WebPosReservationAlert = {
  id: string;
  code?: string;
  guestName: string;
  partySize: number;
  reservedAt: string;
  status: string;
};

type Props = {
  orders: OnlineOrder[];
  reservations: WebPosReservationAlert[];
  showBookings: boolean;
  onClose: () => void;
  onOpenOrder: (orderId: string) => void;
  onOpenBookings: () => void;
  onViewAllOrders: () => void;
};

export default function WebPosNotificationsPanel({
  orders,
  reservations,
  showBookings,
  onClose,
  onOpenOrder,
  onOpenBookings,
  onViewAllOrders,
}: Props) {
  const { t, formatDateTime } = useI18n();
  const money = (n: string | number) => `CHF ${Number(n || 0).toFixed(2)}`;
  const empty = orders.length === 0 && (!showBookings || reservations.length === 0);

  const panel = (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label={t('close')}
        className="fixed inset-0 z-[250] cursor-default border-0 bg-black/10 p-0"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label={t('webPosNotificationsTitle')}
        className="fixed z-[251] flex max-h-[min(70vh,28rem)] flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl inset-x-3 top-[max(3.25rem,env(safe-area-inset-top,0px)+3rem)] sm:inset-x-auto sm:right-3 sm:w-[22rem]"
      >
        <div className="flex items-center gap-2 border-b border-stone-100 px-3 py-2.5">
          <Bell size={16} className="text-stone-500" aria-hidden />
          <p className="text-sm font-bold text-stone-900">{t('webPosNotificationsTitle')}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {empty ? (
            <p className="px-2 py-6 text-center text-sm text-stone-500">
              {t('webPosNotificationsEmpty')}
            </p>
          ) : null}

          {orders.length > 0 ? (
            <section className="mb-2">
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">
                {t('webPosNotificationsOrders')}
              </p>
              <ul className="space-y-1">
                {orders.map((order) => {
                  const items = order.items || [];
                  const preview = items[0];
                  return (
                    <li key={order.id}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-2 rounded-lg border border-stone-100 px-2.5 py-2 text-left hover:bg-violet-50"
                        onClick={() => onOpenOrder(order.id)}
                      >
                        <ClipboardList size={16} className="mt-0.5 shrink-0 text-violet-600" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-stone-900">
                            {formatOrderNumberDisplay(order.orderNumber) || order.id.slice(0, 8)}
                          </span>
                          <span className="block text-xs text-stone-600">
                            {[order.customerName, money(order.total)].filter(Boolean).join(' · ')}
                          </span>
                          {preview ? (
                            <span className="mt-0.5 block truncate text-[11px] text-stone-500">
                              {preview.quantity}× {resolveOrderItemName(preview.productName)}
                              {items.length > 1
                                ? ` +${items.length - 1} ${t('more')}`
                                : ''}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {showBookings && reservations.length > 0 ? (
            <section>
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">
                {t('webPosNotificationsBookings')}
              </p>
              <ul className="space-y-1">
                {reservations.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 rounded-lg border border-stone-100 px-2.5 py-2 text-left hover:bg-amber-50"
                      onClick={onOpenBookings}
                    >
                      <BookOpen size={16} className="mt-0.5 shrink-0 text-amber-700" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-stone-900">
                          {r.guestName}
                        </span>
                        <span className="block text-xs text-stone-600">
                          {r.partySize} {t('reservationsGuests')} · {formatDateTime(r.reservedAt)}
                        </span>
                        {r.code ? (
                          <span className="mt-0.5 block text-[11px] font-medium text-amber-800">
                            {r.code}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {orders.length > 0 ? (
          <div className="border-t border-stone-100 p-2">
            <button
              type="button"
              className="w-full rounded-lg border border-stone-200 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              onClick={onViewAllOrders}
            >
              {t('webPosOnlineOrders')}
            </button>
          </div>
        ) : null}
      </div>
    </>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(panel, document.body);
}
