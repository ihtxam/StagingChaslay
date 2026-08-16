import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Scale, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { roundMoney2 } from '@/lib/money';
import {
  formatScalePortLabel,
  isPrintAgentAvailable,
  listScalePorts,
  readScaleWeight,
  type ScaleReading,
} from '@/lib/print-agent';
import WebPosNumericKeypad from './WebPosNumericKeypad';

const SCALE_PORT_KEY = 'webpos_scale_com_port';

type Props = {
  open: boolean;
  productName: string;
  /** Catalog price = CHF per kg */
  pricePerKg: number;
  weightUnit?: 'kg' | 'g' | 'lb' | string | null;
  /** Merchant panel / print settings COM port — skips discovery when set. */
  configuredPort?: string | null;
  onClose: () => void;
  onConfirm: (weightKg: number) => void;
};

function money(n: number) {
  return `CHF ${Number(n || 0).toFixed(2)}`;
}

function persistPort(port: string) {
  try {
    if (port.trim()) localStorage.setItem(SCALE_PORT_KEY, port.trim());
  } catch {
    /* ignore */
  }
}

export default function WebPosWeightModal({
  open,
  productName,
  pricePerKg,
  weightUnit = 'kg',
  configuredPort,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const [buffer, setBuffer] = useState('');
  const [entryUnit, setEntryUnit] = useState<'kg' | 'g'>('kg');
  const [ports, setPorts] = useState<string[]>([]);
  const [port, setPort] = useState('');
  const [portsError, setPortsError] = useState('');
  const [portsLoading, setPortsLoading] = useState(false);
  const [scaleReading, setScaleReading] = useState<ScaleReading | null>(null);
  const [scaleMsg, setScaleMsg] = useState('');
  const [agentOk, setAgentOk] = useState(false);

  const fixedPort = (configuredPort || '').trim();

  const refreshPorts = useCallback(async () => {
    setPortsLoading(true);
    setPortsError('');
    try {
      const ok = await isPrintAgentAvailable();
      setAgentOk(ok);
      if (!ok) return;
      const list = await listScalePorts();
      setPorts(list);
      setPort((prev) => {
        const saved = prev.trim();
        if (saved) return saved;
        return list[0] || '';
      });
    } catch (e: any) {
      setPorts([]);
      setPortsError(e?.message || t('webPosScalePortsFailed'));
    } finally {
      setPortsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    setBuffer('');
    setScaleReading(null);
    setScaleMsg('');
    setPortsError('');
    setEntryUnit(weightUnit === 'g' ? 'g' : 'kg');

    if (fixedPort) {
      setPort(formatScalePortLabel(fixedPort));
      void (async () => {
        const ok = await isPrintAgentAvailable();
        setAgentOk(ok);
      })();
      return;
    }

    try {
      setPort(formatScalePortLabel(localStorage.getItem(SCALE_PORT_KEY) || ''));
    } catch {
      setPort('');
    }
    void refreshPorts();
  }, [open, weightUnit, fixedPort, refreshPorts]);

  useEffect(() => {
    if (!open || !agentOk || !port.trim()) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await readScaleWeight(port, fixedPort ? 800 : 1800);
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
    const intervalMs = fixedPort ? 600 : 2000;
    const id = window.setInterval(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open, agentOk, port, entryUnit, t, fixedPort]);

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
            {agentOk ? (
              <>
                {fixedPort ? (
                  <p className="mb-1.5 text-xs font-mono text-[var(--webpos-text-muted,var(--text-muted))]">
                    {formatScalePortLabel(fixedPort)}
                  </p>
                ) : (
                  <>
                    <div className="mb-1.5 flex gap-1.5">
                      <input
                        list="webpos-scale-ports"
                        className="input flex-1 font-mono text-sm uppercase"
                        value={port}
                        placeholder={t('webPosScalePortPlaceholder')}
                        onChange={(e) => {
                          const v = formatScalePortLabel(e.target.value);
                          setPort(v);
                          persistPort(v);
                        }}
                        aria-label={t('webPosScaleSelectPort')}
                      />
                      <datalist id="webpos-scale-ports">
                        {ports.map((p) => (
                          <option key={p} value={p} />
                        ))}
                      </datalist>
                      <button
                        type="button"
                        className="webpos-keypad-key !px-2.5"
                        onClick={() => void refreshPorts()}
                        disabled={portsLoading}
                        aria-label={t('webPosScaleRefreshPorts')}
                        title={t('webPosScaleRefreshPorts')}
                      >
                        <RefreshCw size={14} className={portsLoading ? 'animate-spin' : ''} />
                      </button>
                    </div>
                    <p className="mb-1 text-[10px] text-[var(--webpos-text-muted,var(--text-muted))]">
                      {portsError || t('webPosScalePortHint')}
                    </p>
                  </>
                )}
                <p className="text-[11px] text-[var(--webpos-text-muted,var(--text-muted))]">
                  {scaleReading
                    ? `${t('webPosScaleLive')}: ${scaleReading.weightKg.toFixed(3)} kg (${scaleReading.status})`
                    : scaleMsg || (port.trim() ? t('webPosScaleWaiting') : t('webPosScaleSelectPort'))}
                </p>
              </>
            ) : (
              <p className="text-[11px] text-[var(--webpos-text-muted,var(--text-muted))]">
                {t('webPosScaleAgentOffline')}
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
