import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, ExternalLink, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { isKioskLicensed } from '@/lib/kiosk-addon';
import { kioskPublicUrl } from '@/lib/kiosk-api';
import { useI18n } from '@/lib/i18n';

type KioskSettings = {
  accessToken?: string;
  name?: string;
  promoSlides?: Array<{ imageUrl?: string; title?: string; subtitle?: string }>;
  enabledLanguages?: string[];
  defaultLanguage?: string;
  terminalId?: string | null;
  locationSlug?: string | null;
  tableMode?: 'table' | 'badge' | 'both';
  membershipScanEnabled?: boolean;
  kioskAutoAcceptCard?: boolean;
  kioskCashNeedsApproval?: boolean;
  idleTimeoutSeconds?: number;
};

export default function KioskSettingsPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [settings, setSettings] = useState<KioskSettings>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/kiosk/settings');
      setEnabled(!!res.data.enabled);
      setSettings(res.data.settings || {});
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Failed to load kiosk settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put('/merchant/kiosk/settings', { settings });
      setSettings(res.data.settings || settings);
      toast.success('Kiosk settings saved');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const regenerateToken = async () => {
    if (!window.confirm('Regenerate kiosk URL? Existing kiosk devices must be reconfigured.')) return;
    try {
      const res = await api.post('/merchant/kiosk/settings/regenerate-token');
      setSettings(res.data.settings || settings);
      toast.success('Kiosk URL regenerated');
    } catch {
      toast.error('Failed to regenerate token');
    }
  };

  const kioskUrl = settings.accessToken ? kioskPublicUrl(settings.accessToken) : '';

  if (loading) return <p className="p-6 muted">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Self-order kiosk</h1>
        <p className="mt-1 muted">
          Browser-based kiosk for Android tablets. Install the URL below in Chrome → Add to Home screen.
        </p>
      </div>

      {!enabled ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          The self-order kiosk add-on is not enabled for your account. Contact your reseller to activate it.
        </div>
      ) : null}

      {isKioskLicensed({ enabled }) && kioskUrl ? (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <h2 className="font-semibold">Kiosk URL</h2>
          <p className="mt-1 text-sm muted">Open this URL on your kiosk tablet and install as a PWA.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="flex-1 break-all rounded-lg bg-stone-100 px-3 py-2 text-sm">{kioskUrl}</code>
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-1"
              onClick={() => {
                void navigator.clipboard.writeText(kioskUrl);
                toast.success('Copied');
              }}
            >
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
        <p className="text-sm muted">Images and text shown at the top of the kiosk (also on the welcome screen).</p>
        {(settings.promoSlides || []).map((slide, idx) => (
          <div key={idx} className="grid gap-2 rounded-lg border border-[var(--border)] p-3 md:grid-cols-3">
            <input
              className="input md:col-span-3"
              placeholder="Image URL"
              value={slide.imageUrl || ''}
              onChange={(e) => {
                const next = [...(settings.promoSlides || [])];
                next[idx] = { ...next[idx], imageUrl: e.target.value };
                setSettings({ ...settings, promoSlides: next });
              }}
            />
            <input
              className="input"
              placeholder="Title"
              value={slide.title || ''}
              onChange={(e) => {
                const next = [...(settings.promoSlides || [])];
                next[idx] = { ...next[idx], title: e.target.value };
                setSettings({ ...settings, promoSlides: next });
              }}
            />
            <input
              className="input md:col-span-2"
              placeholder="Subtitle"
              value={slide.subtitle || ''}
              onChange={(e) => {
                const next = [...(settings.promoSlides || [])];
                next[idx] = { ...next[idx], subtitle: e.target.value };
                setSettings({ ...settings, promoSlides: next });
              }}
            />
          </div>
        ))}
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
          Add slide
        </button>
      </section>

      <section className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold">Kiosk name</span>
          <input
            className="input mt-1 w-full"
            value={settings.name || ''}
            onChange={(e) => setSettings({ ...settings, name: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Languages (comma-separated)</span>
          <input
            className="input mt-1 w-full"
            value={(settings.enabledLanguages || []).join(', ')}
            onChange={(e) =>
              setSettings({
                ...settings,
                enabledLanguages: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Default language</span>
          <input
            className="input mt-1 w-full"
            value={settings.defaultLanguage || 'en'}
            onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Table / badge mode</span>
          <select
            className="input mt-1 w-full"
            value={settings.tableMode || 'both'}
            onChange={(e) =>
              setSettings({ ...settings, tableMode: e.target.value as KioskSettings['tableMode'] })
            }
          >
            <option value="both">Table and badge</option>
            <option value="table">Table only</option>
            <option value="badge">Badge number only</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Payment terminal ID</span>
          <input
            className="input mt-1 w-full"
            placeholder="Adyen terminal POI id"
            value={settings.terminalId || ''}
            onChange={(e) => setSettings({ ...settings, terminalId: e.target.value || null })}
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Location slug (optional)</span>
          <input
            className="input mt-1 w-full"
            value={settings.locationSlug || ''}
            onChange={(e) => setSettings({ ...settings, locationSlug: e.target.value || null })}
          />
        </label>
        <label className="flex items-center gap-2 md:col-span-2">
          <input
            type="checkbox"
            checked={settings.membershipScanEnabled !== false}
            onChange={(e) => setSettings({ ...settings, membershipScanEnabled: e.target.checked })}
          />
          <span className="text-sm">Offer membership QR scan step</span>
        </label>
        <label className="flex items-center gap-2 md:col-span-2">
          <input
            type="checkbox"
            checked={settings.kioskCashNeedsApproval !== false}
            onChange={(e) => setSettings({ ...settings, kioskCashNeedsApproval: e.target.checked })}
          />
          <span className="text-sm">Cash orders need staff approval in Order Hub</span>
        </label>
      </section>

      <button type="button" className="btn-primary" disabled={saving || !enabled} onClick={() => void save()}>
        {saving ? 'Saving…' : 'Save kiosk settings'}
      </button>
    </div>
  );
}
