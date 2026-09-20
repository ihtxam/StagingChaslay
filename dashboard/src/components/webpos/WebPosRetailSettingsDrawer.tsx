import { Settings, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import type { CartSide, PosCheckoutSettings, RetailTileSize } from '@/lib/pos-checkout';
import {
  profileLayoutPatch,
  type RetailRegisterProfile,
} from '@/lib/retail-register-profile';
import type { Product } from './types';

type Props = {
  open: boolean;
  onClose: () => void;
  settings: PosCheckoutSettings;
  products: Product[];
  deviceProfileId: string | null;
  onSave: (next: Partial<PosCheckoutSettings>, deviceProfileId: string | null) => void;
};

export default function WebPosRetailSettingsDrawer({
  open,
  onClose,
  settings,
  products,
  deviceProfileId,
  onSave,
}: Props) {
  const { t } = useI18n();
  const [tileSize, setTileSize] = useState<RetailTileSize>(settings.retailTileSize);
  const [scannerFirst, setScannerFirst] = useState(settings.retailScannerFirst);
  const [paymentBar, setPaymentBar] = useState(settings.retailPaymentBar);
  const [cartSide, setCartSide] = useState<CartSide>(settings.cartSide);
  const [showStock, setShowStock] = useState(settings.retailShowStockOnTiles);
  const [quickTiles, setQuickTiles] = useState<string[]>(settings.retailQuickTiles);
  const [profiles, setProfiles] = useState<RetailRegisterProfile[]>(settings.retailRegisterProfiles);
  const [activeId, setActiveId] = useState<string | null>(deviceProfileId);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products.slice(0, 80);
    return products.filter((p) => p.name.toLowerCase().includes(s) || String(p.sku || '').toLowerCase().includes(s)).slice(0, 80);
  }, [products, q]);

  if (!open) return null;

  const applyProfile = (id: string) => {
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return;
    const patch = profileLayoutPatch(profile);
    setActiveId(id);
    setCartSide(patch.cartSide);
    setTileSize(patch.retailTileSize);
    setScannerFirst(patch.retailScannerFirst);
    setPaymentBar(patch.retailPaymentBar);
    setShowStock(patch.retailShowStockOnTiles);
    setQuickTiles(patch.retailQuickTiles);
  };

  const saveProfileFromCurrent = () => {
    const id = activeId || `reg-${Date.now().toString(36)}`;
    const name =
      profiles.find((p) => p.id === id)?.name ||
      `${t('webPosRetailRegisterProfile')} ${profiles.length + 1}`;
    const next: RetailRegisterProfile = {
      id,
      name,
      cartSide,
      retailTileSize: tileSize,
      retailScannerFirst: scannerFirst,
      retailPaymentBar: paymentBar,
      retailShowStockOnTiles: showStock,
      retailQuickTiles: quickTiles,
    };
    const others = profiles.filter((p) => p.id !== id);
    setProfiles([next, ...others].slice(0, 12));
    setActiveId(id);
  };

  const handleSave = () => {
    onSave(
      {
        retailTileSize: tileSize,
        retailScannerFirst: scannerFirst,
        retailPaymentBar: paymentBar,
        cartSide,
        retailShowStockOnTiles: showStock,
        retailQuickTiles: quickTiles,
        retailRegisterProfiles: profiles,
      },
      activeId
    );
    onClose();
  };

  const toggleTile = (id: string) => {
    setQuickTiles((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 24)
    );
  };

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/40" role="dialog" aria-modal>
      <button type="button" className="h-full flex-1" aria-label={t('close')} onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Settings size={18} aria-hidden />
            {t('webPosRetailTillSettings')}
          </h2>
          <button type="button" className="rounded-lg p-2 hover:bg-stone-100" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">
              {t('webPosRetailRegisterProfile')}
            </p>
            <select
              className="w-full rounded-lg border px-3 py-2"
              value={activeId || ''}
              onChange={(e) => (e.target.value ? applyProfile(e.target.value) : setActiveId(null))}
            >
              <option value="">{t('webPosRetailRegisterProfileNone')}</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-teal-700"
              onClick={saveProfileFromCurrent}
            >
              {t('webPosRetailRegisterProfileSave')}
            </button>
          </section>

          <label className="flex items-center justify-between gap-3">
            <span>{t('posRetailScannerFirst')}</span>
            <input type="checkbox" checked={scannerFirst} onChange={(e) => setScannerFirst(e.target.checked)} />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>{t('posRetailPaymentBar')}</span>
            <input type="checkbox" checked={paymentBar} onChange={(e) => setPaymentBar(e.target.checked)} />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>{t('posRetailShowStockOnTiles')}</span>
            <input type="checkbox" checked={showStock} onChange={(e) => setShowStock(e.target.checked)} />
          </label>

          <div>
            <p className="mb-1 font-semibold">{t('posCartSide')}</p>
            <div className="flex gap-2">
              {(['right', 'left'] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  className={`flex-1 rounded-lg border px-3 py-2 font-semibold ${
                    cartSide === side ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-stone-200'
                  }`}
                  onClick={() => setCartSide(side)}
                >
                  {side === 'right' ? t('posCartSideRight') : t('posCartSideLeft')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 font-semibold">{t('posRetailTileSize')}</p>
            <div className="flex gap-2">
              {(['sm', 'md', 'lg'] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`flex-1 rounded-lg border px-3 py-2 font-semibold ${
                    tileSize === size ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-stone-200'
                  }`}
                  onClick={() => setTileSize(size)}
                >
                  {size === 'sm' ? t('posRetailTileSmall') : size === 'md' ? t('posRetailTileMedium') : t('posRetailTileLarge')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 font-semibold">{t('posRetailQuickTiles')}</p>
            <p className="mb-2 text-xs text-stone-500">{t('posRetailQuickTilesHint')}</p>
            <input
              className="mb-2 w-full rounded-lg border px-3 py-2"
              placeholder={t('webPosSearchProducts')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-1">
              {filtered.map((p) => (
                <li key={p.id}>
                  <label className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={quickTiles.includes(p.id)}
                      onChange={() => toggleTile(p.id)}
                    />
                    <span className="truncate">{p.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t p-3">
          <button
            type="button"
            className="w-full rounded-xl bg-teal-700 py-3 text-sm font-bold text-white"
            onClick={handleSave}
          >
            {t('save')}
          </button>
        </div>
      </aside>
    </div>
  );
}
