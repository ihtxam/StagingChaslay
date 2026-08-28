import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Scale, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { roundMoney2 } from '@/lib/money';
import {
  formatScalePortLabel,
  isPrintAgentAvailable,
  readScaleWeight,
  type ScaleReading,
} from '@/lib/print-agent';
import WebPosNumericKeypad from './WebPosNumericKeypad';

type Props = {
  open: boolean;
  productName: string;
  /** Catalog price = CHF per kg */
  pricePerKg: number;
  weightUnit?: 'kg' | 'g' | 'lb' | string | null;
  /** Merchant Settings → Print → Scale COM port (Print Agent). */
  configuredPort?: string | null;
  /** Friendly USB/Bluetooth name so we can find a new COM port after replug. */
  configuredDeviceName?: string | null;
  configuredDeviceId?: string | null;
  /** Called when Print Agent resolves a different COM port (USB replug). */
  onPortResolved?: (port: string) => void;
  onClose: () => void;
  onConfirm: (weightKg: number) => void;
};

function money(n: number) {
  return `CHF ${Number(n || 0).toFixed(2)}`;
}

function formatScaleBuffer(kg: number, unit: 'kg' | 'g'): string {
  if (!Number.isFinite(kg) || kg <= 0) return '';
  return unit === 'g' ? String(Math.round(kg * 1000)) : String(Math.round(kg * 1000) / 1000);
}

export default function WebPosWeightModal({
  open,
  productName,
  pricePerKg,
  weightUnit = 'kg',
  configuredPort,
  configuredDeviceName,
  configuredDeviceId,
  onPortResolved,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const [buffer, setBuffer] = useState('');
  const [entryUnit, setEntryUnit] = useState<'kg' | 'g'>('kg');
  const [scaleReading, setScaleReading] = useState<ScaleReading | null>(null);
  const [scaleMsg, setScaleMsg] = useState('');
  const [activePort, setActivePort] = useState('');
  const [agentOk, setAgentOk] = useState(false);
  const manualOverrideRef = useRef(false);
  const entryUnitRef = useRef<'kg' | 'g'>('kg');

  const fixedPort = (configuredPort || '').trim();
  const portLabel = activePort || (fixedPort ? formatScalePortLabel(fixedPort) : '');
  const deviceHint = (configuredDeviceName || '').trim();
  const deviceId = (configuredDeviceId || '').trim();
  const scaleConfigured = !!(fixedPort || deviceHint || deviceId);

  entryUnitRef.current = entryUnit;

  const applyLiveReading = useCallback((reading: ScaleReading, unit: 'kg' | 'g') => {
    if (manualOverrideRef.current) return;
    if (reading.weightKg > 0) {
      setBuffer(formatScaleBuffer(reading.weightKg, unit));
    }
  }, []);

  const switchEntryUnit = useCallback(
    (next: 'kg' | 'g') => {
      setEntryUnit(next);
      entryUnitRef.current = next;
      manualOverrideRef.current = false;
      const kg =
        scaleReading && scaleReading.weightKg > 0
          ? scaleReading.weightKg
          : (() => {
              const n = Number(buffer);
              if (!Number.isFinite(n) || n <= 0) return 0;
              return entryUnit === 'g' ? n / 1000 : n;
            })();
      if (kg > 0) {
        setBuffer(formatScaleBuffer(kg, next));
      }
    },
    [buffer, entryUnit, scaleReading]
  );

  useEffect(() => {
    if (!open) return;
    setBuffer('');
    setScaleReading(null);
    setScaleMsg('');
    setActivePort('');
    manualOverrideRef.current = false;
    const initialUnit = weightUnit === 'g' ? 'g' : 'kg';
    setEntryUnit(initialUnit);
    entryUnitRef.current = initialUnit;
    if (!scaleConfigured) return;
    void (async () => {
      const ok = await isPrintAgentAvailable();
      setAgentOk(ok);
    })();
  }, [open, weightUnit, scaleConfigured]);

  useEffect(() => {
    if (!open || !scaleConfigured || !agentOk) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await readScaleWeight(portLabel, 800, {
          hint: deviceHint || null,
          deviceId: deviceId || null,
        });
        if (cancelled) return;
        if (res.resolvedPort) {
          const resolved = formatScalePortLabel(res.resolvedPort);
          setActivePort(resolved);
          onPortResolved?.(resolved);
        }
        if (res.reading) {
          setScaleReading(res.reading);
          setScaleMsg('');
          applyLiveReading(res.reading, entryUnitRef.current);
        } else if (res.message) {
          setScaleMsg(res.message);
        }
      } catch (e: any) {
        if (!cancelled) setScaleMsg(e?.message || t('webPosScaleReadFailed'));
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 600);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    open,
    agentOk,
    portLabel,
    deviceHint,
    deviceId,
    t,
    scaleConfigured,
    applyLiveReading,
    onPortResolved,
  ]);

  const weightKg = useMemo(() => {
    const n = Number(buffer);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return entryUnit === 'g' ? n / 1000 : n;
  }, [buffer, entryUnit]);

  const lineTotal = useMemo(
    () => roundMoney2(Math.max(0, weightKg) * Math.max(0, pricePerKg)),
    [weightKg, pricePerKg]
  );

  const displayPort = activePort || (fixedPort ? formatScalePortLabel(fixedPort) : '');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--webpos-border,var(--border))] bg-[var(--webpos-surface,var(--bg-elevated))] text-[var(--webpos-text,var(--text))] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--webpos-border,var(--border))] px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">
              {t('webPosEnterWeight')} — {productName}
            </h3>
            <p className="text-xs text-[var(--webpos-text-muted,var(--text-muted))]">
              {money(pricePerKg)} / kg
            </p>
          </div>
          <button
            type="button"
            className="p-2 text-[var(--webpos-text-muted,var(--text-muted))]"
            onClick={onClose}
            aria-label={t('close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => switchEntryUnit('kg')}
              className={`rounded-lg py-2 text-xs font-bold uppercase ${
                entryUnit === 'kg'
                  ? 'bg-[var(--webpos-accent-soft)] text-[var(--webpos-accent-text)] ring-1 ring-[var(--webpos-accent-ring)]'
                  : 'webpos-keypad-key !py-2 text-xs'
              }`}
            >
              kg
            </button>
            <button
              type="button"
              onClick={() => switchEntryUnit('g')}
              className={`rounded-lg py-2 text-xs font-bold uppercase ${
                entryUnit === 'g'
                  ? 'bg-[var(--webpos-accent-soft)] text-[var(--webpos-accent-text)] ring-1 ring-[var(--webpos-accent-ring)]'
                  : 'webpos-keypad-key !py-2 text-xs'
              }`}
            >
              g
            </button>
          </div>

          <div className="rounded-xl border border-[var(--webpos-border,var(--border))] bg-[var(--webpos-bg,var(--bg))] px-4 py-3 text-right">
            <p className="text-2xl font-semibold tabular-nums">
              {buffer || '0'} {entryUnit}
            </p>
            <p className="mt-1 text-sm text-[var(--webpos-text-muted,var(--text-muted))]">
              = {weightKg > 0 ? weightKg.toFixed(3) : '0.000'} kg · {money(lineTotal)}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--webpos-border,var(--border))] p-2">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--webpos-text-muted,var(--text-muted))]">
              <Scale size={14} />
              {t('webPosScale')}
            </div>
            {!scaleConfigured ? (
              <p className="text-[11px] text-amber-800">{t('webPosScalePortMissing')}</p>
            ) : !agentOk ? (
              <p className="text-[11px] text-[var(--webpos-text-muted,var(--text-muted))]">
                {t('webPosScaleAgentOffline')}
              </p>
            ) : (
              <div className="space-y-0.5 text-[11px] text-[var(--webpos-text-muted,var(--text-muted))]">
                <p>
                  {scaleReading
                    ? `${t('webPosScaleLive')}: ${scaleReading.weightKg.toFixed(3)} kg (${scaleReading.status})`
                    : scaleMsg || t('webPosScaleWaiting')}
                </p>
                {displayPort ? (
                  <p>
                    {t('webPosScalePort')}: {displayPort}
                    {activePort &&
                    fixedPort &&
                    formatScalePortLabel(activePort) !== formatScalePortLabel(fixedPort)
                      ? ` (${t('webPosScalePortReconnected')})`
                      : ''}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <WebPosNumericKeypad
            mode="price"
            onModeChange={() => undefined}
            buffer={buffer}
            onBufferChange={(value) => {
              manualOverrideRef.current = true;
              setBuffer(value);
            }}
            onApply={() => {
              if (weightKg <= 0) return;
              onConfirm(weightKg);
            }}
            showModeButtons={false}
            integerOnly={entryUnit === 'g'}
            applyLabel={t('confirm')}
            applyDisabled={weightKg <= 0}
          />
        </div>
      </div>
    </div>
  );
}
