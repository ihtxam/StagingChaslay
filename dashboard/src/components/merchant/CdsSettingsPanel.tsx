import { useCallback, useEffect, useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import KioskSlideEditor from '@/components/kiosk/KioskSlideEditor';
import { cdsPublicUrl } from '@/lib/customer-display-sync';
import type { KioskPromoSlide } from '@/lib/kiosk-api';
import { useI18n } from '@/lib/i18n';

type CdsSettings = {
  accessToken?: string;
  shortCode?: string | null;
  enabled?: boolean;
  promoSlides?: KioskPromoSlide[];
  slideIntervalSec?: number;
  theme?: 'light' | 'dark';
};

const PANEL_CARD = 'rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]';

export default function CdsSettingsPanel() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<CdsSettings | null>(null);
  const [displayUrl, setDisplayUrl] = useState('');
  const [merchantSlug, setMerchantSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/cds/settings');
      setSettings(res.data?.settings || null);
      setMerchantSlug(res.data?.merchantSlug || null);
      setDisplayUrl(
        String(res.data?.displayUrl || '') ||
          cdsPublicUrl({
            merchantSlug: res.data?.merchantSlug,
            shortCode: res.data?.settings?.shortCode,
          })
      );
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('cdsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (patch: Partial<CdsSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSaving(true);
    try {
      const res = await api.put('/merchant/cds/settings', { settings: next });
      setSettings(res.data?.settings || next);
      if (res.data?.displayUrl) setDisplayUrl(String(res.data.displayUrl));
      if (res.data?.merchantSlug) setMerchantSlug(res.data.merchantSlug);
      toast.success(t('cdsSettingsSaved'));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('cdsActionFailed'));
    } finally {
      setSaving(false);
    }
  };

  const rotateToken = async () => {
    if (!window.confirm(t('cdsRotateConfirm'))) return;
    try {
      const res = await api.post('/merchant/cds/settings/rotate-token');
      setSettings(res.data?.settings || settings);
      if (res.data?.displayUrl) setDisplayUrl(String(res.data.displayUrl));
      toast.success(t('cdsTokenRotated'));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('cdsActionFailed'));
    }
  };

  const copyUrl = async () => {
    const url =
      displayUrl ||
      cdsPublicUrl({ merchantSlug, shortCode: settings?.shortCode });
    if (!url || url.endsWith('/cds/')) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('cdsUrlCopied'));
    } catch {
      toast.error(url);
    }
  };

  if (loading) {
    return <p className="text-sm muted">{t('loading')}</p>;
  }

  if (!settings) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {t('cdsLoadFailed')}
      </div>
    );
  }

  const slides = settings.promoSlides?.length ? settings.promoSlides : [{ title: '', subtitle: '' }];

  return (
    <div className="space-y-4">
      <div className={`${PANEL_CARD} p-4 space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{t('cdsEnableTitle')}</p>
            <p className="text-xs text-[var(--text-muted)]">{t('cdsEnableHint')}</p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save({ enabled: !settings.enabled })}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
              settings.enabled
                ? 'bg-emerald-600 text-white'
                : 'bg-[var(--bg-muted)] text-[var(--text)]'
            }`}
          >
            {settings.enabled ? t('webPosToggleOn') : t('webPosToggleOff')}
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('cdsDisplayUrl')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 break-all rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2 text-xs">
              {displayUrl || (merchantSlug || settings.shortCode ? cdsPublicUrl({ merchantSlug, shortCode: settings.shortCode }) : '—')}
            </code>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold hover:bg-[var(--bg-muted)]"
              onClick={() => void copyUrl()}
            >
              <Copy className="h-4 w-4" />
              {t('copy')}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold hover:bg-[var(--bg-muted)]"
              onClick={() => void rotateToken()}
            >
              <RefreshCw className="h-4 w-4" />
              {t('cdsRotateToken')}
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">{t('cdsUrlHint')}</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('cdsTheme')}</p>
          <div className="flex flex-wrap gap-2">
            {(['light', 'dark'] as const).map((th) => (
              <button
                key={th}
                type="button"
                disabled={saving}
                onClick={() => void save({ theme: th })}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
                  (settings.theme || 'light') === th
                    ? 'bg-teal-600 text-white'
                    : 'bg-[var(--bg-muted)] text-[var(--text)]'
                }`}
              >
                {t(`cdsTheme_${th}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">{t('cdsSlideInterval')}</label>
          <input
            type="number"
            min={3}
            max={60}
            className="input w-28"
            value={settings.slideIntervalSec ?? 8}
            onChange={(e) =>
              setSettings({ ...settings, slideIntervalSec: Number(e.target.value) || 8 })
            }
            onBlur={() => void save({ slideIntervalSec: settings.slideIntervalSec ?? 8 })}
          />
        </div>
      </div>

      <div className={`${PANEL_CARD} p-4 space-y-3`}>
        <p className="text-sm font-medium">{t('cdsPromoSlides')}</p>
        <p className="text-xs text-[var(--text-muted)]">{t('cdsPromoSlidesHint')}</p>
        <KioskSlideEditor
          slides={slides}
          editable
          mode="merchant"
          onChange={(promoSlides) => {
            setSettings({ ...settings, promoSlides });
          }}
        />
        <button
          type="button"
          disabled={saving}
          className="btn btn-primary"
          onClick={() => void save({ promoSlides: settings.promoSlides })}
        >
          {t('save')}
        </button>
      </div>
    </div>
  );
}
