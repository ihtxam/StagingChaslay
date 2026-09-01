import { useCallback, useEffect, useState } from 'react';
import { Minus, Plus, Volume2, VolumeX } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import AcceptingMenu from '@/components/AcceptingMenu';
import { useI18n } from '@/lib/i18n';
import { readDeliveryAutoAccept } from '@/lib/delivery-auto-accept';
import {
  isDeliveryHubSpeechEnabled,
  setDeliveryHubSpeechEnabled,
} from '@/lib/delivery-hub-alerts';

type Props = {
  showAcceptingMenu?: boolean;
  className?: string;
};

/**
 * Shared online-order controls from the delivery portal: shop pause, auto-accept,
 * takeaway/delivery prep times, and voice alert mute.
 */
export default function OnlineOrderOpsBar({ showAcceptingMenu = true, className = '' }: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [autoAccept, setAutoAccept] = useState(false);
  const [pickupEta, setPickupEta] = useState(25);
  const [deliveryEta, setDeliveryEta] = useState(45);
  const [speechOn, setSpeechOn] = useState(() => isDeliveryHubSpeechEnabled());

  const load = useCallback(async () => {
    try {
      const res = await api.get('/merchant/settings');
      const s = res.data?.settings || res.data || {};
      setPickupEta(Number(s.pickupEtaMinutes) || 25);
      setDeliveryEta(Number(s.deliveryEtaMinutes) || 45);
      setAutoAccept(readDeliveryAutoAccept(s));
    } catch {
      /* keep defaults */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveEta = async (patch: { pickupEtaMinutes?: number; deliveryEtaMinutes?: number }) => {
    try {
      await api.put('/merchant/settings', patch);
    } catch {
      toast.error(t('actionFailed'));
    }
  };

  const toggleAutoAccept = async () => {
    const next = !autoAccept;
    try {
      const settingsRes = await api.get('/merchant/settings');
      const s = settingsRes.data?.settings || settingsRes.data || {};
      const dp = s.deliveryPlatformSettings || {};
      await api.put('/merchant/settings', {
        deliveryPlatformSettings: {
          ...dp,
          onlineShopAutoAccept: next,
          justEat: { ...(dp.justEat || {}), autoAccept: next },
          uberEats: { ...(dp.uberEats || {}), autoAccept: next },
        },
      });
      setAutoAccept(next);
      toast.success(t('updated'));
    } catch {
      toast.error(t('actionFailed'));
    }
  };

  if (loading) {
    return (
      <div className={`rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3 text-sm text-[var(--text-muted)] ${className}`}>
        {t('loading')}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3 shadow-sm ${className}`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{t('ovOnlineOpsTitle')}</h2>
          <p className="text-xs text-[var(--text-muted)]">{t('ovOnlineOpsSub')}</p>
        </div>
        {showAcceptingMenu ? <AcceptingMenu /> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
            autoAccept
              ? 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
              : 'border-[var(--border)] bg-[var(--bg-muted)]'
          }`}
          onClick={() => void toggleAutoAccept()}
        >
          {t('deliveryHubAutoAccept')}: {autoAccept ? t('yes') : t('no')}
        </button>

        <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-2 py-1.5 text-xs">
          <span className="font-semibold">{t('orderCenterPrepTakeaway')}</span>
          <button
            type="button"
            className="rounded p-0.5 hover:bg-[var(--bg-elevated)]"
            aria-label={t('decrease')}
            onClick={() => {
              const n = Math.max(5, pickupEta - 5);
              setPickupEta(n);
              void saveEta({ pickupEtaMinutes: n });
            }}
          >
            <Minus size={12} />
          </button>
          <span className="w-7 text-center font-bold tabular-nums">{pickupEta}</span>
          <button
            type="button"
            className="rounded p-0.5 hover:bg-[var(--bg-elevated)]"
            aria-label={t('increase')}
            onClick={() => {
              const n = Math.min(180, pickupEta + 5);
              setPickupEta(n);
              void saveEta({ pickupEtaMinutes: n });
            }}
          >
            <Plus size={12} />
          </button>
          <span className="text-[var(--text-muted)]">{t('minutes')}</span>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-2 py-1.5 text-xs">
          <span className="font-semibold">{t('orderCenterPrepDelivery')}</span>
          <button
            type="button"
            className="rounded p-0.5 hover:bg-[var(--bg-elevated)]"
            aria-label={t('decrease')}
            onClick={() => {
              const n = Math.max(5, deliveryEta - 5);
              setDeliveryEta(n);
              void saveEta({ deliveryEtaMinutes: n });
            }}
          >
            <Minus size={12} />
          </button>
          <span className="w-7 text-center font-bold tabular-nums">{deliveryEta}</span>
          <button
            type="button"
            className="rounded p-0.5 hover:bg-[var(--bg-elevated)]"
            aria-label={t('increase')}
            onClick={() => {
              const n = Math.min(180, deliveryEta + 5);
              setDeliveryEta(n);
              void saveEta({ deliveryEtaMinutes: n });
            }}
          >
            <Plus size={12} />
          </button>
          <span className="text-[var(--text-muted)]">{t('minutes')}</span>
        </div>

        <button
          type="button"
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] p-2"
          title={speechOn ? t('deliveryHubSoundOff') : t('deliveryHubSoundOn')}
          onClick={() => {
            const next = !speechOn;
            setSpeechOn(next);
            setDeliveryHubSpeechEnabled(next);
          }}
        >
          {speechOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </div>
    </div>
  );
}
