import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { resolveOrderItemName } from '@/lib/order-item-name';

export type OnlineOrder = {
  id: string;
  orderNumber?: string;
  orderType?: string;
  fulfillmentChannel?: string | null;
  status: string;
  total: string | number;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  scheduledFor?: string | null;
  notes?: string | null;
  createdAt: string;
  items?: Array<{
    productName?: string | null;
    quantity: string | number;
    totalPrice?: string | number;
  }>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  orders: OnlineOrder[];
  onRefresh: () => void;
  /** After accept / kitchen action — open Orders board on this ticket */
  onGoToOrders?: (orderId: string) => void;
};

function isNew(status: string) {
  return status === 'pending' || status === 'pending_approval';
}

function isUnpaid(o: OnlineOrder) {
  const pay = (o.paymentStatus || '').toLowerCase();
  const method = (o.paymentMethod || '').toLowerCase();
  if (pay === 'completed' || pay === 'paid') return false;
  return pay === 'awaiting_payment' || method === 'pay_later' || pay === 'cash';
}

export default function WebPosOnlineOrdersPanel({
  open,
  onClose,
  orders,
  onRefresh,
  onGoToOrders,
}: Props) {
  const { t, formatDateTime } = useI18n();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<'new' | 'active' | 'all'>('new');

  useEffect(() => {
    if (open) setTab('new');
  }, [open]);

  const run = useCallback(
    async (id: string, action: string) => {
      setBusyId(id);
      try {
        await api.post(`/merchant/orders/${id}/action`, { action });
        toast.success(t('updated'));
        await onRefresh();
        if (action === 'accept' || action === 'start_preparing' || action === 'mark_ready') {
          onClose();
          onGoToOrders?.(id);
        }
      } catch (e: any) {
        toast.error(e.response?.data?.error || t('actionFailed'));
      } finally {
        setBusyId(null);
      }
    },
    [onClose, onGoToOrders, onRefresh, t]
  );

  const list = useMemo(() => {
    const filtered =
      tab === 'new'
        ? orders.filter((o) => isNew(o.status))
        : tab === 'active'
          ? orders.filter(
              (o) =>
                !isNew(o.status) &&
                o.status !== 'completed' &&
                o.status !== 'cancelled'
            )
          : orders;
    return [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [orders, tab]);

  if (!open) return null;

  const money = (n: string | number) => `CHF ${Number(n || 0).toFixed(2)}`;
  const channelLabel = (ch?: string | null) => {
    if (ch === 'delivery') return t('delivery');
    if (ch === 'dine_in') return t('dineIn');
    return t('takeaway');
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={t('webPosOnlineOrders')}
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-md flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <h2 className="font-semibold text-stone-900">{t('webPosOnlineOrders')}</h2>
          <button type="button" className="p-2 text-stone-600" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>
        <div className="flex gap-1 border-b border-stone-200 px-3 pt-2">
          {(
            [
              ['new', t('webPosOnlineNew')],
              ['active', t('webPosOnlineActive')],
              ['all', t('webPosOnlineAll')],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-2 text-sm ${
                tab === id
                  ? 'border-b-2 border-stone-900 font-semibold text-stone-900'
                  : 'text-stone-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {list.length === 0 ? (
            <p className="p-2 text-sm text-stone-500">{t('webPosNoOnlineOrders')}</p>
          ) : (
            list.map((o) => (
              <div
                key={o.id}
                className={`space-y-2 rounded-xl border p-3 ${
                  isNew(o.status) ? 'border-amber-400 bg-amber-50/80' : 'border-stone-200 bg-white'
                }`}
              >
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-stone-900">
                      {o.orderNumber || o.id.slice(0, 8)}
                      {isNew(o.status) ? (
                        <span className="ml-2 rounded-full bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                          {t('webPosNewBadge')}
                        </span>
                      ) : null}
                      {isUnpaid(o) ? (
                        <span className="ml-2 rounded-full bg-violet-700 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                          {t('webPosPayLater')}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-stone-500">
                      {channelLabel(o.fulfillmentChannel)} · {money(o.total)} ·{' '}
                      {o.scheduledFor
                        ? formatDateTime(o.scheduledFor)
                        : t('webPosAsap')}
                    </p>
                    {(o.customerName || o.customerPhone) && (
                      <p className="mt-0.5 text-[11px] text-stone-700">
                        {[o.customerName, o.customerPhone].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {o.shippingAddress ? (
                      <p className="mt-0.5 text-[11px] text-stone-600 line-clamp-2">
                        {o.shippingAddress}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-stone-500">
                    {new Date(o.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <ul className="text-xs text-stone-600">
                  {(o.items || []).slice(0, 5).map((i, idx) => (
                    <li key={idx}>
                      {i.quantity}× {resolveOrderItemName(i.productName)}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  {isNew(o.status) ? (
                    <>
                      <button
                        type="button"
                        className="btn-primary flex-1 text-xs"
                        disabled={busyId === o.id}
                        onClick={() => void run(o.id, 'accept')}
                      >
                        {t('webPosAcceptOrder')}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        disabled={busyId === o.id}
                        onClick={() => void run(o.id, 'reject')}
                      >
                        {t('webPosRejectOrder')}
                      </button>
                    </>
                  ) : null}
                  {o.status === 'accepted' || o.status === 'preparing' ? (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={busyId === o.id}
                      onClick={() =>
                        void run(
                          o.id,
                          o.status === 'accepted' ? 'start_preparing' : 'mark_ready'
                        )
                      }
                    >
                      {o.status === 'accepted'
                        ? t('webPosStartKitchen')
                        : t('webPosMarkReady')}
                    </button>
                  ) : null}
                  {o.status === 'ready' ? (
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      disabled={busyId === o.id}
                      onClick={() =>
                        void run(
                          o.id,
                          o.paymentStatus === 'awaiting_payment' ||
                            o.paymentMethod === 'cash'
                            ? 'complete_and_collect'
                            : 'complete'
                        )
                      }
                    >
                      {t('webPosCompleteOrder')}
                    </button>
                  ) : null}
                  {!isNew(o.status) && onGoToOrders ? (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => {
                        onClose();
                        onGoToOrders(o.id);
                      }}
                    >
                      {t('webPosOrders')}
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
