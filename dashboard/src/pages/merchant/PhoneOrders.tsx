import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type PhoneTicket = {
  id: string;
  orderNumber?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  status?: string | null;
  total?: string | number | null;
  createdAt?: string;
};

type CatalogProduct = {
  id: string;
  name: string;
  price?: string | number | null;
};

type CartLine = { productId: string; name: string; quantity: number; unitPrice: number };

export default function PhoneOrders() {
  const { t } = useI18n();
  const [tickets, setTickets] = useState<PhoneTicket[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [licensed, setLicensed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ordersRes, settingsRes] = await Promise.all([
        api.get('/merchant/orders', { params: { orderSource: 'phone', limit: 50 } }),
        api.get('/merchant/settings'),
      ]);
      setTickets(ordersRes.data?.orders || []);
      setLicensed(settingsRes.data?.settings?.phoneOrderingAddonEnabled === true);
      const phone =
        settingsRes.data?.settings?.phoneOrderingSettings ||
        settingsRes.data?.phoneOrderingSettings;
      setEnabled(phone?.enabled !== false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('cmsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const q = query.trim();
    const handle = window.setTimeout(() => {
      api
        .get('/merchant/products', { params: { search: q || undefined, limit: 30 } })
        .then((res) => setProducts(res.data?.products || res.data || []))
        .catch(() => setProducts([]));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query]);

  const total = useMemo(
    () => cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    [cart]
  );

  const addProduct = (p: CatalogProduct) => {
    const unitPrice = Number(p.price || 0);
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        return prev.map((l) => (l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { productId: p.id, name: p.name, quantity: 1, unitPrice }];
    });
  };

  const submit = async (e: FormEvent, markPaid: boolean) => {
    e.preventDefault();
    if (!cart.length && !notes.trim()) {
      toast.error(t('phoneOrderingEmptyCart'));
      return;
    }
    setBusy(true);
    try {
      await api.post('/merchant/orders', {
        items: cart.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          productName: l.name,
        })),
        orderType: 'pos',
        orderSource: 'phone',
        customerName,
        customerPhone,
        notes,
        paymentMethod: markPaid ? 'cash' : undefined,
        markPaid,
        sendToKitchen: !markPaid,
      });
      toast.success(t('phoneOrderingCreated'));
      setCart([]);
      setNotes('');
      setCustomerName('');
      setCustomerPhone('');
      await load();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      toast.error(msg || t('saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-[var(--text-muted)]">{t('loading')}</div>;
  }

  if (!licensed) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold">{t('phoneOrderingDeskTitle')}</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {t('phoneOrderingAddonUpsell')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('phoneOrderingDeskTitle')}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{t('phoneOrderingDeskHint')}</p>
        {!enabled ? (
          <p className="mt-2 text-sm">
            {t('phoneOrderingNeedEnabled')}{' '}
            <Link to="/merchant/settings?tab=phone" className="underline">
              {t('settingsPhoneOrdering')}
            </Link>
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">{t('phoneOrderingTickets')}</h2>
          {tickets.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">{t('phoneOrderingTicketsEmpty')}</p>
          ) : (
            <ul className="space-y-3">
              {tickets.map((o) => (
                <li key={o.id} className="rounded-lg border border-[var(--border)] p-3 text-sm">
                  <div className="font-medium">
                    {o.orderNumber || o.id.slice(0, 8)} · {o.status || 'pending'}
                  </div>
                  <div className="text-[var(--text-muted)]">
                    {[o.customerName, o.customerPhone].filter(Boolean).join(' · ') || '—'}
                  </div>
                  {o.notes ? <p className="mt-1 whitespace-pre-wrap">{o.notes}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <form className="card space-y-3 p-4" onSubmit={(e) => void submit(e, false)}>
          <h2 className="font-semibold">{t('phoneOrderingTake')}</h2>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('phoneOrderingCustomer')}</span>
            <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('phoneOrderingCustomerPhone')}</span>
            <input className="input" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('phoneOrderingSearchCatalog')}</span>
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <ul className="max-h-40 overflow-auto text-sm">
            {products.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-1">
                <span>
                  {p.name}{' '}
                  <span className="text-[var(--text-muted)]">{Number(p.price || 0).toFixed(2)}</span>
                </span>
                <button type="button" className="btn-secondary text-xs" onClick={() => addProduct(p)}>
                  {t('phoneOrderingAddItem')}
                </button>
              </li>
            ))}
          </ul>
          {cart.length ? (
            <ul className="text-sm">
              {cart.map((l) => (
                <li key={l.productId}>
                  {l.quantity} × {l.name}
                </li>
              ))}
              <li className="mt-1 font-medium">{total.toFixed(2)}</li>
            </ul>
          ) : null}
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('phoneOrderingNotes')}</span>
            <textarea className="input min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={busy}>
              {t('phoneOrderingSendKitchen')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={(e) => void submit(e, true)}
            >
              {t('phoneOrderingMarkPaid')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
