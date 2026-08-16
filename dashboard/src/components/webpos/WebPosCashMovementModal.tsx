import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import api from '@/lib/api';

const MAX_CASH_INT_DIGITS = 10;
const MAX_CASH_DEC_DIGITS = 2;

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

function CashKeypad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {keys.map((k) => (
        <button key={k} type="button" onClick={() => append(k)} className="webpos-keypad-key webpos-keypad-key--compact">
          {k}
        </button>
      ))}
      <button
        type="button"
        onClick={() => append('C')}
        className="webpos-keypad-key webpos-keypad-key--compact col-span-3 !py-2 text-sm"
      >
        C
      </button>
    </div>
  );
}

export type CashMovementRow = {
  id: string;
  type: string;
  amount: number;
  reason?: string | null;
  staffName?: string | null;
  createdAt?: string;
};

type Props = {
  open: boolean;
  shiftId: string | null;
  staffId?: string | null;
  staffName?: string | null;
  onClose: () => void;
  onSuccess?: (live: {
    cashIn: number;
    cashOut: number;
    expectedCash: number;
    cashSales: number;
  }) => void;
};

export default function WebPosCashMovementModal({
  open,
  shiftId,
  staffId,
  staffName,
  onClose,
  onSuccess,
}: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<'in' | 'out'>('in');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [movements, setMovements] = useState<CashMovementRow[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (open) {
      setTab('in');
      setAmount('');
      setReason('');
      setError(null);
      setShowDetails(false);
      setMovements([]);
    }
  }, [open]);

  const loadDetails = async () => {
    if (!shiftId) return;
    setLoadingDetails(true);
    try {
      const res = await api.get('/merchant/pos/shifts/cash-movements', {
        params: { shiftId },
      });
      setMovements((res.data.movements || []) as CashMovementRow[]);
      setShowDetails(true);
    } catch {
      setError(t('webPosCashMovementLoadFailed'));
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleConfirm = async () => {
    const parsed = parseCashAmount(amount);
    if (parsed <= 0) {
      setError(t('webPosCashAmountRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/merchant/pos/shifts/cash-movement', {
        type: tab,
        amount: parsed,
        reason: reason.trim() || null,
        staffId: staffId || null,
        staffName: staffName || null,
      });
      onSuccess?.(res.data.live);
      onClose();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        t('webPosCashMovementFailed');
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[min(96dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-4 py-3">
          <h2 className="text-lg font-bold text-stone-900">{t('webPosCashMovementTitle')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-stone-500 hover:bg-stone-100"
            aria-label={t('close')}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex shrink-0 border-b border-stone-100 px-4 pt-2">
          <div className="grid w-full grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1">
            <button
              type="button"
              onClick={() => setTab('in')}
              className={`rounded-md py-2 text-sm font-bold ${
                tab === 'in' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
              }`}
            >
              {t('webPosCashIn')}
            </button>
            <button
              type="button"
              onClick={() => setTab('out')}
              className={`rounded-md py-2 text-sm font-bold ${
                tab === 'out' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
              }`}
            >
              {t('webPosCashOut')}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {showDetails ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-stone-800">{t('webPosCashDetails')}</h3>
                <button
                  type="button"
                  className="text-xs font-semibold text-[var(--webpos-accent)]"
                  onClick={() => setShowDetails(false)}
                >
                  {t('webPosCashBackToForm')}
                </button>
              </div>
              {loadingDetails ? (
                <p className="text-sm text-stone-500">{t('loading')}</p>
              ) : movements.length === 0 ? (
                <p className="text-sm text-stone-500">{t('webPosCashNoMovements')}</p>
              ) : (
                <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
                  {movements.map((m) => (
                    <li key={m.id} className="px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs font-bold uppercase ${
                            m.type === 'out' ? 'text-red-600' : 'text-emerald-700'
                          }`}
                        >
                          {m.type === 'out' ? t('webPosCashOut') : t('webPosCashIn')}
                        </span>
                        <span className="font-bold tabular-nums text-stone-900">
                          {m.type === 'out' ? '−' : '+'}
                          {Number(m.amount).toFixed(2)} CHF
                        </span>
                      </div>
                      {m.reason ? (
                        <p className="mt-1 text-xs text-stone-600">{m.reason}</p>
                      ) : null}
                      {m.staffName ? (
                        <p className="mt-0.5 text-[10px] text-stone-400">{m.staffName}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              <label className="mb-1 block text-center text-xs font-semibold uppercase tracking-wide text-stone-500">
                {t('webPosCashAmount')}
              </label>
              <div className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-stone-50 px-3 py-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  placeholder="0"
                  onChange={(e) => setAmount(sanitizeCashAmountInput(e.target.value))}
                  className="w-full max-w-[14rem] border-0 bg-transparent text-center text-2xl font-bold tabular-nums text-stone-900 outline-none"
                />
                <span className="shrink-0 text-base font-semibold text-stone-500">CHF</span>
              </div>
              <CashKeypad value={amount} onChange={setAmount} />
              <label className="mb-1 mt-4 block text-xs font-semibold uppercase tracking-wide text-stone-500">
                {t('webPosCashReason')}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder={t('webPosCashReasonPlaceholder')}
                className="w-full resize-none rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:border-stone-400"
              />
            </>
          )}
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="shrink-0 space-y-2 border-t border-stone-100 px-4 py-3">
          {!showDetails ? (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-secondary py-3" onClick={onClose} disabled={busy}>
                {t('webPosCashDiscard')}
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--webpos-accent)] py-3 text-sm font-bold text-white disabled:opacity-50"
                onClick={() => void handleConfirm()}
                disabled={busy}
              >
                {t('webPosCashConfirm')}
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="w-full py-2 text-sm font-semibold text-stone-600 hover:underline disabled:opacity-50"
            onClick={() => (showDetails ? setShowDetails(false) : void loadDetails())}
            disabled={!shiftId || loadingDetails}
          >
            {showDetails ? t('webPosCashBackToForm') : t('webPosCashDetails')}
          </button>
        </div>
      </div>
    </div>
  );
}
