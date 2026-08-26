import { useEffect, useMemo, useState } from 'react';
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
  onClose: () => void;
  onConfirm: (weightKg: number) => void;
};

function money(n: number) {
  return `CHF ${Number(n || 0).toFixed(2)}`;
}

export default function WebPosWeightModal({
  open,
  productName,
  pricePerKg,
  weightUnit = 'kg',
  configuredPort,
  configuredDeviceName,
  configuredDeviceId,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const [buffer, setBuffer] = useState('');
  const [entryUnit, setEntryUnit] = useState<'kg' | 'g'>('kg');
  const [scaleReading, setScaleReading] = useState<ScaleReading | null>(null);
  const [scaleMsg, setScaleMsg] = useState('');
  const [agentOk, setAgentOk] = useState(false);

  const fixedPort = (configuredPort || '').trim();
  const portLabel = fixedPort ? formatScalePortLabel(fixedPort) : '';
  const deviceHint = (configuredDeviceName || '').trim();
  const deviceId = (configuredDeviceId || '').trim();
  const scaleConfigured = !!(fixedPort || deviceHint || deviceId);

  useEffect(() => {
    if (!open) return;
    setBuffer('');
    setScaleReading(null);
    setScaleMsg('');
    setEntryUnit(weightUnit === 'g' ? 'g' : 'kg');
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
        if (res.reading) {
          setScaleReading(res.reading);
          setScaleMsg('');
          if (res.reading.status === 'STABLE' && res.reading.weightKg > 0) {
            const kg = res.reading.weightKg;
            setBuffer(
              entryUnit === 'g'
                ? String(Math.round(kg * 1000))
                : String(Math.round(kg * 1000) / 1000)
            );
          }
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
  }, [open, agentOk, portLabel, deviceHint, deviceId, entryUnit, t, scaleConfigured]);

  const weightKg = useMemo(() => {
    const n = Number(buffer);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return entryUnit === 'g' ? n / 1000 : n;
  }, [buffer, entryUnit]);

  const lineTotal = useMemo(
    () => roundMoney2(Math.max(0, weightKg) * Math.max(0, pricePerKg)),
    [weightKg, pricePerKg]
  );

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
              onClick={() => {
                setEntryUnit('kg');
                setBuffer('');
              }}
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
              onClick={() => {
                setEntryUnit('g');
                setBuffer('');
              }}
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
              <p className="text-[11px] text-[var(--webpos-text-muted,var(--text-muted))]">
                {scaleReading
                  ? `${t('webPosScaleLive')}: ${scaleReading.weightKg.toFixed(3)} kg (${scaleReading.status})`
                  : scaleMsg || t('webPosScaleWaiting')}
              </p>
            )}
          </div>

          <WebPosNumericKeypad
            mode="price"
            onModeChange={() => undefined}
            buffer={buffer}
            onBufferChange={setBuffer}
            onApply={() => {
              if (weightKg <= 0) return;
              onConfirm(weightKg);
            }}
            showModeButtons={false}
            applyLabel={t('confirm')}
            applyDisabled={weightKg <= 0}
          />
        </div>
      </div>
    </div>
  );
}
