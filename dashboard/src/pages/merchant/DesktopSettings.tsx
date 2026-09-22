import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Banknote, Monitor, Palette, Printer, Scale, Settings2, Smartphone } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
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
  desktopScalePorts,
  desktopScaleReading,
  type DesktopHwCapabilities,
} from '@/lib/hardware/desktop-bridge';
import {
  formatScaleDeviceLabel,
  formatScalePortLabel,
  type AgentPrinter,
  type ScaleDevice,
} from '@/lib/print-agent';
import { buildPrinterTestEscPos, uint8ToBase64 } from '@/lib/webpos-receipt';
import { normalizePosCheckoutSettings, type RetailTileSize } from '@/lib/pos-checkout';

const WEBPOS_GRID_TILE_SIZE_KEY = 'webpos.grid.tileSize';

type SectionId = 'appearance' | 'printer' | 'scale' | 'drawer' | 'device';

type PrinterProfile = {
  id: string;
  name: string;
  printReceipts?: boolean;
  printKitchenTickets?: boolean;
};

type MerchantSnapshot = {
  name?: string;
  posCheckoutSettings?: Record<string, unknown>;
  posPrintSettings?: {
    printers?: PrinterProfile[];
    scalePort?: string | null;
  };
};

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
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const [section, setSection] = useState<SectionId>('appearance');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [merchant, setMerchant] = useState<MerchantSnapshot | null>(null);
  const [tileSize, setTileSize] = useState<RetailTileSize>(() => readLocalTileSize());
  const [clearSearchAfterAdd, setClearSearchAfterAdd] = useState(true);
  const [printers, setPrinters] = useState<AgentPrinter[]>([]);
  const [printerProfiles, setPrinterProfiles] = useState<PrinterProfile[]>([]);
  const [receiptPrinter, setReceiptPrinter] = useState('');
  const [kitchenPrinter, setKitchenPrinter] = useState('');
  const [scalePort, setScalePort] = useState('');
  const [scaleDevices, setScaleDevices] = useState<ScaleDevice[]>([]);
  const [scaleReading, setScaleReading] = useState('—');
  const [sidecar, setSidecar] = useState<{ ok: boolean; version?: string; bundled?: boolean }>({
    ok: false,
  });
  const [shellVersion, setShellVersion] = useState('—');
  const [hwCaps, setHwCaps] = useState<DesktopHwCapabilities | null>(null);
  const [startWithWindows, setStartWithWindows] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const refreshHardware = useCallback(async () => {
    const [printerList, ports, health, caps, env] = await Promise.all([
      desktopListPrinters().catch(() => [] as AgentPrinter[]),
      desktopScalePorts().catch(() => ({ ports: [], devices: [] })),
      desktopSidecarHealth(),
      desktopHwCapabilities(),
      desktopPosEnv(),
    ]);
    setPrinters(printerList);
    setScaleDevices(ports.devices);
    if (!scalePort && ports.devices[0]?.port) {
      setScalePort(ports.devices[0].port);
    }
    setSidecar(health);
    setHwCaps(caps);
    setShellVersion(env?.version || '—');
    try {
      setStartWithWindows(await isDesktopStartWithWindows());
    } catch {
      setStartWithWindows(false);
    }
  }, [scalePort]);

  useEffect(() => {
    if (!isDesktopApp()) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get<MerchantSnapshot>('/merchant/settings');
        if (cancelled) return;
        setMerchant(data);
        const checkoutSettings = normalizePosCheckoutSettings(data.posCheckoutSettings);
        setClearSearchAfterAdd(checkoutSettings.retailClearSearchAfterAdd);
        setTileSize(checkoutSettings.retailTileSize || readLocalTileSize());
        const profiles = data.posPrintSettings?.printers || [];
        setPrinterProfiles(profiles);
        setReceiptPrinter(profiles.find((p) => p.printReceipts)?.name || '');
        setKitchenPrinter(profiles.find((p) => p.printKitchenTickets)?.name || '');
        setScalePort(String(data.posPrintSettings?.scalePort || ''));
        await refreshHardware();
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
        scalePort: scalePort || null,
      };
      await api.put('/merchant/settings', { posCheckoutSettings, posPrintSettings });
      try {
        localStorage.setItem(WEBPOS_GRID_TILE_SIZE_KEY, tileSize);
      } catch {
        /* ignore */
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
    scalePort,
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
    if (!scalePort) {
      toast.error(t('desktopSettingsScalePortRequired'));
      return;
    }
    setBusyAction('test-scale');
    try {
      const { reading, message } = await desktopScaleReading(scalePort, 3000);
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
    <div className="desktop-settings-page mx-auto flex min-h-[calc(100vh-2.25rem)] max-w-6xl flex-col gap-4 p-4 pt-12 md:flex-row">
      <aside className="w-full shrink-0 rounded-xl border border-stone-200 bg-white p-3 shadow-sm md:w-56">
        <div className="mb-3 flex items-center gap-2 px-2 text-sm font-bold text-stone-800">
          <Settings2 size={16} aria-hidden />
          {t('desktopSettingsTitle')}
        </div>
        <nav className="space-y-1">
          {SECTIONS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium ${
                section === id ? 'bg-teal-50 text-teal-800' : 'text-stone-700 hover:bg-stone-50'
              }`}
              onClick={() => setSection(id)}
            >
              <Icon size={16} aria-hidden />
              {sectionLabel(id)}
            </button>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-stone-500">{t('loading')}</p>
        ) : (
          <>
            {section === 'appearance' && (
              <section className="space-y-4">
                <h2 className="text-lg font-bold text-stone-900">{sectionLabel('appearance')}</h2>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>{t('theme')}</span>
                  <select
                    className="rounded-lg border px-3 py-2"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                  >
                    <option value="light">{t('themeLight')}</option>
                    <option value="dark">{t('themeDark')}</option>
                  </select>
                </label>
                <div>
                  <p className="mb-2 text-sm font-medium">{t('posRetailTileSize')}</p>
                  <div className="flex gap-2">
                    {(['sm', 'md', 'lg'] as const).map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
                          tileSize === size
                            ? 'border-teal-600 bg-teal-50 text-teal-800'
                            : 'border-stone-200'
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
                <label className="flex items-center justify-between gap-3 text-sm">
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
                  <h2 className="text-lg font-bold text-stone-900">{sectionLabel('printer')}</h2>
                  <button
                    type="button"
                    className="text-sm font-semibold text-teal-700"
                    onClick={() => void refreshHardware()}
                  >
                    {t('refresh')}
                  </button>
                </div>
                <p className="text-sm text-stone-500">{t('desktopSettingsPrinterHint')}</p>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">{t('desktopSettingsReceiptPrinter')}</span>
                  <select
                    className="w-full rounded-lg border px-3 py-2"
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
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">{t('desktopSettingsKitchenPrinter')}</span>
                  <select
                    className="w-full rounded-lg border px-3 py-2"
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
                <h2 className="text-lg font-bold text-stone-900">{sectionLabel('scale')}</h2>
                <p className="text-sm text-stone-500">{t('desktopSettingsScaleHint')}</p>
                <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
                  <span className="font-medium">{t('desktopSettingsScaleStatus')}: </span>
                  {sidecar.ok ? t('desktopSettingsSidecarOnline') : t('desktopSettingsSidecarOffline')}
                </div>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">{t('desktopSettingsScalePort')}</span>
                  <select
                    className="w-full rounded-lg border px-3 py-2"
                    value={scalePort}
                    onChange={(e) => setScalePort(e.target.value)}
                  >
                    <option value="">{t('desktopSettingsSelectScale')}</option>
                    {scaleDevices.map((d) => (
                      <option key={d.port} value={d.port}>
                        {formatScaleDeviceLabel(d) || formatScalePortLabel(d.port)}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-sm">
                  <span className="font-medium">{t('desktopSettingsScaleLastReading')}: </span>
                  {scaleReading}
                </p>
                <button
                  type="button"
                  className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={!scalePort || busyAction === 'test-scale'}
                  onClick={() => void onTestScale()}
                >
                  {busyAction === 'test-scale' ? t('loading') : t('desktopSettingsScaleTest')}
                </button>
              </section>
            )}

            {section === 'drawer' && (
              <section className="space-y-4">
                <h2 className="text-lg font-bold text-stone-900">{sectionLabel('drawer')}</h2>
                <p className="text-sm text-stone-500">{t('desktopSettingsDrawerHint')}</p>
                <p className="text-sm text-stone-600">
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
                <h2 className="text-lg font-bold text-stone-900">{sectionLabel('device')}</h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4 border-b border-stone-100 py-2">
                    <dt className="text-stone-500">{t('desktopSettingsAppVersion')}</dt>
                    <dd className="font-medium">{shellVersion}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-stone-100 py-2">
                    <dt className="text-stone-500">{t('printAgentVersionStatusLabel')}</dt>
                    <dd className="font-medium">
                      {sidecar.ok
                        ? sidecar.version || t('printAgentConnectedUnknown')
                        : t('printAgentNotDetected')}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-stone-100 py-2">
                    <dt className="text-stone-500">{t('desktopSettingsSidecarBundled')}</dt>
                    <dd className="font-medium">{sidecar.bundled ? t('yes') : t('no')}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-stone-100 py-2">
                    <dt className="text-stone-500">{t('desktopSettingsHwPathPrint')}</dt>
                    <dd className="font-medium">{hwCaps?.paths.print || 'auto'}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-stone-100 py-2">
                    <dt className="text-stone-500">{t('desktopSettingsHwPathPrinters')}</dt>
                    <dd className="font-medium">{hwCaps?.paths.printers || 'auto'}</dd>
                  </div>
                </dl>
                <label className="flex items-center justify-between gap-3 text-sm">
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
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <Monitor size={14} aria-hidden />
                  {t('desktopSettingsDeviceHint')}
                </div>
              </section>
            )}

            <div className="mt-8 flex justify-end border-t border-stone-100 pt-4">
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
