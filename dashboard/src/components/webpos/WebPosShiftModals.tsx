import { useEffect, useState } from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  EodIncludeProductsCheckbox,
  useEodIncludeProductsSold,
} from '@/components/EodIncludeProductsCheckbox';

/** Integer digits allowed in Start/Close Shift cash amounts (excludes decimals). */
const MAX_CASH_INT_DIGITS = 10;
const MAX_CASH_DEC_DIGITS = 2;

/** Keep only a valid cash amount: up to 10 digits before decimal, 2 after. */
function sanitizeCashAmountInput(raw: string): string {
  let s = String(raw ?? '').replace(/[^\d.]/g, '');
  const dot = s.indexOf('.');
  if (dot !== -1) {
    s = `${s.slice(0, dot + 1)}${s.slice(dot + 1).replace(/\./g, '')}`;
  }
  const [intRaw = '', decRaw] = s.split('.');
  const intPart = intRaw.replace(/\D/g, '').slice(0, MAX_CASH_INT_DIGITS);
  if (decRaw === undefined) return intPart;
  const decPart = decRaw.replace(/\D/g, '').slice(0, MAX_CASH_DEC_DIGITS);
  if (s.endsWith('.') && decPart === '') return intPart ? `${intPart}.` : '0.';
  return decPart.length ? `${intPart || '0'}.${decPart}` : intPart;
}

function parseCashAmount(raw: string): number {
  const cleaned = sanitizeCashAmountInput(raw);
  if (!cleaned || cleaned === '.' || cleaned === '0.') return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

type KeypadProps = {
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
};

function CashKeypad({ value, onChange, compact }: KeypadProps) {
  const append = (ch: string) => {
    if (ch === 'C') {
      onChange('');
      return;
    }
    if (ch === '⌫') {
      onChange(value.slice(0, -1));
      return;
    }
    if (ch === '.') {
      if (value.includes('.')) return;
      onChange(sanitizeCashAmountInput(value ? `${value}.` : '0.'));
      return;
    }
    if (!/^\d$/.test(ch)) return;
    onChange(sanitizeCashAmountInput(`${value}${ch}`));
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
  const keyClass = compact ? 'webpos-keypad-key webpos-keypad-key--compact' : 'webpos-keypad-key py-3.5';
  return (
    <div className={`grid grid-cols-3 ${compact ? 'gap-1.5' : 'gap-2'}`}>
      {keys.map((k) => (
        <button key={k} type="button" onClick={() => append(k)} className={keyClass}>
          {k}
        </button>
      ))}
      <button
        type="button"
        onClick={() => append('C')}
        className={`${keyClass} col-span-3 ${compact ? '!py-2 text-sm' : 'py-2 text-sm'}`}
      >
        C
      </button>
    </div>
  );
}

function CashAmountField({
  value,
  onChange,
  label,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'my-1' : 'my-4'}>
      <label className="mb-1 block text-center text-xs font-semibold uppercase tracking-wide text-stone-500">
        {label}
      </label>
      <div
        className={`flex items-center justify-center gap-2 rounded-xl bg-stone-50 px-3 ${compact ? 'py-2' : 'py-3'}`}
      >
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          placeholder="0"
          onChange={(e) => onChange(sanitizeCashAmountInput(e.target.value))}
          onPaste={(e) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text');
            onChange(sanitizeCashAmountInput(text));
          }}
          className={`w-full min-w-0 max-w-[14rem] border-0 bg-transparent text-center font-bold tabular-nums text-stone-900 outline-none placeholder:text-stone-400 ${
            compact ? 'text-2xl' : 'text-3xl'
          }`}
          aria-label={label}
          aria-valuemax={10 ** MAX_CASH_INT_DIGITS - 1}
        />
        <span className="shrink-0 text-base font-semibold text-stone-500">CHF</span>
      </div>
    </div>
  );
}

function ShiftSummaryStat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-2.5 py-2 ${
        accent
          ? 'border border-[var(--webpos-accent)]/30 bg-[var(--webpos-accent)]/5'
          : 'bg-stone-50'
      }`}
    >
      <p
        className={`truncate text-[10px] font-semibold uppercase tracking-wide ${
          accent ? 'text-[var(--webpos-accent)]' : 'text-stone-500'
        }`}
      >
        {label}
      </p>
      <p className="mt-0.5 text-base font-bold tabular-nums leading-tight text-stone-900">{value}</p>
      {hint ? <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-stone-500">{hint}</p> : null}
    </div>
  );
}

export function WebPosStartShiftModal({
  open,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (openingCash: number) => void;
}) {
  const { t } = useI18n();
  const [askConfirm, setAskConfirm] = useState(true);
  const [cash, setCash] = useState('');

  useEffect(() => {
    if (open) {
      setAskConfirm(true);
      setCash('');
    }
  }, [open]);

  if (!open) return null;

  const startWithAmount = (raw: string) => {
    onConfirm(parseCashAmount(raw));
  };

  const setCashSafe = (v: string) => setCash(sanitizeCashAmountInput(v));

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/45 p-3 sm:items-center sm:p-4">
      <div className="relative my-3 flex w-full max-w-md max-h-[min(92dvh,900px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:my-auto">
        {askConfirm ? (
          <div className="overflow-y-auto overscroll-contain p-5">
            <h2 className="text-lg font-bold text-stone-900">{t('webPosShiftStartTitle')}</h2>
            <p className="mt-2 text-sm text-stone-600">{t('webPosShiftStartAsk')}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" className="btn-secondary py-3" onClick={onCancel} disabled={busy}>
                {t('no')}
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--webpos-accent)] py-3 text-sm font-bold text-white hover:opacity-90"
                onClick={() => setAskConfirm(false)}
                disabled={busy}
              >
                {t('yes')}
              </button>
            </div>
            <button
              type="button"
              className="mt-3 w-full py-2 text-sm font-medium text-stone-600 hover:underline disabled:opacity-50"
              disabled={busy}
              onClick={() => startWithAmount('')}
            >
              {t('webPosShiftStartWithZero')}
            </button>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              <h2 className="text-lg font-bold text-stone-900">{t('webPosShiftOpeningCash')}</h2>
              <p className="mt-1 text-sm text-stone-600">{t('webPosShiftOpeningCashHint')}</p>
              <p className="mt-1 text-xs font-medium text-teal-700">{t('webPosShiftOpeningCashOptional')}</p>
              <CashAmountField
                value={cash}
                onChange={setCashSafe}
                label={t('webPosShiftOpeningCash')}
              />
              <CashKeypad value={cash} onChange={setCashSafe} />
            </div>
            <div className="shrink-0 space-y-2 border-t border-stone-100 px-5 py-3">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn-secondary py-3" onClick={onCancel} disabled={busy}>
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-[var(--webpos-accent)] py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => startWithAmount(cash)}
                >
                  {t('webPosShiftStartConfirm')}
                </button>
              </div>
              <button
                type="button"
                className="w-full py-2 text-sm font-medium text-stone-600 hover:underline disabled:opacity-50"
                disabled={busy}
                onClick={() => startWithAmount('')}
              >
                {t('webPosShiftSkipFloat')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function WebPosCloseShiftModal({
  open,
  busy,
  live,
  openingCash,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy?: boolean;
  openingCash: number;
  live: {
    cashSales: number;
    cashIn?: number;
    cashOut?: number;
    cashRefunds?: number;
    cardSales: number;
    terminalSales: number;
    totalSales: number;
    orderCount: number;
    expectedCash: number;
  } | null;
  onCancel: () => void;
  onConfirm: (closingCash: number) => void;
}) {
  const { t } = useI18n();
  const [cash, setCash] = useState('');
  const setCashSafe = (v: string) => setCash(sanitizeCashAmountInput(v));
  const expected = live?.expectedCash ?? openingCash;
  const counted = parseCashAmount(cash);
  const diff = Math.round((counted - expected) * 100) / 100;
  const balanced = cash !== '' && Math.abs(diff) < 0.005;

  useEffect(() => {
    if (open) setCash('');
  }, [open]);

  if (!open) return null;

  const cardTotal = (live?.cardSales ?? 0) + (live?.terminalSales ?? 0);
  const cashIn = live?.cashIn ?? 0;
  const cashOut = live?.cashOut ?? 0;
  const cashRefunds = live?.cashRefunds ?? 0;
  const expectedFormula = t('webPosShiftExpectedFormula')
    .replace('{float}', openingCash.toFixed(2))
    .replace('{sales}', (live?.cashSales ?? 0).toFixed(2))
    .replace('{in}', cashIn.toFixed(2))
    .replace('{out}', cashOut.toFixed(2));

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="webpos-close-shift-title"
        className="relative flex max-h-[min(96dvh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-stone-100 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id="webpos-close-shift-title" className="text-lg font-bold text-stone-900">
              {t('webPosShiftCloseTitle')}
            </h2>
            <p className="mt-0.5 text-sm text-stone-600">{t('webPosShiftCloseHint')}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-50"
            aria-label={t('close')}
          >
            <X size={20} strokeWidth={2.25} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:divide-x md:divide-stone-100">
          <div className="shrink-0 border-b border-stone-100 px-4 py-3 md:border-b-0 md:overflow-y-auto md:overscroll-contain">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2">
              <ShiftSummaryStat
                accent
                label={t('webPosShiftOpeningCash')}
                value={`${openingCash.toFixed(2)} CHF`}
                hint={t('webPosShiftFloatCarriesForward')}
              />
              <ShiftSummaryStat
                label={t('webPosShiftCashSales')}
                value={`${(live?.cashSales ?? 0).toFixed(2)} CHF`}
              />
              <ShiftSummaryStat
                label={t('webPosShiftCashIn')}
                value={`${cashIn > 0 ? '+' : ''}${cashIn.toFixed(2)} CHF`}
              />
              <ShiftSummaryStat
                label={t('webPosShiftCashOut')}
                value={`${cashOut > 0 ? '−' : ''}${cashOut.toFixed(2)} CHF`}
              />
              {cashRefunds > 0 ? (
                <ShiftSummaryStat
                  label={t('webPosShiftCashRefunds')}
                  value={`−${cashRefunds.toFixed(2)} CHF`}
                />
              ) : null}
              <ShiftSummaryStat
                label={t('webPosShiftExpectedDrawer')}
                value={`${expected.toFixed(2)} CHF`}
                hint={expectedFormula}
              />
              <ShiftSummaryStat
                label={t('webPosShiftCardSales')}
                value={`${cardTotal.toFixed(2)} CHF`}
              />
              <ShiftSummaryStat
                label={t('webPosShiftOrders')}
                value={String(live?.orderCount ?? 0)}
              />
              <ShiftSummaryStat
                label={t('webPosShiftTotalSales')}
                value={`${(live?.totalSales ?? 0).toFixed(2)} CHF`}
              />
            </div>
          </div>

          <div className="flex min-h-0 flex-col px-4 py-3">
            <div
              className={
                cash === ''
                  ? undefined
                  : balanced
                    ? 'rounded-xl bg-emerald-50/80 px-1'
                    : 'rounded-xl bg-amber-50/80 px-1'
              }
            >
              <CashAmountField
                compact
                value={cash}
                onChange={setCashSafe}
                label={t('webPosShiftCountCash')}
              />
            </div>
            {cash !== '' ? (
              <p
                className={`mb-2 flex items-center justify-center gap-1 text-sm font-semibold ${
                  balanced ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {balanced ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {balanced
                  ? t('webPosShiftBalanced')
                  : t('webPosShiftVariance').replace('{amount}', diff.toFixed(2))}
              </p>
            ) : (
              <p className="mb-2 text-center text-xs text-stone-500">{t('webPosShiftCountCashHint')}</p>
            )}
            <div className="min-h-0 flex-1">
              <CashKeypad compact value={cash} onChange={setCashSafe} />
            </div>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-stone-100 bg-white px-4 py-3 sm:px-5">
          <button type="button" className="btn-secondary py-3" onClick={onCancel} disabled={busy}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="rounded-xl bg-[var(--webpos-accent)] py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
            disabled={busy || cash === ''}
            onClick={() => onConfirm(counted)}
          >
            {t('webPosShiftCloseConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WebPosShiftClosedModal({
  open,
  balanced,
  showEodPrint = false,
  onPrintShift,
  onPrintEod,
  onRestart,
  onStay,
  onLogout,
}: {
  open: boolean;
  balanced: boolean;
  /** Whole-day EOD — managers with View all sales + EOD permission only. */
  showEodPrint?: boolean;
  onPrintShift: (opts: { includeProductsSold: boolean }) => void;
  onPrintEod: (opts: { includeProductsSold: boolean }) => void;
  onRestart: () => void;
  onStay: () => void;
  onLogout: () => void;
}) {
  const { t } = useI18n();
  const [includeProductsSold, setIncludeProductsSold] = useEodIncludeProductsSold();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          {balanced ? (
            <CheckCircle2 className="mb-2 text-emerald-600" size={48} />
          ) : (
            <XCircle className="mb-2 text-amber-600" size={48} />
          )}
          <h2 className="text-lg font-bold text-stone-900">{t('webPosShiftClosedTitle')}</h2>
          <p className="mt-1 text-sm text-stone-600">
            {balanced ? t('webPosShiftClosedBalanced') : t('webPosShiftClosedWithVariance')}
          </p>
        </div>
        <div className="mt-5 space-y-2">
          <EodIncludeProductsCheckbox
            className="mb-3 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2.5"
            checked={includeProductsSold}
            onChange={setIncludeProductsSold}
          />
          <button
            type="button"
            className="w-full rounded-xl bg-[var(--webpos-accent)] py-3 text-sm font-bold text-white"
            onClick={() => onPrintShift({ includeProductsSold })}
          >
            {t('webPosShiftPrintShift')}
          </button>
          {showEodPrint ? (
            <button
              type="button"
              className="btn-secondary w-full py-3 text-sm font-semibold"
              onClick={() => onPrintEod({ includeProductsSold })}
            >
              {t('webPosShiftPrintEod')}
            </button>
          ) : null}
          <button type="button" className="btn-secondary w-full py-3" onClick={onRestart}>
            {t('webPosShiftRestart')}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-secondary py-2.5 text-sm font-semibold" onClick={onStay}>
              {t('webPosShiftStayConnected')}
            </button>
            <button type="button" className="btn-secondary py-2.5 text-sm font-semibold" onClick={onLogout}>
              {t('webPosShiftLogout')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
