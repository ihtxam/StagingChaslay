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
import { getPrintAgentHealth } from '@/lib/print-agent';
import { getKioskAdminPin, isKioskAdminUnlocked } from '@/lib/kiosk-admin-session';
import { useI18n } from '@/lib/i18n';

export type { KioskAdminSettings };

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
}: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [settings, setSettings] = useState<KioskAdminSettings>({});
  const [serverDiag, setServerDiag] = useState<KioskDiagnostics | null>(null);
  const [terminals, setTerminals] = useState<PaymentTerminal[]>([]);
  const [printOk, setPrintOk] = useState<boolean | null>(null);
  const [printMessage, setPrintMessage] = useState('');

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
      if (mode === 'merchant') {
        const diag = await api.get('/merchant/kiosk/diagnostics');
        setServerDiag(diag.data.diagnostics || null);
      } else if (token) {
        const res = await fetchKioskDiagnosticsByToken(token);
        setServerDiag(res);
        setTerminals(res.terminals || []);
      }
      const health = await getPrintAgentHealth();
      setPrintOk(health.ok);
      setPrintMessage(
        health.ok
          ? t('kioskPrintBridgeOk').replace('{version}', health.version || '?')
          : t('kioskPrintBridgeMissing')
      );
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
    window.location.href = kioskPublicUrl(token);
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
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{t('kioskSetupTitle')}</h1>
        <p className="mt-1 text-sm text-stone-600">{t('kioskSetupSubtitle')}</p>
      </div>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
        <h2 className="font-semibold">{t('kioskConnectionsTitle')}</h2>
        <p className="mt-1 text-sm text-stone-500">{t('kioskConnectionsHint')}</p>
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-stone-200 bg-white p-3">
            {terminalOk ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            )}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-semibold">
                <CreditCard className="h-4 w-4" /> {t('paymentTerminals')}
              </p>
              <p className="text-sm text-stone-600">
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
          <div className="flex items-start gap-3 rounded-lg border border-stone-200 bg-white p-3">
            {printOk === true ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            ) : printOk === false ? (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            ) : (
              <Printer className="mt-0.5 h-5 w-5 shrink-0 text-stone-400" />
            )}
            <div>
              <p className="font-semibold flex items-center gap-2">
                <Printer className="h-4 w-4" /> {t('kioskPrintBridgeTitle')}
              </p>
              <p className="text-sm text-stone-600">
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
            <h2 className="font-semibold">{t('kioskTerminalPickerTitle')}</h2>
            <p className="mt-1 text-sm text-stone-500">{t('kioskTerminalPickerHint')}</p>
          </div>
          {mode === 'merchant' ? (
            <Link to="/merchant/settings?tab=payments" className="text-sm font-semibold text-teal-700 hover:underline">
              {t('settingsNavPayments')} →
            </Link>
          ) : null}
        </div>

        {terminals.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-stone-600">
            {t('kioskNoTerminalsHint')}
          </p>
        ) : (
          <>
            <label className="mt-4 block">
              <span className="text-sm font-semibold">{t('kioskSelectTerminal')}</span>
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
                        term.terminalId === selectedTerminalId ? 'bg-emerald-50/80' : ''
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
          <h2 className="font-semibold">{t('kioskUrlTitle')}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="flex-1 break-all rounded-lg bg-stone-100 px-3 py-2 text-sm">{kioskUrl}</code>
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

      <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
        <h2 className="font-semibold">{t('kioskAttractTitle')}</h2>
        {(settings.promoSlides || []).map((slide, idx) => (
          <div key={idx} className="grid gap-2 rounded-lg border border-[var(--border)] p-3 md:grid-cols-3">
            <input
              className="input md:col-span-3"
              placeholder={t('kioskSlideImageUrl')}
              value={slide.imageUrl || ''}
              disabled={!tokenModeEditable}
              onChange={(e) => {
                const next = [...(settings.promoSlides || [])];
                next[idx] = { ...next[idx], imageUrl: e.target.value };
                setSettings({ ...settings, promoSlides: next });
              }}
            />
            <input
              className="input"
              placeholder={t('kioskSlideTitle')}
              value={slide.title || ''}
              disabled={!tokenModeEditable}
              onChange={(e) => {
                const next = [...(settings.promoSlides || [])];
                next[idx] = { ...next[idx], title: e.target.value };
                setSettings({ ...settings, promoSlides: next });
              }}
            />
            <input
              className="input md:col-span-2"
              placeholder={t('kioskSlideSubtitle')}
              value={slide.subtitle || ''}
              disabled={!tokenModeEditable}
              onChange={(e) => {
                const next = [...(settings.promoSlides || [])];
                next[idx] = { ...next[idx], subtitle: e.target.value };
                setSettings({ ...settings, promoSlides: next });
              }}
            />
          </div>
        ))}
        {tokenModeEditable ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              setSettings({
                ...settings,
                promoSlides: [...(settings.promoSlides || []), { title: '', subtitle: '' }],
              })
            }
          >
            {t('kioskAddSlide')}
          </button>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold">{t('kioskNameLabel')}</span>
          <input
            className="input mt-1 w-full"
            value={settings.name || ''}
            disabled={!tokenModeEditable}
            onChange={(e) => setSettings({ ...settings, name: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">{t('kioskAdminPinLabel')}</span>
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
          <span className="text-sm font-semibold">{t('kioskLanguagesLabel')}</span>
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
          <span className="text-sm font-semibold">{t('kioskDefaultLanguageLabel')}</span>
          <input
            className="input mt-1 w-full"
            value={settings.defaultLanguage || 'en'}
            disabled={!tokenModeEditable}
            onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">{t('kioskTableModeLabel')}</span>
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

      <div className="flex flex-wrap gap-3">
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
    </div>
  );
}
