import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { roundMoney2 } from '@/lib/money';
import WebPosKeypadModalShell from '@/components/webpos/WebPosKeypadModalShell';

type TipMode = 'amount' | 'percent';

type Props = {
  open: boolean;
  initial?: number;
  title?: string;
  /** Order total before tip - used for % mode */
  baseAmount?: number;
  presetsPercent?: number[];
  allowPercent?: boolean;
  allowCustom?: boolean;
  onClose: () => void;
  /** Second arg: raw keypad mode/value (for bill discount % vs fixed). */
  onConfirm: (amount: number, meta?: { mode: TipMode; value: number }) => void;
};

export default function WebPosTipKeypad({
  open,
  initial = 0,
  title,
  baseAmount = 0,
  presetsPercent = [5, 10, 15],
  allowPercent = true,
  allowCustom = true,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const [mode, setMode] = useState<TipMode>('amount');
  const [buf, setBuf] = useState('');

  useEffect(() => {
    if (!open) return;
    setMode('amount');
    setBuf(initial > 0 ? String(roundMoney2(initial)) : '');
  }, [open, initial]);

  const push = (ch: string) => {
    setBuf((prev) => {
      if (ch === '.' && prev.includes('.')) return prev;
      if (prev === '0' && ch !== '.') return ch;
      if (prev.includes('.') && prev.split('.')[1]!.length >= 2) return prev;
      return (prev + ch).slice(0, 10);
    });
  };

  const resolvedAmount = (() => {
    const n = Number(buf) || 0;
    if (mode === 'percent') {
      return roundMoney2((Math.max(0, baseAmount) * Math.max(0, n)) / 100);
    }
    return roundMoney2(Math.max(0, n));
  })();

  const display =
    mode === 'percent'
      ? `${buf || '0'}% → CHF ${resolvedAmount.toFixed(2)}`
      : `CHF ${buf || '0'}`;

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

  return (
    <WebPosKeypadModalShell open={open} onClose={onClose} title={title || t('webPosTip')}>
      {allowPercent ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('amount');
              setBuf('');
            }}
            className={`rounded-lg py-2.5 text-xs font-bold uppercase ${
              mode === 'amount'
                ? 'bg-[var(--webpos-accent-soft)] text-[var(--webpos-accent-text)] ring-1 ring-[var(--webpos-accent-ring)]'
                : 'bg-[var(--webpos-surface-2,#f5f5f4)] text-[var(--webpos-text-muted,#78716c)] ring-1 ring-[var(--webpos-border,#e7e5e4)]'
            }`}
          >
            {t('webPosTipFixed')}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('percent');
              setBuf('');
            }}
            className={`rounded-lg py-2.5 text-xs font-bold uppercase ${
              mode === 'percent'
                ? 'bg-[var(--webpos-accent-soft)] text-[var(--webpos-accent-text)] ring-1 ring-[var(--webpos-accent-ring)]'
                : 'bg-[var(--webpos-surface-2,#f5f5f4)] text-[var(--webpos-text-muted,#78716c)] ring-1 ring-[var(--webpos-border,#e7e5e4)]'
            }`}
          >
            {t('webPosTipPercent')}
          </button>
        </div>
      ) : null}

      {mode === 'percent' && presetsPercent.length ? (
        <div className="flex flex-wrap gap-2">
          {presetsPercent
            .filter((p) => p > 0)
            .map((pct) => (
              <button
                key={pct}
                type="button"
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold hover:bg-stone-50"
                onClick={() => setBuf(String(pct))}
              >
                {pct}%
              </button>
            ))}
        </div>
      ) : null}

      <div className="rounded-xl border border-[var(--webpos-border,var(--border))] bg-[var(--webpos-bg,var(--bg))] px-4 py-3 text-right text-xl font-semibold tabular-nums text-[var(--webpos-text,var(--text))]">
        {display}
      </div>

      {allowCustom !== false ? (
        <div className="grid grid-cols-3 gap-2.5">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              className="webpos-keypad-key"
              onClick={() => {
                if (k === '⌫') setBuf((p) => p.slice(0, -1));
                else push(k);
              }}
            >
              {k}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2.5">
        <button
          type="button"
          className="webpos-keypad-key flex-1 !py-3 text-sm"
          onClick={() => {
            setBuf('');
            onConfirm(0, { mode, value: 0 });
          }}
        >
          {t('clear')}
        </button>
        <button
          type="button"
          className="webpos-accent-btn flex-1 rounded-lg py-3 text-sm font-semibold"
          onClick={() => {
            const value = Number(buf) || 0;
            onConfirm(resolvedAmount, { mode, value });
            onClose();
          }}
        >
          {t('confirm')}
        </button>
      </div>
    </WebPosKeypadModalShell>
  );
}
