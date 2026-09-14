import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

type VoucherUsageOrder = {
  id: string;
  total: string;
  currency: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  merchant?: { name?: string | null; email?: string | null };
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

function draftTracking(order: Order, draft: Record<string, string>) {
  return draft[order.id] ?? order.trackingUrl ?? '';
}

/** Only send tracking on status change when the draft differs from saved (avoids accidental clears). */
function trackingPayload(order: Order, draft: Record<string, string>): string | undefined {
  if (!(order.id in draft)) return undefined;
  const draftVal = draft[order.id] ?? '';
  const saved = order.trackingUrl ?? '';
  if (draftVal !== saved) return draftVal;
  return undefined;
}

function statusAfterTrackingSave(currentStatus: string, trackingValue: string) {
  const trimmed = trackingValue.trim();
  if (!trimmed) return currentStatus;
  if (['paid', 'accepted', 'processing'].includes(currentStatus)) return 'shipped';
  return currentStatus;
}

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
  expiresAt: '',
  isActive: true,
};

export default function SuperadminPlatformShop() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'products' | 'vouchers' | 'orders'>('products');
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [voucherForm, setVoucherForm] = useState(emptyVoucher);
  const [usageVoucherId, setUsageVoucherId] = useState<string | null>(null);
  const [usageOrders, setUsageOrders] = useState<VoucherUsageOrder[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
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
    if (!voucherForm.discountPercent && !voucherForm.discountAmount) {
      toast.error('Set a discount % or CHF amount');
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
        expiresAt: voucherForm.expiresAt || null,
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

  const toggleVoucherActive = async (voucher: Voucher) => {
    try {
      await api.put(`/superadmin/platform-shop/vouchers/${voucher.id}`, {
        isActive: !voucher.isActive,
      });
      toast.success(voucher.isActive ? t('platformShopVoucherDeactivate') : t('platformShopVoucherActivate'));
      await load();
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Update failed'
      );
    }
  };

  const deleteVoucher = async (voucher: Voucher) => {
    const msg = t('platformShopVoucherDeleteConfirm').replace('{code}', voucher.code);
    if (!confirm(msg)) return;
    try {
      await api.delete(`/superadmin/platform-shop/vouchers/${voucher.id}`);
      toast.success(t('platformShopVoucherDelete'));
      if (usageVoucherId === voucher.id) {
        setUsageVoucherId(null);
        setUsageOrders([]);
      }
      await load();
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Delete failed'
      );
    }
  };

  const loadVoucherUsage = async (voucherId: string) => {
    if (usageVoucherId === voucherId) {
      setUsageVoucherId(null);
      setUsageOrders([]);
      return;
    }
    setUsageLoading(true);
    setUsageVoucherId(voucherId);
    try {
      const res = await api.get(`/superadmin/platform-shop/vouchers/${voucherId}/usage`);
      setUsageOrders(res.data.orders || []);
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Load failed'
      );
      setUsageVoucherId(null);
      setUsageOrders([]);
    } finally {
      setUsageLoading(false);
    }
  };

  const formatMaxUses = (maxUses?: number | null) => {
    if (maxUses == null) return t('platformShopVoucherUnlimited');
    return String(maxUses);
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
              <input
                className="input"
                type="number"
                min={1}
                placeholder={t('platformShopVoucherMaxUses')}
                value={voucherForm.maxUses}
                onChange={(e) => setVoucherForm({ ...voucherForm, maxUses: e.target.value })}
              />
              <input
                className="input"
                type="date"
                aria-label={t('platformShopVoucherExpires')}
                value={voucherForm.expiresAt}
                onChange={(e) => setVoucherForm({ ...voucherForm, expiresAt: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={voucherForm.isActive}
                onChange={(e) => setVoucherForm({ ...voucherForm, isActive: e.target.checked })}
              />
              {t('active')}
            </label>
            <button type="button" className="btn-primary text-sm" disabled={saving} onClick={() => void saveVoucher()}>
              {t('save')}
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-stone-50 text-left text-stone-500">
                <tr>
                  <th className="px-3 py-2">{t('code')}</th>
                  <th className="px-3 py-2">{t('discount')}</th>
                  <th className="px-3 py-2">{t('platformShopVoucherUsedCount')}</th>
                  <th className="px-3 py-2">{t('status')}</th>
                  <th className="px-3 py-2">{t('platformShopVoucherExpires')}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v) => (
                  <Fragment key={v.id}>
                    <tr className="border-t border-stone-100 align-top">
                      <td className="px-3 py-2">
                        <strong>{v.code}</strong>
                        {v.label ? <div className="text-xs text-stone-500">{v.label}</div> : null}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {v.discountPercent ? `${v.discountPercent}%` : v.discountAmount ? `${v.discountAmount} CHF` : '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {v.usedCount || 0} / {formatMaxUses(v.maxUses)}
                      </td>
                      <td className="px-3 py-2">
                        {v.isActive ? (
                          <span className="text-emerald-700">{t('active')}</span>
                        ) : (
                          <span className="text-red-600">{t('inactive')}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-stone-500">
                        {v.expiresAt ? new Date(v.expiresAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2 justify-end">
                          <button
                            type="button"
                            className="text-xs text-blue-600"
                            onClick={() => void loadVoucherUsage(v.id)}
                          >
                            {usageVoucherId === v.id ? t('close') : t('platformShopVoucherUsageHistory')}
                          </button>
                          <button
                            type="button"
                            className="text-xs text-amber-700"
                            onClick={() => void toggleVoucherActive(v)}
                          >
                            {v.isActive ? t('platformShopVoucherDeactivate') : t('platformShopVoucherActivate')}
                          </button>
                          {(v.usedCount || 0) === 0 ? (
                            <button
                              type="button"
                              className="text-xs text-red-600"
                              onClick={() => void deleteVoucher(v)}
                            >
                              {t('platformShopVoucherDelete')}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {usageVoucherId === v.id ? (
                      <tr className="border-t border-stone-100 bg-stone-50">
                        <td colSpan={6} className="px-3 py-3">
                          {usageLoading ? (
                            <p className="text-stone-500">{t('loading')}</p>
                          ) : usageOrders.length ? (
                            <ul className="space-y-1 text-xs">
                              {usageOrders.map((o) => (
                                <li key={o.id} className="flex flex-wrap gap-x-3 gap-y-1">
                                  <span>{new Date(o.createdAt).toLocaleString()}</span>
                                  <span>{o.merchant?.name || '—'}</span>
                                  <span>
                                    {Number(o.total).toFixed(2)} {o.currency}
                                  </span>
                                  <span className="text-stone-500">{o.paymentStatus}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-stone-500">{t('platformShopVoucherNoUsage')}</p>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {!vouchers.length ? (
              <p className="px-3 py-4 text-sm text-stone-500">{t('platformShopNoProducts')}</p>
            ) : null}
          </div>
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
                    <button
                      type="button"
                      className="text-left underline-offset-2 hover:underline"
                      onClick={() => setViewOrderId(o.id)}
                    >
                      {new Date(o.createdAt).toLocaleString()}
                    </button>
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
                      onChange={(e) =>
                        void updateOrderStatus(o.id, e.target.value, trackingPayload(o, trackingDraft))
                      }
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
                            statusAfterTrackingSave(o.status, draftTracking(o, trackingDraft)),
                            draftTracking(o, trackingDraft)
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

      {viewOrderId && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[280] flex items-center justify-center bg-black/50 p-3 sm:p-6"
              role="dialog"
              aria-modal="true"
              onClick={() => setViewOrderId(null)}
            >
              <div
                className="flex min-h-0 w-full max-w-lg max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-2xl bg-[var(--bg-elevated)] shadow-2xl border border-[var(--border)]"
                onClick={(e) => e.stopPropagation()}
              >
                {(() => {
                  const o = orders.find((row) => row.id === viewOrderId);
                  if (!o) return null;
                  return (
                    <>
                      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[var(--border)]">
                        <div>
                          <h2 className="text-base font-semibold text-[var(--text)]">
                            {t('platformShopOrderDetails')}
                          </h2>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            {o.merchant?.name || '—'} · #{o.id.slice(0, 8)}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-sm font-semibold text-[var(--text-muted)] underline"
                          onClick={() => setViewOrderId(null)}
                        >
                          {t('close')}
                        </button>
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
                        <p className="text-sm text-[var(--text)]">
                          {(o.items || []).map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                        </p>
                        {o.notes ? (
                          <p className="text-sm text-[var(--text-muted)] whitespace-pre-wrap">{o.notes}</p>
                        ) : null}
                        <p className="text-sm font-semibold text-[var(--text)]">
                          {Number(o.total).toFixed(2)} {o.currency}
                        </p>
                        <label className="block text-xs text-[var(--text-muted)]">
                          {t('status')}
                          <select
                            className="input mt-1 w-full text-sm"
                            value={o.status}
                            onChange={(e) =>
                              void updateOrderStatus(o.id, e.target.value, trackingPayload(o, trackingDraft))
                            }
                          >
                            {['paid', 'accepted', 'processing', 'shipped', 'fulfilled', 'cancelled', 'pending'].map(
                              (s) => (
                                <option key={s} value={s}>
                                  {statusOptionLabel(s)}
                                </option>
                              )
                            )}
                          </select>
                        </label>
                        <label className="block text-xs text-[var(--text-muted)]">
                          {t('platformShopTracking')}
                          <div className="mt-1 flex gap-1">
                            <input
                              className="input text-sm w-full"
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
                                  statusAfterTrackingSave(o.status, draftTracking(o, trackingDraft)),
                                  draftTracking(o, trackingDraft)
                                )
                              }
                            >
                              {t('save')}
                            </button>
                          </div>
                        </label>
                        {o.trackingUrl ? (
                          <a
                            href={o.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-blue-600 dark:text-blue-400 underline"
                          >
                            {t('platformShopOpenTracking')}
                          </a>
                        ) : null}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
