import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { roundMoney2 } from '@/lib/money';

/** Swiss banknotes commonly used at the till. */
export const SWISS_CASH_NOTES = [5, 10, 20, 50, 100, 200, 1000] as const;

type Props = {
  open: boolean;
  total: number;
  busy?: boolean;
  onClose: () => void;
  onComplete: (tendered: number, changeDue: number) => void;
};

function formatChf(amount: number): { whole: string; cents: string } {
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100)
    .toString()
    .padStart(2, '0');
  return { whole: String(whole), cents };
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

  useEffect(() => {
    if (open) setTendered(0);
  }, [open, due]);

  const changeDue = useMemo(
    () => roundMoney2(Math.max(0, tendered - due)),
    [tendered, due]
  );

  const addNote = (note: number) => {
    if (busy) return;
    const next = roundMoney2(tendered + note);
    setTendered(next);
    if (next + 0.001 >= due && due > 0) {
      onComplete(next, roundMoney2(Math.max(0, next - due)));
    }
  };

  if (!open) return null;

  const { whole, cents } = formatChf(due);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="webpos-retail-cash-title"
        className="flex max-h-[min(92vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-4 py-3">
          <h2 id="webpos-retail-cash-title" className="text-sm font-bold uppercase tracking-wide text-stone-700">
            {t('webPosRetailCashTitle')}
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-40"
            aria-label={t('close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 md:grid-cols-2">
          <div className="flex flex-col border-b border-stone-100 p-5 md:border-b-0 md:border-r">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
              {t('webPosAmountDue')}
            </p>
            <p className="mt-2 tabular-nums tracking-tight text-stone-800">
              <span className="text-2xl font-medium text-stone-400">CHF </span>
              <span className="text-6xl font-bold">{whole}</span>
              <span className="text-2xl font-medium text-stone-400">.{cents}</span>
            </p>

            <div className="mt-6 space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm">
              <div className="flex items-center justify-between font-semibold text-stone-700">
                <span>{t('webPosRetailCashGiven')}</span>
                <span className="tabular-nums">CHF {tendered.toFixed(2)}</span>
              </div>
              {changeDue > 0 ? (
                <div className="flex items-center justify-between font-semibold text-emerald-700">
                  <span>{t('webPosChangeDue')}</span>
                  <span className="tabular-nums">CHF {changeDue.toFixed(2)}</span>
                </div>
              ) : null}
            </div>

            {tendered > 0 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setTendered(0)}
                className="mt-3 self-start rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-40"
              >
                {t('webPosRetailCashReset')}
              </button>
            ) : null}
          </div>

          <div className="min-h-0 overflow-y-auto p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
              {t('webPosRetailCashNotesHint')}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SWISS_CASH_NOTES.map((note) => (
                <button
                  key={note}
                  type="button"
                  disabled={busy}
                  onClick={() => addNote(note)}
                  className="webpos-retail-cash-note group relative min-h-[4.5rem] touch-manipulation overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/80 px-2 py-3 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md active:scale-[0.98] disabled:opacity-40"
                >
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-emerald-800/70">
                    CHF
                  </span>
                  <span className="mt-0.5 block text-2xl font-bold tabular-nums text-emerald-950">
                    {note}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {busy ? (
          <div className="shrink-0 border-t border-stone-100 px-4 py-3 text-center text-sm font-medium text-stone-500">
            {t('webPosProcessing')}
          </div>
        ) : null}
      </div>
    </div>
  );
}
