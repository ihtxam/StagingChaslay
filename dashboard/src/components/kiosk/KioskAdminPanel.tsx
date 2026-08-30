import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Copy,
  ExternalLink,
  ImagePlus,
  Loader2,
  Play,
  Printer,
  RefreshCw,
  CreditCard,
  CheckCircle2,
  XCircle,
  Trash2,
} from 'lucide-react';
import api from '@/lib/api';
import axios from 'axios';
import { isKioskLicensed } from '@/lib/kiosk-addon';
import {
  fetchKioskAdminSettingsByToken,
  fetchKioskDiagnosticsByToken,
  kioskPublicUrl,
  saveKioskAdminSettingsByToken,
  uploadKioskSlideImageByToken,
  type KioskAdminSettings,
  type KioskDiagnostics,
} from '@/lib/kiosk-api';
import { getPrintAgentHealth } from '@/lib/print-agent';
import { getKioskAdminPin, isKioskAdminUnlocked } from '@/lib/kiosk-admin-session';
import { compressImageIfNeeded } from '@/lib/compress-image';
import { useI18n } from '@/lib/i18n';

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
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [uploadingSlideIdx, setUploadingSlideIdx] = useState<number | null>(null);
  const slideFileRefs = useRef<Array<HTMLInputElement | null>>([]);
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
          ? `Bridge Reborn v${health.version || '?'} — ${health.printerReady ? 'printer ready' : 'no printer yet'}`
          : 'Bridge Reborn not running on this device (install from Settings)',
      );
    } catch {
      setPrintOk(false);
      setPrintMessage('Could not reach Bridge Reborn on http://127.0.0.1:9101');
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

  const tokenModeEditable =
    mode === 'merchant' || (mode === 'token' && !!accessToken && isKioskAdminUnlocked(accessToken));

  const uploadSlideImage = async (idx: number, file: File | null) => {
    if (!file || !tokenModeEditable) return;
    setUploadingSlideIdx(idx);
    try {
      const compressed = await compressImageIfNeeded(file, {
        maxBytes: 1024 * 1024,
        maxWidth: 1920,
        targetBytes: 700 * 1024,
      });
      let url: string;
      if (mode === 'merchant') {
        const fd = new FormData();
        fd.append('file', compressed);
        const res = await api.post('/merchant/kiosk/media', fd);
        url = res.data?.url as string;
      } else if (accessToken) {
        const pin = getKioskAdminPin(accessToken);
        if (!pin) {
          toast.error(t('kioskAdminSessionExpired'));
          return;
        }
        url = await uploadKioskSlideImageByToken(accessToken, pin, compressed);
      } else {
        return;
      }
      if (!url) throw new Error('Upload failed');
      const next = [...(settings.promoSlides || [])];
      next[idx] = { ...next[idx], imageUrl: url };
      setSettings({ ...settings, promoSlides: next });
      toast.success(t('imageUploaded'));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('uploadFailed'));
    } finally {
      setUploadingSlideIdx(null);
      const input = slideFileRefs.current[idx];
      if (input) input.value = '';
    }
  };

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
    <div className="mx-auto max-w-3xl space-y-6 p-6 pb-12">
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
          Test payment terminal registration and Bridge Reborn on this device before going live.
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
                <Printer className="h-4 w-4" /> Bridge Reborn / printers
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
        <div>
          <h2 className="font-semibold">{t('kioskAttractTitle')}</h2>
          <p className="mt-1 text-xs text-stone-500">{t('kioskSlideImageHint')}</p>
        </div>
        {(settings.promoSlides || []).map((slide, idx) => (
          <div key={idx} className="grid gap-3 rounded-lg border border-[var(--border)] p-3 md:grid-cols-3">
            {slide.imageUrl ? (
              <div className="relative md:col-span-3">
                <img
                  src={slide.imageUrl}
                  alt=""
                  className="h-36 w-full rounded-lg border border-stone-200 object-cover"
                />
                {tokenModeEditable ? (
                  <button
                    type="button"
                    className="absolute right-2 top-2 rounded-lg bg-black/60 p-2 text-white hover:bg-black/80"
                    aria-label={t('kioskRemoveSlide')}
                    onClick={() => {
                      const next = [...(settings.promoSlides || [])];
                      next[idx] = { ...next[idx], imageUrl: undefined };
                      setSettings({ ...settings, promoSlides: next });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ) : null}
            {tokenModeEditable ? (
              <div className="flex flex-wrap items-center gap-2 md:col-span-3">
                <input
                  ref={(el) => {
                    slideFileRefs.current[idx] = el;
                  }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => void uploadSlideImage(idx, e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  className="btn-secondary inline-flex items-center gap-2"
                  disabled={uploadingSlideIdx === idx}
                  onClick={() => slideFileRefs.current[idx]?.click()}
                >
                  {uploadingSlideIdx === idx ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                  {uploadingSlideIdx === idx ? t('uploading') : t('kioskSlideUploadImage')}
                </button>
              </div>
            ) : null}
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
            {tokenModeEditable && (settings.promoSlides || []).length > 1 ? (
              <div className="md:col-span-3">
                <button
                  type="button"
                  className="text-xs font-medium text-red-700 underline-offset-2 hover:underline"
                  onClick={() => {
                    const next = (settings.promoSlides || []).filter((_, i) => i !== idx);
                    setSettings({ ...settings, promoSlides: next });
                  }}
                >
                  {t('kioskRemoveSlide')}
                </button>
              </div>
            ) : null}
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
