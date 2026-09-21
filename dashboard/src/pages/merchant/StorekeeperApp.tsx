import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  ImagePlus,
  Package,
  Pencil,
  Plus,
  Printer,
  ScanLine,
  Sparkles,
  UserCircle2,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth';
import WebPosPinModal from '@/components/WebPosPinModal';
import BarcodeScanModal from '@/components/storekeeper/BarcodeScanModal';
import {
  normalizeLabelOptions,
  parseLabelHeightMm,
  parseLabelWidthMm,
  printLabelsViaAgentOrQueue,
  type LabelPrintOptions,
} from '@/lib/barcode-labels';
import { stripScannerControlChars } from '@/lib/product-scan-codes';
import { BARCODE_FIELD_INPUT_CLASS } from '@/lib/barcode-wedge';
import type { PosPrintSettingsClient } from '@/lib/webpos-receipt';
import {
  clearWebPosStaffSession,
  hasPermission,
  isStorekeeperOnlyStaff,
  isStorekeeperRestrictedStaff,
  jwtHasPanelAccess,
  loadWebPosStaffSession,
  notifyWebPosStaffSessionChanged,
  saveWebPosStaffSession,
  type Permission,
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
  stock?: number;
};

type LookupSuggestion = {
  name: string;
  brand?: string | null;
  categoryHint?: string | null;
  categoryId?: string | null;
  packageSize?: string | null;
  unit?: string | null;
  weightGrams?: number | null;
  imageUrl?: string | null;
  source?: string;
};

type SessionIntakeEntry = {
  sessionId: string;
  itemId: string;
  barcode: string;
  name: string;
  qty: number;
  unit: string;
  categoryId: string;
  categoryName: string;
  expiryDate: string;
  salePrice: string;
  photoUrl: string | null;
  lotId: string | null;
  at: string;
};

function fillI18n(template: string, values: Record<string, string | number>) {
  let out = template;
  for (const [key, value] of Object.entries(values)) {
    out = out.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return out;
}

function formatStockQty(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(3).replace(/\.?0+$/, '');
}

function stockLabel(qty: unknown, unitCode: string, units: Unit[]): string {
  const amount = formatStockQty(qty);
  const unitName = units.find((u) => u.code === unitCode)?.name || unitCode;
  return `${amount} ${unitName}`;
}

function newSessionId(): string {
  return `sk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function qtyFromSuggestion(ext: LookupSuggestion | null): string {
  if (!ext) return '1';
  const pkg = String(ext.packageSize || '').trim();
  const multi = pkg.match(/^(\d+(?:[.,]\d+)?)\s*(x|×)/i);
  if (multi) return multi[1]!.replace(',', '.');
  const pieces = pkg.match(/^(\d+(?:[.,]\d+)?)\s*(pcs|pieces|piece|pack|pk|unit|units)\b/i);
  if (pieces) return pieces[1]!.replace(',', '.');
  return '1';
}

function onlinePhotoUrl(ext: LookupSuggestion | null, menu: MenuProduct | null): string | null {
  return ext?.imageUrl || menu?.imageUrl || null;
}

type SavedLabel = {
  id: string;
  name: string;
  barcode: string;
  price?: string;
};

const FALLBACK_UNITS: Unit[] = [
  { code: 'kg', name: 'Kilogram' },
  { code: 'g', name: 'Gram' },
  { code: 'L', name: 'Liter' },
  { code: 'ml', name: 'Milliliter' },
  { code: 'piece', name: 'Piece' },
  { code: 'pack', name: 'Pack' },
];

export default function StorekeeperApp() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [pinStaff, setPinStaff] = useState<WebPosStaffSession | null>(() => loadWebPosStaffSession());
  const [pinOpen, setPinOpen] = useState(false);
  const [pinMode, setPinMode] = useState<'gate' | 'switch'>('gate');
  const [licensed, setLicensed] = useState<boolean | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>(FALLBACK_UNITS);
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
  const [sessionEntries, setSessionEntries] = useState<SessionIntakeEntry[]>([]);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [defaultCategoryId, setDefaultCategoryId] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoSource, setPhotoSource] = useState<'upload' | 'online' | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [currentMenuPhoto, setCurrentMenuPhoto] = useState<string | null>(null);
  const [existingAction, setExistingAction] = useState<'stock' | 'expiry' | 'photo'>('stock');
  const [newProductMode, setNewProductMode] = useState(false);
  const photoFileRef = useRef<HTMLInputElement>(null);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [labelOpts, setLabelOpts] = useState<LabelPrintOptions>({ showPrice: true });
  const [posPrintSettings, setPosPrintSettings] = useState<PosPrintSettingsClient | null>(null);
  const [pendingLabel, setPendingLabel] = useState<SavedLabel | null>(null);
  const scanBufferRef = useRef('');
  const scanTimerRef = useRef<number | null>(null);

  const staffAccessToken = pinStaff?.accessToken;
  const displayName = pinStaff?.name || user?.name;
  const jwtIsOwner = user?.role === 'merchant' && user?.isOwner !== false;
  const effectivePerms = (pinStaff?.permissions ?? user?.permissions) as Permission[] | undefined;
  const actingAsOwner = !pinStaff && jwtIsOwner;
  const managerPanelAccess = jwtHasPanelAccess(
    user?.permissions as Permission[] | undefined,
    jwtIsOwner,
    user?.role
  );
  const canReturnToInventoryPanel =
    !isStorekeeperOnlyStaff(effectivePerms, actingAsOwner) &&
    !isStorekeeperRestrictedStaff(effectivePerms, actingAsOwner) &&
    (actingAsOwner ||
      hasPermission(effectivePerms, 'MANAGE_INVENTORY', false) ||
      hasPermission(effectivePerms, 'ACCESS_PANEL', false));
  const canEditSession =
    actingAsOwner || hasPermission(effectivePerms, 'STOREKEEPER_EDIT_INTAKE', false);
  const clockedIn = !!pinStaff || managerPanelAccess;
  const showBackToPanel = canReturnToInventoryPanel;
  const pinLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const returnToPanel = useCallback(() => {
    if (pinStaff) {
      clearWebPosStaffSession();
      notifyWebPosStaffSessionChanged();
      setPinStaff(null);
    }
    if (hasPermission(effectivePerms, 'MANAGE_INVENTORY', false) || actingAsOwner) {
      navigate('/merchant/inventory');
      return;
    }
    if (hasPermission(effectivePerms, 'ACCESS_PANEL', false)) {
      navigate('/merchant');
    }
  }, [pinStaff, navigate, effectivePerms, actingAsOwner]);

  const apiHeaders = staffAccessToken ? { 'X-WebPos-Staff-Access': staffAccessToken } : undefined;

  const unitOptions = units.length ? units : FALLBACK_UNITS;

  const displayPhoto = photoUrl || (existingItem ? currentMenuPhoto : null);
  const onlinePhotoAvailable = !!(suggestion?.imageUrl || menuProduct?.imageUrl);

  const loadBootstrap = useCallback(async () => {
    if (!clockedIn) return;
    try {
      const res = await api.get('/merchant/storekeeper/bootstrap', { headers: apiHeaders });
      setLicensed(res.data.enabled !== false);
      setCategories(res.data.categories || []);
      const loadedUnits = (res.data.units || []).length ? res.data.units : FALLBACK_UNITS;
      setUnits(loadedUnits);
      setStoreName(String(res.data.storeName || '').trim());
      const label = res.data.labelPrint || {};
      setLabelOpts({
        storeName: String(res.data.storeName || '').trim(),
        widthMm: parseLabelWidthMm(label.widthMm),
        heightMm: parseLabelHeightMm(label.heightMm),
        showStoreName: label.showStoreName !== false,
        showProductName: label.showProductName !== false,
        showBarcodeNumber: label.showBarcodeNumber !== false,
        showPrice: label.showPrice === true,
        showSku: label.showSku === true,
      });
      setPosPrintSettings(res.data.posPrintSettings || null);
      if (loadedUnits[0]?.code) {
        setUnit((u) => (loadedUnits.some((x: Unit) => u && x.code === u) ? u : loadedUnits[0].code));
      }
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      setLicensed(
        code === 'STOREKEEPER_ADDON_REQUIRED' || code === 'INVENTORY_ADDON_REQUIRED' ? false : null
      );
      setUnits(FALLBACK_UNITS);
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
      setPhotoSource(null);
      setCurrentMenuPhoto(null);
      setExistingAction('stock');
      setEditingSessionId(null);
      setLookupBusy(true);
      try {
        const res = await api.get(`/merchant/storekeeper/lookup/${encodeURIComponent(trimmed)}`, {
          headers: apiHeaders,
        });
        const menu = res.data.menuProduct as MenuProduct | null;
        if (menu) setMenuProduct(menu);

        const item = res.data.item as InvItem | null;
        if (item) {
          setExistingItem({
            ...item,
            onHand: Number(item.onHand) || 0,
          });
          setName(item.name);
          setUnit(item.unit || 'piece');
          setCategoryId(item.categoryId || defaultCategoryId || '');
          setCurrentMenuPhoto(menu?.imageUrl || null);
          if (menu?.price != null && menu.price > 0) setSalePrice(String(menu.price));
          setExistingAction('stock');
          toast(t('storekeeperProductExists'), { icon: 'ℹ️' });
          return;
        }

        setExistingItem(null);
        const ext = res.data.suggestion as LookupSuggestion | null;
        const onlinePhoto = onlinePhotoUrl(ext, menu);
        if (ext?.name) {
          setSuggestion(ext);
          setName(ext.name);
          if (ext.unit) {
            const hasUnit = units.some((u) => u.code === ext.unit);
            if (hasUnit) setUnit(ext.unit);
          }
          setCategoryId(ext.categoryId || defaultCategoryId || '');
          setQty(qtyFromSuggestion(ext));
          if (onlinePhoto) {
            setPhotoUrl(onlinePhoto);
            setPhotoSource('online');
          }
          toast.success(t('storekeeperOnlineFound'));
        } else if (menu) {
          setName(menu.name);
          setCategoryId(defaultCategoryId || '');
          setQty('1');
          if (menu.price > 0) setSalePrice(String(menu.price));
          if (onlinePhoto) {
            setPhotoUrl(onlinePhoto);
            setPhotoSource('online');
          }
          toast.success(t('storekeeperMenuProductFound'));
        } else {
          setName('');
          setCategoryId(defaultCategoryId || '');
          setQty('1');
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
    [apiHeaders, t, units, defaultCategoryId]
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
    setPhotoSource(null);
    setCurrentMenuPhoto(null);
    setExistingAction('stock');
    setExistingItem(null);
    setMenuProduct(null);
    setSuggestion(null);
    setNewProductMode(false);
    setPendingLabel(null);
    setEditingSessionId(null);
    setCategoryId(defaultCategoryId);
  };

  const loadSessionForEdit = (entry: SessionIntakeEntry) => {
    setEditingSessionId(entry.sessionId);
    setBarcode(entry.barcode);
    setName(entry.name);
    setUnit(entry.unit);
    setCategoryId(entry.categoryId || defaultCategoryId);
    setQty(String(entry.qty));
    setExpiryDate(entry.expiryDate);
    setSalePrice(entry.salePrice);
    setPhotoUrl(entry.photoUrl);
    setPhotoSource(entry.photoUrl ? 'online' : null);
    setExistingItem(null);
    setMenuProduct(null);
    setSuggestion(null);
    setNewProductMode(false);
    setPendingLabel(null);
    setExistingAction('stock');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onUploadPhoto = async (file: File | null) => {
    if (!file) return;
    setPhotoUploading(true);
    try {
      const { compressImageIfNeeded, ensureImageFileType } = await import('@/lib/compress-image');
      const normalized = ensureImageFileType(file);
      const compressed = await compressImageIfNeeded(normalized, {
        maxBytes: 200 * 1024,
        targetBytes: 200 * 1024,
        maxWidth: 1200,
      });
      const fd = new FormData();
      fd.append('file', compressed);
      const res = await api.post('/merchant/media', fd, { headers: apiHeaders });
      const url = String(res.data?.url || '').trim();
      if (!url) throw new Error('empty');
      setPhotoUrl(url);
      setPhotoSource('upload');
      toast.success(t('storekeeperPhotoUploaded'));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err instanceof Error ? err.message : null);
      toast.error(msg || t('storekeeperPhotoUploadFailed'));
    } finally {
      setPhotoUploading(false);
      if (photoFileRef.current) photoFileRef.current.value = '';
    }
  };

  const applyOnlinePhoto = () => {
    const url = suggestion?.imageUrl || menuProduct?.imageUrl || null;
    if (!url) return;
    setPhotoUrl(url);
    setPhotoSource('online');
    toast.success(t('storekeeperPhotoFromWeb'));
  };

  const startNewProduct = () => {
    setBarcode('');
    setName('');
    setQty('1');
    setExpiryDate('');
    setSalePrice('');
    setPhotoUrl(null);
    setPhotoSource(null);
    setCurrentMenuPhoto(null);
    setExistingAction('stock');
    setExistingItem(null);
    setMenuProduct(null);
    setSuggestion(null);
    setPendingLabel(null);
    setNewProductMode(true);
  };

  const generateBarcode = async () => {
    setGenerateBusy(true);
    try {
      const res = await api.post('/merchant/storekeeper/barcode/generate', {}, { headers: apiHeaders });
      const code = String(res.data.barcode || '').trim();
      if (!code) throw new Error('empty');
      setBarcode(code);
      setExistingItem(null);
      setMenuProduct(null);
      setSuggestion(null);
      toast.success(t('storekeeperBarcodeGenerated'));
    } catch {
      toast.error(t('storekeeperGenerateBarcodeFailed'));
    } finally {
      setGenerateBusy(false);
    }
  };

  const printLabel = async (target: SavedLabel) => {
    if (!target.barcode.trim()) {
      toast.error(t('storekeeperBarcodeRequired'));
      return;
    }
    setPrintBusy(true);
    try {
      const opts = normalizeLabelOptions({
        ...labelOpts,
        storeName: labelOpts.storeName || storeName,
        showPrice: target.price ? true : labelOpts.showPrice,
      });
      const mode = await printLabelsViaAgentOrQueue(
        [
          {
            id: target.id,
            name: target.name,
            barcode: target.barcode,
            price: target.price,
          },
        ],
        opts,
        posPrintSettings,
        { retryLocally: false }
      );
      toast.success(
        mode === 'queued' ? t('storekeeperPrintLabelQueued') : t('barcodePrinted')
      );
      setPendingLabel(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('barcodePrintFailed');
      toast.error(msg);
    } finally {
      setPrintBusy(false);
    }
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
    const photoOnly = !!existingItem && existingAction === 'photo';
    const q = Number(qty);
    if (!photoOnly && !(q > 0)) {
      toast.error(t('storekeeperQtyRequired'));
      return;
    }
    if (photoOnly && !photoUrl) {
      toast.error(t('storekeeperPhotoRequired'));
      return;
    }
    if (existingItem && existingAction === 'expiry' && !expiryDate) {
      toast.error(t('storekeeperExpiryRequired'));
      return;
    }
    if (editingSessionId && !canEditSession) {
      toast.error(t('storekeeperEditNotAllowed'));
      return;
    }
    setBusy(true);
    try {
      const priceNum = salePrice.trim() ? Number(salePrice) : undefined;
      const chosenImageUrl = photoUrl;
      const editingEntry = editingSessionId
        ? sessionEntries.find((e) => e.sessionId === editingSessionId)
        : null;

      if (editingEntry && canEditSession) {
        const res = await api.patch(
          '/merchant/storekeeper/intake/revise',
          {
            itemId: editingEntry.itemId,
            barcode: barcode.trim(),
            name: name.trim(),
            unit,
            categoryId: categoryId || null,
            qty: q,
            previousQty: editingEntry.qty,
            expiryDate: expiryDate || null,
            lotId: editingEntry.lotId,
            salePrice: priceNum != null && Number.isFinite(priceNum) ? priceNum : undefined,
            imageUrl: chosenImageUrl,
            updateImageUrl: !!chosenImageUrl,
          },
          { headers: apiHeaders }
        );
        const item = res.data.item as InvItem;
        const categoryName =
          categories.find((c) => c.id === (categoryId || ''))?.name || editingEntry.categoryName;
        setSessionEntries((prev) =>
          prev.map((row) =>
            row.sessionId === editingEntry.sessionId
              ? {
                  ...row,
                  name: item.name,
                  qty: q,
                  unit: item.unit,
                  categoryId: categoryId || '',
                  categoryName,
                  expiryDate: expiryDate || '',
                  salePrice: salePrice.trim(),
                  photoUrl: chosenImageUrl,
                }
              : row
          )
        );
        toast.success(t('storekeeperSessionUpdated'));
        resetForm();
        return;
      }

      const res = await api.post(
        '/merchant/storekeeper/intake',
        {
          barcode: barcode.trim(),
          name: name.trim(),
          unit,
          categoryId: categoryId || null,
          qty: photoOnly ? 0 : q,
          expiryDate: expiryDate || null,
          salePrice: priceNum != null && Number.isFinite(priceNum) ? priceNum : undefined,
          imageUrl: chosenImageUrl,
          updateImageUrl:
            photoSource === 'upload' ||
            photoSource === 'online' ||
            (photoOnly && !!photoUrl),
          photoOnly,
        },
        { headers: apiHeaders }
      );

      const item = res.data.item as InvItem;
      const lotId = (res.data.lotId as string | null | undefined) ?? null;
      const categoryName = categories.find((c) => c.id === (categoryId || ''))?.name || '';
      if (!photoOnly) {
        setSessionEntries((prev) => [
          {
            sessionId: newSessionId(),
            itemId: item.id,
            barcode: barcode.trim(),
            name: item.name,
            qty: q,
            unit: item.unit,
            categoryId: categoryId || '',
            categoryName,
            expiryDate: expiryDate || '',
            salePrice: salePrice.trim(),
            photoUrl: chosenImageUrl,
            lotId,
            at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
      toast.success(
        photoOnly
          ? t('storekeeperPhotoOnlySaved')
          : res.data.menuProduct
            ? res.data.menuProduct.created
              ? t('storekeeperPosProductCreated')
              : t('storekeeperPosProductUpdated')
            : res.data.created
              ? t('storekeeperItemCreated')
              : t('storekeeperStockAdded')
      );
      if (res.data.created && barcode.trim()) {
        setPendingLabel({
          id: item.id,
          name: item.name,
          barcode: barcode.trim(),
          price: salePrice.trim() || undefined,
        });
      }
      setNewProductMode(false);
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
          onClick={() => {
            setPinMode('gate');
            setPinOpen(true);
          }}
        >
          {t('webPosPinClockIn')}
        </button>
        <WebPosPinModal
          open={pinOpen}
          mode={pinMode}
          onClose={() => setPinOpen(false)}
          onSuccess={(session) => {
            saveWebPosStaffSession(session);
            setPinStaff(session);
            setPinOpen(false);
          }}
          onLogout={pinLogout}
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
    <div className="storekeeper-app mx-auto flex h-[100dvh] max-h-[100dvh] max-w-lg flex-col overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <header className="flex shrink-0 items-center justify-between gap-2 px-4 pt-4">
        <div className="flex min-w-0 items-start gap-2">
          {showBackToPanel ? (
            <button
              type="button"
              onClick={() => returnToPanel()}
              className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)] hover:bg-[var(--bg-muted)]"
              aria-label={t('storekeeperBackToPanel')}
              title={t('storekeeperBackToPanel')}
            >
              <ArrowLeft size={18} />
            </button>
          ) : null}
          <div className="min-w-0">
            <h1 className="text-lg font-bold">{t('storekeeperTitle')}</h1>
            <div className="mt-0.5 flex items-center gap-1.5">
              <p className="truncate text-xs muted">
                {newProductMode ? t('storekeeperNewProduct') : displayName}
              </p>
              <button
                type="button"
                onClick={() => {
                  setPinMode('switch');
                  setPinOpen(true);
                }}
                className="inline-flex shrink-0 items-center justify-center rounded-md p-0.5 text-teal-800 hover:bg-teal-500/10 dark:text-teal-200"
                aria-label={t('webPosSwitchUser')}
                title={t('webPosSwitchUser')}
              >
                <UserCircle2 size={16} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className={`flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm ${
              newProductMode
                ? 'border-teal-600 bg-teal-500/15 text-teal-800 dark:text-teal-200'
                : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)]'
            }`}
            onClick={startNewProduct}
            aria-label={t('storekeeperNewProduct')}
            title={t('storekeeperNewProduct')}
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow"
            onClick={() => setScanOpen(true)}
          >
            <Camera size={18} />
            <span className="hidden min-[400px]:inline">{t('storekeeperScan')}</span>
          </button>
        </div>
      </header>

      <div className="storekeeper-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-8 pt-4">
      {pendingLabel ? (
        <div className="rounded-2xl border border-teal-500/30 bg-teal-500/10 p-4 shadow-sm dark:border-teal-800/40 dark:bg-teal-950/30">
          <p className="text-sm font-semibold text-teal-900 dark:text-teal-100">{t('storekeeperPrintLabelPrompt')}</p>
          <p className="mt-1 text-xs text-teal-800 dark:text-teal-200">{t('storekeeperPrintLabelHint')}</p>
          <p className="mt-2 text-sm font-medium">{pendingLabel.name}</p>
          <p className="font-mono text-xs text-[var(--text-muted)]">{pendingLabel.barcode}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={printBusy}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              onClick={() => void printLabel(pendingLabel)}
            >
              <Printer size={16} />
              {printBusy ? t('loading') : t('storekeeperPrintLabel')}
            </button>
            <button
              type="button"
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm font-medium text-[var(--text)]"
              onClick={() => setPendingLabel(null)}
            >
              {t('dismiss')}
            </button>
          </div>
        </div>
      ) : null}

      {editingSessionId ? (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <span className="font-medium text-amber-950 dark:text-amber-100">{t('storekeeperEditingSession')}</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-xs font-semibold"
            onClick={resetForm}
          >
            <X size={14} />
            {t('cancel')}
          </button>
        </div>
      ) : null}

      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide muted">
            {t('storekeeperBarcode')}
          </label>
          <div className="flex gap-2">
            <input
              className={`flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base text-[var(--text)] ${BARCODE_FIELD_INPUT_CLASS}`}
              value={barcode}
              onInput={(e) => setBarcode(stripScannerControlChars(e.currentTarget.value))}
              onChange={(e) => setBarcode(stripScannerControlChars(e.target.value))}
              onBlur={() => barcode.trim() && !newProductMode && void applyBarcode(barcode)}
              placeholder={t('storekeeperBarcodePlaceholder')}
              inputMode="numeric"
              autoComplete="off"
            />
            {!existingItem ? (
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg border border-teal-600 bg-teal-500/15 px-3 text-sm font-semibold text-teal-800 dark:text-teal-200 disabled:opacity-60"
                disabled={generateBusy}
                onClick={() => void generateBarcode()}
                title={t('storekeeperGenerateBarcode')}
              >
                <Sparkles size={16} />
                <span className="hidden min-[380px]:inline">{t('storekeeperGenerateBarcode')}</span>
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-lg border border-[var(--border)] px-3"
              onClick={() => barcode.trim() && void applyBarcode(barcode)}
              aria-label={t('storekeeperLookup')}
            >
              <ScanLine size={20} />
            </button>
          </div>
          {existingItem ? (
            <div className="mt-2 space-y-2">
              <div className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2 dark:border-teal-800/40 dark:bg-teal-950/30">
                <p className="text-xs font-semibold text-teal-900 dark:text-teal-100">
                  {t('storekeeperProductExists')}
                </p>
                <p className="mt-1 text-xs text-teal-800 dark:text-teal-200">
                  {fillI18n(t('storekeeperExistingItem'), {
                    stock: stockLabel(existingItem.onHand, existingItem.unit || unit, units),
                  })}
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums text-teal-950 dark:text-teal-100">
                  {formatStockQty(existingItem.onHand)}
                  <span className="ml-1 text-sm font-semibold">
                    {units.find((u) => u.code === (existingItem.unit || unit))?.name ||
                      existingItem.unit ||
                      unit}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['stock', 'expiry', 'photo'] as const).map((action) => (
                  <button
                    key={action}
                    type="button"
                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                      existingAction === action
                        ? 'bg-teal-700 text-white'
                        : 'border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)]'
                    }`}
                    onClick={() => setExistingAction(action)}
                  >
                    {action === 'stock'
                      ? t('storekeeperUpdateStock')
                      : action === 'expiry'
                        ? t('storekeeperUpdateExpiry')
                        : t('storekeeperUpdatePhoto')}
                  </button>
                ))}
              </div>
            </div>
          ) : menuProduct && menuProduct.stock != null && !lookupBusy ? (
            <div className="mt-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 dark:border-sky-800/40 dark:bg-sky-950/30">
              <p className="text-xs text-sky-900 dark:text-sky-100">{t('storekeeperPosStock')}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-sky-950 dark:text-sky-100">
                {formatStockQty(menuProduct.stock)}
                <span className="ml-1 text-sm font-semibold">{t('storekeeperPosStockUnit')}</span>
              </p>
            </div>
          ) : suggestion ? (
            <p className="mt-1 text-xs text-teal-800">
              {t('storekeeperOnlineFound')}
              {suggestion.packageSize
                ? ` · ${fillI18n(t('storekeeperPackageSize'), { size: suggestion.packageSize })}`
                : ''}
            </p>
          ) : barcode ? (
            <p className="mt-1 text-xs text-amber-800">
              {lookupBusy ? t('loading') : newProductMode ? t('storekeeperNewProductHint') : t('storekeeperNewItem')}
            </p>
          ) : newProductMode ? (
            <p className="mt-1 text-xs text-amber-800">{t('storekeeperNewProductHint')}</p>
          ) : null}
        </div>

        {existingItem && existingAction === 'photo' ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide muted">
              {t('storekeeperUpdatePhoto')}
            </p>
            <div className="flex items-start gap-3">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]">
                {displayPhoto ? (
                  <img src={displayPhoto} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[var(--text-muted)]">
                    <Package size={28} />
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <button
                  type="button"
                  disabled={photoUploading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm font-medium text-[var(--text)] disabled:opacity-60"
                  onClick={() => photoFileRef.current?.click()}
                >
                  <ImagePlus size={16} />
                  {photoUploading ? t('loading') : t('storekeeperTakePhoto')}
                </button>
                {currentMenuPhoto && !photoUrl ? (
                  <p className="text-xs text-[var(--text-muted)]">{t('storekeeperCurrentPhoto')}</p>
                ) : null}
                {photoSource === 'upload' ? (
                  <p className="text-xs text-teal-800">{t('storekeeperPhotoUploaded')}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {!(existingItem && existingAction === 'photo') ? (
          <>
            {!existingItem ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-muted)]/50 p-3">
                <p className="text-xs text-[var(--text-muted)]">{t('storekeeperPhotoOnlineAutoHint')}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={photoUploading}
                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm font-medium"
                    onClick={() => photoFileRef.current?.click()}
                  >
                    <ImagePlus size={16} />
                    {photoUploading ? t('loading') : t('storekeeperTakePhoto')}
                  </button>
                  {onlinePhotoAvailable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg border border-teal-600/40 bg-teal-500/10 px-3 py-2 text-sm font-medium text-teal-900 dark:text-teal-100"
                      onClick={applyOnlinePhoto}
                    >
                      {t('storekeeperUseOnlinePhoto')}
                    </button>
                  ) : null}
                </div>
                {displayPhoto ? (
                  <div className="mt-3 h-16 w-16 overflow-hidden rounded-lg border border-[var(--border)]">
                    <img src={displayPhoto} alt="" className="h-full w-full object-cover" />
                  </div>
                ) : null}
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide muted">
                {t('storekeeperProductName')}
              </label>
              <input
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base text-[var(--text)] disabled:opacity-80"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('storekeeperProductName')}
                required
                readOnly={!!existingItem}
              />
            </div>

            {!existingItem ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide muted">
                    {t('storekeeperUnit')}
                  </label>
                  <select
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base text-[var(--text)]"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    {unitOptions.map((u) => (
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
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base text-[var(--text)]"
                    value={categoryId}
                    onChange={(e) => {
                      const next = e.target.value;
                      setCategoryId(next);
                      setDefaultCategoryId(next);
                    }}
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
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              {!existingItem ? (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide muted">
                    {t('storekeeperSalePrice')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.05"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base text-[var(--text)]"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
              ) : null}
              <div className={existingItem ? 'col-span-2' : undefined}>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide muted">
                    {t('storekeeperQty')}
                    {existingItem ? (
                      <span className="ml-1 font-normal normal-case text-teal-800">
                        ({fillI18n(t('storekeeperStockNowShort'), {
                          stock: stockLabel(existingItem.onHand, existingItem.unit || unit, units),
                        })})
                      </span>
                    ) : null}
                  </label>
                  <input
                    type="number"
                    min="0.0001"
                    step="any"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base text-[var(--text)]"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    required
                  />
                </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide muted">
                {t('storekeeperExpiry')}
                {existingItem && existingAction === 'expiry' ? (
                  <span className="ml-1 font-normal normal-case text-amber-800">
                    ({t('storekeeperUpdateExpiry')})
                  </span>
                ) : null}
              </label>
              <input
                type="date"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-base text-[var(--text)]"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                required={existingItem && existingAction === 'expiry'}
              />
            </div>
          </>
        ) : null}

        <input
          ref={photoFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => void onUploadPhoto(e.target.files?.[0] || null)}
        />

        <button
          type="submit"
          disabled={busy || photoUploading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 py-3.5 text-base font-bold text-white disabled:opacity-60"
        >
          <CheckCircle size={20} />
          {busy
            ? t('loading')
            : editingSessionId
              ? t('storekeeperSaveSessionEdit')
              : existingItem && existingAction === 'photo'
                ? t('storekeeperSavePhoto')
                : existingItem && existingAction === 'expiry'
                  ? t('storekeeperSaveExpiry')
                  : t('storekeeperSaveStock')}
        </button>

        {!existingItem && barcode.trim() && name.trim() ? (
          <button
            type="button"
            disabled={printBusy || busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] py-3 text-sm font-semibold text-[var(--text)] disabled:opacity-60"
            onClick={() =>
              void printLabel({
                id: 'draft',
                name: name.trim(),
                barcode: barcode.trim(),
                price: salePrice.trim() || undefined,
              })
            }
          >
            <Printer size={18} />
            {printBusy ? t('loading') : t('storekeeperPrintLabel')}
          </button>
        ) : null}
      </form>

      {sessionEntries.length > 0 ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <h2 className="mb-1 text-sm font-bold">{t('storekeeperSessionList')}</h2>
          <p className="mb-3 text-xs text-[var(--text-muted)]">{t('storekeeperSessionListHint')}</p>
          <ul className="space-y-2 text-sm">
            {sessionEntries.map((r) => (
              <li
                key={r.sessionId}
                className={`flex items-start justify-between gap-2 rounded-xl border px-3 py-2 ${
                  editingSessionId === r.sessionId
                    ? 'border-teal-500/40 bg-teal-500/10'
                    : 'border-[var(--border)]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    +{formatStockQty(r.qty)} {units.find((u) => u.code === r.unit)?.name || r.unit}
                    {r.categoryName ? ` · ${r.categoryName}` : ''}
                    {r.expiryDate ? ` · ${r.expiryDate}` : ''}
                  </p>
                  <p className="font-mono text-[10px] text-[var(--text-muted)]">{r.barcode}</p>
                </div>
                {canEditSession ? (
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 text-xs font-semibold"
                    onClick={() => loadSessionForEdit(r)}
                  >
                    <Pencil size={14} />
                    {t('edit')}
                  </button>
                ) : null}
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
        mode={pinMode}
        onClose={() => setPinOpen(false)}
        onSuccess={(session) => {
          saveWebPosStaffSession(session);
          setPinStaff(session);
          setPinOpen(false);
        }}
        onLogout={pinLogout}
      />
      </div>
    </div>
  );
}
