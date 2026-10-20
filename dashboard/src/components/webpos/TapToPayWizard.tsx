import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
  Nfc,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  probeDeviceBridgeHealth,
  registerDeviceBridgeTapToPay,
  requestBridgeRebornAutostart,
  runDeviceBridgeTapToPay,
  type DeviceBridgeHealth,
} from '@/lib/device-bridge';
import {
  fetchPrintBridgeManifest,
  openPrintBridgeApkInstall,
  type DownloadManifest,
} from '@/lib/print-agent-platform';
import { isAndroidWebPosTill } from '@/lib/print-agent';
import {
  buildTapToPayWizardSteps,
  tapToPayErrorMessageKey,
  tapToPayWizardComplete,
  type TapToPayWizardStep,
  type TapToPayWizardStepStatus,
} from '@/lib/tap-to-pay-wizard-steps';

export const WEBPOS_TAP_TO_PAY_SETUP_KEY = 'webpos_tap_to_pay_setup_done';

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

type Props = {
  adyenReady: boolean;
  tapToPayEnabled: boolean;
  /** When false, wizard still renders but shows a desktop-only hint */
  compact?: boolean;
  onActivated?: () => void;
  onComplete?: () => void;
};

function StepIcon({ status }: { status: TapToPayWizardStepStatus }) {
  if (status === 'ok') {
    return <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />;
  }
  if (status === 'error') {
    return <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />;
  }
  if (status === 'warn') {
    return <Circle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden />;
  }
  return <Circle className="mt-0.5 h-5 w-5 shrink-0 text-stone-300" aria-hidden />;
}

function stepTitleKey(id: TapToPayWizardStep['id']): string {
  const map: Record<TapToPayWizardStep['id'], string> = {
    bridgeInstall: 'tapToPayWizardStepInstall',
    bridgeRunning: 'tapToPayWizardStepRunning',
    panelEnabled: 'tapToPayWizardStepPanel',
    register: 'tapToPayWizardStepRegister',
    ready: 'tapToPayWizardStepReady',
    test: 'tapToPayWizardStepTest',
  };
  return map[id];
}

function stepHintKey(id: TapToPayWizardStep['id']): string {
  const map: Record<TapToPayWizardStep['id'], string> = {
    bridgeInstall: 'tapToPayWizardHintInstall',
    bridgeRunning: 'tapToPayWizardHintRunning',
    panelEnabled: 'tapToPayWizardHintPanel',
    register: 'tapToPayWizardHintRegister',
    ready: 'tapToPayWizardHintReady',
    test: 'tapToPayWizardHintTest',
  };
  return map[id];
}

export default function TapToPayWizard({
  adyenReady,
  tapToPayEnabled,
  compact = false,
  onActivated,
  onComplete,
}: Props) {
  const { t } = useI18n();
  const [health, setHealth] = useState<DeviceBridgeHealth>({ ok: false });
  const [manifest, setManifest] = useState<DownloadManifest | null>(null);
  const [bridgeMessage, setBridgeMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAndroidWebPosTill()) return;
    setRefreshing(true);
    try {
      const [h, m] = await Promise.all([
        probeDeviceBridgeHealth(4),
        fetchPrintBridgeManifest().catch(() => null),
      ]);
      setHealth(h);
      setManifest(m);
      setBridgeMessage(h.tapToPayMessage || null);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const steps = useMemo(
    () =>
      buildTapToPayWizardSteps({
        bridgeHealth: health,
        serverBridgeVersion: manifest?.version,
        adyenReady,
        tapToPayEnabled,
      }),
    [health, manifest?.version, adyenReady, tapToPayEnabled]
  );

  const complete = tapToPayWizardComplete(steps);
  const errorKey = tapToPayErrorMessageKey(bridgeMessage);
  const errorText = errorKey ? t(errorKey) : bridgeMessage;

  useEffect(() => {
    if (complete) {
      markWebPosTapToPaySetupDone();
      onComplete?.();
    }
  }, [complete, onComplete]);

  if (!isAndroidWebPosTill()) {
    return (
      <p className="text-sm text-stone-600 dark:text-stone-300">{t('tapToPayWizardAndroidOnly')}</p>
    );
  }

  const openBridge = () => {
    requestBridgeRebornAutostart({ cooldownMs: 0, bypassCooldown: true });
    window.setTimeout(() => void refresh(), 2_500);
  };

  const installBridge = () => {
    openPrintBridgeApkInstall(manifest?.downloadUrl || undefined);
  };

  const panelUrl = '/merchant/settings?tab=payments#payments-tap-to-pay';

  const activate = async () => {
    setBusy(true);
    try {
      const result = await registerDeviceBridgeTapToPay();
      if (result.ok) {
        toast.success(result.message || t('tapToPayDeviceActivated'));
        markWebPosTapToPaySetupDone();
        onActivated?.();
        await refresh();
      } else {
        toast.error(result.message || t('tapToPayDeviceActivateFailed'));
        setBridgeMessage(result.message || null);
      }
    } finally {
      setBusy(false);
    }
  };

  const runTestPayment = async () => {
    setTestBusy(true);
    try {
      const token = String(localStorage.getItem('token') || '').trim();
      if (!token) {
        toast.error(t('webPosTapToPaySignIn'));
        return;
      }
      const { resolveApiOriginForBridge } = await import('@/lib/api');
      const apiBase = resolveApiOriginForBridge();
      const result = await runDeviceBridgeTapToPay(
        {
          amountMinor: 100,
          currency: 'CHF',
          apiBaseUrl: apiBase,
          authToken: token,
          reference: `ttp-wizard-test-${Date.now()}`,
        },
        { timeoutMs: 120_000 }
      );
      if (result.ok) {
        toast.success(t('tapToPayWizardTestOk'));
        markWebPosTapToPaySetupDone();
      } else if (result.status === 'cancelled') {
        toast(t('webPosPayCancelledMsg'));
      } else {
        toast.error(result.message || t('tapToPayDeviceActivateFailed'));
      }
      await refresh();
    } finally {
      setTestBusy(false);
    }
  };

  const registerStep = steps.find((s) => s.id === 'register');
  const canActivate =
    registerStep?.status === 'warn' && adyenReady && tapToPayEnabled && health.hasAdyenSdk === true;

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {!compact ? (
        <div className="flex items-start gap-3">
          <Nfc className="mt-0.5 h-7 w-7 shrink-0 text-teal-600" aria-hidden />
          <div>
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              {t('webPosTapToPaySetupTitle')}
            </h2>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
              {t('tapToPayWizardIntro')}
            </p>
          </div>
        </div>
      ) : null}

      <ul className="space-y-3">
        {steps.map((step) => (
          <li
            key={step.id}
            className="rounded-xl border border-stone-200 bg-stone-50/80 p-3 dark:border-stone-700 dark:bg-stone-900/40"
          >
            <div className="flex items-start gap-2">
              <StepIcon status={step.status} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  {t(stepTitleKey(step.id))}
                </p>
                <p className="mt-0.5 text-xs text-stone-600 dark:text-stone-400">
                  {t(stepHintKey(step.id))}
                  {step.id === 'bridgeInstall' && step.detail
                    ? ` (${t('tapToPayWizardInstalledVersion').replace('{v}', step.detail)})`
                    : null}
                  {step.id === 'bridgeInstall' && manifest?.version
                    ? ` · ${t('tapToPayWizardLatestVersion').replace('{v}', String(manifest.version))}`
                    : null}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {errorText && !complete ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {errorText}
        </p>
      ) : null}

      {complete ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          {t('tapToPayWizardAllReady')}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 dark:border-stone-600 dark:text-stone-200"
          disabled={refreshing}
          onClick={() => void refresh()}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {t('tapToPayWizardRefresh')}
        </button>
        {!health.ok || steps.find((s) => s.id === 'bridgeInstall')?.status !== 'ok' ? (
          <button
            type="button"
            className="webpos-accent-btn rounded-lg px-3 py-2 text-xs font-bold"
            onClick={installBridge}
          >
            {t('downloadPrintBridge')}
          </button>
        ) : null}
        {!health.ok ? (
          <button
            type="button"
            className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-100"
            onClick={openBridge}
          >
            {t('tapToPayWizardOpenBridge')}
          </button>
        ) : null}
        {(!adyenReady || !tapToPayEnabled) && (
          <a
            href={panelUrl}
            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 dark:border-stone-600 dark:text-stone-200"
          >
            {t('tapToPayWizardOpenPanel')}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {canActivate ? (
          <button
            type="button"
            className="webpos-accent-btn inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold"
            disabled={busy}
            onClick={() => void activate()}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('tapToPayDeviceActivate')}
          </button>
        ) : null}
        {complete ? (
          <button
            type="button"
            className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 dark:border-stone-600 dark:text-stone-200"
            disabled={testBusy}
            onClick={() => void runTestPayment()}
          >
            {testBusy ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : null}
            {t('tapToPayWizardTestPayment')}
          </button>
        ) : null}
      </div>
      <p className="text-[10px] leading-snug text-stone-500 dark:text-stone-400">
        {t('tapToPayWizardSdkNote')}
      </p>
    </div>
  );
}
