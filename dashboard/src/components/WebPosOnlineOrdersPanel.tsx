import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { resolveOrderItemName } from '@/lib/order-item-name';
import { formatOrderNumberDisplay } from '@/lib/order-number';
import {
  isAwaitingApproval,
  isAwaitingPaymentOrder,
  orderStatusBadgeClass,
  orderStatusLabel,
  type MerchantOrder,
} from '@/lib/order-management';

export type OnlineOrder = {
  id: string;
  orderNumber?: string;
  orderType?: string;
  orderSource?: string | null;
  fulfillmentChannel?: string | null;
  status: string;
  total: string | number;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  shippingAddress?: string | null;
  scheduledFor?: string | null;
  estimatedReadyAt?: string | null;
  printCount?: number | null;
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
  /** Unpaid order marked ready — open POS checkout to collect payment */
  onCollectPayment?: (order: OnlineOrder) => void;
  /** Order handled (accept/reject/complete) — clear bell badge for this ticket */
  onOrderActioned?: (orderId: string) => void;
};

function isNew(status: string) {
  return isAwaitingApproval(status);
}

function isUnpaid(o: OnlineOrder) {
  return isAwaitingPaymentOrder(o);
}

type WorkflowStep = 'accept' | 'kitchen' | 'ready' | 'done';

function workflowStep(status: string): WorkflowStep {
  if (isNew(status)) return 'accept';
  if (status === 'accepted') return 'kitchen';
  if (status === 'preparing') return 'ready';
  return 'done';
}

function WorkflowIndicator({ status, t }: { status: string; t: (k: string) => string }) {
  const current = workflowStep(status);
  const steps: { id: WorkflowStep; label: string }[] = [
    { id: 'accept', label: t('webPosWorkflowAccept') },
    { id: 'kitchen', label: t('webPosWorkflowKitchen') },
    { id: 'ready', label: t('webPosWorkflowReady') },
    { id: 'done', label: t('webPosWorkflowDone') },
  ];
  const order: WorkflowStep[] = ['accept', 'kitchen', 'ready', 'done'];
  const currentIdx = order.indexOf(current);

  return (
    <div className="flex flex-wrap items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
      {steps.map((step, idx) => {
        const done = idx < currentIdx;
        const active = step.id === current;
        return (
          <span key={step.id} className="inline-flex items-center gap-1">
            {idx > 0 ? <span className="text-stone-300">→</span> : null}
            <span
              className={`rounded-full px-2 py-0.5 ${
                active
                  ? 'bg-violet-600 text-white'
                  : done
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-stone-100 text-stone-400'
              }`}
            >
              {step.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export default function WebPosOnlineOrdersPanel({
  open,
  onClose,
  orders,
  onRefresh,
  onCollectPayment,
  onOrderActioned,
}: Props) {
  const { t, formatDateTime } = useI18n();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<'new' | 'active' | 'all'>('new');

  useEffect(() => {
    if (open) setTab('new');
  }, [open]);

  const postAction = useCallback(
    async (id: string, action: string, extra?: Record<string, unknown>) => {
      const res = await api.post(`/merchant/orders/${id}/action`, { action, ...extra });
      return (res.data?.order as OnlineOrder | undefined) || null;
    },
    []
  );

  const finalizeWhenReady = useCallback(
    async (order: OnlineOrder) => {
      if (isUnpaid(order)) {
        onOrderActioned?.(order.id);
        onClose();
        onCollectPayment?.(order);
        toast(t('webPosCollectOnReady'));
        return;
      }
      setBusyId(order.id);
      try {
        await postAction(order.id, 'complete');
        toast.success(t('webPosOrderCompleted'));
        onOrderActioned?.(order.id);
        await onRefresh();
      } catch (e: any) {
        toast.error(e.response?.data?.error || t('actionFailed'));
      } finally {
        setBusyId(null);
      }
    },
    [onClose, onCollectPayment, onOrderActioned, onRefresh, postAction, t]
  );

  const run = useCallback(
    async (order: OnlineOrder, action: string) => {
      setBusyId(order.id);
      try {
        const updated = await postAction(order.id, action);
        toast.success(t('updated'));
        if (action === 'accept' || action === 'reject') {
          onOrderActioned?.(order.id);
        }
        await onRefresh();
      } catch (e: any) {
        toast.error(e.response?.data?.error || t('actionFailed'));
      } finally {
        setBusyId(null);
      }
    },
    [finalizeWhenReady, onOrderActioned, onRefresh, postAction, t]
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
          <div>
            <h2 className="font-semibold text-stone-900">{t('webPosOnlineOrders')}</h2>
            <p className="text-[11px] text-stone-500">{t('webPosOnlineWorkflowHint')}</p>
          </div>
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
                  isNew(o.status)
                    ? 'border-violet-400 bg-violet-50/80'
                    : 'border-violet-200 bg-white'
                }`}
              >
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-stone-900">
                      {formatOrderNumberDisplay(o.orderNumber) || o.id.slice(0, 8)}
                      {isNew(o.status) ? (
                        <span className="ml-2 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                          {t('webPosNewBadge')}
                        </span>
                      ) : null}
                      {isUnpaid(o) && !isNew(o.status) ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                          {t('webPosAwaitingPayment')}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-stone-500">
                      {channelLabel(o.fulfillmentChannel)} · {money(o.total)} ·{' '}
                      {o.scheduledFor ? formatDateTime(o.scheduledFor) : t('webPosAsap')}
                      {!isNew(o.status) ? (
                        <span
                          className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${orderStatusBadgeClass(o.status)}`}
                        >
                          {orderStatusLabel(o.status, t)}
                        </span>
                      ) : null}
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
                {!['completed', 'cancelled'].includes(o.status) ? (
                  <WorkflowIndicator status={o.status} t={t} />
                ) : null}
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
                        onClick={() => void run(o, 'accept')}
                      >
                        {t('webPosAcceptOrder')}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        disabled={busyId === o.id}
                        onClick={() => void run(o, 'reject')}
                      >
                        {t('webPosRejectOrder')}
                      </button>
                    </>
                  ) : null}
                  {o.status === 'accepted' || o.status === 'preparing' ? (
                    <button
                      type="button"
                      className="btn-primary flex-1 text-xs"
                      disabled={busyId === o.id}
                      onClick={() => void run(o, 'mark_ready')}
                    >
                      {t('webPosMarkReady')}
                    </button>
                  ) : null}
                  {o.status === 'ready' && o.fulfillmentChannel === 'delivery' ? (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={busyId === o.id}
                      onClick={() => void run(o, 'out_for_delivery')}
                    >
                      {t('ordersActionSendDelivery')}
                    </button>
                  ) : null}
                  {(o.status === 'ready' || o.status === 'out_for_delivery') &&
                  !['completed', 'cancelled'].includes(o.status) ? (
                    <button
                      type="button"
                      className="btn-primary flex-1 text-xs"
                      disabled={busyId === o.id}
                      onClick={() => void finalizeWhenReady(o)}
                    >
                      {isUnpaid(o) ? t('webPosTakePayment') : t('webPosCompleteOrder')}
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
