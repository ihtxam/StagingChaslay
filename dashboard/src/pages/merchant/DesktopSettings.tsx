import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Banknote, FileText, Monitor, Palette, Printer, RefreshCw, Scale, Settings2, Smartphone } from 'lucide-react';
import api from '@/lib/api';
import { useI18n, type Locale } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import {
  WEBPOS_COLOR_THEMES,
  WEBPOS_TEXT_SIZES,
  type WebPosAppearance,
  type WebPosColorTheme,
  type WebPosTextSize,
} from '@/components/webpos/WebPosTopBar';
import { openCustomerDisplayWindow } from '@/lib/customer-display-sync';
import { sendWebPosLogsToSupport } from '@/lib/webpos-log';
import {
  desktopPosEnv,
  desktopSidecarHealth,
  isDesktopApp,
  isDesktopStartWithWindows,
  setDesktopStartWithWindows,
} from '@/lib/platform';
import {
  desktopDrawerKick,
  desktopHwCapabilities,
  desktopListPrinters,
  desktopPrintEscPos,
  desktopScaleReading,
  type DesktopHwCapabilities,
} from '@/lib/hardware/desktop-bridge';
import {
  formatScaleDeviceLabel,
  formatScalePortLabel,
  listScaleDevices,
  type AgentPrinter,
  type ScaleDevice,
} from '@/lib/print-agent';
import { buildPrinterTestEscPos, uint8ToBase64 } from '@/lib/webpos-receipt';
import { normalizePosCheckoutSettings, type RetailTileSize } from '@/lib/pos-checkout';
import { OnScreenKeyboardToggle, useOnScreenKeyboard } from '@/components/OnScreenKeyboard';

const WEBPOS_GRID_TILE_SIZE_KEY = 'webpos.grid.tileSize';
const WEBPOS_TEXT_SIZE_KEY = 'webpos_text_size';
const WEBPOS_APPEARANCE_KEY = 'webpos_appearance';
const WEBPOS_PRINTER_STORAGE_KEY = 'manupos_webpos_printer';

function readPosTextSize(): WebPosTextSize {
  try {
    const v = localStorage.getItem(WEBPOS_TEXT_SIZE_KEY);
    if (v && WEBPOS_TEXT_SIZES.includes(v as WebPosTextSize)) return v as WebPosTextSize;
  } catch {
    /* ignore */
  }
  return 'md';
}

function readPosAppearance(): WebPosAppearance {
  try {
    const v = localStorage.getItem(WEBPOS_APPEARANCE_KEY);
    if (v === 'light' || v === 'night') return v;
  } catch {
    /* ignore */
  }
  return 'light';
}

type SectionId = 'appearance' | 'printer' | 'scale' | 'drawer' | 'device';

type PrinterProfile = {
  id: string;
  name: string;
  printReceipts?: boolean;
  printKitchenTickets?: boolean;
};

type MerchantSnapshot = {
  name?: string;
  slug?: string | null;
  panelLanguage?: string | null;
  posColorTheme?: string | null;
  posCheckoutSettings?: Record<string, unknown>;
  customerDisplaySettings?: {
    enabled?: boolean;
    accessToken?: string | null;
    shortCode?: string | null;
  } | null;
  posPrintSettings?: {
    printers?: PrinterProfile[];
    scaleComPort?: string | null;
    scaleDeviceName?: string | null;
    scaleDeviceId?: string | null;
    scaleEnabled?: boolean;
  };
};

function readMerchantSettingsPayload(data: unknown): MerchantSnapshot | null {
  if (!data || typeof data !== 'object') return null;
  const root = data as Record<string, unknown>;
  const snapshot = (root.settings || root.merchant || root) as MerchantSnapshot;
  return snapshot && typeof snapshot === 'object' ? snapshot : null;
}

const SECTIONS: { id: SectionId; icon: typeof Palette }[] = [
  { id: 'appearance', icon: Palette },
  { id: 'printer', icon: Printer },
  { id: 'scale', icon: Scale },
  { id: 'drawer', icon: Banknote },
  { id: 'device', icon: Smartphone },
];

function readLocalTileSize(): RetailTileSize {
  try {
    const v = localStorage.getItem(WEBPOS_GRID_TILE_SIZE_KEY);
    if (v === 'sm' || v === 'md' || v === 'lg') return v;
  } catch {
    /* ignore */
  }
  return 'lg';
}

export default function DesktopSettings() {
  const { t, locale, setLocale } = useI18n();
  const { open: keyboardOpen } = useOnScreenKeyboard();
  const { theme, setTheme } = useTheme();
  const [section, setSection] = useState<SectionId>('appearance');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [merchant, setMerchant] = useState<MerchantSnapshot | null>(null);
  const [tileSize, setTileSize] = useState<RetailTileSize>(() => readLocalTileSize());
  const [clearSearchAfterAdd, setClearSearchAfterAdd] = useState(true);
  const [panelLanguage, setPanelLanguage] = useState<Locale>('en');
  const [posColorTheme, setPosColorTheme] = useState<WebPosColorTheme>('teal');
  const [posTextSize, setPosTextSize] = useState<WebPosTextSize>(() => readPosTextSize());
  const [posAppearance, setPosAppearance] = useState<WebPosAppearance>(() => readPosAppearance());
  const [printers, setPrinters] = useState<AgentPrinter[]>([]);
  const [printerProfiles, setPrinterProfiles] = useState<PrinterProfile[]>([]);
  const [receiptPrinter, setReceiptPrinter] = useState('');
  const [kitchenPrinter, setKitchenPrinter] = useState('');
  const [scaleComPort, setScaleComPort] = useState('');
  const [scaleDeviceName, setScaleDeviceName] = useState('');
  const [scaleDeviceId, setScaleDeviceId] = useState('');
  const [scaleDevices, setScaleDevices] = useState<ScaleDevice[]>([]);
  const [scaleReading, setScaleReading] = useState('—');
  const [sidecar, setSidecar] = useState<{ ok: boolean; version?: string; bundled?: boolean }>({
    ok: false,
  });
  const [shellVersion, setShellVersion] = useState('—');
  const [hwCaps, setHwCaps] = useState<DesktopHwCapabilities | null>(null);
  const [startWithWindows, setStartWithWindows] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const applyScaleDevice = useCallback((device: ScaleDevice) => {
    const port = formatScalePortLabel(device.port);
    if (!port) return;
    const name = String(device.name || device.caption || '')
      .replace(/\s*\(COM\d+\)\s*$/i, '')
      .trim();
    setScaleComPort(port);
    setScaleDeviceName(name);
    setScaleDeviceId(String(device.pnpDeviceId || '').trim());
  }, []);

  const persistScaleDevice = useCallback(
    async (device: ScaleDevice, quiet = false) => {
      if (!merchant) return;
      const port = formatScalePortLabel(device.port);
      if (!port) return;
      const deviceName = String(device.name || device.caption || '')
        .replace(/\s*\(COM\d+\)\s*$/i, '')
        .trim();
      const posPrintSettings = {
        ...(merchant.posPrintSettings || {}),
        scaleComPort: port,
        scaleDeviceName: deviceName || null,
        scaleDeviceId: device.pnpDeviceId?.trim() || null,
        scaleEnabled: true,
      };
      applyScaleDevice(device);
      try {
        await api.put('/merchant/settings', { posPrintSettings });
        setMerchant((prev) => (prev ? { ...prev, posPrintSettings } : prev));
        if (!quiet) toast.success(t('settingsScaleSaved'));
      } catch (e: unknown) {
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : '';
        toast.error(msg || t('saveFailed'));
      }
    },
    [merchant, applyScaleDevice, t]
  );

  const refreshHardware = useCallback(
    async (opts?: { autoSaveScale?: boolean; hasSavedScale?: boolean }) => {
      const [printerList, scaleScan, health, caps, env] = await Promise.all([
        desktopListPrinters().catch(() => [] as AgentPrinter[]),
        listScaleDevices().catch(() => ({ ports: [], devices: [] as ScaleDevice[] })),
        desktopSidecarHealth(),
        desktopHwCapabilities(),
        desktopPosEnv(),
      ]);
      setPrinters(printerList);
      setScaleDevices(scaleScan.devices);
      setSidecar(health);
      setHwCaps(caps);
      setShellVersion(env?.version || '—');
      try {
        setStartWithWindows(await isDesktopStartWithWindows());
      } catch {
        setStartWithWindows(false);
      }

      const hasSavedScale =
        opts?.hasSavedScale ?? (!!scaleComPort || !!scaleDeviceName);
      if (opts?.autoSaveScale && scaleScan.devices.length > 0 && !hasSavedScale) {
        await persistScaleDevice(scaleScan.devices[0], true);
      }
    },
    [scaleComPort, scaleDeviceName, persistScaleDevice]
  );

  useEffect(() => {
    if (!isDesktopApp()) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/merchant/settings');
        if (cancelled) return;
        const snapshot = readMerchantSettingsPayload(data);
        if (!snapshot) throw new Error('Settings response missing data');
        setMerchant(snapshot);
        const lang = String(snapshot.panelLanguage || locale || 'en').slice(0, 2);
        setPanelLanguage(lang === 'fr' || lang === 'de' ? lang : 'en');
        const themeRaw = String(snapshot.posColorTheme || 'teal').toLowerCase();
        setPosColorTheme(
          WEBPOS_COLOR_THEMES.includes(themeRaw as WebPosColorTheme)
            ? (themeRaw as WebPosColorTheme)
            : 'teal'
        );
        setPosTextSize(readPosTextSize());
        setPosAppearance(readPosAppearance());
        const checkoutSettings = normalizePosCheckoutSettings(snapshot.posCheckoutSettings);
        setClearSearchAfterAdd(checkoutSettings.retailClearSearchAfterAdd);
        setTileSize(checkoutSettings.retailTileSize || readLocalTileSize());
        const profiles = snapshot.posPrintSettings?.printers || [];
        setPrinterProfiles(profiles);
        const savedReceiptPrinter = profiles.find((p) => p.printReceipts)?.name || '';
        const savedKitchenPrinter = profiles.find((p) => p.printKitchenTickets)?.name || '';
        setReceiptPrinter(savedReceiptPrinter);
        setKitchenPrinter(savedKitchenPrinter);
        setScaleComPort(String(snapshot.posPrintSettings?.scaleComPort || ''));
        setScaleDeviceName(String(snapshot.posPrintSettings?.scaleDeviceName || ''));
        setScaleDeviceId(String(snapshot.posPrintSettings?.scaleDeviceId || ''));
        if (savedReceiptPrinter) {
          try {
            localStorage.setItem(WEBPOS_PRINTER_STORAGE_KEY, savedReceiptPrinter);
          } catch {
            /* ignore */
          }
        }
        await refreshHardware({
          autoSaveScale: true,
          hasSavedScale:
            !!snapshot.posPrintSettings?.scaleComPort ||
            !!snapshot.posPrintSettings?.scaleDeviceName,
        });
      } catch (e: unknown) {
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : '';
        toast.error(msg || t('desktopSettingsLoadFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshHardware, t]);

  const saveMerchantSettings = useCallback(async () => {
    if (!merchant) return;
    setSaving(true);
    try {
      const nextProfiles = printerProfiles.map((p) => ({
        ...p,
        printReceipts: p.name === receiptPrinter,
        printKitchenTickets: p.name === kitchenPrinter,
      }));
      for (const name of [receiptPrinter, kitchenPrinter].filter(Boolean)) {
        if (!nextProfiles.some((p) => p.name === name)) {
          nextProfiles.push({
            id: `desk-${Date.now().toString(36)}-${name.slice(0, 8)}`,
            name,
            printReceipts: name === receiptPrinter,
            printKitchenTickets: name === kitchenPrinter,
          });
        }
      }
      const posCheckoutSettings = {
        ...(merchant.posCheckoutSettings || {}),
        retailTileSize: tileSize,
        retailClearSearchAfterAdd: clearSearchAfterAdd,
      };
      const posPrintSettings = {
        ...(merchant.posPrintSettings || {}),
        printers: nextProfiles,
        scaleComPort: scaleComPort || null,
        scaleDeviceName: scaleDeviceName || null,
        scaleDeviceId: scaleDeviceId || null,
        scaleEnabled: !!scaleComPort,
      };
      await api.put('/merchant/settings', {
        posCheckoutSettings,
        posPrintSettings,
        panelLanguage,
        posColorTheme,
      });
      try {
        localStorage.setItem(WEBPOS_GRID_TILE_SIZE_KEY, tileSize);
        localStorage.setItem(WEBPOS_TEXT_SIZE_KEY, posTextSize);
        localStorage.setItem(WEBPOS_APPEARANCE_KEY, posAppearance);
        localStorage.setItem(WEBPOS_PRINTER_STORAGE_KEY, receiptPrinter || '');
      } catch {
        /* ignore */
      }
      if (panelLanguage !== locale) {
        setLocale(panelLanguage);
      }
      setMerchant((prev) =>
        prev ? { ...prev, posCheckoutSettings, posPrintSettings } : prev
      );
      setPrinterProfiles(nextProfiles);
      toast.success(t('saved'));
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : '';
      toast.error(msg || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [
    merchant,
    printerProfiles,
    receiptPrinter,
    kitchenPrinter,
    tileSize,
    clearSearchAfterAdd,
    scaleComPort,
    scaleDeviceName,
    scaleDeviceId,
    panelLanguage,
    posColorTheme,
    posTextSize,
    posAppearance,
    locale,
    setLocale,
    t,
  ]);

  const onTestPrint = async (printerName: string) => {
    if (!printerName) {
      toast.error(t('testPrinterNeedName'));
      return;
    }
    setBusyAction('test-print');
    try {
      const escpos = buildPrinterTestEscPos({
        merchantName: merchant?.name,
        printerName,
      });
      const result = await desktopPrintEscPos({
        printerName,
        dataBase64: uint8ToBase64(escpos),
        text: `TEST PRINT\n${merchant?.name || ''}\n${printerName}\n`,
      });
      if (!result.ok) throw new Error(result.error || t('testPrinterFailed'));
      toast.success(t('testPrinterOk').replace('{name}', printerName));
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : '';
      toast.error(msg || t('testPrinterFailed'));
    } finally {
      setBusyAction(null);
    }
  };

  const onTestScale = async () => {
    if (!scaleComPort) {
      toast.error(t('desktopSettingsScalePortRequired'));
      return;
    }
    setBusyAction('test-scale');
    try {
      const { reading, message } = await desktopScaleReading(scaleComPort, 3000);
      if (reading?.weightKg != null) {
        setScaleReading(`${reading.weightKg.toFixed(3)} kg`);
        toast.success(t('desktopSettingsScaleReadOk'));
      } else {
        setScaleReading(message || t('desktopSettingsScaleNoReading'));
        toast.error(message || t('desktopSettingsScaleNoReading'));
      }
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : '';
      toast.error(msg || t('desktopSettingsScaleReadFailed'));
    } finally {
      setBusyAction(null);
    }
  };

  const onTestDrawer = async () => {
    setBusyAction('test-drawer');
    try {
      const result = await desktopDrawerKick(receiptPrinter || undefined);
      if (!result.ok) throw new Error(t('desktopSettingsDrawerFailed'));
      toast.success(t('desktopSettingsDrawerOk'));
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : '';
      toast.error(msg || t('desktopSettingsDrawerFailed'));
    } finally {
      setBusyAction(null);
    }
  };

  if (!isDesktopApp()) {
    return <Navigate to="/merchant/settings" replace />;
  }

  const sectionLabel = (id: SectionId) => t(`desktopSettingsSection_${id}` as const);

  return (
    <div className="desktop-settings-page mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col gap-4 p-4 pt-2 md:flex-row">
      <aside className="w-full shrink-0 rounded-xl border border-stone-200 bg-white p-3 shadow-sm dark:border-stone-700 dark:bg-stone-900 md:w-56">
        <div className="mb-3 flex items-center gap-2 px-2 text-sm font-bold text-stone-800 dark:text-stone-100">
          <Settings2 size={16} aria-hidden />
          {t('desktopSettingsTitle')}
        </div>
        <nav className="space-y-1">
          {SECTIONS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium ${
                section === id
                  ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-200'
                  : 'text-stone-700 hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-800'
              }`}
              onClick={() => setSection(id)}
            >
              <Icon size={16} aria-hidden />
              {sectionLabel(id)}
            </button>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-700 dark:bg-stone-900">
        {loading ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">{t('loading')}</p>
        ) : (
          <>
            {section === 'appearance' && (
              <section className="space-y-4">
                <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">{sectionLabel('appearance')}</h2>
                <div>
                  <p className="mb-2 text-sm font-medium dark:text-stone-200">{t('language')}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['en', 'fr', 'de'] as Locale[]).map((code) => (
                      <button
                        key={code}
                        type="button"
                        className={`rounded-lg border px-3 py-2 text-xs font-bold uppercase ${
                          panelLanguage === code
                            ? 'border-teal-600 bg-teal-50 text-teal-900 dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-100'
                            : 'border-stone-200 dark:border-stone-600 dark:text-stone-200'
                        }`}
                        onClick={() => setPanelLanguage(code)}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center justify-between gap-3 text-sm dark:text-stone-200">
                  <span>{t('theme')}</span>
                  <select
                    className="rounded-lg border border-stone-200 bg-white px-3 py-2 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                  >
                    <option value="light">{t('themeLight')}</option>
                    <option value="dark">{t('themeDark')}</option>
                  </select>
                </label>
                <div>
                  <p className="mb-2 text-sm font-medium dark:text-stone-200">{t('webPosAppearance')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['light', 'night'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                          posAppearance === mode
                            ? 'border-teal-600 bg-teal-50 text-teal-900 dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-100'
                            : 'border-stone-200 dark:border-stone-600 dark:text-stone-200'
                        }`}
                        onClick={() => setPosAppearance(mode)}
                      >
                        {mode === 'light' ? t('webPosAppearanceLightShort') : t('webPosAppearanceNightShort')}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium dark:text-stone-200">{t('posColorTheme')}</p>
                  <div className="flex flex-wrap gap-2">
                    {WEBPOS_COLOR_THEMES.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`rounded-lg border px-3 py-1.5 text-xs font-bold capitalize ${
                          posColorTheme === color
                            ? 'border-stone-900 bg-stone-900 text-white'
                            : 'border-stone-200 dark:border-stone-600 dark:text-stone-200'
                        }`}
                        onClick={() => setPosColorTheme(color)}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium dark:text-stone-200">{t('webPosTextSize')}</p>
                  <div className="flex gap-2">
                    {WEBPOS_TEXT_SIZES.map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold uppercase ${
                          posTextSize === size
                            ? 'border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-200'
                            : 'border-stone-200 dark:border-stone-600 dark:text-stone-200'
                        }`}
                        onClick={() => setPosTextSize(size)}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium dark:text-stone-200">{t('posRetailTileSize')}</p>
                  <div className="flex gap-2">
                    {(['sm', 'md', 'lg'] as const).map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
                          tileSize === size
                            ? 'border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-200'
                            : 'border-stone-200 dark:border-stone-600 dark:text-stone-200'
                        }`}
                        onClick={() => setTileSize(size)}
                      >
                        {size === 'sm'
                          ? t('posRetailTileSmall')
                          : size === 'md'
                            ? t('posRetailTileMedium')
                            : t('posRetailTileLarge')}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center justify-between gap-3 text-sm dark:text-stone-200">
                  <span>{t('posRetailClearSearchAfterAdd')}</span>
                  <input
                    type="checkbox"
                    checked={clearSearchAfterAdd}
                    onChange={(e) => setClearSearchAfterAdd(e.target.checked)}
                  />
                </label>
              </section>
            )}

            {section === 'printer' && (
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">{sectionLabel('printer')}</h2>
                  <button
                    type="button"
                    className="text-sm font-semibold text-teal-700"
                    onClick={() => void refreshHardware({ autoSaveScale: true })}
                  >
                    {t('refresh')}
                  </button>
                </div>
                <p className="text-sm text-stone-500 dark:text-stone-400">{t('desktopSettingsPrinterHint')}</p>
                <label className="block space-y-1 text-sm dark:text-stone-200">
                  <span className="font-medium">{t('desktopSettingsReceiptPrinter')}</span>
                  <select
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
                    value={receiptPrinter}
                    onChange={(e) => setReceiptPrinter(e.target.value)}
                  >
                    <option value="">{t('desktopSettingsSelectPrinter')}</option>
                    {printers.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                        {p.isDefault ? ` (${t('default')})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1 text-sm dark:text-stone-200">
                  <span className="font-medium">{t('desktopSettingsKitchenPrinter')}</span>
                  <select
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
                    value={kitchenPrinter}
                    onChange={(e) => setKitchenPrinter(e.target.value)}
                  >
                    <option value="">{t('desktopSettingsSelectPrinter')}</option>
                    {printers.map((p) => (
                      <option key={`k-${p.name}`} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={!receiptPrinter || busyAction === 'test-print'}
                  onClick={() => void onTestPrint(receiptPrinter)}
                >
                  {busyAction === 'test-print' ? t('loading') : t('testPrinter')}
                </button>
              </section>
            )}

            {section === 'scale' && (
              <section className="space-y-4">
                <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">{sectionLabel('scale')}</h2>
                <p className="text-sm text-stone-500 dark:text-stone-400">{t('desktopSettingsScaleHint')}</p>
                <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-800/60 dark:text-stone-200">
                  <span className="font-medium">{t('desktopSettingsScaleStatus')}: </span>
                  {sidecar.ok ? t('desktopSettingsSidecarOnline') : t('desktopSettingsSidecarOffline')}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700"
                    onClick={() => void refreshHardware({ autoSaveScale: true })}
                  >
                    <RefreshCw size={14} aria-hidden />
                    {t('settingsScaleScan')}
                  </button>
                </div>
                {scaleDevices.length > 0 ? (
                  <ul className="space-y-1.5">
                    {scaleDevices.map((device) => {
                      const selected =
                        formatScalePortLabel(scaleComPort) === formatScalePortLabel(device.port) ||
                        (!!scaleDeviceId && scaleDeviceId === device.pnpDeviceId);
                      return (
                        <li key={`${device.port}-${device.pnpDeviceId || device.name || ''}`}>
                          <button
                            type="button"
                            className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                              selected
                                ? 'border-teal-600 bg-teal-50 text-teal-900 dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-100'
                                : 'border-stone-200 bg-white hover:border-teal-300 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100'
                            }`}
                            onClick={() => void persistScaleDevice(device)}
                          >
                            <span className="font-medium">
                              {formatScaleDeviceLabel(device) || formatScalePortLabel(device.port)}
                            </span>
                            {device.manufacturer ? (
                              <span className="mt-0.5 block text-xs text-stone-500 dark:text-stone-400">
                                {device.manufacturer}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-stone-500 dark:text-stone-400">{t('settingsScaleNoPorts')}</p>
                )}
                <p className="text-sm dark:text-stone-200">
                  <span className="font-medium">{t('desktopSettingsScaleLastReading')}: </span>
                  {scaleReading}
                </p>
                <button
                  type="button"
                  className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={!scaleComPort || busyAction === 'test-scale'}
                  onClick={() => void onTestScale()}
                >
                  {busyAction === 'test-scale' ? t('loading') : t('desktopSettingsScaleTest')}
                </button>
              </section>
            )}

            {section === 'drawer' && (
              <section className="space-y-4">
                <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">{sectionLabel('drawer')}</h2>
                <p className="text-sm text-stone-500 dark:text-stone-400">{t('desktopSettingsDrawerHint')}</p>
                <p className="text-sm text-stone-600 dark:text-stone-300">
                  {t('desktopSettingsDrawerUsesReceipt').replace(
                    '{name}',
                    receiptPrinter || t('desktopSettingsDefaultPrinter')
                  )}
                </p>
                <button
                  type="button"
                  className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={busyAction === 'test-drawer'}
                  onClick={() => void onTestDrawer()}
                >
                  {busyAction === 'test-drawer' ? t('loading') : t('desktopSettingsDrawerTest')}
                </button>
              </section>
            )}

            {section === 'device' && (
              <section className="space-y-4">
                <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">{sectionLabel('device')}</h2>
                <dl className="space-y-2 text-sm dark:text-stone-200">
                  <div className="flex justify-between gap-4 border-b border-stone-100 py-2 dark:border-stone-700">
                    <dt className="text-stone-500 dark:text-stone-400">{t('desktopSettingsAppVersion')}</dt>
                    <dd className="font-medium">{shellVersion}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-stone-100 py-2 dark:border-stone-700">
                    <dt className="text-stone-500 dark:text-stone-400">{t('printAgentVersionStatusLabel')}</dt>
                    <dd className="font-medium">
                      {sidecar.ok
                        ? sidecar.version || t('printAgentConnectedUnknown')
                        : t('printAgentNotDetected')}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-stone-100 py-2 dark:border-stone-700">
                    <dt className="text-stone-500 dark:text-stone-400">{t('desktopSettingsSidecarBundled')}</dt>
                    <dd className="font-medium">{sidecar.bundled ? t('yes') : t('no')}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-stone-100 py-2 dark:border-stone-700">
                    <dt className="text-stone-500 dark:text-stone-400">{t('desktopSettingsHwPathPrint')}</dt>
                    <dd className="font-medium">{hwCaps?.paths.print || 'auto'}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-stone-100 py-2 dark:border-stone-700">
                    <dt className="text-stone-500 dark:text-stone-400">{t('desktopSettingsHwPathPrinters')}</dt>
                    <dd className="font-medium">{hwCaps?.paths.printers || 'auto'}</dd>
                  </div>
                </dl>
                <label className="flex items-center justify-between gap-3 text-sm dark:text-stone-200">
                  <span>{t('desktopSettingsStartWithWindows')}</span>
                  <input
                    type="checkbox"
                    checked={startWithWindows}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      void setDesktopStartWithWindows(enabled)
                        .then(() => setStartWithWindows(enabled))
                        .catch(() => toast.error(t('desktopSettingsAutostartFailed')));
                    }}
                  />
                </label>
                <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                  <Monitor size={14} aria-hidden />
                  {t('desktopSettingsDeviceHint')}
                </div>
                <div className="grid grid-cols-1 gap-2 border-t border-stone-100 pt-4 dark:border-stone-700 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 dark:border-stone-600 dark:bg-stone-800/60 sm:col-span-2">
                    <div>
                      <p className="text-sm font-semibold dark:text-stone-100">{t('webPosOnScreenKeyboard')}</p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">{t('desktopSettingsKeyboardHint')}</p>
                    </div>
                    <OnScreenKeyboardToggle className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-stone-300 bg-white hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100" />
                  </div>
                  {keyboardOpen ? (
                    <p className="text-xs text-teal-700 dark:text-teal-300 sm:col-span-2">{t('desktopSettingsKeyboardOpenHint')}</p>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('webpos:reload-catalog'));
                      toast.success(t('webPosReloadCatalogShort'));
                    }}
                  >
                    <RefreshCw size={16} aria-hidden />
                    {t('webPosReloadCatalogShort')}
                  </button>
                  {merchant?.customerDisplaySettings?.accessToken &&
                  merchant.customerDisplaySettings.enabled !== false ? (
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
                      onClick={() => {
                        const win = openCustomerDisplayWindow({
                          merchantSlug: merchant.slug || undefined,
                          shortCode: merchant.customerDisplaySettings?.shortCode || undefined,
                        });
                        if (!win) toast.error(t('cdsActionFailed'));
                      }}
                    >
                      <Monitor size={16} aria-hidden />
                      {t('cdsOpenDisplay')}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-100 sm:col-span-2"
                    onClick={() => {
                      void sendWebPosLogsToSupport({ locale: panelLanguage }).catch(() =>
                        toast.error(t('saveFailed'))
                      );
                    }}
                  >
                    <FileText size={16} aria-hidden />
                    {t('webPosSendLogs')}
                  </button>
                </div>
              </section>
            )}

            <div className="mt-8 flex justify-end border-t border-stone-100 pt-4 dark:border-stone-700">
              <button
                type="button"
                className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                disabled={saving}
                onClick={() => void saveMerchantSettings()}
              >
                {saving ? t('loading') : t('save')}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
