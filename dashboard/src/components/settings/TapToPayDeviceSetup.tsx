import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { isAndroidWebPosTill, probePrintAgentHealth } from '@/lib/print-agent';
import {
  getDeviceBridgeHealth,
  registerDeviceBridgeTapToPay,
} from '@/lib/device-bridge';

type Props = {
  adyenReady: boolean;
  tapToPayEnabled: boolean;
};

export default function TapToPayDeviceSetup({ adyenReady, tapToPayEnabled }: Props) {
  const { t } = useI18n();
  const [bridgeOk, setBridgeOk] = useState(false);
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAndroidWebPosTill()) return;
    const agent = await probePrintAgentHealth(3);
    setBridgeOk(agent.ok);
    if (!agent.ok) {
      setRegistered(false);
      setMessage(t('tapToPayDeviceBridgeOffline'));
      return;
    }
    const health = await getDeviceBridgeHealth();
    setRegistered(health.tapToPayRegistered === true || health.tapToPayReady === true);
    setMessage(health.tapToPayMessage || null);
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!isAndroidWebPosTill()) return null;

  const canActivate = adyenReady && tapToPayEnabled && bridgeOk && registered !== true;

  const activate = async () => {
    setBusy(true);
    try {
      const result = await registerDeviceBridgeTapToPay();
      if (result.ok) {
        toast.success(result.message || t('tapToPayDeviceActivated'));
        await refresh();
      } else {
        toast.error(result.message || t('tapToPayDeviceActivateFailed'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50/80 p-3 dark:border-teal-900 dark:bg-teal-950/30">
      <p className="text-sm font-medium text-teal-900 dark:text-teal-100">
        {t('tapToPayDeviceSetupTitle')}
      </p>
      <p className="mt-1 text-xs text-teal-800/90 dark:text-teal-200/80">
        {t('tapToPayDeviceSetupHint')}
      </p>
      <p className="mt-2 text-xs text-stone-600 dark:text-stone-400">
        {registered === true
          ? t('tapToPayDeviceRegistered')
          : message || t('tapToPayDeviceNotRegistered')}
      </p>
      {canActivate && (
        <button
          type="button"
          className="btn btn-primary mt-3 inline-flex items-center gap-2 text-sm"
          disabled={busy}
          onClick={() => void activate()}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('tapToPayDeviceActivate')}
        </button>
      )}
      {!bridgeOk && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          {t('tapToPayDeviceOpenBridge')}
        </p>
      )}
    </div>
  );
}
