import { useCallback, useEffect, useState } from 'react';
import { Copy, Eraser, Plus, RefreshCw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { clearAllOdsOrders } from '@/lib/ods-push';
import { useI18n } from '@/lib/i18n';

type OdsDisplay = {
  id: string;
  name: string;
  token: string;
  shortCode?: string | null;
  theme: 'light' | 'teal' | 'dark';
  isActive: boolean;
};

const THEMES = ['light', 'teal', 'dark'] as const;

function odsPublicUrl(display: Pick<OdsDisplay, 'shortCode' | 'token'>): string {
  const origin =
    (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://app.chaslay.com');
  const code = (display.shortCode || display.token).trim();
  return `${origin.replace(/\/$/, '')}/ods/${code}`;
}

export default function OdsSettingsPanel() {
  const { t } = useI18n();
  const [displays, setDisplays] = useState<OdsDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [theme, setTheme] = useState<(typeof THEMES)[number]>('light');
  const [busy, setBusy] = useState(false);
  const [licenseError, setLicenseError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/ods/displays');
      setDisplays(res.data?.displays || []);
      setLicenseError(false);
    } catch (e: any) {
      if (e.response?.data?.code === 'ODS_ADDON_REQUIRED') {
        setLicenseError(true);
        setDisplays([]);
      } else {
        toast.error(e.response?.data?.error || t('odsLoadFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const createDisplay = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await api.post('/merchant/ods/displays', { name: trimmed, theme });
      setName('');
      setTheme('light');
      toast.success(t('odsDisplayCreated'));
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('odsActionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const updateTheme = async (id: string, nextTheme: string) => {
    try {
      await api.put(`/merchant/ods/displays/${id}`, { theme: nextTheme });
      toast.success(t('odsThemeUpdated'));
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('odsActionFailed'));
    }
  };

  const rotateToken = async (id: string) => {
    try {
      await api.post(`/merchant/ods/displays/${id}/rotate-token`);
      toast.success(t('odsTokenRotated'));
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('odsActionFailed'));
    }
  };

  const removeDisplay = async (id: string) => {
    if (!window.confirm(t('odsDeleteConfirm'))) return;
    try {
      await api.delete(`/merchant/ods/displays/${id}`);
      toast.success(t('odsDisplayDeleted'));
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('odsActionFailed'));
    }
  };

  const copyUrl = async (display: Pick<OdsDisplay, 'shortCode' | 'token'>) => {
    const url = odsPublicUrl(display);
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('odsUrlCopied'));
    } catch {
      toast.error(url);
    }
  };

  const clearBoard = async () => {
    if (!window.confirm(t('odsClearBoardConfirm'))) return;
    setBusy(true);
    try {
      const { removed, dismissed } = await clearAllOdsOrders();
      toast.success(
        t('odsClearBoardDone')
          .replace('{n}', String(removed))
          .replace('{d}', String(dismissed))
      );
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('odsActionFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (licenseError) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {t('odsAddonRequired')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{t('odsSettingsTitle')}</h3>
        <p className="mt-1 text-sm text-stone-500">{t('odsSettingsHint')}</p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
        <p className="text-sm font-medium text-amber-950">{t('odsClearBoard')}</p>
        <p className="mt-1 text-xs text-amber-900/80">{t('odsClearBoardHint')}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void clearBoard()}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
        >
          <Eraser className="h-4 w-4" aria-hidden />
          {t('odsClearBoard')}
        </button>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
        <p className="text-sm font-medium">{t('odsAddDisplay')}</p>
        <input
          className="input w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('odsDisplayNamePlaceholder')}
        />
        <div className="flex flex-wrap gap-2">
          {THEMES.map((th) => (
            <button
              key={th}
              type="button"
              onClick={() => setTheme(th)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
                theme === th ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {t(`odsTheme_${th}`)}
            </button>
          ))}
        </div>
        <p className="text-xs text-stone-500">{t('odsThemeHint')}</p>
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => void createDisplay()}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t('odsAddDisplay')}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">{t('loading')}</p>
      ) : !displays.length ? (
        <p className="text-sm text-stone-500">{t('odsNoDisplays')}</p>
      ) : (
        <ul className="space-y-3">
          {displays.map((d) => {
            const url = odsPublicUrl(d);
            const code = d.shortCode || d.token.slice(0, 8);
            return (
              <li key={d.id} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{d.name}</p>
                    <p className="mt-1 text-2xl font-mono font-bold tracking-wider text-teal-700">{code}</p>
                    <p className="mt-1 break-all font-mono text-xs text-stone-500">{url}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {THEMES.map((th) => (
                        <button
                          key={th}
                          type="button"
                          onClick={() => void updateTheme(d.id, th)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize ${
                            d.theme === th
                              ? 'bg-teal-600 text-white'
                              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                          }`}
                        >
                          {t(`odsTheme_${th}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-stone-300 p-2 hover:bg-stone-50"
                      title={t('odsCopyUrl')}
                      onClick={() => void copyUrl(d)}
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-stone-300 p-2 hover:bg-stone-50"
                      title={t('odsRotateToken')}
                      onClick={() => void rotateToken(d.id)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50"
                      title={t('delete')}
                      onClick={() => void removeDisplay(d.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
