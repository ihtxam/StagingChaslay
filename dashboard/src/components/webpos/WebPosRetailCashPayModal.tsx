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
  const [cashEntries, setCashEntries] = useState<number[]>([]);

  useEffect(() => {
    if (open) {
      setTendered(0);
      setPadBuffer('');
      setCashEntries([]);
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
    setCashEntries((prev) => [...prev, amount]);
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
    setCashEntries((prev) => [...prev, val]);
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
    setCashEntries([]);
  };

  if (!open) return null;

  const dueParts = formatChfParts(due);
  const remainingParts = formatChfParts(remaining);
  const tenderedParts = formatChfParts(tendered);
  const padDisplay = padBuffer || '0';
  const hasProgress = tendered > 0 || !!padBuffer.trim();

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-2 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="webpos-retail-cash-title"
        className="flex max-h-[min(96vh,880px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-4 py-3 sm:px-5">
          <h2
            id="webpos-retail-cash-title"
            className="text-base font-bold uppercase tracking-wide text-stone-700"
          >
            {t('webPosRetailCashTitle')}
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-40"
            aria-label={t('close')}
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-stone-100 bg-stone-50 px-4 py-3 sm:grid-cols-4 sm:px-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
              {t('total')}
            </p>
            <p className="mt-1 tabular-nums text-stone-900">
              <span className="text-sm font-medium text-stone-500">CHF </span>
              <span className="text-3xl font-bold">{dueParts.whole}</span>
              <span className="text-lg font-semibold text-stone-500">.{dueParts.cents}</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
              {t('webPosRetailCashEnteredSoFar')}
            </p>
            <p className="mt-1 tabular-nums text-emerald-800">
              <span className="text-sm font-medium text-emerald-700/80">CHF </span>
              <span className="text-3xl font-bold">{tenderedParts.whole}</span>
              <span className="text-lg font-semibold text-emerald-700/80">.{tenderedParts.cents}</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
              {t('webPosRemaining')}
            </p>
            <p className="mt-1 tabular-nums text-amber-800">
              <span className="text-sm font-medium text-amber-700/80">CHF </span>
              <span className="text-3xl font-bold">{remainingParts.whole}</span>
              <span className="text-lg font-semibold text-amber-700/80">.{remainingParts.cents}</span>
            </p>
          </div>
          {changeDue > 0 ? (
            <div className="col-span-2 sm:col-span-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                {t('webPosChangeDue')}
              </p>
              <p className="mt-1 tabular-nums font-bold text-emerald-700">CHF {changeDue.toFixed(2)}</p>
            </div>
          ) : null}
        </div>

        {hasProgress ? (
          <div className="shrink-0 border-b border-emerald-100 bg-emerald-50/80 px-4 py-3 sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
              {t('webPosRetailCashEnteredSoFar')}: CHF {tendered.toFixed(2)}
              {remaining > 0 ? (
                <span className="ml-2 font-medium normal-case text-amber-800">
                  · {t('webPosRetailCashStillToPay')}: CHF {remaining.toFixed(2)}
                </span>
              ) : null}
            </p>
            {cashEntries.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {cashEntries.map((value, index) => (
                  <span
                    key={`${value}-${index}`}
                    className="inline-flex items-center rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-bold tabular-nums text-emerald-900"
                  >
                    CHF {formatDenomLabel(value)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,0.9fr)]">
          <div className="flex flex-col border-b border-stone-100 p-4 lg:border-b-0 lg:border-r">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              {t('webPosRetailCashGiven')}
            </p>
            <p className="mt-2 tabular-nums text-stone-900">
              <span className="text-sm font-medium text-stone-500">CHF </span>
              <span className="text-4xl font-bold">{tendered.toFixed(2)}</span>
            </p>
            {remaining > 0 && tendered > 0 ? (
              <p className="mt-2 text-sm font-semibold text-amber-800">
                {t('webPosRetailCashStillToPay')}: CHF {remaining.toFixed(2)}
              </p>
            ) : null}

            <div className="mt-4 space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm">
              <div className="flex items-center justify-between text-stone-600">
                <span>{t('webPosRetailCashPadEntry')}</span>
                <span className="tabular-nums font-semibold text-stone-800">{padDisplay}</span>
              </div>
            </div>

            {hasProgress ? (
              <button
                type="button"
                disabled={busy}
                onClick={resetAll}
                className="mt-3 self-start rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-40"
              >
                {t('webPosRetailCashReset')}
              </button>
            ) : null}
          </div>

          <div className="min-h-0 overflow-y-auto border-b border-stone-100 p-4 lg:border-b-0 lg:border-r">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
              {t('webPosRetailCashNotesHint')}
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {SWISS_CASH_DENOMINATIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={busy}
                  onClick={() => addAmount(value)}
                  className={`webpos-retail-cash-note group relative min-h-[4.25rem] touch-manipulation overflow-hidden rounded-xl border px-2 py-2.5 text-left shadow-sm transition active:scale-[0.98] disabled:opacity-40 ${
                    value >= 10
                      ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/80 hover:border-emerald-300'
                      : value >= 1
                        ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/80 hover:border-amber-300'
                        : 'border-stone-300 bg-gradient-to-br from-stone-50 to-stone-100 hover:border-stone-400'
                  }`}
                >
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-stone-600/80">
                    CHF
                  </span>
                  <span className="mt-0.5 block text-xl font-bold tabular-nums text-stone-900 sm:text-2xl">
                    {formatDenomLabel(value)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
              {t('webPosRetailCashKeypad')}
            </p>
            <div className="grid flex-1 grid-cols-3 gap-2">
              {(['7', '8', '9', '4', '5', '6', '1', '2', '3'] as const).map((digit) => (
                <button
                  key={digit}
                  type="button"
                  disabled={busy}
                  onClick={() => appendPad(digit)}
                  className="min-h-[3.25rem] rounded-xl border border-sky-200 bg-sky-50 text-2xl font-bold text-sky-950 hover:bg-sky-100 active:scale-[0.98] disabled:opacity-40"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => appendPad('ce')}
                className="min-h-[3.25rem] rounded-xl border border-sky-300 bg-sky-100 text-sm font-bold uppercase text-sky-900 hover:bg-sky-200 disabled:opacity-40"
              >
                CE
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => appendPad('0')}
                className="min-h-[3.25rem] rounded-xl border border-sky-200 bg-sky-50 text-2xl font-bold text-sky-950 hover:bg-sky-100 disabled:opacity-40"
              >
                0
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => appendPad('.')}
                className="min-h-[3.25rem] rounded-xl border border-sky-200 bg-sky-50 text-2xl font-bold text-sky-950 hover:bg-sky-100 disabled:opacity-40"
              >
                .
              </button>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={applyPadBuffer}
              className="mt-2 min-h-[3rem] rounded-xl border border-sky-300 bg-sky-600 text-sm font-bold uppercase tracking-wide text-white hover:bg-sky-700 disabled:opacity-40"
            >
              {t('webPosRetailCashPadAdd')}
            </button>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-stone-100 p-3 sm:p-4">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-[3.25rem] rounded-xl border border-stone-300 bg-white text-base font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={busy || (tendered + 0.001 < due && !padBuffer.trim())}
            onClick={handleOk}
            className="min-h-[3.25rem] rounded-xl bg-emerald-600 text-base font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
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
