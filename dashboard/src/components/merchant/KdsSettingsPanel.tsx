import { useCallback, useEffect, useState } from 'react';
import { Copy, Plus, RefreshCw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type KdsStation = {
  id: string;
  name: string;
  token: string;
  orderTypes: string[];
  categoryIds: string[];
  productIds: string[];
  isActive: boolean;
};

const CHANNELS = ['takeaway', 'dine_in', 'delivery'] as const;

function kdsPublicUrl(token: string): string {
  const origin =
    (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://app.chaslay.com');
  return `${origin.replace(/\/$/, '')}/kds/${token}`;
}

export default function KdsSettingsPanel() {
  const { t } = useI18n();
  const [stations, setStations] = useState<KdsStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [orderTypes, setOrderTypes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [licenseError, setLicenseError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/kds/stations');
      setStations(res.data?.stations || []);
      setLicenseError(false);
    } catch (e: any) {
      if (e.response?.data?.code === 'KDS_ADDON_REQUIRED') {
        setLicenseError(true);
        setStations([]);
      } else {
        toast.error(e.response?.data?.error || t('kdsLoadFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const createStation = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await api.post('/merchant/kds/stations', {
        name: trimmed,
        orderTypes,
      });
      setName('');
      setOrderTypes([]);
      toast.success(t('kdsStationCreated'));
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('kdsActionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const rotateToken = async (id: string) => {
    try {
      await api.post(`/merchant/kds/stations/${id}/rotate-token`);
      toast.success(t('kdsTokenRotated'));
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('kdsActionFailed'));
    }
  };

  const removeStation = async (id: string) => {
    if (!window.confirm(t('kdsDeleteConfirm'))) return;
    try {
      await api.delete(`/merchant/kds/stations/${id}`);
      toast.success(t('kdsStationDeleted'));
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('kdsActionFailed'));
    }
  };

  const copyUrl = async (token: string) => {
    const url = kdsPublicUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('kdsUrlCopied'));
    } catch {
      toast.error(url);
    }
  };

  const toggleChannel = (ch: string) => {
    setOrderTypes((prev) => (prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]));
  };

  if (licenseError) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {t('kdsAddonRequired')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{t('kdsSettingsTitle')}</h3>
        <p className="mt-1 text-sm text-stone-500">{t('kdsSettingsHint')}</p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
        <p className="text-sm font-medium">{t('kdsAddStation')}</p>
        <input
          className="input w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('kdsStationNamePlaceholder')}
        />
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => toggleChannel(ch)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                orderTypes.includes(ch)
                  ? 'bg-teal-600 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {ch}
            </button>
          ))}
        </div>
        <p className="text-xs text-stone-500">{t('kdsChannelFilterHint')}</p>
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => void createStation()}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t('kdsAddStation')}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">{t('loading')}</p>
      ) : !stations.length ? (
        <p className="text-sm text-stone-500">{t('kdsNoStations')}</p>
      ) : (
        <ul className="space-y-3">
          {stations.map((s) => {
            const url = kdsPublicUrl(s.token);
            return (
              <li key={s.id} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <p className="mt-1 break-all font-mono text-xs text-stone-500">{url}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-stone-300 p-2 hover:bg-stone-50"
                      title={t('kdsCopyUrl')}
                      onClick={() => void copyUrl(s.token)}
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-stone-300 p-2 hover:bg-stone-50"
                      title={t('kdsRotateToken')}
                      onClick={() => void rotateToken(s.id)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50"
                      title={t('delete')}
                      onClick={() => void removeStation(s.id)}
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
