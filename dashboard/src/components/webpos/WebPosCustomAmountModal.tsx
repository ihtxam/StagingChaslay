import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { roundMoney2 } from '@/lib/money';
import { isAndroidDevice } from '@/lib/print-agent-platform';
import {
  formatScalePortLabel,
  formatScaleUsbLabel,
  isPrintAgentAvailable,
  isUsbScaleAddress,
  readScaleWeight,
  type ScaleReading,
} from '@/lib/print-agent';
import WebPosKeypadModalShell from './WebPosKeypadModalShell';
import WebPosNumericKeypad from './WebPosNumericKeypad';

export type WebPosCustomAmountConfirm = {
  amount: number;
  weightKg?: number;
  pricePerKg?: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: WebPosCustomAmountConfirm) => void;
  scaleEnabled?: boolean;
  configuredPort?: string | null;
  configuredUsbAddress?: string | null;
  configuredDeviceName?: string | null;
  configuredDeviceId?: string | null;
  onPortResolved?: (port: string) => void;
  onUsbAddressResolved?: (address: string) => void;
};

const POLL_INTERVAL_MS = 700;
const READ_TIMEOUT_MS = 1200;
const REOPEN_SETTLE_MS = 350;

export default function WebPosCustomAmountModal({
  open,
  onClose,
  onConfirm,
  scaleEnabled = false,
  configuredPort,
  configuredUsbAddress,
  configuredDeviceName,
  configuredDeviceId,
  onPortResolved,
  onUsbAddressResolved,
}: Props) {
  const { t } = useI18n();
  const [buffer, setBuffer] = useState('');
  const [scaleReading, setScaleReading] = useState<ScaleReading | null>(null);
  const [scaleMsg, setScaleMsg] = useState('');
  const [agentOk, setAgentOk] = useState(false);
  const pollSessionRef = useRef(0);
  const addressRef = useRef('');
  const onPortResolvedRef = useRef(onPortResolved);
  const onUsbAddressResolvedRef = useRef(onUsbAddressResolved);

  const fixedPort = (configuredPort || '').trim();
  const fixedUsb = (configuredUsbAddress || '').trim();
  const deviceHint = (configuredDeviceName || '').trim();
  const deviceId = (configuredDeviceId || '').trim();
  const useUsbScale = isUsbScaleAddress(fixedUsb) || isUsbScaleAddress(fixedPort);
  const scaleConfigured = !!(fixedPort || fixedUsb || deviceHint || deviceId);
  const scaleActive = scaleEnabled && scaleConfigured;

  onPortResolvedRef.current = onPortResolved;
  onUsbAddressResolvedRef.current = onUsbAddressResolved;

  const liveWeightKg = useMemo(() => {
    const kg = scaleReading?.weightKg;
    return kg != null && Number.isFinite(kg) && kg > 0 ? kg : 0;
  }, [scaleReading]);

  const weighedMode = scaleActive && liveWeightKg > 0;
  const entered = roundMoney2(Math.max(0, Number(buffer) || 0));
  const lineTotal = weighedMode
    ? roundMoney2(liveWeightKg * entered)
    : entered;

  const display = weighedMode
    ? `CHF ${buffer || '0'}/kg × ${liveWeightKg.toFixed(3)} kg`
    : `CHF ${buffer || '0'}`;

  useEffect(() => {
    if (!open) return;
    const session = ++pollSessionRef.current;
    setBuffer('');
    setScaleReading(null);
    setScaleMsg('');
    const initialAddress = useUsbScale
      ? fixedUsb || fixedPort
      : fixedPort
        ? formatScalePortLabel(fixedPort)
        : '';
    addressRef.current = initialAddress;
    if (!scaleActive) {
      setAgentOk(false);
      return;
    }
    setAgentOk(false);
    void (async () => {
      const ok = await isPrintAgentAvailable();
      if (pollSessionRef.current !== session) return;
      setAgentOk(ok);
    })();
  }, [open, scaleActive, fixedPort, fixedUsb, useUsbScale]);

  useEffect(() => {
    if (!open || !scaleActive || !agentOk) return;

    const session = pollSessionRef.current;
    let stopped = false;

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      });

    const pollLoop = async () => {
      await sleep(REOPEN_SETTLE_MS);
      while (!stopped && pollSessionRef.current === session) {
        const address = addressRef.current;
        try {
          const res = await readScaleWeight(useUsbScale ? '' : address, READ_TIMEOUT_MS, {
            hint: deviceHint || null,
            deviceId: deviceId || null,
            usbAddress: useUsbScale ? address || fixedUsb || fixedPort : null,
          });
          if (stopped || pollSessionRef.current !== session) return;
          if (res.resolvedPort) {
            const resolved = formatScalePortLabel(res.resolvedPort);
            if (resolved !== addressRef.current) {
              addressRef.current = resolved;
              onPortResolvedRef.current?.(resolved);
            }
          }
          if (res.resolvedUsbAddress) {
            const resolved = res.resolvedUsbAddress.trim();
            if (resolved && resolved !== addressRef.current) {
              addressRef.current = resolved;
              onUsbAddressResolvedRef.current?.(resolved);
            }
          }
          if (res.reading) {
            setScaleReading(res.reading);
            setScaleMsg('');
          } else if (res.message) {
            setScaleMsg(res.message);
          }
        } catch (e: unknown) {
          if (!stopped && pollSessionRef.current === session) {
            const msg = e instanceof Error ? e.message : '';
            setScaleMsg(msg || t('webPosScaleReadFailed'));
          }
        }
        if (stopped || pollSessionRef.current !== session) return;
        await sleep(POLL_INTERVAL_MS);
      }
    };

    void pollLoop();

    return () => {
      stopped = true;
    };
  }, [open, scaleActive, agentOk, deviceHint, deviceId, fixedUsb, useUsbScale, t]);

  const confirm = () => {
    if (lineTotal <= 0) return;
    if (weighedMode) {
      onConfirm({ amount: lineTotal, weightKg: liveWeightKg, pricePerKg: entered });
    } else {
      onConfirm({ amount: lineTotal });
    }
    onClose();
  };

  const subtitle = weighedMode
    ? t('webPosCustomAmountHintRate')
    : t('webPosCustomAmountHint');

  const scaleHint = useMemo(() => {
    if (!scaleActive) return null;
    if (!agentOk) {
      return isAndroidDevice() ? t('webPosScaleBridgeOffline') : t('webPosScaleAgentOffline');
    }
    if (liveWeightKg > 0) {
      return `${t('webPosScaleLive')}: ${liveWeightKg.toFixed(3)} kg`;
    }
    return scaleMsg || t('webPosScaleWaiting');
  }, [scaleActive, agentOk, liveWeightKg, scaleMsg, t]);

  return (
    <WebPosKeypadModalShell open={open} onClose={onClose} title={t('webPosCustomAmount')} subtitle={subtitle}>
      <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-right">
        <p className="text-2xl font-bold tabular-nums">{display}</p>
        {weighedMode ? (
          <p className="mt-1 text-sm font-semibold tabular-nums text-stone-600">
            = CHF {lineTotal.toFixed(2)}
          </p>
        ) : null}
        {scaleHint ? (
          <p className="mt-2 text-left text-xs text-stone-500">{scaleHint}</p>
        ) : null}
      </div>
      <WebPosNumericKeypad
        mode="price"
        onModeChange={() => undefined}
        buffer={buffer}
        onBufferChange={setBuffer}
        onApply={confirm}
        showModeButtons={false}
        showQuickAdd={false}
        showSignToggle={false}
        hideApply
      />
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          className="rounded-lg border border-stone-200 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50"
          onClick={() => setBuffer('')}
        >
          {t('clear')}
        </button>
        <button
          type="button"
          className="webpos-accent-btn rounded-lg py-3 text-sm font-semibold disabled:opacity-40"
          disabled={lineTotal <= 0}
          onClick={confirm}
        >
          {t('webPosAddToCart')}
        </button>
      </div>
    </WebPosKeypadModalShell>
  );
}
