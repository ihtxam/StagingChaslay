/**
 * Lightweight mobile PWA for merchants who use shop/ordering only (no full POS).
 * Accept/reject online + QR table orders, kitchen print via till relay.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Check, RefreshCw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth';
import { formatOrderNumberDisplay } from '@/lib/order-number';
import { isAwaitingApproval, isOnlineShopOrder } from '@/lib/order-management';
import { playOrderAlertOnce } from '@/lib/order-alert';
import { useTillPrintHub } from '@/hooks/useTillPrintHub';

type HubOrder = {
  id: string;
  orderNumber: string;
  status: string;
  orderSource?: string | null;
  fulfillmentChannel?: string | null;
  customerName?: string | null;
  total: number | string;
  createdAt: string;
  items?: Array<{ productName?: string; name?: string; quantity: number }>;
};

export default function MerchantOrderHub() {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const [orders, setOrders] = useState<HubOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const knownRef = useState<Set<string>>(() => new Set())[0];

  useTillPrintHub({ enabled: true });

  const load = useCallback(async () => {
    try {
      const res = await api.get('/merchant/orders', {
        params: { limit: 80, status: 'pending_approval,preparing,ready' },
      });
      const rows: HubOrder[] = res.data?.orders || res.data?.data || [];
      const online = rows.filter((o) => isOnlineShopOrder(o as Parameters<typeof isOnlineShopOrder>[0]));
      setOrders(online);
      for (const o of online) {
        if (!knownRef.has(o.id) && isAwaitingApproval(o.status)) {
          playOrderAlertOnce();
        }
        knownRef.add(o.id);
      }
    } catch {
      toast.error(t('orderHubLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [knownRef, t]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 12_000);
    return () => window.clearInterval(id);
  }, [load]);

  const pending = useMemo(
    () => orders.filter((o) => isAwaitingApproval(o.status)),
    [orders]
  );

  const act = async (orderId: string, action: 'accept' | 'reject') => {
    setBusyId(orderId);
    try {
      await api.post(`/merchant/orders/${orderId}/action`, { action });
      toast.success(action === 'accept' ? t('orderAccepted') : t('orderRejected'));
      await load();
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || t('actionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const sourceLabel = (o: HubOrder) => {
    if (o.orderSource === 'qr_table') return t('catalogChannel_qr_table');
    if (o.fulfillmentChannel === 'delivery') return t('delivery');
    return t('shop');
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{t('orderHubTitle')}</p>
            <h1 className="text-lg font-bold">{user?.name || t('merchant')}</h1>
          </div>
          <button type="button" className="btn-secondary p-2" onClick={() => void load()} aria-label={t('refresh')}>
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{t('orderHubHint')}</p>
      </header>

      <main className="p-4 space-y-3 max-w-lg mx-auto">
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">{t('loading')}</p>
        ) : pending.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] p-8 text-center">
            <Bell className="w-10 h-10 mx-auto text-[var(--text-muted)] mb-3" />
            <p className="font-medium">{t('orderHubEmpty')}</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">{t('orderHubEmptyHint')}</p>
          </div>
        ) : (
          pending.map((o) => (
            <article key={o.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">{sourceLabel(o)}</p>
                  <h2 className="text-lg font-bold">#{formatOrderNumberDisplay(o.orderNumber)}</h2>
                  <p className="text-sm">{o.customerName || '—'}</p>
                </div>
                <p className="text-lg font-bold tabular-nums">{Number(o.total).toFixed(2)}</p>
              </div>
              <ul className="mt-2 text-sm text-[var(--text-muted)] space-y-0.5">
                {(o.items || []).slice(0, 6).map((item, idx) => (
                  <li key={idx}>
                    {item.quantity}× {item.productName || item.name}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={busyId === o.id}
                  className="btn-primary flex-1 inline-flex items-center justify-center gap-2 py-3"
                  onClick={() => void act(o.id, 'accept')}
                >
                  <Check className="w-5 h-5" />
                  {t('accept')}
                </button>
                <button
                  type="button"
                  disabled={busyId === o.id}
                  className="btn-secondary flex-1 inline-flex items-center justify-center gap-2 py-3"
                  onClick={() => void act(o.id, 'reject')}
                >
                  <X className="w-5 h-5" />
                  {t('reject')}
                </button>
              </div>
            </article>
          ))
        )}

        {orders.filter((o) => !isAwaitingApproval(o.status)).length > 0 ? (
          <section className="pt-4">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] mb-2">{t('orderHubInKitchen')}</h2>
            <div className="space-y-2">
              {orders
                .filter((o) => !isAwaitingApproval(o.status))
                .map((o) => (
                  <div key={o.id} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm flex justify-between">
                    <span>#{formatOrderNumberDisplay(o.orderNumber)}</span>
                    <span className="uppercase text-xs text-[var(--text-muted)]">{o.status}</span>
                  </div>
                ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
