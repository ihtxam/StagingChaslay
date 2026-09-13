import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: string;
  discountPercent?: number | null;
  imageUrl?: string | null;
  isActive: boolean;
  sortOrder: number;
};

type Voucher = {
  id: string;
  code: string;
  label?: string | null;
  discountPercent?: number | null;
  discountAmount?: string | null;
  isActive: boolean;
  maxUses?: number | null;
  usedCount: number;
  expiresAt?: string | null;
};

type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  total: string;
  currency: string;
  createdAt: string;
  notes?: string | null;
  trackingUrl?: string | null;
  merchant?: { name?: string | null; email?: string | null };
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
};

const emptyProduct = {
  name: '',
  description: '',
  price: '',
  discountPercent: '',
  sortOrder: '0',
  isActive: true,
};

const emptyVoucher = {
  code: '',
  label: '',
  discountPercent: '',
  discountAmount: '',
  maxUses: '',
  isActive: true,
};

export default function SuperadminPlatformShop() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'products' | 'vouchers' | 'orders'>('products');
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [voucherForm, setVoucherForm] = useState(emptyVoucher);
  const [saving, setSaving] = useState(false);
  const [trackingDraft, setTrackingDraft] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadProductId, setUploadProductId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, v, o] = await Promise.all([
        api.get('/superadmin/platform-shop/products'),
        api.get('/superadmin/platform-shop/vouchers'),
        api.get('/superadmin/platform-shop/orders'),
      ]);
      setProducts(p.data.products || []);
      setVouchers(v.data.vouchers || []);
      const nextOrders: Order[] = o.data.orders || [];
      setOrders(nextOrders);
      setTrackingDraft(
        Object.fromEntries(nextOrders.map((ord) => [ord.id, ord.trackingUrl || '']))
      );
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Load failed'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreateProduct = () => {
    setCreatingProduct(true);
    setEditingProduct(null);
    setProductForm(emptyProduct);
  };

  const openEditProduct = (p: Product) => {
    setCreatingProduct(false);
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      description: p.description || '',
      price: p.price,
      discountPercent: p.discountPercent != null ? String(p.discountPercent) : '',
      sortOrder: String(p.sortOrder || 0),
      isActive: p.isActive,
    });
  };

  const saveProduct = async () => {
    if (!productForm.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: productForm.name,
        description: productForm.description || null,
        price: Number(productForm.price) || 0,
        discountPercent: productForm.discountPercent ? Number(productForm.discountPercent) : null,
        sortOrder: Number(productForm.sortOrder) || 0,
        isActive: productForm.isActive,
      };
      if (editingProduct) {
        await api.put(`/superadmin/platform-shop/products/${editingProduct.id}`, body);
        toast.success('Product updated');
      } else {
        await api.post('/superadmin/platform-shop/products', body);
        toast.success('Product created');
      }
      setEditingProduct(null);
      setCreatingProduct(false);
      setProductForm(emptyProduct);
      await load();
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Save failed'
      );
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (productId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      await api.post(`/superadmin/platform-shop/products/${productId}/image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Photo uploaded');
      await load();
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Upload failed'
      );
    }
  };

  const saveVoucher = async () => {
    if (!voucherForm.code.trim()) {
      toast.error('Code is required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/superadmin/platform-shop/vouchers', {
        code: voucherForm.code,
        label: voucherForm.label || null,
        discountPercent: voucherForm.discountPercent ? Number(voucherForm.discountPercent) : null,
        discountAmount: voucherForm.discountAmount ? Number(voucherForm.discountAmount) : null,
        maxUses: voucherForm.maxUses ? Number(voucherForm.maxUses) : null,
        isActive: voucherForm.isActive,
      });
      toast.success('Voucher created');
      setVoucherForm(emptyVoucher);
      await load();
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Save failed'
      );
    } finally {
      setSaving(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string, trackingUrl?: string | null) => {
    try {
      await api.patch(`/superadmin/platform-shop/orders/${orderId}`, { status, trackingUrl });
      toast.success('Order updated');
      await load();
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Update failed'
      );
    }
  };

  const statusOptionLabel = (s: string) => {
    if (s === 'paid') return t('platformShopStatusPaid');
    if (s === 'accepted') return t('platformShopStatusAccepted');
    if (s === 'processing') return t('platformShopStatusProcessing');
    if (s === 'shipped') return t('platformShopStatusShipped');
    if (s === 'fulfilled') return t('platformShopStatusFulfilled');
    if (s === 'cancelled') return t('platformShopStatusCancelled');
    return t('platformShopStatusPending');
  };

  const showProductForm = creatingProduct || editingProduct !== null;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">{t('platformShopAdminTitle')}</h1>
          <p className="page-sub">{t('platformShopAdminHint')}</p>
        </div>
        <div className="flex gap-2">
          {(['products', 'vouchers', 'orders'] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                tab === key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-stone-700'
              }`}
              onClick={() => setTab(key)}
            >
              {key === 'products' ? t('products') : key === 'vouchers' ? t('vouchers') : t('orders')}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="text-sm text-stone-500">{t('loading')}</p> : null}

      {tab === 'products' && !loading ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button type="button" className="btn-primary text-sm" onClick={openCreateProduct}>
              {t('addProduct')}
            </button>
          </div>

          {showProductForm ? (
            <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
              <h2 className="font-medium">{editingProduct ? t('editProduct') : t('addProduct')}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="input"
                  placeholder={t('name')}
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                />
                <input
                  className="input"
                  placeholder={t('price')}
                  value={productForm.price}
                  onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                />
                <input
                  className="input"
                  placeholder={`${t('discount')} %`}
                  value={productForm.discountPercent}
                  onChange={(e) => setProductForm({ ...productForm, discountPercent: e.target.value })}
                />
                <input
                  className="input"
                  placeholder={t('sortOrder')}
                  value={productForm.sortOrder}
                  onChange={(e) => setProductForm({ ...productForm, sortOrder: e.target.value })}
                />
              </div>
              <textarea
                className="input w-full min-h-[80px]"
                placeholder={t('description')}
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={productForm.isActive}
                  onChange={(e) => setProductForm({ ...productForm, isActive: e.target.checked })}
                />
                {t('active')}
              </label>
              <div className="flex gap-2">
                <button type="button" className="btn-primary text-sm" disabled={saving} onClick={() => void saveProduct()}>
                  {t('save')}
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => {
                    setEditingProduct(null);
                    setCreatingProduct(false);
                    setProductForm(emptyProduct);
                  }}
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          ) : null}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && uploadProductId) void uploadImage(uploadProductId, file);
              e.target.value = '';
            }}
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <article key={p.id} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" className="h-32 w-full object-cover" />
                ) : (
                  <div className="h-32 bg-stone-100" />
                )}
                <div className="p-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <strong>{p.name}</strong>
                    <span>{Number(p.price).toFixed(2)} CHF</span>
                  </div>
                  {!p.isActive ? <span className="text-xs text-red-600">{t('inactive')}</span> : null}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="text-xs text-blue-600" onClick={() => openEditProduct(p)}>
                      {t('edit')}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-blue-600"
                      onClick={() => {
                        setUploadProductId(p.id);
                        fileRef.current?.click();
                      }}
                    >
                      {t('uploadPhoto')}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'vouchers' && !loading ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
            <h2 className="font-medium">{t('addVoucher')}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="input"
                placeholder={t('code')}
                value={voucherForm.code}
                onChange={(e) => setVoucherForm({ ...voucherForm, code: e.target.value.toUpperCase() })}
              />
              <input
                className="input"
                placeholder={t('label')}
                value={voucherForm.label}
                onChange={(e) => setVoucherForm({ ...voucherForm, label: e.target.value })}
              />
              <input
                className="input"
                placeholder={`${t('discount')} %`}
                value={voucherForm.discountPercent}
                onChange={(e) => setVoucherForm({ ...voucherForm, discountPercent: e.target.value })}
              />
              <input
                className="input"
                placeholder={`${t('discount')} CHF`}
                value={voucherForm.discountAmount}
                onChange={(e) => setVoucherForm({ ...voucherForm, discountAmount: e.target.value })}
              />
            </div>
            <button type="button" className="btn-primary text-sm" disabled={saving} onClick={() => void saveVoucher()}>
              {t('save')}
            </button>
          </div>
          <ul className="space-y-2 text-sm">
            {vouchers.map((v) => (
              <li key={v.id} className="rounded-lg border border-stone-200 bg-white px-3 py-2 flex justify-between">
                <span>
                  <strong>{v.code}</strong>
                  {v.label ? ` — ${v.label}` : ''}
                  {!v.isActive ? ` (${t('inactive')})` : ''}
                </span>
                <span className="text-stone-500">
                  {v.discountPercent ? `${v.discountPercent}%` : v.discountAmount ? `${v.discountAmount} CHF` : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === 'orders' && !loading ? (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--bg-muted)] text-left text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2">{t('date')}</th>
                <th className="px-3 py-2">{t('merchant')}</th>
                <th className="px-3 py-2">{t('items')}</th>
                <th className="px-3 py-2">{t('total')}</th>
                <th className="px-3 py-2">{t('status')}</th>
                <th className="px-3 py-2">{t('platformShopTracking')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-[var(--border)] align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-[var(--text)]">
                    {new Date(o.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-[var(--text)]">{o.merchant?.name || '—'}</td>
                  <td className="px-3 py-2 text-[var(--text)]">
                    {(o.items || []).map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                    {o.notes ? (
                      <div className="text-xs text-[var(--text-muted)] mt-1">{o.notes}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-[var(--text)]">
                    {Number(o.total).toFixed(2)} {o.currency}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="input text-xs py-1"
                      value={o.status}
                      onChange={(e) => void updateOrderStatus(o.id, e.target.value, trackingDraft[o.id] ?? o.trackingUrl)}
                    >
                      {['paid', 'accepted', 'processing', 'shipped', 'fulfilled', 'cancelled', 'pending'].map((s) => (
                        <option key={s} value={s}>
                          {statusOptionLabel(s)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 min-w-[220px]">
                    <div className="flex gap-1">
                      <input
                        className="input text-xs w-full"
                        placeholder="https://"
                        value={trackingDraft[o.id] ?? (o.trackingUrl || '')}
                        onChange={(e) => setTrackingDraft((d) => ({ ...d, [o.id]: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="btn-secondary text-xs shrink-0"
                        onClick={() =>
                          void updateOrderStatus(
                            o.id,
                            o.status === 'paid' && (trackingDraft[o.id] || '').trim()
                              ? 'shipped'
                              : o.status,
                            trackingDraft[o.id] ?? ''
                          )
                        }
                      >
                        {t('save')}
                      </button>
                    </div>
                    {o.trackingUrl ? (
                      <a
                        href={o.trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-600 dark:text-blue-400 underline mt-1 inline-block"
                      >
                        {t('platformShopTracking')}
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!orders.length ? (
            <p className="px-3 py-4 text-sm text-[var(--text-muted)]">{t('platformShopNoOrders')}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
