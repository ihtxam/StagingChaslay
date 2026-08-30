import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
  Copy,
  ExternalLink,
  Loader2,
  Play,
  Printer,
  RefreshCw,
  CreditCard,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import api from '@/lib/api';
import axios from 'axios';
import { isKioskLicensed } from '@/lib/kiosk-addon';
import {
  fetchKioskAdminSettingsByToken,
  fetchKioskDiagnosticsByToken,
  kioskPublicUrl,
  saveKioskAdminSettingsByToken,
  type KioskAdminSettings,
  type KioskDiagnostics,
} from '@/lib/kiosk-api';
import KioskLaunchCheckModal from '@/components/kiosk/KioskLaunchCheckModal';
import { runKioskConnectionChecks } from '@/lib/kiosk-connection-check';
import { getKioskAdminPin, isKioskAdminUnlocked } from '@/lib/kiosk-admin-session';
import KioskSlideEditor from '@/components/kiosk/KioskSlideEditor';
import { useI18n } from '@/lib/i18n';

export type { KioskAdminSettings };

type KioskPanelTab = 'branding' | 'slides' | 'kiosks';

type PaymentTerminal = {
  id: string;
  terminalId: string;
  terminalName: string | null;
  status: string;
};

type Props = {
  /** Merchant JWT mode — full save via /merchant/kiosk/settings */
  mode?: 'merchant' | 'token';
  accessToken?: string;
  showOwnerExtras?: boolean;
  embedded?: boolean;
};

function resolveStoredTerminalId(
  settings: KioskAdminSettings,
  terminals: PaymentTerminal[]
): string {
  const raw = String(settings.terminalId || '').trim();
  if (!raw) return '';
  const match = terminals.find(
    (t) => t.id === raw || t.terminalId === raw
  );
  return match?.terminalId || raw;
}

export default function KioskAdminPanel({
  mode = 'merchant',
  accessToken,
  showOwnerExtras = true,
  embedded = false,
}: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [settings, setSettings] = useState<KioskAdminSettings>({});
  const [serverDiag, setServerDiag] = useState<KioskDiagnostics | null>(null);
  const [terminals, setTerminals] = useState<PaymentTerminal[]>([]);
  const [printOk, setPrintOk] = useState<boolean | null>(null);
  const [printMessage, setPrintMessage] = useState('');
  const [launchCheckOpen, setLaunchCheckOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<KioskPanelTab>('branding');

  const token = accessToken || settings.accessToken || '';
  const kioskLicensed = isKioskLicensed({ enabled });
  const activeTerminals = useMemo(
    () => terminals.filter((term) => String(term.status).toLowerCase() === 'active'),
    [terminals]
  );
  const selectedTerminalId = resolveStoredTerminalId(settings, terminals);

  const loadTerminals = useCallback(async () => {
    if (mode !== 'merchant') {
      setTerminals(serverDiag?.terminals || []);
      return;
    }
    try {
      const res = await api.get('/terminals');
      setTerminals(res.data.terminals || []);
    } catch {
      setTerminals(serverDiag?.terminals || []);
    }
  }, [mode, serverDiag?.terminals]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (mode === 'merchant') {
        const res = await api.get('/merchant/kiosk/settings');
        setEnabled(!!res.data.enabled);
        setSettings(res.data.settings || {});
        const diag = await api.get('/merchant/kiosk/diagnostics');
        setServerDiag(diag.data.diagnostics || null);
      } else if (accessToken) {
        const res = await axios.get(`/api/kiosk/${accessToken}/diagnostics`);
        setServerDiag(res.data.diagnostics || null);
        setTerminals(res.data.diagnostics?.terminals || []);
        const pin = getKioskAdminPin(accessToken);
        if (pin && isKioskAdminUnlocked(accessToken)) {
          const adminSettings = await fetchKioskAdminSettingsByToken(accessToken, pin);
          setSettings({ ...adminSettings, accessToken });
        } else {
          const cfg = await axios.get(`/api/kiosk/${accessToken}/config`);
          setSettings((prev) => ({ ...prev, accessToken, name: cfg.data.settings?.name }));
        }
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('kioskLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [mode, accessToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loading) void loadTerminals();
  }, [loading, loadTerminals, serverDiag]);

  const save = async () => {
    setSaving(true);
    try {
      if (mode === 'merchant') {
        const res = await api.put('/merchant/kiosk/settings', { settings });
        setSettings(res.data.settings || settings);
      } else if (accessToken) {
        const pin = getKioskAdminPin(accessToken);
        if (!pin) {
          toast.error(t('kioskAdminSessionExpired'));
          return;
        }
        const saved = await saveKioskAdminSettingsByToken(accessToken, pin, settings);
        setSettings({ ...saved, accessToken });
      } else {
        return;
      }
      toast.success(t('kioskSettingsSaved'));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const testConnections = async () => {
    setTesting(true);
    setPrintOk(null);
    try {
      const report = await runKioskConnectionChecks({
        mode,
        token: token || undefined,
        cardPaymentEnabled: settings.cardPaymentEnabled,
      });
      setServerDiag(report.serverDiag);
      setTerminals(report.serverDiag?.terminals || []);
      setPrintOk(report.printer.status === 'ok' || report.printer.status === 'warn');
      setPrintMessage(report.printer.message);
    } catch {
      setPrintOk(false);
      setPrintMessage(t('kioskPrintBridgeMissing'));
    } finally {
      setTesting(false);
    }
  };

  const launchFullscreen = () => {
    if (!token) {
      toast.error(t('kioskSaveForUrl'));
      return;
    }
    setLaunchCheckOpen(true);
  };

  const regenerateToken = async () => {
    if (!window.confirm(t('kioskRegenerateConfirm'))) return;
    try {
      const res = await api.post('/merchant/kiosk/settings/regenerate-token');
      setSettings(res.data.settings || settings);
      toast.success(t('kioskUrlRegenerated'));
    } catch {
      toast.error(t('kioskRegenerateFailed'));
    }
  };

  const tokenModeEditable =
    mode === 'merchant' || (mode === 'token' && !!accessToken && isKioskAdminUnlocked(accessToken));

  const kioskUrl = token ? kioskPublicUrl(token) : '';
  const terminalOk =
    serverDiag?.terminalConfigured && serverDiag?.terminalRegistered && serverDiag?.adyenConfigured;

  const panelTabs: { id: KioskPanelTab; label: string; hint: string }[] = [
    { id: 'branding', label: t('kioskTabBranding'), hint: t('kioskTabBrandingHint') },
    { id: 'slides', label: t('kioskTabSlides'), hint: t('kioskTabSlidesHint') },
    { id: 'kiosks', label: t('kioskTabKiosks'), hint: t('kioskTabKiosksHint') },
  ];

  const activeTabHint = panelTabs.find((item) => item.id === panelTab)?.hint ?? '';

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (mode === 'merchant' && !kioskLicensed) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <div>
          <h1 className="text-2xl font-bold">{t('kioskNav')}</h1>
          <p className="mt-1 text-sm text-stone-600">{t('kioskSetupSubtitle')}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          {t('kioskAddonDisabled')}
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? 'space-y-6' : 'mx-auto max-w-3xl space-y-6 p-6 pb-12'}>
      {!embedded ? (
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">{t('kioskSetupTitle')}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{t('kioskSetupSubtitle')}</p>
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">{t('kioskNav')}</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{t('kioskSetupSubtitle')}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {panelTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              panelTab === item.id
                ? 'bg-teal-600 text-white'
                : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
            }`}
            onClick={() => setPanelTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {activeTabHint ? (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-3 text-sm text-[var(--text-muted)]">
          {activeTabHint}
        </p>
      ) : null}

      {panelTab === 'kiosks' ? (
        <>
          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
            <h2 className="font-semibold text-[var(--text)]">{t('kioskConnectionsTitle')}</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{t('kioskConnectionsHint')}</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] p-3">
                {terminalOk ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold text-[var(--text)]">
                    <CreditCard className="h-4 w-4" /> {t('paymentTerminals')}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">
                    {serverDiag?.terminalConfigured
                      ? serverDiag.terminalRegistered
                        ? `${t('kioskTerminalSelected')}: ${serverDiag.terminalLabel || selectedTerminalId}${
                            serverDiag.adyenConfigured ? '' : ` — ${t('kioskAdyenMissing')}`
                          }`
                        : t('kioskTerminalNotRegistered')
                      : t('kioskTerminalNotSelected')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] p-3">
                {printOk === true ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                ) : printOk === false ? (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                ) : (
                  <Printer className="mt-0.5 h-5 w-5 shrink-0 text-[var(--text-muted)]" />
                )}
                <div>
                  <p className="font-semibold flex items-center gap-2 text-[var(--text)]">
                    <Printer className="h-4 w-4" /> {t('kioskPrintBridgeTitle')}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">
                    {printMessage || t('kioskPrintBridgeHint')}
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary mt-4"
              disabled={testing}
              onClick={() => void testConnections()}
            >
              {testing ? t('kioskTesting') : t('kioskTestConnections')}
            </button>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-[var(--text)]">{t('kioskTerminalPickerTitle')}</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{t('kioskTerminalPickerHint')}</p>
              </div>
              {mode === 'merchant' ? (
                <Link to="/merchant/settings?tab=payments" className="text-sm font-semibold text-teal-700 hover:underline dark:text-teal-400">
                  {t('settingsNavPayments')} →
                </Link>
              ) : null}
            </div>

            {terminals.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-muted)] px-4 py-6 text-sm text-[var(--text-muted)]">
                {t('kioskNoTerminalsHint')}
              </p>
            ) : (
              <>
                <label className="mt-4 block">
                  <span className="text-sm font-semibold text-[var(--text)]">{t('kioskSelectTerminal')}</span>
                  <select
                    className="input mt-1 w-full"
                    disabled={!tokenModeEditable}
                    value={selectedTerminalId}
                    onChange={(e) =>
                      setSettings({ ...settings, terminalId: e.target.value || null })
                    }
                  >
                    <option value="">{t('kioskSelectTerminalPlaceholder')}</option>
                    {activeTerminals.map((term) => (
                      <option key={term.id} value={term.terminalId}>
                        {term.terminalName || term.terminalId} ({term.terminalId})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="mt-4 table-scroll rounded-lg border border-[var(--border)]">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left muted">
                        <th className="px-3 py-2 font-medium">{t('terminalName')}</th>
                        <th className="px-3 py-2 font-medium">{t('terminalId')}</th>
                        <th className="px-3 py-2 font-medium">{t('status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {terminals.map((term) => (
                        <tr
                          key={term.id}
                          className={`border-b border-[var(--border)] last:border-0 ${
                            term.terminalId === selectedTerminalId ? 'bg-emerald-50/80 dark:bg-emerald-950/30' : ''
                          }`}
                        >
                          <td className="px-3 py-2.5 font-medium">{term.terminalName || '—'}</td>
                          <td className="px-3 py-2.5 font-mono text-xs">{term.terminalId}</td>
                          <td className="px-3 py-2.5 capitalize">{term.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          {mode === 'merchant' && showOwnerExtras && kioskLicensed && kioskUrl ? (
            <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
              <h2 className="font-semibold text-[var(--text)]">{t('kioskUrlTitle')}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="flex-1 break-all rounded-lg bg-[var(--bg-muted)] px-3 py-2 text-sm">{kioskUrl}</code>
                <button
                  type="button"
                  className="btn-secondary inline-flex items-center gap-1"
                  onClick={() => {
                    void navigator.clipboard.writeText(kioskUrl);
                    toast.success(t('copied'));
                  }}
                >
                  <Copy className="h-4 w-4" /> {t('copy')}
                </button>
                <a href={kioskUrl} target="_blank" rel="noreferrer" className="btn-secondary inline-flex items-center gap-1">
                  <ExternalLink className="h-4 w-4" /> {t('open')}
                </a>
                <button type="button" className="btn-secondary inline-flex items-center gap-1" onClick={() => void regenerateToken()}>
                  <RefreshCw className="h-4 w-4" /> {t('kioskRegenerateUrl')}
                </button>
              </div>
            </section>
          ) : null}

          <section className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-[var(--text)]">{t('kioskNameLabel')}</span>
              <input
                className="input mt-1 w-full"
                value={settings.name || ''}
                disabled={!tokenModeEditable}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[var(--text)]">{t('kioskAdminPinLabel')}</span>
              <input
                className="input mt-1 w-full"
                inputMode="numeric"
                maxLength={8}
                value={settings.adminPin || ''}
                disabled={!tokenModeEditable}
                onChange={(e) =>
                  setSettings({ ...settings, adminPin: e.target.value.replace(/\D/g, '') })
                }
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[var(--text)]">{t('kioskLanguagesLabel')}</span>
              <input
                className="input mt-1 w-full"
                value={(settings.enabledLanguages || []).join(', ')}
                disabled={!tokenModeEditable}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    enabledLanguages: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[var(--text)]">{t('kioskDefaultLanguageLabel')}</span>
              <input
                className="input mt-1 w-full"
                value={settings.defaultLanguage || 'en'}
                disabled={!tokenModeEditable}
                onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[var(--text)]">{t('kioskTableModeLabel')}</span>
              <select
                className="input mt-1 w-full"
                value={settings.tableMode || 'both'}
                disabled={!tokenModeEditable}
                onChange={(e) =>
                  setSettings({ ...settings, tableMode: e.target.value as KioskAdminSettings['tableMode'] })
                }
              >
                <option value="both">{t('kioskTableModeBoth')}</option>
                <option value="table">{t('kioskTableModeTable')}</option>
                <option value="badge">{t('kioskTableModeBadge')}</option>
              </select>
            </label>
            <label className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={settings.cashPaymentEnabled !== false}
                disabled={!tokenModeEditable}
                onChange={(e) => setSettings({ ...settings, cashPaymentEnabled: e.target.checked })}
              />
              <span className="text-sm">{t('kioskCashEnabled')}</span>
            </label>
            <label className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={settings.cardPaymentEnabled !== false}
                disabled={!tokenModeEditable}
                onChange={(e) => setSettings({ ...settings, cardPaymentEnabled: e.target.checked })}
              />
              <span className="text-sm">{t('kioskCardEnabled')}</span>
            </label>
            <label className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={settings.membershipScanEnabled !== false}
                disabled={!tokenModeEditable}
                onChange={(e) => setSettings({ ...settings, membershipScanEnabled: e.target.checked })}
              />
              <span className="text-sm">{t('kioskMembershipScan')}</span>
            </label>
            <label className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={settings.kioskCashNeedsApproval !== false}
                disabled={!tokenModeEditable}
                onChange={(e) => setSettings({ ...settings, kioskCashNeedsApproval: e.target.checked })}
              />
              <span className="text-sm">{t('kioskCashNeedsApproval')}</span>
            </label>
          </section>
        </>
      ) : null}

      {panelTab === 'slides' ? (
        <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <h2 className="font-semibold text-[var(--text)]">{t('kioskAttractTitle')}</h2>
          <p className="text-sm text-[var(--text-muted)]">{t('kioskSlidesHint')}</p>
          <label className="block">
            <span className="text-sm font-semibold text-[var(--text)]">{t('kioskSlidesBannerLabel')}</span>
            <input
              className="input mt-1 w-full"
              placeholder={t('kioskSlidesBannerPlaceholder')}
              value={settings.slideBannerText || ''}
              disabled={!tokenModeEditable}
              onChange={(e) => setSettings({ ...settings, slideBannerText: e.target.value })}
            />
          </label>
          <KioskSlideEditor
            slides={settings.promoSlides?.length ? settings.promoSlides : [{ title: '', subtitle: '' }]}
            editable={tokenModeEditable}
            mode={mode}
            accessToken={accessToken}
            onChange={(promoSlides) => setSettings({ ...settings, promoSlides })}
          />
        </section>
      ) : null}

      {panelTab === 'branding' ? (
        <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <h2 className="font-semibold text-[var(--text)]">{t('kioskBrandingTitle')}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-[var(--text)]">{t('kioskBrandingAttractHeadline')}</span>
              <input
                className="input mt-1 w-full"
                placeholder={settings.name || 'Your restaurant name'}
                value={settings.attractHeadline || ''}
                disabled={!tokenModeEditable}
                onChange={(e) => setSettings({ ...settings, attractHeadline: e.target.value })}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-[var(--text)]">{t('kioskBrandingAttractSubheadline')}</span>
              <input
                className="input mt-1 w-full"
                placeholder="Order here — pay at the counter or by card."
                value={settings.attractSubheadline || ''}
                disabled={!tokenModeEditable}
                onChange={(e) => setSettings({ ...settings, attractSubheadline: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[var(--text)]">{t('kioskBrandPrimaryColor')}</span>
              <input
                type="color"
                className="mt-1 h-10 w-full cursor-pointer rounded border border-[var(--border)]"
                value={settings.brandPrimaryColor || '#059669'}
                disabled={!tokenModeEditable}
                onChange={(e) => setSettings({ ...settings, brandPrimaryColor: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[var(--text)]">{t('kioskBrandSecondaryColor')}</span>
              <input
                type="color"
                className="mt-1 h-10 w-full cursor-pointer rounded border border-[var(--border)]"
                value={settings.brandSecondaryColor || '#047857'}
                disabled={!tokenModeEditable}
                onChange={(e) => setSettings({ ...settings, brandSecondaryColor: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[var(--text)]">{t('kioskBrandButtonTextColor')}</span>
              <input
                type="color"
                className="mt-1 h-10 w-full cursor-pointer rounded border border-[var(--border)]"
                value={settings.brandButtonTextColor || '#ffffff'}
                disabled={!tokenModeEditable}
                onChange={(e) => setSettings({ ...settings, brandButtonTextColor: e.target.value })}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-[var(--text)]">{t('kioskScreenSizeLabel')}</span>
              <select
                className="input mt-1 w-full max-w-xs"
                value={settings.screenSizeIn === 27 ? 27 : 23}
                disabled={!tokenModeEditable}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    screenSizeIn: Number(e.target.value) === 27 ? 27 : 23,
                  })
                }
              >
                <option value={23}>{t('kioskScreenSize23')}</option>
                <option value={27}>{t('kioskScreenSize27')}</option>
              </select>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{t('kioskScreenSizeHint')}</p>
            </label>
          </div>
          <div className="space-y-2 border-t border-[var(--border)] pt-3">
            <p className="text-sm font-semibold text-[var(--text)]">{t('kioskOrderTypeButtonsTitle')}</p>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.takeawayEnabled !== false} disabled={!tokenModeEditable} onChange={(e) => setSettings({ ...settings, takeawayEnabled: e.target.checked })} />
              <span className="text-sm">{t('kioskTakeawayEnabled')}</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.deliveryEnabled === true} disabled={!tokenModeEditable} onChange={(e) => setSettings({ ...settings, deliveryEnabled: e.target.checked })} />
              <span className="text-sm">{t('kioskDeliveryEnabled')}</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.dineInEnabled !== false} disabled={!tokenModeEditable} onChange={(e) => setSettings({ ...settings, dineInEnabled: e.target.checked })} />
              <span className="text-sm">{t('kioskDineInEnabled')}</span>
            </label>
          </div>
          <div className="space-y-2 border-t border-[var(--border)] pt-3">
            <p className="text-sm font-semibold text-[var(--text)]">{t('kioskPrintTitle')}</p>
            <p className="text-xs text-stone-500">{t('kioskAutoPrintKitchenHint')}</p>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.autoPrintKitchen !== false} disabled={!tokenModeEditable} onChange={(e) => setSettings({ ...settings, autoPrintKitchen: e.target.checked })} />
              <span className="text-sm">{t('kioskAutoPrintKitchen')}</span>
            </label>
            <p className="text-xs text-stone-500">{t('kioskAutoPrintReceiptHint')}</p>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.autoPrintReceipt === true} disabled={!tokenModeEditable} onChange={(e) => setSettings({ ...settings, autoPrintReceipt: e.target.checked })} />
              <span className="text-sm">{t('kioskAutoPrintReceipt')}</span>
            </label>
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
        {tokenModeEditable ? (
          <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? t('saving') : t('save')}
          </button>
        ) : null}
        <button
          type="button"
          className="btn-primary inline-flex items-center gap-2 bg-emerald-600"
          onClick={launchFullscreen}
        >
          <Play className="h-4 w-4" /> {t('kioskLaunchCustomer')}
        </button>
      </div>

      <KioskLaunchCheckModal
        open={launchCheckOpen}
        kioskUrl={kioskUrl}
        mode={mode}
        token={token || undefined}
        cardPaymentEnabled={settings.cardPaymentEnabled}
        onClose={() => setLaunchCheckOpen(false)}
      />
    </div>
  );
}
