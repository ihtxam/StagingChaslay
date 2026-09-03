import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Loader2, Nfc, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { isAndroidWebPosTill, probePrintAgentHealth } from '@/lib/print-agent';
import {
  getDeviceBridgeHealth,
  registerDeviceBridgeTapToPay,
} from '@/lib/device-bridge';

export const WEBPOS_TAP_TO_PAY_SETUP_KEY = 'webpos_tap_to_pay_setup_done';

type Props = {
  open: boolean;
  adyenReady: boolean;
  tapToPayEnabled: boolean;
  onClose: () => void;
  onActivated?: () => void;
};

export function readWebPosTapToPaySetupDone(): boolean {
  try {
    return localStorage.getItem(WEBPOS_TAP_TO_PAY_SETUP_KEY) === '1';
  } catch {
    return false;
  }
}

export function markWebPosTapToPaySetupDone(): void {
  try {
    localStorage.setItem(WEBPOS_TAP_TO_PAY_SETUP_KEY, '1');
  } catch {
    /* ignore */
  }
}

export default function WebPosTapToPaySetupModal({
  open,
  adyenReady,
  tapToPayEnabled,
  onClose,
  onActivated,
}: Props) {
  const { t } = useI18n();
  const [bridgeOk, setBridgeOk] = useState(false);
  const [hasAdyenSdk, setHasAdyenSdk] = useState<boolean | null>(null);
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAndroidWebPosTill()) return;
    const agent = await probePrintAgentHealth(4);
    setBridgeOk(agent.ok);
    if (!agent.ok) {
      setRegistered(false);
      setHasAdyenSdk(null);
      setMessage(t('tapToPayDeviceBridgeOffline'));
      return;
    }
    const health = await getDeviceBridgeHealth();
    setHasAdyenSdk(health.hasAdyenSdk === true);
    setRegistered(health.tapToPayRegistered === true || health.tapToPayReady === true);
    setMessage(health.tapToPayMessage || null);
  }, [t]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  if (!open || !isAndroidWebPosTill()) return null;

  const canActivate =
    adyenReady && tapToPayEnabled && bridgeOk && hasAdyenSdk === true && registered !== true;

  const finish = () => {
    if (registered) markWebPosTapToPaySetupDone();
    onClose();
  };

  const activate = async () => {
    setBusy(true);
    try {
      const result = await registerDeviceBridgeTapToPay();
      if (result.ok) {
        toast.success(result.message || t('tapToPayDeviceActivated'));
        markWebPosTapToPaySetupDone();
        onActivated?.();
        await refresh();
        onClose();
      } else {
        toast.error(result.message || t('tapToPayDeviceActivateFailed'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-teal-200 bg-white p-5 shadow-2xl dark:border-teal-900 dark:bg-stone-900"
      >
        <div className="flex items-start gap-3">
          <Nfc className="mt-0.5 h-7 w-7 shrink-0 text-teal-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              {t('webPosTapToPaySetupTitle')}
            </h2>
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
              {t('webPosTapToPaySetupBody')}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-stone-700 dark:text-stone-300">
              <li className="flex items-start gap-2">
                <CheckCircle2
                  className={`mt-0.5 h-4 w-4 shrink-0 ${bridgeOk ? 'text-emerald-600' : 'text-stone-300'}`}
                />
                {t('webPosTapToPaySetupStepBridge')}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2
                  className={`mt-0.5 h-4 w-4 shrink-0 ${hasAdyenSdk ? 'text-emerald-600' : 'text-stone-300'}`}
                />
                {hasAdyenSdk === false
                  ? t('webPosTapToPaySetupStepSdkMissing')
                  : t('webPosTapToPaySetupStepSdk')}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2
                  className={`mt-0.5 h-4 w-4 shrink-0 ${registered ? 'text-emerald-600' : 'text-stone-300'}`}
                />
                {registered ? t('tapToPayDeviceRegistered') : t('webPosTapToPaySetupStepActivate')}
              </li>
            </ul>
            {message && !registered && (
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">{message}</p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {canActivate && (
                <button
                  type="button"
                  className="webpos-accent-btn inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold"
                  disabled={busy}
                  onClick={() => void activate()}
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('tapToPayDeviceActivate')}
                </button>
              )}
              <button
                type="button"
                className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 dark:border-stone-600 dark:text-stone-200"
                onClick={finish}
              >
                {registered ? t('webPosTourDone') : t('webPosTapToPaySetupLater')}
              </button>
            </div>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg p-1 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
            aria-label={t('close')}
            onClick={finish}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
