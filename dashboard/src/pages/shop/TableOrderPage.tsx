import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, ShoppingBag } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { resolveShopKey } from '@/lib/shop-cart';
import ShopThemeShell from '@/components/shop/ShopThemeShell';
import { useShopCmsTheme } from '@/hooks/useShopCmsTheme';
import ShopProductModifiersModal, {
  productHasModifiers,
  type ShopProductForModifiers,
} from '@/components/shop/ShopProductModifiersModal';

type MenuCategory = {
  id: string;
  name: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    description?: string;
    image?: string;
    modifierGroups?: ShopProductForModifiers['modifierGroups'];
  }>;
};

type SessionOrder = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  items: Array<{ name: string; quantity: number; totalPrice: number }>;
};

type CartLine = {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  selectedExtras?: Array<{ id: string; name: string; price: number }>;
};

export default function TableOrderPage() {
  const { t } = useI18n();
  const { merchantSlug, tableId } = useParams<{ merchantSlug: string; tableId: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const cmsTheme = useShopCmsTheme(shopKey);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [tableLabel, setTableLabel] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [orders, setOrders] = useState<SessionOrder[]>([]);
  const [runningTotal, setRunningTotal] = useState(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [modifierProduct, setModifierProduct] = useState<ShopProductForModifiers | null>(null);
  const [notes, setNotes] = useState('');

  const loadSession = useCallback(async () => {
    if (!shopKey || !tableId) return;
    const [sessionRes, menuRes] = await Promise.all([
      axios.get(`/api/shop/${shopKey}/table/${tableId}/session`),
      axios.get(`/api/shop/${shopKey}/menu`, { params: { channel: 'qr_table', table: tableId } }),
    ]);
    const session = sessionRes.data;
    setTableLabel(session.table?.label || tableId);
    setSessionToken(session.session?.token || '');
    setOrders(session.orders || []);
    setRunningTotal(Number(session.runningTotal || 0));
    setMenu(menuRes.data.data || []);
  }, [shopKey, tableId]);

  useEffect(() => {
    void (async () => {
      try {
        await loadSession();
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } } };
        toast.error(err.response?.data?.error || t('tableOrderLoadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [loadSession, t]);

  const cartTotal = useMemo(
    () =>
      cart.reduce((sum, line) => {
        const extras = (line.selectedExtras || []).reduce((s, e) => s + e.price, 0);
        return sum + (line.price + extras) * line.quantity;
      }, 0),
    [cart]
  );

  const addProduct = (item: MenuCategory['items'][number]) => {
    if (productHasModifiers(item as ShopProductForModifiers)) {
      setModifierProduct(item as ShopProductForModifiers);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === item.id && !l.selectedExtras?.length);
      if (existing) {
        return prev.map((l) =>
          l.id === existing.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          id: `${item.id}-${Date.now()}`,
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
        },
      ];
    });
  };

  const submitOrder = async () => {
    if (!cart.length || !tableId) return;
    setSubmitting(true);
    try {
      await axios.post(`/api/shop/${shopKey}/orders`, {
        items: cart.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          selectedExtras: (line.selectedExtras || []).map((e) => ({ id: e.id })),
        })),
        fulfillmentChannel: 'dine_in',
        tableId,
        tableSessionToken: sessionToken,
        orderSource: 'qr_table',
        customerName: tableLabel ? `Table ${tableLabel}` : 'Table guest',
        customerPhone: 'QR',
        notes: notes.trim() || undefined,
        paymentMethod: 'pay_later',
        guestCheckout: true,
      });
      toast.success(t('tableOrderSubmitted'));
      setCart([]);
      setNotes('');
      await loadSession();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('tableOrderSubmitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-600">
        {t('loading')}
      </div>
    );
  }

  return (
    <ShopThemeShell shopKey={shopKey} cmsTheme={cmsTheme}>
      <div className="mx-auto max-w-lg min-h-screen bg-white pb-28">
        <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            {t('tableOrderTitle')}
          </p>
          <h1 className="text-xl font-bold text-stone-900">
            {t('tableOrderTableLabel').replace('{label}', tableLabel)}
          </h1>
        </header>

        {orders.length > 0 ? (
          <section className="border-b border-stone-100 px-4 py-4">
            <h2 className="text-sm font-bold text-stone-800">{t('tableOrderHistory')}</h2>
            <div className="mt-2 space-y-2">
              {orders.map((o) => (
                <div key={o.id} className="rounded-lg border border-stone-200 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">#{o.orderNumber}</span>
                    <span className="text-xs uppercase text-stone-500">{o.status}</span>
                  </div>
                  <ul className="mt-1 text-stone-600">
                    {o.items.map((item, idx) => (
                      <li key={`${o.id}-${idx}`}>
                        {item.quantity}× {item.name}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 font-semibold tabular-nums">{o.total.toFixed(2)}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm font-bold">
              {t('tableOrderRunningTotal')}: {runningTotal.toFixed(2)}
            </p>
          </section>
        ) : null}

        <section className="px-4 py-4 space-y-4">
          {menu.map((cat) => (
            <div key={cat.id}>
              <h2 className="text-sm font-bold text-stone-800">{cat.name}</h2>
              <div className="mt-2 space-y-2">
                {cat.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addProduct(item)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-stone-200 p-3 text-left hover:bg-stone-50"
                  >
                    <div>
                      <p className="font-semibold text-stone-900">{item.name}</p>
                      {item.description ? (
                        <p className="text-xs text-stone-500 line-clamp-2">{item.description}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-semibold tabular-nums">{item.price.toFixed(2)}</span>
                      <Plus size={16} className="text-teal-600" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        {cart.length > 0 ? (
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white p-4 shadow-lg">
            <div className="mx-auto max-w-lg space-y-2">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <ShoppingBag size={16} />
                  {t('tableOrderCartCount').replace('{n}', String(cart.length))}
                </span>
                <span className="tabular-nums">{cartTotal.toFixed(2)}</span>
              </div>
              <textarea
                className="input w-full text-sm"
                rows={2}
                placeholder={t('tableOrderNotesPlaceholder')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitOrder()}
                className="btn-primary w-full py-3"
              >
                {submitting ? t('loading') : t('tableOrderSendToKitchen')}
              </button>
            </div>
          </div>
        ) : null}

        {modifierProduct ? (
          <ShopProductModifiersModal
            product={modifierProduct}
            onClose={() => setModifierProduct(null)}
            onConfirm={(extras, unitPrice) => {
              setCart((prev) => [
                ...prev,
                {
                  id: `${modifierProduct.id}-${Date.now()}`,
                  productId: modifierProduct.id,
                  name: modifierProduct.name,
                  price: unitPrice,
                  quantity: 1,
                  selectedExtras: extras,
                },
              ]);
              setModifierProduct(null);
            }}
          />
        ) : null}
      </div>
    </ShopThemeShell>
  );
}
