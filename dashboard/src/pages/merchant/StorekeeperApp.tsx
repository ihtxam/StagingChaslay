import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle, Package, ScanLine } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth';
import WebPosPinModal from '@/components/WebPosPinModal';
import BarcodeScanModal from '@/components/storekeeper/BarcodeScanModal';
import {
  loadWebPosStaffSession,
  saveWebPosStaffSession,
  type WebPosStaffSession,
} from '@/lib/permissions';

type Category = { id: string; name: string };
type Unit = { code: string; name: string };
type InvItem = {
  id: string;
  name: string;
  barcode?: string | null;
  unit: string;
  categoryId?: string | null;
  onHand: number;
  cost?: number;
};

type MenuProduct = {
  id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
};

type RecentIntake = {
  id: string;
  name: string;
  qty: number;
  unit: string;
  at: string;
};

type LookupSuggestion = {
  name: string;
  brand?: string | null;
  categoryHint?: string | null;
  categoryId?: string | null;
  packageSize?: string | null;
  unit?: string | null;
  imageUrl?: string | null;
  source?: string;
};

export default function StorekeeperApp() {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const [pinStaff, setPinStaff] = useState<WebPosStaffSession | null>(() => loadWebPosStaffSession());
  const [pinOpen, setPinOpen] = useState(false);
  const [licensed, setLicensed] = useState<boolean | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('piece');
  const [categoryId, setCategoryId] = useState('');
  const [qty, setQty] = useState('1');
  const [expiryDate, setExpiryDate] = useState('');
  const [existingItem, setExistingItem] = useState<InvItem | null>(null);
  const [menuProduct, setMenuProduct] = useState<MenuProduct | null>(null);
  const [suggestion, setSuggestion] = useState<LookupSuggestion | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [recent, setRecent] = useState<RecentIntake[]>([]);
  const [salePrice, setSalePrice] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const scanBufferRef = useRef('');
  const scanTimerRef = useRef<number | null>(null);

  const staffAccessToken = pinStaff?.accessToken;
  const displayName = pinStaff?.name || user?.name;
  const clockedIn = !!pinStaff;

  const apiHeaders = staffAccessToken ? { 'X-WebPos-Staff-Access': staffAccessToken } : undefined;

  const displayPhoto = photoUrl || menuProduct?.imageUrl || suggestion?.imageUrl || null;

  const loadBootstrap = useCallback(async () => {
    if (!clockedIn) return;
    try {
      const res = await api.get('/merchant/storekeeper/bootstrap', { headers: apiHeaders });
      setLicensed(res.data.enabled !== false);
      setCategories(res.data.categories || []);
      setUnits(res.data.units || []);
      if (res.data.units?.[0]?.code) setUnit((u) => u || res.data.units[0].code);
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      setLicensed(
        code === 'STOREKEEPER_ADDON_REQUIRED' || code === 'INVENTORY_ADDON_REQUIRED' ? false : null
      );
    }
  }, [clockedIn, apiHeaders]);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  const applyBarcode = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;
      setBarcode(trimmed);
      setSuggestion(null);
      setMenuProduct(null);
      setPhotoUrl(null);
      setLookupBusy(true);
      try {
        const res = await api.get(`/merchant/storekeeper/lookup/${encodeURIComponent(trimmed)}`, {
          headers: apiHeaders,
        });
        const menu = res.data.menuProduct as MenuProduct | null;
        if (menu) setMenuProduct(menu);

        const item = res.data.item as InvItem | null;
        if (item) {
          setExistingItem(item);
          setName(item.name);
          setUnit(item.unit || 'piece');
          setCategoryId(item.categoryId || '');
          if (menu?.imageUrl) setPhotoUrl(menu.imageUrl);
          if (menu?.price != null && menu.price > 0) setSalePrice(String(menu.price));
          return;
        }

        setExistingItem(null);
        const ext = res.data.suggestion as LookupSuggestion | null;
        if (ext?.name) {
          setSuggestion(ext);
          setName(ext.name);
          if (ext.unit) {
            const hasUnit = units.some((u) => u.code === ext.unit);
            if (hasUnit) setUnit(ext.unit);
          }
          if (ext.categoryId) setCategoryId(ext.categoryId);
          if (ext.imageUrl && !menu?.imageUrl) setPhotoUrl(ext.imageUrl);
          toast.success(t('storekeeperOnlineFound'));
        } else if (menu) {
          setName(menu.name);
          if (menu.imageUrl) setPhotoUrl(menu.imageUrl);
          if (menu.price > 0) setSalePrice(String(menu.price));
          toast.success(t('storekeeperMenuProductFound'));
        } else {
          setName('');
          setCategoryId('');
          setSalePrice('');
          toast(t('storekeeperOnlineNotFound'), { icon: 'ℹ️' });
        }
      } catch {
        setExistingItem(null);
        setSuggestion(null);
      } finally {
        setLookupBusy(false);
      }
    },
    [apiHeaders, t, units]
  );

  // Bluetooth / USB keyboard-wedge scanner
  useEffect(() => {
    if (!clockedIn || licensed === false) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Enter') {
        const code = scanBufferRef.current.trim();
        scanBufferRef.current = '';
        if (code.length >= 3) {
          e.preventDefault();
          void applyBarcode(code);
        }
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        scanBufferRef.current += e.key;
        if (scanTimerRef.current) window.clearTimeout(scanTimerRef.current);
        scanTimerRef.current = window.setTimeout(() => {
          scanBufferRef.current = '';
        }, 120);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applyBarcode, clockedIn, licensed]);

  const resetForm = () => {
    setBarcode('');
    setName('');
    setQty('1');
    setExpiryDate('');
    setSalePrice('');
    setPhotoUrl(null);
    setExistingItem(null);
    setMenuProduct(null);
    setSuggestion(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) {
      toast.error(t('storekeeperBarcodeRequired'));
      return;
    }
    if (!name.trim()) {
      toast.error(t('storekeeperNameRequired'));
      return;
    }
    const q = Number(qty);
    if (!(q > 0)) {
      toast.error(t('storekeeperQtyRequired'));
      return;
    }
    setBusy(true);
    try {
      const priceNum = salePrice.trim() ? Number(salePrice) : undefined;
      const res = await api.post(
        '/merchant/storekeeper/intake',
        {
          barcode: barcode.trim(),
          name: name.trim(),
          unit,
          categoryId: categoryId || null,
          qty: q,
          expiryDate: expiryDate || null,
          salePrice: priceNum != null && Number.isFinite(priceNum) ? priceNum : undefined,
          imageUrl: photoUrl || suggestion?.imageUrl || menuProduct?.imageUrl || null,
        },
        { headers: apiHeaders }
      );

      const item = res.data.item as InvItem;
      setRecent((prev) => [
        {
          id: item.id,
          name: item.name,
          qty: q,
          unit: item.unit,
          at: new Date().toISOString(),
        },
        ...prev.slice(0, 9),
      ]);
      toast.success(
        res.data.menuProduct
          ? res.data.menuProduct.created
            ? t('storekeeperPosProductCreated')
            : t('storekeeperPosProductUpdated')
          : res.data.created
            ? t('storekeeperItemCreated')
            : t('storekeeperStockAdded')
      );
      resetForm();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || t('storekeeperIntakeFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (!clockedIn) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <Package className="text-teal-700" size={48} />
        <h1 className="text-xl font-bold">{t('storekeeperTitle')}</h1>
        <p className="max-w-sm text-sm muted">{t('storekeeperPinHint')}</p>
        <button
          type="button"
          className="rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white"
          onClick={() => setPinOpen(true)}
        >
          {t('webposPinClockIn')}
        </button>
        <WebPosPinModal
          open={pinOpen}
          onClose={() => setPinOpen(false)}
          onSuccess={(session) => {
            saveWebPosStaffSession(session);
            setPinStaff(session);
            setPinOpen(false);
          }}
        />
      </div>
    );
  }

  if (licensed === false) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <h1 className="text-lg font-bold">{t('storekeeperTitle')}</h1>
        <p className="mt-2 text-sm muted">{t('storekeeperUpsellBody')}</p>
        <p className="mt-2 text-xs muted">{t('storekeeperUpsellHint')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col gap-4 p-4 pb-8">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">{t('storekeeperTitle')}</h1>
          <p className="text-xs muted">{displayName}</p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow"
          onClick={() => setScanOpen(true)}
        >
          <Camera size={18} />
          {t('storekeeperScan')}
        </button>
      </header>

      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide muted">
            {t('storekeeperBarcode')}
          </label>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2.5 text-base"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onBlur={() => barcode.trim() && void applyBarcode(barcode)}
              placeholder={t('storekeeperBarcodePlaceholder')}
              inputMode="numeric"
              autoComplete="off"
            />
            <button
              type="button"
              className="rounded-lg border border-stone-300 px-3"
              onClick={() => barcode.trim() && void applyBarcode(barcode)}
              aria-label={t('storekeeperLookup')}
            >
              <ScanLine size={20} />
            </button>
          </div>
          {existingItem ? (
            <p className="mt-1 text-xs text-teal-800">{t('storekeeperExistingItem', { stock: existingItem.onHand })}</p>
          ) : suggestion ? (
            <p className="mt-1 text-xs text-teal-800">
              {t('storekeeperOnlineFound')}
              {suggestion.packageSize ? ` · ${t('storekeeperPackageSize', { size: suggestion.packageSize })}` : ''}
            </p>
          ) : barcode ? (
            <p className="mt-1 text-xs text-amber-800">
              {lookupBusy ? t('loading') : t('storekeeperNewItem')}
            </p>
          ) : null}
        </div>

        {(displayPhoto || suggestion?.imageUrl || menuProduct?.imageUrl) && (
          <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-white">
              {displayPhoto ? (
                <img src={displayPhoto} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-stone-400">
                  <Package size={28} />
                </div>
              )}
            </div>
            <p className="text-xs text-stone-600">{t('storekeeperPhotoOnlineHint')}</p>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide muted">
            {t('storekeeperProductName')}
          </label>
          <input
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('storekeeperProductName')}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide muted">
              {t('storekeeperUnit')}
            </label>
            <select
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              {units.map((u) => (
                <option key={u.code} value={u.code}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide muted">
              {t('storekeeperCategory')}
            </label>
            <select
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">{t('storekeeperNoCategory')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide muted">
              {t('storekeeperSalePrice')}
            </label>
            <input
              type="number"
              min="0"
              step="0.05"
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide muted">
              {t('storekeeperQty')}
            </label>
            <input
              type="number"
              min="0.0001"
              step="any"
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide muted">
            {t('storekeeperExpiry')}
          </label>
          <input
            type="date"
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 py-3.5 text-base font-bold text-white disabled:opacity-60"
        >
          <CheckCircle size={20} />
          {busy ? t('loading') : t('storekeeperSaveStock')}
        </button>
      </form>

      {recent.length > 0 ? (
        <section className="rounded-2xl border border-stone-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-bold">{t('storekeeperRecent')}</h2>
          <ul className="space-y-2 text-sm">
            {recent.map((r) => (
              <li key={`${r.id}-${r.at}`} className="flex justify-between gap-2 border-b border-stone-100 pb-2 last:border-0">
                <span className="font-medium">{r.name}</span>
                <span className="muted">
                  +{r.qty} {r.unit}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <BarcodeScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(code) => void applyBarcode(code)}
      />

      <WebPosPinModal
        open={pinOpen}
        onClose={() => setPinOpen(false)}
        onSuccess={(session) => {
          saveWebPosStaffSession(session);
          setPinStaff(session);
          setPinOpen(false);
        }}
      />
    </div>
  );
}
