import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import ZoneMapEditor, {
  leafletToLngLat,
  lngLatToLeaflet,
  type LatLngTuple,
  type LngLatTuple,
} from '@/components/ZoneMapEditor';
import { useI18n } from '@/lib/i18n';
import ShopPublicLinks from '@/components/merchant/ShopPublicLinks';

/** Reject empty / Null Island (0,0) so the map does not open in the ocean. */
function parseStoreCoords(latRaw: unknown, lngRaw: unknown): LatLngTuple | null {
  if (latRaw == null || lngRaw == null || latRaw === '' || lngRaw === '') return null;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) < 1e-5 && Math.abs(lng) < 1e-5) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

const DEFAULT_MAP_CENTER: LatLngTuple = [46.8182, 8.2275]; // Switzerland overview

interface Zone {
  id: string;
  name: string;
  polygon: LngLatTuple[];
  minOrderAmount: string;
  deliveryFee: string;
  estimatedMinutes?: number | null;
  color?: string | null;
  isActive: boolean;
  zipCodes?: string[];
}

interface ZipRule {
  id: string;
  name: string;
  zipCode?: string | null;
  zipFrom?: string | null;
  zipTo?: string | null;
  minOrderAmount: string;
  deliveryFee: string;
  estimatedMinutes?: number | null;
  isActive: boolean;
}

function resetZipRuleForm() {
  return {
    ruleName: '',
    ruleZipCode: '',
    ruleZipFrom: '',
    ruleZipTo: '',
    ruleMinOrder: '20',
    ruleDeliveryFee: '5',
    ruleEta: '45',
    editingZipRuleId: null as string | null,
  };
}

function resetZoneForm() {
  return {
    zoneName: '',
    minOrder: '20',
    deliveryFee: '5',
    eta: '45',
    color: '#0d9488',
    zipCodes: '',
    draftRing: [] as LatLngTuple[],
    editingId: null as string | null,
  };
}

export default function OnlineShop() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [savingShop, setSavingShop] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zipRules, setZipRules] = useState<ZipRule[]>([]);

  const [zoneName, setZoneName] = useState('');
  const [minOrder, setMinOrder] = useState('20');
  const [deliveryFee, setDeliveryFee] = useState('5');
  const [eta, setEta] = useState('45');
  const [color, setColor] = useState('#0d9488');
  const [zipCodes, setZipCodes] = useState('');
  const [draftRing, setDraftRing] = useState<LatLngTuple[]>([]);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [savingZone, setSavingZone] = useState(false);
  const [keepExistingPolygon, setKeepExistingPolygon] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleZipCode, setRuleZipCode] = useState('');
  const [ruleZipFrom, setRuleZipFrom] = useState('');
  const [ruleZipTo, setRuleZipTo] = useState('');
  const [ruleMinOrder, setRuleMinOrder] = useState('20');
  const [ruleDeliveryFee, setRuleDeliveryFee] = useState('5');
  const [ruleEta, setRuleEta] = useState('45');
  const [editingZipRuleId, setEditingZipRuleId] = useState<string | null>(null);
  const [savingZipRule, setSavingZipRule] = useState(false);
  const [locatingStore, setLocatingStore] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);

  const storeCoords = useMemo(
    () => parseStoreCoords(settings?.latitude, settings?.longitude),
    [settings?.latitude, settings?.longitude]
  );

  const mapCenter = useMemo<LatLngTuple>(() => storeCoords || DEFAULT_MAP_CENTER, [storeCoords]);

  const otherZones = useMemo(
    () => zones.filter((z) => z.id !== editingZoneId),
    [zones, editingZoneId]
  );

  const deliveryMode = settings?.deliveryMode === 'zipcode' ? 'zipcode' : 'zones';

  const load = async () => {
    try {
      const [s, z, zipRes] = await Promise.all([
        api.get('/merchant/settings'),
        api.get('/delivery-zones'),
        api.get('/delivery-zip-rules'),
      ]);
      const settingsData = s.data.settings;
      setSettings(settingsData);
      setZones(z.data.zones || []);
      setZipRules(zipRes.data.rules || []);
      return settingsData;
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load shop settings');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const locateStoreFromAddress = async (opts?: { silent?: boolean; settingsOverride?: any }) => {
    const src = opts?.settingsOverride || settings;
    if (!src) return null;
    setLocatingStore(true);
    try {
      const query = [src.address, src.city, src.country || 'Switzerland']
        .map((p: unknown) => String(p || '').trim())
        .filter(Boolean)
        .join(', ');
      if (!query) {
        if (!opts?.silent) toast.error('Set your business address in Settings first');
        return null;
      }
      const res = await api.post('/merchant/geocode', { query });
      if (!res.data.found) {
        if (!opts?.silent) toast.error('Could not find that address on the map');
        return null;
      }
      const lat = Number(res.data.lat);
      const lng = Number(res.data.lng);
      const coords = parseStoreCoords(lat, lng);
      if (!coords) {
        if (!opts?.silent) toast.error('Invalid coordinates for address');
        return null;
      }
      setSettings((prev: any) =>
        prev ? { ...prev, latitude: String(coords[0]), longitude: String(coords[1]) } : prev
      );
      // Persist so the next visit opens on the store
      try {
        await api.put('/merchant/settings', {
          latitude: coords[0],
          longitude: coords[1],
        });
      } catch {
        /* keep UI coords even if save fails */
      }
      if (!opts?.silent) toast.success('Map centered on store address');
      return coords;
    } catch (error: any) {
      if (!opts?.silent) {
        toast.error(error.response?.data?.error || 'Could not locate store address');
      }
      return null;
    } finally {
      setLocatingStore(false);
    }
  };

  useEffect(() => {
    void (async () => {
      const settingsData = await load();
      if (!settingsData) return;
      if (parseStoreCoords(settingsData.latitude, settingsData.longitude)) return;
      const hasAddress = Boolean(
        String(settingsData.address || '').trim() || String(settingsData.city || '').trim()
      );
      if (hasAddress) {
        await locateStoreFromAddress({ silent: true, settingsOverride: settingsData });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadShopImage = async (file: File | null, kind: 'logo' | 'banner') => {
    if (!file) return;
    const setBusy = kind === 'logo' ? setUploadingLogo : setUploadingBanner;
    setBusy(true);
    try {
      const compressed = await compressImageIfNeeded(file, {
        maxBytes: 350 * 1024,
        targetBytes: 350 * 1024,
        maxWidth: kind === 'banner' ? 1600 : 800,
      });
      const fd = new FormData();
      fd.append('file', compressed);
      const res = await api.post('/merchant/media', fd);
      const url = res.data.url || '';
      const patch =
        kind === 'logo' ? { shopLogoUrl: url || null } : { shopBannerUrl: url || null };
      setSettings((prev: any) => (prev ? { ...prev, ...patch } : prev));
      await api.put('/merchant/settings', patch);
      toast.success(kind === 'logo' ? 'Logo uploaded' : 'Banner uploaded');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Upload failed');
    } finally {
      setBusy(false);
      if (kind === 'logo' && logoFileRef.current) logoFileRef.current.value = '';
      if (kind === 'banner' && bannerFileRef.current) bannerFileRef.current.value = '';
    }
  };

  const clearShopImage = async (kind: 'logo' | 'banner') => {
    const patch =
      kind === 'logo' ? { shopLogoUrl: null } : { shopBannerUrl: null };
    try {
      setSettings((prev: any) => (prev ? { ...prev, ...patch } : prev));
      await api.put('/merchant/settings', patch);
      toast.success(kind === 'logo' ? 'Logo removed' : 'Banner removed');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Could not remove image');
    }
  };

  const onSaveShopMeta = async (e: FormEvent) => {
    e.preventDefault();
    setSavingShop(true);
    try {
      const response = await api.put('/merchant/settings', {
        shopEnabled: settings.shopEnabled,
        pickupEnabled: settings.pickupEnabled,
        dineInEnabled: settings.dineInEnabled,
        deliveryEnabled: settings.deliveryEnabled,
        deliveryMode: settings.deliveryMode || 'zones',
        channelSelectMode: settings.channelSelectMode || 'checkout',
        menuShowProductImages: settings.menuShowProductImages !== false,
        menuShowCategoryBanners: settings.menuShowCategoryBanners !== false,
        cartLayout: settings.cartLayout || 'hidden_slide',
        scheduledOrdersEnabled: settings.scheduledOrdersEnabled !== false,
        latitude: settings.latitude,
        longitude: settings.longitude,
        pickupEtaMinutes: Number(settings.pickupEtaMinutes || 25),
        deliveryEtaMinutes: Number(settings.deliveryEtaMinutes || 45),
        minPreOrderDelayMinutes: Number(settings.minPreOrderDelayMinutes ?? 30),
        deliveryMenuMarkup: Number(settings.deliveryMenuMarkup || 0),
        categoryPricingEnabled: !!settings.categoryPricingEnabled,
        shopLogoUrl: settings.shopLogoUrl,
        shopBannerUrl: settings.shopBannerUrl,
        slug: settings.slug,
        subdomain: settings.subdomain,
      });
      setSettings((prev: any) => ({ ...prev, ...(response.data.merchant || {}) }));
      toast.success(t('onlineShopSaved'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Save failed');
    } finally {
      setSavingShop(false);
    }
  };

  const clearZoneEditor = () => {
    const reset = resetZoneForm();
    setZoneName(reset.zoneName);
    setMinOrder(reset.minOrder);
    setDeliveryFee(reset.deliveryFee);
    setEta(reset.eta);
    setColor(reset.color);
    setZipCodes(reset.zipCodes);
    setDraftRing(reset.draftRing);
    setEditingZoneId(null);
    setKeepExistingPolygon(false);
  };

  const startEditZone = (zone: Zone) => {
    setEditingZoneId(zone.id);
    setZoneName(zone.name);
    setMinOrder(String(zone.minOrderAmount ?? '0'));
    setDeliveryFee(String(zone.deliveryFee ?? '0'));
    setEta(String(zone.estimatedMinutes ?? 45));
    setColor(zone.color || '#0d9488');
    setZipCodes((zone.zipCodes || []).join(', '));
    // Load polygon into draft for visual edit; keep flag so save works without redraw
    const ring = lngLatToLeaflet(zone.polygon || []);
    // Drop closing duplicate point if present
    const openRing =
      ring.length > 1 &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1]
        ? ring.slice(0, -1)
        : ring;
    setDraftRing(openRing);
    setKeepExistingPolygon(true);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const onSaveZone = async (e: FormEvent) => {
    e.preventDefault();
    const editing = !!editingZoneId;
    const hasDraft = draftRing.length >= 3;
    if (!editing && !hasDraft) {
      toast.error('Draw at least 3 points on the map');
      return;
    }
    if (editing && !hasDraft && !keepExistingPolygon) {
      toast.error('Draw at least 3 points, or keep the existing shape');
      return;
    }

    setSavingZone(true);
    try {
      const payload: Record<string, unknown> = {
        name: zoneName,
        minOrderAmount: Number(minOrder),
        deliveryFee: Number(deliveryFee),
        estimatedMinutes: Number(eta),
        color,
        zipCodes: zipCodes
          .split(',')
          .map((z) => z.trim())
          .filter(Boolean),
      };
      if (hasDraft) {
        payload.polygon = leafletToLngLat(draftRing);
      }

      if (editingZoneId) {
        await api.put(`/delivery-zones/${editingZoneId}`, payload);
        toast.success('Delivery zone updated');
      } else {
        await api.post('/delivery-zones', payload);
        toast.success('Delivery zone created');
      }
      clearZoneEditor();
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save zone');
    } finally {
      setSavingZone(false);
    }
  };

  const onDeleteZone = async (id: string) => {
    if (!confirm('Delete this delivery zone?')) return;
    try {
      await api.delete(`/delivery-zones/${id}`);
      toast.success('Deleted');
      if (editingZoneId === id) clearZoneEditor();
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Delete failed');
    }
  };

  const clearZipRuleEditor = () => {
    const reset = resetZipRuleForm();
    setRuleName(reset.ruleName);
    setRuleZipCode(reset.ruleZipCode);
    setRuleZipFrom(reset.ruleZipFrom);
    setRuleZipTo(reset.ruleZipTo);
    setRuleMinOrder(reset.ruleMinOrder);
    setRuleDeliveryFee(reset.ruleDeliveryFee);
    setRuleEta(reset.ruleEta);
    setEditingZipRuleId(null);
  };

  const startEditZipRule = (rule: ZipRule) => {
    setEditingZipRuleId(rule.id);
    setRuleName(rule.name);
    setRuleZipCode(rule.zipCode || '');
    setRuleZipFrom(rule.zipFrom || '');
    setRuleZipTo(rule.zipTo || '');
    setRuleMinOrder(String(rule.minOrderAmount ?? '0'));
    setRuleDeliveryFee(String(rule.deliveryFee ?? '0'));
    setRuleEta(String(rule.estimatedMinutes ?? 45));
  };

  const onSaveZipRule = async (e: FormEvent) => {
    e.preventDefault();
    const hasExact = !!ruleZipCode.trim();
    const hasRange = !!ruleZipFrom.trim() && !!ruleZipTo.trim();
    if (!hasExact && !hasRange) {
      toast.error('Enter a ZIP code or a ZIP range');
      return;
    }
    if (hasExact && hasRange) {
      toast.error('Use either a single ZIP code or a range, not both');
      return;
    }

    setSavingZipRule(true);
    try {
      const payload = {
        name: ruleName,
        zipCode: hasExact ? ruleZipCode.trim() : undefined,
        zipFrom: hasRange ? ruleZipFrom.trim() : undefined,
        zipTo: hasRange ? ruleZipTo.trim() : undefined,
        minOrderAmount: Number(ruleMinOrder),
        deliveryFee: Number(ruleDeliveryFee),
        estimatedMinutes: Number(ruleEta),
      };
      if (editingZipRuleId) {
        await api.put(`/delivery-zip-rules/${editingZipRuleId}`, payload);
        toast.success('ZIP rule updated');
      } else {
        await api.post('/delivery-zip-rules', payload);
        toast.success('ZIP rule created');
      }
      clearZipRuleEditor();
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save ZIP rule');
    } finally {
      setSavingZipRule(false);
    }
  };

  const onDeleteZipRule = async (id: string) => {
    if (!confirm('Delete this ZIP rule?')) return;
    try {
      await api.delete(`/delivery-zip-rules/${id}`);
      toast.success('Deleted');
      if (editingZipRuleId === id) clearZipRuleEditor();
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Delete failed');
    }
  };

  if (loading) return <div className="text-center py-12">{t('loading')}</div>;
  if (!settings) return <div className="card">{t('cmsLoadFailed')}</div>;

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold mb-1">{t('shop')}</h1>
        <p className="text-gray-600 mb-4">{t('onlineShopPageHint')}</p>
        <ShopPublicLinks
          shopPathUrl={settings.shopPathUrl}
          shopMenuUrl={settings.shopMenuUrl}
          shopPanelPathUrl={settings.shopPanelPathUrl}
          shopSubdomainUrl={settings.shopSubdomainUrl}
          shopCustomDomainUrl={settings.shopCustomDomainUrl}
          className="mb-4"
        />

        <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 mb-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">{t('shopHoursNavTitle')}</h2>
            <p className="text-xs text-stone-600 mt-0.5">{t('shopHoursNavHint')}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link to="/merchant/settings?tab=hours" className="btn-secondary text-sm">
              {t('shopHoursNavOpening')}
            </Link>
            <Link to="/merchant/settings?tab=reservations" className="btn-secondary text-sm">
              {t('shopHoursNavReservations')}
            </Link>
            <Link to="/merchant/settings?tab=business#business-vacation" className="btn-secondary text-sm">
              {t('shopHoursNavVacation')}
            </Link>
          </div>
          <p className="text-xs text-stone-600">{t('shopHoursNavPos')}</p>
        </div>

        <form onSubmit={onSaveShopMeta} className="space-y-5">
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!settings.shopEnabled}
                onChange={(e) => setSettings({ ...settings, shopEnabled: e.target.checked })}
              />
              Shop enabled
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!settings.pickupEnabled}
                onChange={(e) => setSettings({ ...settings, pickupEnabled: e.target.checked })}
              />
              Pickup
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!settings.dineInEnabled}
                onChange={(e) => setSettings({ ...settings, dineInEnabled: e.target.checked })}
              />
              Dine in
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!settings.deliveryEnabled}
                onChange={(e) => setSettings({ ...settings, deliveryEnabled: e.target.checked })}
              />
              Delivery
            </label>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-2">
            <label className="block text-sm font-medium">Ask pickup / delivery / dine-in</label>
            <p className="text-xs text-stone-500 leading-snug">
              Cleaner shops ask at checkout. Use a start popup if guests should choose before browsing.
            </p>
            <select
              className="input max-w-md"
              value={settings.channelSelectMode || 'checkout'}
              onChange={(e) => setSettings({ ...settings, channelSelectMode: e.target.value })}
            >
              <option value="checkout">At checkout (recommended)</option>
              <option value="popup_start">Popup when opening the menu</option>
              <option value="menu">Buttons on the menu page</option>
            </select>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-2">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={settings.scheduledOrdersEnabled !== false}
                onChange={(e) => setSettings({ ...settings, scheduledOrdersEnabled: e.target.checked })}
              />
              <span>
                <span className="font-medium block">Allow programmed / scheduled orders</span>
                <span className="text-xs text-stone-500 leading-snug block mt-0.5">
                  When off, customers can only order during opening hours (no “order for later”).
                </span>
              </span>
            </label>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-3">
            <div>
              <p className="text-sm font-medium">Shop branding</p>
              <p className="text-xs text-stone-500 mt-0.5">
                Logo appears in the header. Banner is the wide image at the top of the menu.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Logo
                </span>
                {settings.shopLogoUrl ? (
                  <img
                    src={settings.shopLogoUrl}
                    alt=""
                    className="h-14 w-auto max-w-full object-contain rounded border border-stone-200 bg-stone-50 p-1"
                  />
                ) : (
                  <div className="h-14 rounded border border-dashed border-stone-300 bg-stone-50 flex items-center justify-center text-xs text-stone-400">
                    No logo
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={logoFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => void uploadShopImage(e.target.files?.[0] || null, 'logo')}
                  />
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    disabled={uploadingLogo}
                    onClick={() => logoFileRef.current?.click()}
                  >
                    {uploadingLogo ? 'Uploading…' : 'Upload logo'}
                  </button>
                  {settings.shopLogoUrl ? (
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      onClick={() => void clearShopImage('logo')}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Menu banner
                </span>
                {settings.shopBannerUrl ? (
                  <img
                    src={settings.shopBannerUrl}
                    alt=""
                    className="h-20 w-full object-cover rounded border border-stone-200 bg-stone-50"
                  />
                ) : (
                  <div className="h-20 rounded border border-dashed border-stone-300 bg-stone-50 flex items-center justify-center text-xs text-stone-400">
                    No banner
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={bannerFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => void uploadShopImage(e.target.files?.[0] || null, 'banner')}
                  />
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    disabled={uploadingBanner}
                    onClick={() => bannerFileRef.current?.click()}
                  >
                    {uploadingBanner ? 'Uploading…' : 'Upload banner'}
                  </button>
                  {settings.shopBannerUrl ? (
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      onClick={() => void clearShopImage('banner')}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-2">
            <label className="block text-sm font-medium">{t('shopCartLayout')}</label>
            <p className="text-xs text-stone-500 leading-snug">{t('shopCartLayoutHint')}</p>
            <select
              className="input max-w-md"
              value={settings.cartLayout || 'hidden_slide'}
              onChange={(e) => setSettings({ ...settings, cartLayout: e.target.value })}
            >
              <option value="hidden_slide">{t('shopCartLayoutHiddenSlide')}</option>
              <option value="sticky_right">{t('shopCartLayoutStickyRight')}</option>
            </select>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-2">
            <p className="text-sm font-medium">Menu photos</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.menuShowProductImages !== false}
                onChange={(e) => setSettings({ ...settings, menuShowProductImages: e.target.checked })}
              />
              Show product photos
            </label>
            <p className="text-xs text-stone-500">
              Photos uploaded on Products appear on the online shop menu. Uncheck to hide them (POS keeps its own display).
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.menuShowCategoryBanners !== false}
                onChange={(e) => setSettings({ ...settings, menuShowCategoryBanners: e.target.checked })}
              />
              Show category banner photos
            </label>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={async () => {
                try {
                  const res = await api.post('/merchant/demo-menu-photos');
                  toast.success(
                    `Demo photos applied (${res.data.productsUpdated || 0} products, ${
                      res.data.categoriesUpdated || 0
                    } categories)`
                  );
                } catch (e: any) {
                  toast.error(e.response?.data?.error || 'Could not apply demo photos');
                }
              }}
            >
              Load demo photos (compressed)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Pickup ETA (min)</label>
              <input
                className="input"
                type="number"
                value={settings.pickupEtaMinutes ?? 25}
                onChange={(e) => setSettings({ ...settings, pickupEtaMinutes: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Delivery ETA (min)</label>
              <input
                className="input"
                type="number"
                value={settings.deliveryEtaMinutes ?? 45}
                onChange={(e) => setSettings({ ...settings, deliveryEtaMinutes: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Min pre-order delay (min)</label>
              <input
                className="input"
                type="number"
                min={0}
                value={settings.minPreOrderDelayMinutes ?? 30}
                onChange={(e) =>
                  setSettings({ ...settings, minPreOrderDelayMinutes: e.target.value })
                }
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <input
                  type="checkbox"
                  checked={!!settings.categoryPricingEnabled}
                  onChange={(e) =>
                    setSettings({ ...settings, categoryPricingEnabled: e.target.checked })
                  }
                />
                Enable category pricing
              </label>
              <p className="text-xs text-stone-500 mb-3">
                When enabled, delivery item prices use per-category extra charges instead of the flat
                delivery menu markup below. Configure each category under Products → Categories.
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Delivery menu markup (CHF)
              </label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={settings.deliveryMenuMarkup ?? 0}
                onChange={(e) => setSettings({ ...settings, deliveryMenuMarkup: e.target.value })}
                placeholder="0"
                disabled={!!settings.categoryPricingEnabled}
              />
              <p className="text-xs text-stone-500 mt-1">
                {settings.categoryPricingEnabled
                  ? 'Disabled while category pricing is enabled. Set extra delivery prices per category instead.'
                  : 'Added to every item for delivery (e.g. 2.00 → delivery prices = takeaway + 2.00). Zone delivery fee is separate.'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Store latitude</label>
              <input
                className="input"
                value={settings.latitude || ''}
                onChange={(e) => setSettings({ ...settings, latitude: e.target.value })}
                placeholder="46.99"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Store longitude</label>
              <input
                className="input"
                value={settings.longitude || ''}
                onChange={(e) => setSettings({ ...settings, longitude: e.target.value })}
                placeholder="6.93"
              />
            </div>
            <div className="md:col-span-2 flex flex-wrap items-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={locatingStore}
                onClick={() => void locateStoreFromAddress()}
              >
                {locatingStore ? 'Locating…' : 'Locate from business address'}
              </button>
              <p className="text-xs text-stone-500">
                Uses the address from Settings → Business. The delivery map opens on this pin.
              </p>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={savingShop}>
            {savingShop ? t('saving') : t('save')}
          </button>
        </form>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{t('deliveryMode')}</h2>
            <p className="text-gray-600 text-sm">{t('deliveryModeHint')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="deliveryMode"
              checked={deliveryMode === 'zones'}
              onChange={() => setSettings({ ...settings, deliveryMode: 'zones' })}
            />
            {t('deliveryModeZones')}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="deliveryMode"
              checked={deliveryMode === 'zipcode'}
              onChange={() => setSettings({ ...settings, deliveryMode: 'zipcode' })}
            />
            {t('deliveryModeZipcode')}
          </label>
        </div>
        <p className="text-xs text-stone-500">
          Save shop settings above after changing the delivery mode.
        </p>
      </div>

      {deliveryMode === 'zones' ? (
      <div className="card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{t('deliveryZones')}</h2>
            <p className="text-gray-600 text-sm">
              Draw or edit zones on the map. Set minimum order and delivery fee per zone.
              Menu markup for delivery items is set above (takeaway price + CHF).
            </p>
          </div>
          {editingZoneId && (
            <button type="button" className="btn-secondary" onClick={clearZoneEditor}>
              Cancel edit
            </button>
          )}
        </div>

        <ZoneMapEditor
          center={mapCenter}
          zoom={storeCoords ? 15 : 8}
          storeMarker={storeCoords}
          existingZones={otherZones}
          draftRing={draftRing}
          onDraftChange={(ring) => {
            setDraftRing(ring);
            // Clearing while editing keeps the saved polygon unless a new shape is drawn
            if (ring.length === 0 && editingZoneId) {
              setKeepExistingPolygon(true);
            } else if (ring.length > 0) {
              setKeepExistingPolygon(false);
            }
          }}
        />

        <form onSubmit={onSaveZone} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-3 text-sm font-medium">
            {editingZoneId ? 'Editing zone' : 'New zone'}
            {editingZoneId && keepExistingPolygon && draftRing.length >= 3 && (
              <span className="text-gray-500 font-normal"> - existing shape loaded (redraw optional)</span>
            )}
          </div>
          <input
            className="input"
            placeholder="Zone name (Center)"
            value={zoneName}
            onChange={(e) => setZoneName(e.target.value)}
            required
          />
          <input
            className="input"
            type="number"
            step="0.01"
            placeholder="Min order CHF"
            value={minOrder}
            onChange={(e) => setMinOrder(e.target.value)}
            required
          />
          <input
            className="input"
            type="number"
            step="0.01"
            placeholder="Delivery fee CHF"
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(e.target.value)}
            required
          />
          <input
            className="input"
            type="number"
            placeholder="ETA minutes"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
          />
          <input
            className="input"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            title="Zone color"
          />
          <input
            className="input"
            placeholder="ZIP codes (optional, comma-separated)"
            value={zipCodes}
            onChange={(e) => setZipCodes(e.target.value)}
          />
          <div className="md:col-span-3 flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={savingZone}>
              {savingZone
                ? 'Saving…'
                : editingZoneId
                  ? `Update zone (${draftRing.length} points)`
                  : `Save zone (${draftRing.length} points)`}
            </button>
            {editingZoneId && (
              <button type="button" className="btn-secondary" onClick={clearZoneEditor}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Zone</th>
              <th className="py-2">Min order</th>
              <th className="py-2">Fee</th>
              <th className="py-2">ETA</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {zones.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-gray-500">
                  No zones yet - draw one on the map.
                </td>
              </tr>
            )}
            {zones.map((z) => (
              <tr
                key={z.id}
                className={`border-b last:border-0 ${editingZoneId === z.id ? 'bg-amber-50' : ''}`}
              >
                <td className="py-3 font-medium">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-sm"
                      style={{ background: z.color || '#0d9488' }}
                    />
                    {z.name}
                  </span>
                </td>
                <td className="py-3">CHF {Number(z.minOrderAmount).toFixed(2)}</td>
                <td className="py-3">CHF {Number(z.deliveryFee).toFixed(2)}</td>
                <td className="py-3">{z.estimatedMinutes || 45} min</td>
                <td className="py-3 text-right space-x-3">
                  <button type="button" className="text-blue-600 hover:underline" onClick={() => startEditZone(z)}>
                    Edit
                  </button>
                  <button type="button" className="text-red-600 hover:underline" onClick={() => onDeleteZone(z.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      ) : (
      <div className="card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{t('deliveryZipRules')}</h2>
            <p className="text-gray-600 text-sm">{t('deliveryZipRulesHint')}</p>
          </div>
          {editingZipRuleId && (
            <button type="button" className="btn-secondary" onClick={clearZipRuleEditor}>
              Cancel edit
            </button>
          )}
        </div>

        <form onSubmit={onSaveZipRule} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-3 text-sm font-medium">
            {editingZipRuleId ? 'Editing ZIP rule' : 'New ZIP rule'}
          </div>
          <input
            className="input"
            placeholder={t('deliveryZipRuleLabel')}
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            required
          />
          <input
            className="input"
            placeholder={t('deliveryZipCode')}
            value={ruleZipCode}
            onChange={(e) => setRuleZipCode(e.target.value)}
            disabled={!!ruleZipFrom.trim() || !!ruleZipTo.trim()}
          />
          <input
            className="input"
            placeholder={t('deliveryZipFrom')}
            value={ruleZipFrom}
            onChange={(e) => setRuleZipFrom(e.target.value)}
            disabled={!!ruleZipCode.trim()}
          />
          <input
            className="input"
            placeholder={t('deliveryZipTo')}
            value={ruleZipTo}
            onChange={(e) => setRuleZipTo(e.target.value)}
            disabled={!!ruleZipCode.trim()}
          />
          <input
            className="input"
            type="number"
            step="0.01"
            placeholder="Min order CHF"
            value={ruleMinOrder}
            onChange={(e) => setRuleMinOrder(e.target.value)}
            required
          />
          <input
            className="input"
            type="number"
            step="0.01"
            placeholder="Delivery fee CHF"
            value={ruleDeliveryFee}
            onChange={(e) => setRuleDeliveryFee(e.target.value)}
            required
          />
          <input
            className="input"
            type="number"
            placeholder="ETA minutes"
            value={ruleEta}
            onChange={(e) => setRuleEta(e.target.value)}
          />
          <div className="md:col-span-3 flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={savingZipRule}>
              {savingZipRule ? 'Saving…' : editingZipRuleId ? 'Update ZIP rule' : 'Save ZIP rule'}
            </button>
            {editingZipRuleId && (
              <button type="button" className="btn-secondary" onClick={clearZipRuleEditor}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Rule</th>
              <th className="py-2">ZIP</th>
              <th className="py-2">Min order</th>
              <th className="py-2">Fee</th>
              <th className="py-2">ETA</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {zipRules.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-gray-500">
                  No ZIP rules yet — add one above.
                </td>
              </tr>
            )}
            {zipRules.map((rule) => (
              <tr
                key={rule.id}
                className={`border-b last:border-0 ${editingZipRuleId === rule.id ? 'bg-amber-50' : ''}`}
              >
                <td className="py-3 font-medium">{rule.name}</td>
                <td className="py-3">
                  {rule.zipCode
                    ? rule.zipCode
                    : rule.zipFrom && rule.zipTo
                      ? `${rule.zipFrom}–${rule.zipTo}`
                      : '—'}
                </td>
                <td className="py-3">CHF {Number(rule.minOrderAmount).toFixed(2)}</td>
                <td className="py-3">CHF {Number(rule.deliveryFee).toFixed(2)}</td>
                <td className="py-3">{rule.estimatedMinutes || 45} min</td>
                <td className="py-3 text-right space-x-3">
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => startEditZipRule(rule)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-red-600 hover:underline"
                    onClick={() => onDeleteZipRule(rule.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
