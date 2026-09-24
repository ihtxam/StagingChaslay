import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { roundMoney2 } from '@/lib/money';

/** Swiss circulation notes and coins for till entry (matches common POS layouts). */
export const SWISS_CASH_DENOMINATIONS = [
  200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05,
] as const;

type Props = {
  open: boolean;
  total: number;
  busy?: boolean;
  onClose: () => void;
  onComplete: (tendered: number, changeDue: number) => void;
};

type ChfTone = 'dark' | 'green' | 'amber' | 'red';

function formatChfParts(amount: number): { whole: string; cents: string } {
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100)
    .toString()
    .padStart(2, '0');
  return { whole: String(whole), cents };
}

function formatDenomLabel(value: number): string {
  if (value >= 1) return String(value);
  return value.toFixed(2);
}

function denomButtonClass(value: number): string {
  if (value >= 20) {
    return 'border-[#c5e8ea] bg-[#dff3f4] hover:border-[#9fd4d8]';
  }
  if (value >= 10) {
    return 'border-[#d5e8c4] bg-[#eaf4df] hover:border-[#b8d6a4]';
  }
  if (value >= 1) {
    return 'border-[#ebe2c4] bg-[#f7f0dc] hover:border-[#d9cdb0]';
  }
  return 'border-[#ddd9d0] bg-[#f2f0eb] hover:border-[#c8c4bb]';
}

function ChfAmount({
  amount,
  tone = 'dark',
  size = 'md',
}: {
  amount: number;
  tone?: ChfTone;
  size?: 'md' | 'lg';
}) {
  const { whole, cents } = formatChfParts(amount);
  const currencyClass =
    tone === 'green'
      ? 'text-emerald-700/80'
      : tone === 'amber'
        ? 'text-amber-700/80'
        : tone === 'red'
          ? 'text-red-700/80'
          : 'text-stone-500';
  const wholeClass =
    tone === 'green'
      ? 'text-emerald-800'
      : tone === 'amber'
        ? 'text-amber-800'
        : tone === 'red'
          ? 'text-red-700'
          : 'text-stone-900';
  const centsClass =
    tone === 'green'
      ? 'text-emerald-700/90'
      : tone === 'amber'
        ? 'text-amber-700/90'
        : tone === 'red'
          ? 'text-red-600/90'
          : 'text-stone-600';

  return (
    <p className="tabular-nums leading-none">
      <span className={`font-medium ${currencyClass} ${size === 'lg' ? 'text-base' : 'text-sm'}`}>
        CHF{' '}
      </span>
      <span className={`font-bold ${wholeClass} ${size === 'lg' ? 'text-5xl' : 'text-3xl'}`}>
        {whole}
      </span>
      <span className={`font-semibold ${centsClass} ${size === 'lg' ? 'text-2xl' : 'text-lg'}`}>
        .{cents}
      </span>
    </p>
  );
}

export default function WebPosRetailCashPayModal({
  open,
  total,
  busy = false,
  onClose,
  onComplete,
}: Props) {
  const { t } = useI18n();
  const due = roundMoney2(Math.max(0, total));
  const [tendered, setTendered] = useState(0);
  const [padBuffer, setPadBuffer] = useState('');

  useEffect(() => {
    if (open) {
      setTendered(0);
      setPadBuffer('');
    }
  }, [open, due]);

  const remaining = useMemo(
    () => roundMoney2(Math.max(0, due - tendered)),
    [due, tendered]
  );

  const changeDue = useMemo(
    () => roundMoney2(Math.max(0, tendered - due)),
    [tendered, due]
  );

  const tryComplete = (nextTendered: number) => {
    if (nextTendered + 0.001 >= due && due >= 0) {
      onComplete(nextTendered, roundMoney2(Math.max(0, nextTendered - due)));
    }
  };

  const addAmount = (amount: number) => {
    if (busy || amount <= 0) return;
    const next = roundMoney2(tendered + amount);
    setTendered(next);
    setPadBuffer('');
    tryComplete(next);
  };

  const applyPadBuffer = () => {
    if (busy) return;
    const raw = padBuffer.trim().replace(',', '.');
    if (!raw) return;
    const val = roundMoney2(parseFloat(raw));
    if (!Number.isFinite(val) || val <= 0) return;
    setPadBuffer('');
    const next = roundMoney2(tendered + val);
    setTendered(next);
    tryComplete(next);
  };

  const appendPad = (key: string) => {
    if (busy) return;
    if (key === '.') {
      if (padBuffer.includes('.')) return;
      setPadBuffer(padBuffer ? `${padBuffer}.` : '0.');
      return;
    }
    if (key === 'back') {
      setPadBuffer((prev) => prev.slice(0, -1));
      return;
    }
    if (key === 'ce') {
      setPadBuffer('');
      return;
    }
    if (padBuffer === '0') {
      setPadBuffer(key);
      return;
    }
    setPadBuffer((prev) => `${prev}${key}`);
  };

  const handleOk = () => {
    if (busy) return;
    if (padBuffer.trim()) {
      applyPadBuffer();
      return;
    }
    if (tendered + 0.001 >= due) {
      tryComplete(tendered);
    }
  };

  const resetAll = () => {
    if (busy) return;
    setTendered(0);
    setPadBuffer('');
  };

  if (!open) return null;

  const padDisplay = padBuffer || '0';
  const hasProgress = tendered > 0 || !!padBuffer.trim();
  const balanceLabel = changeDue > 0 ? t('webPosChangeDue') : t('webPosRetailCashStillToPay');
  const balanceAmount = changeDue > 0 ? changeDue : remaining;
  const balanceTone: ChfTone = changeDue > 0 ? 'green' : 'red';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-2 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="webpos-retail-cash-title"
        className="flex max-h-[min(96vh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-5 py-4">
          <h2
            id="webpos-retail-cash-title"
            className="text-lg font-bold uppercase tracking-wide text-stone-800"
          >
            {t('webPosRetailCashTitle')}
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 disabled:opacity-40"
            aria-label={t('close')}
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.45fr)_minmax(0,0.85fr)]">
          <div className="flex flex-col gap-3 border-b border-stone-200 p-5 lg:border-b-0 lg:border-r">
            <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-sky-100/80 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700/70">
                {t('total')}
              </p>
              <div className="mt-1">
                <ChfAmount amount={due} tone="dark" />
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700/70">
                {t('webPosRetailCashEnteredSoFar')}
              </p>
              <div className="mt-1">
                <ChfAmount amount={tendered} tone="green" />
              </div>
            </div>

            <div
              className={`rounded-xl border px-4 py-3 ${
                changeDue > 0
                  ? 'border-emerald-200 bg-emerald-50/60'
                  : remaining > 0
                    ? 'border-red-200 bg-red-50/70'
                    : 'border-stone-200 bg-stone-50'
              }`}
            >
              <p
                className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
                  changeDue > 0
                    ? 'text-emerald-700/70'
                    : remaining > 0
                      ? 'text-red-700/70'
                      : 'text-stone-400'
                }`}
              >
                {balanceLabel}
              </p>
              <div className="mt-1">
                <ChfAmount amount={balanceAmount} tone={balanceTone} />
              </div>
            </div>

            <div className="mt-1 rounded-xl border border-stone-200 bg-stone-100/80 px-4 py-3">
              <div className="flex items-center justify-between text-sm text-stone-500">
                <span>{t('webPosRetailCashPadEntry')}</span>
                <span className="tabular-nums text-base font-semibold text-stone-700">{padDisplay}</span>
              </div>
            </div>

            {hasProgress ? (
              <button
                type="button"
                disabled={busy}
                onClick={resetAll}
                className="mt-3 self-start text-xs font-semibold text-stone-500 underline-offset-2 hover:text-stone-700 hover:underline disabled:opacity-40"
              >
                {t('webPosRetailCashReset')}
              </button>
            ) : null}
          </div>

          <div className="min-h-0 overflow-y-auto border-b border-stone-200 p-5 lg:border-b-0 lg:border-r">
            <p className="mb-3 text-[11px] font-semibold uppercase leading-snug tracking-[0.1em] text-stone-400">
              {t('webPosRetailCashNotesHint')}
            </p>
            <div className="grid grid-cols-4 gap-2.5">
              {SWISS_CASH_DENOMINATIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={busy}
                  onClick={() => addAmount(value)}
                  className={`webpos-retail-cash-note group relative flex min-h-[4.5rem] touch-manipulation flex-col items-center justify-center rounded-2xl border px-1 py-2 transition active:scale-[0.98] disabled:opacity-40 ${denomButtonClass(value)}`}
                >
                  <span className="absolute left-2 top-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-500/80">
                    CHF
                  </span>
                  <span className="text-2xl font-bold tabular-nums text-stone-900 sm:text-[1.65rem]">
                    {formatDenomLabel(value)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">
              {t('webPosRetailCashKeypad')}
            </p>
            <div className="grid flex-1 grid-cols-3 gap-2">
              {(['7', '8', '9', '4', '5', '6', '1', '2', '3'] as const).map((digit) => (
                <button
                  key={digit}
                  type="button"
                  disabled={busy}
                  onClick={() => appendPad(digit)}
                  className="min-h-[3.25rem] rounded-xl border border-sky-200 bg-sky-50 text-2xl font-bold text-sky-900 hover:bg-sky-100 active:scale-[0.98] disabled:opacity-40"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => appendPad('ce')}
                className="min-h-[3.25rem] rounded-xl border border-sky-200 bg-sky-50 text-sm font-bold uppercase text-sky-900 hover:bg-sky-100 disabled:opacity-40"
              >
                CE
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => appendPad('0')}
                className="min-h-[3.25rem] rounded-xl border border-sky-200 bg-sky-50 text-2xl font-bold text-sky-900 hover:bg-sky-100 disabled:opacity-40"
              >
                0
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => appendPad('.')}
                className="min-h-[3.25rem] rounded-xl border border-sky-200 bg-sky-50 text-2xl font-bold text-sky-900 hover:bg-sky-100 disabled:opacity-40"
              >
                .
              </button>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={applyPadBuffer}
              className="mt-2.5 min-h-[3.25rem] rounded-xl bg-sky-600 text-sm font-bold uppercase tracking-wide text-white hover:bg-sky-700 disabled:opacity-40"
            >
              {t('webPosRetailCashPadAdd')}
            </button>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)] gap-3 border-t border-stone-200 p-4 sm:px-5">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-[3.5rem] rounded-xl border border-stone-300 bg-white text-base font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={busy || (tendered + 0.001 < due && !padBuffer.trim())}
            onClick={handleOk}
            className="min-h-[3.5rem] rounded-xl bg-emerald-500 text-base font-bold text-white hover:bg-emerald-600 disabled:opacity-40"
          >
            {t('confirm')}
          </button>
        </div>

        {busy ? (
          <div className="shrink-0 border-t border-stone-100 px-4 py-2 text-center text-sm font-medium text-stone-500">
            {t('webPosProcessing')}
          </div>
        ) : null}
      </div>
    </div>
  );
}
