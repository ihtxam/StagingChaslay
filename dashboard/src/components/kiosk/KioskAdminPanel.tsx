import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
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
import KioskSlideEditor from '@/components/kiosk/KioskSlideEditor';

export type { KioskAdminSettings };

type Props = {
  /** Merchant JWT mode — full save via /merchant/kiosk/settings */
  mode?: 'merchant' | 'token';
  accessToken?: string;
  showOwnerExtras?: boolean;
};

export default function KioskAdminPanel({
  mode = 'merchant',
  accessToken,
  showOwnerExtras = true,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [settings, setSettings] = useState<KioskAdminSettings>({});
  const [serverDiag, setServerDiag] = useState<KioskDiagnostics | null>(null);
  const [printOk, setPrintOk] = useState<boolean | null>(null);
  const [printMessage, setPrintMessage] = useState('');

  const token = accessToken || settings.accessToken || '';

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
      toast.error(err.response?.data?.error || 'Failed to load kiosk settings');
    } finally {
      setLoading(false);
    }
  }, [mode, accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      if (mode === 'merchant') {
        const res = await api.put('/merchant/kiosk/settings', { settings });
        setSettings(res.data.settings || settings);
      } else if (accessToken) {
        const pin = getKioskAdminPin(accessToken);
        if (!pin) {
          toast.error('Admin session expired — unlock again');
          return;
        }
        const saved = await saveKioskAdminSettingsByToken(accessToken, pin, settings);
        setSettings({ ...saved, accessToken });
      } else {
        return;
      }
      toast.success('Kiosk settings saved');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Save failed');
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
      }
      const health = await getPrintAgentHealth();
      setPrintOk(health.ok);
      setPrintMessage(
        health.ok
          ? `Print Bridge v${health.version || '?'} — ${health.printerReady ? 'printer ready' : 'no printer yet'}`
          : 'Print Bridge not running on this device (install Reborn Print Bridge)',
      );
    } catch {
      setPrintOk(false);
      setPrintMessage('Could not reach Print Bridge on http://127.0.0.1:9101');
    } finally {
      setTesting(false);
    }
  };

  const launchFullscreen = () => {
    if (!token) {
      toast.error('Save settings first to generate kiosk URL');
      return;
    }
    const url = kioskPublicUrl(token);
    window.location.href = url;
  };

  const regenerateToken = async () => {
    if (!window.confirm('Regenerate kiosk URL? Existing devices must be reconfigured.')) return;
    try {
      const res = await api.post('/merchant/kiosk/settings/regenerate-token');
      setSettings(res.data.settings || settings);
      toast.success('Kiosk URL regenerated');
    } catch {
      toast.error('Failed to regenerate token');
    }
  };

  const tokenModeEditable = mode === 'merchant' || (mode === 'token' && !!accessToken && isKioskAdminUnlocked(accessToken));

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

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Kiosk setup</h1>
        <p className="mt-1 text-sm text-stone-600">
          Configure sliders, payment methods, and connections before launching customer mode.
        </p>
      </div>

      {mode === 'merchant' && !enabled ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          The self-order kiosk add-on is not enabled. Contact your reseller to activate it.
        </div>
      ) : null}

      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
        <h2 className="font-semibold">Connections</h2>
        <p className="mt-1 text-sm text-stone-500">
          Test payment terminal registration and Print Bridge on this device before going live.
        </p>
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-stone-200 bg-white p-3">
            {terminalOk ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            )}
            <div>
              <p className="font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Payment terminal
              </p>
              <p className="text-sm text-stone-600">
                {serverDiag?.terminalConfigured
                  ? serverDiag.terminalRegistered
                    ? `Terminal: ${serverDiag.terminalLabel || 'registered'}${serverDiag.adyenConfigured ? '' : ' — Adyen credentials missing'}`
                    : 'Terminal ID set but not found — check Settings → Payments'
                  : 'No terminal ID configured below'}
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
                <Printer className="h-4 w-4" /> Print Bridge / printers
              </p>
              <p className="text-sm text-stone-600">
                {printMessage || 'Tap Test connections to check localhost:9101 on this tablet'}
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
          {testing ? 'Testing…' : 'Test connections'}
        </button>
      </section>

      {mode === 'merchant' && showOwnerExtras && isKioskLicensed({ enabled }) && kioskUrl ? (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <h2 className="font-semibold">Kiosk URL</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="flex-1 break-all rounded-lg bg-stone-100 px-3 py-2 text-sm">{kioskUrl}</code>
            <button type="button" className="btn-secondary inline-flex items-center gap-1" onClick={() => { void navigator.clipboard.writeText(kioskUrl); toast.success('Copied'); }}>
              <Copy className="h-4 w-4" /> Copy
            </button>
            <a href={kioskUrl} target="_blank" rel="noreferrer" className="btn-secondary inline-flex items-center gap-1">
              <ExternalLink className="h-4 w-4" /> Open
            </a>
            <button type="button" className="btn-secondary inline-flex items-center gap-1" onClick={() => void regenerateToken()}>
              <RefreshCw className="h-4 w-4" /> Regenerate
            </button>
          </div>
        </section>
      ) : null}

      <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
        <h2 className="font-semibold">Attract screen slider</h2>
        <p className="text-sm text-stone-500">
          Upload promo images, add large overlay text on each slide, and optional banner above the slider.
        </p>
        <label className="block">
          <span className="text-sm font-semibold">Banner text (above slider)</span>
          <input
            className="input mt-1 w-full"
            placeholder="e.g. Welcome — order here!"
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

      <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
        <h2 className="font-semibold">Branding &amp; main screen</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="text-sm font-semibold">Attract headline</span>
            <input
              className="input mt-1 w-full"
              placeholder={settings.name || 'Your restaurant name'}
              value={settings.attractHeadline || ''}
              disabled={!tokenModeEditable}
              onChange={(e) => setSettings({ ...settings, attractHeadline: e.target.value })}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-semibold">Attract subheadline</span>
            <input
              className="input mt-1 w-full"
              placeholder="Order here — pay at the counter or by card."
              value={settings.attractSubheadline || ''}
              disabled={!tokenModeEditable}
              onChange={(e) => setSettings({ ...settings, attractSubheadline: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Primary button color</span>
            <input
              type="color"
              className="mt-1 h-10 w-full cursor-pointer rounded border border-stone-200"
              value={settings.brandPrimaryColor || '#059669'}
              disabled={!tokenModeEditable}
              onChange={(e) => setSettings({ ...settings, brandPrimaryColor: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Secondary / accent color</span>
            <input
              type="color"
              className="mt-1 h-10 w-full cursor-pointer rounded border border-stone-200"
              value={settings.brandSecondaryColor || '#047857'}
              disabled={!tokenModeEditable}
              onChange={(e) => setSettings({ ...settings, brandSecondaryColor: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Button text color</span>
            <input
              type="color"
              className="mt-1 h-10 w-full cursor-pointer rounded border border-stone-200"
              value={settings.brandButtonTextColor || '#ffffff'}
              disabled={!tokenModeEditable}
              onChange={(e) => setSettings({ ...settings, brandButtonTextColor: e.target.value })}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-semibold">Touch screen size (portrait)</span>
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
              <option value={23}>23&quot; vertical (1080×1920)</option>
              <option value={27}>27&quot; vertical (1080×1920)</option>
            </select>
            <p className="mt-1 text-xs text-stone-500">
              Scales buttons, text, and product tiles for your kiosk display. Use 27&quot; for larger touch targets.
            </p>
          </label>
        </div>
        <div className="space-y-2 border-t border-stone-200 pt-3">
          <p className="text-sm font-semibold">Order type buttons on main screen</p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={settings.takeawayEnabled !== false} disabled={!tokenModeEditable} onChange={(e) => setSettings({ ...settings, takeawayEnabled: e.target.checked })} />
            <span className="text-sm">Takeaway</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={settings.deliveryEnabled === true} disabled={!tokenModeEditable} onChange={(e) => setSettings({ ...settings, deliveryEnabled: e.target.checked })} />
            <span className="text-sm">Delivery</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={settings.dineInEnabled !== false} disabled={!tokenModeEditable} onChange={(e) => setSettings({ ...settings, dineInEnabled: e.target.checked })} />
            <span className="text-sm">Dine in (table / badge)</span>
          </label>
        </div>
        <div className="space-y-2 border-t border-stone-200 pt-3">
          <p className="text-sm font-semibold">Print from this kiosk tablet</p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={settings.autoPrintKitchen !== false} disabled={!tokenModeEditable} onChange={(e) => setSettings({ ...settings, autoPrintKitchen: e.target.checked })} />
            <span className="text-sm">Auto-print kitchen ticket after order</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={settings.autoPrintReceipt === true} disabled={!tokenModeEditable} onChange={(e) => setSettings({ ...settings, autoPrintReceipt: e.target.checked })} />
            <span className="text-sm">Auto-print guest receipt after order</span>
          </label>
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold">Kiosk name</span>
          <input className="input mt-1 w-full" value={settings.name || ''} disabled={!tokenModeEditable} onChange={(e) => setSettings({ ...settings, name: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Admin PIN (fullscreen → back panel)</span>
          <input className="input mt-1 w-full" inputMode="numeric" maxLength={8} value={settings.adminPin || ''} disabled={!tokenModeEditable} onChange={(e) => setSettings({ ...settings, adminPin: e.target.value.replace(/\D/g, '') })} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Languages (comma-separated)</span>
          <input className="input mt-1 w-full" value={(settings.enabledLanguages || []).join(', ')} disabled={!tokenModeEditable} onChange={(e) => setSettings({ ...settings, enabledLanguages: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Default language</span>
          <input className="input mt-1 w-full" value={settings.defaultLanguage || 'en'} disabled={!tokenModeEditable} onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Table / badge mode</span>
          <select className="input mt-1 w-full" value={settings.tableMode || 'both'} disabled={!tokenModeEditable} onChange={(e) => setSettings({ ...settings, tableMode: e.target.value as KioskAdminSettings['tableMode'] })}>
            <option value="both">Table and badge</option>
            <option value="table">Table only</option>
            <option value="badge">Badge number only</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Payment terminal ID</span>
          <input className="input mt-1 w-full" placeholder="Adyen POI id" value={settings.terminalId || ''} disabled={!tokenModeEditable} onChange={(e) => setSettings({ ...settings, terminalId: e.target.value || null })} />
        </label>
        <label className="flex items-center gap-2 md:col-span-2">
          <input type="checkbox" checked={settings.cashPaymentEnabled !== false} disabled={!tokenModeEditable} onChange={(e) => setSettings({ ...settings, cashPaymentEnabled: e.target.checked })} />
          <span className="text-sm">Accept cash at counter</span>
        </label>
        <label className="flex items-center gap-2 md:col-span-2">
          <input type="checkbox" checked={settings.cardPaymentEnabled !== false} disabled={!tokenModeEditable} onChange={(e) => setSettings({ ...settings, cardPaymentEnabled: e.target.checked })} />
          <span className="text-sm">Accept card via payment terminal</span>
        </label>
        <label className="flex items-center gap-2 md:col-span-2">
          <input type="checkbox" checked={settings.membershipScanEnabled !== false} disabled={!tokenModeEditable} onChange={(e) => setSettings({ ...settings, membershipScanEnabled: e.target.checked })} />
          <span className="text-sm">Offer membership QR scan step</span>
        </label>
        <label className="flex items-center gap-2 md:col-span-2">
          <input type="checkbox" checked={settings.kioskCashNeedsApproval !== false} disabled={!tokenModeEditable} onChange={(e) => setSettings({ ...settings, kioskCashNeedsApproval: e.target.checked })} />
          <span className="text-sm">Cash orders need staff approval</span>
        </label>
      </section>

      <div className="flex flex-wrap gap-3">
        {tokenModeEditable ? (
          <button type="button" className="btn-primary" disabled={saving || (mode === 'merchant' && !enabled)} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        ) : null}
        <button type="button" className="btn-primary inline-flex items-center gap-2 bg-emerald-600" onClick={launchFullscreen}>
          <Play className="h-4 w-4" /> Launch customer kiosk
        </button>
      </div>
    </div>
  );
}
