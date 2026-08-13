import {
  ArrowLeft,
  ArrowLeftRight,
  Banknote,
  Coins,
  CreditCard,
  Gift,
  MonitorSmartphone,
  Percent,
  UserCircle2,
  Vault,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { roundMoney2 } from '@/lib/money';
import type { PosCheckoutSettings } from '@/lib/pos-checkout';
import WebPosTipKeypad from '@/components/WebPosTipKeypad';
import WebPosNumericKeypad from './WebPosNumericKeypad';
import type { PosPaymentMethod } from './types';

export type AppliedPayment = {
  id: string;
  method: PosPaymentMethod;
  amount: number;
  giftCardId?: string;
  giftCardNumber?: string;
};

type Props = {
  total: number;
  splitLabel?: string | null;
  splitGuestCount?: number;
  settings: PosCheckoutSettings;
  methods: {
    cash: boolean;
    card: boolean;
    terminal: boolean;
    payLater: boolean;
    giftCard?: boolean;
  };
  busy: boolean;
  customerLabel?: string | null;
  onCustomer?: () => void;
  onSplit?: () => void;
  onComplete: (payments: AppliedPayment[], changeDue: number, tipAmount: number) => void;
  onGiftCardRequest?: (remaining: number) => void;
  injectPayment?: AppliedPayment | null;
  onInjectPaymentConsumed?: () => void;
  onBack?: () => void;
  onBillDiscount?: () => void;
  onClearBillDiscount?: () => void;
  canApplyBillDiscount?: boolean;
  billDiscountLabel?: string | null;
  billDiscountAmount?: number;
  onOpenDrawer?: () => void;
  membershipPointsBalance?: number | null;
  canPayWithPoints?: boolean;
  payWithPoints?: boolean;
  onTogglePayWithPoints?: (enabled: boolean) => void;
  pointsRedeemed?: number;
  pointsDiscount?: number;
};

function newPayId() {
  return `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function WebPosCheckoutView({
  total: baseTotal,
  splitLabel,
  splitGuestCount,
  settings,
  methods,
  busy,
  customerLabel,
  onCustomer,
  onSplit,
  onComplete,
  onGiftCardRequest,
  injectPayment,
  onInjectPaymentConsumed,
  onBack,
  onBillDiscount,
  onClearBillDiscount,
  canApplyBillDiscount = true,
  billDiscountLabel,
  billDiscountAmount = 0,
  onOpenDrawer,
  membershipPointsBalance,
  canPayWithPoints = false,
  payWithPoints = false,
  onTogglePayWithPoints,
  pointsRedeemed = 0,
  pointsDiscount = 0,
}: Props) {
  const { t } = useI18n();
  const [buffer, setBuffer] = useState('');
  const [payments, setPayments] = useState<AppliedPayment[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [invoice, setInvoice] = useState(false);
  const [tipAmount, setTipAmount] = useState(0);
  const [tipOpen, setTipOpen] = useState(false);
  const [seeded, setSeeded] = useState(false);
  /** Previous amount due — used to resize tenders when tip is added/removed. */
  const prevTotalRef = useRef<number | null>(null);
  const prevDiscountRef = useRef(0);

  const total = useMemo(
    () => roundMoney2(Math.max(0, baseTotal - pointsDiscount) + tipAmount),
    [baseTotal, tipAmount, pointsDiscount]
  );

  const paid = useMemo(
    () => roundMoney2(payments.reduce((s, p) => s + p.amount, 0)),
    [payments]
  );
  const remaining = useMemo(() => roundMoney2(Math.max(0, total - paid)), [total, paid]);
  const changeDue = useMemo(() => roundMoney2(Math.max(0, paid - total)), [paid, total]);

  const perGuest =
    splitGuestCount && splitGuestCount > 1
      ? roundMoney2(total / splitGuestCount)
      : null;

  const bufferAmount = useMemo(() => {
    if (!buffer) return null;
    const n = Number(buffer);
    if (Number.isFinite(n) && n >= 0) return roundMoney2(n);
    return null;
  }, [buffer]);

  const quickAddAmounts = useMemo(() => {
    if (settings.quickCashEnabled === false) return [];
    const dens = (settings.quickCashDenominations || []).filter((n) => Number.isFinite(n) && n > 0);
    return dens.length ? dens : [10, 20, 50, 100];
  }, [settings.quickCashEnabled, settings.quickCashDenominations]);

  const activeMethod = useMemo<PosPaymentMethod | null>(() => {
    if (selectedPaymentId) {
      return payments.find((p) => p.id === selectedPaymentId)?.method ?? null;
    }
    if (payments.length === 1) return payments[0]!.method;
    return null;
  }, [payments, selectedPaymentId]);

  // Default: cash covers full amount and is selected (so Card switches method)
  useEffect(() => {
    if (seeded) return;
    const defaultMethod: PosPaymentMethod | null = methods.cash
      ? 'cash'
      : methods.card
        ? 'card'
        : methods.terminal
          ? 'terminal'
          : methods.giftCard
            ? 'gift_card'
            : methods.payLater
              ? 'pay_later'
              : null;
    if (defaultMethod && baseTotal > 0 && defaultMethod !== 'gift_card') {
      const id = newPayId();
      setPayments([{ id, method: defaultMethod, amount: roundMoney2(baseTotal) }]);
      setSelectedPaymentId(id);
    }
    setSeeded(true);
  }, [seeded, methods.cash, methods.card, methods.terminal, methods.giftCard, methods.payLater, baseTotal]);

  // Inject gift-card tender from parent RFID/QR modal
  useEffect(() => {
    if (!injectPayment) return;
    setPayments((prev) => {
      const withoutGc = prev.filter((p) => p.method !== 'gift_card' || p.giftCardId !== injectPayment.giftCardId);
      if (withoutGc.length === 1 && Math.abs(withoutGc[0]!.amount - total) < 0.011) {
        const cover = withoutGc[0]!;
        const rest = roundMoney2(Math.max(0, cover.amount - injectPayment.amount));
        const next: AppliedPayment[] = [
          { ...injectPayment, id: injectPayment.id || newPayId() },
        ];
        if (rest > 0.001) {
          next.push({ id: newPayId(), method: cover.method, amount: rest });
        }
        return next;
      }
      return [...withoutGc, { ...injectPayment, id: injectPayment.id || newPayId() }];
    });
    setSelectedPaymentId(null);
    setBuffer('');
    onInjectPaymentConsumed?.();
  }, [injectPayment, onInjectPaymentConsumed, total]);

  // When tip (or base) changes amount due, keep covering tenders sized correctly.
  // Fixes: tip +5 then remove → leftover CHF 5 wrongly shown as change.
  useEffect(() => {
    if (!seeded) return;
    const prevTotal = prevTotalRef.current;
    prevTotalRef.current = total;
    if (prevTotal == null || Math.abs(prevTotal - total) < 0.001) return;

    const delta = roundMoney2(total - prevTotal);

    setPayments((prev) => {
      if (!prev.length) return prev;
      const paidSum = roundMoney2(prev.reduce((s, p) => s + p.amount, 0));

      // Payments exactly covered the previous amount due → resize with tip.
      if (Math.abs(paidSum - prevTotal) < 0.051) {
        if (prev.length === 1) {
          return [{ ...prev[0]!, amount: total }];
        }
        const next = prev.map((p) => ({ ...p }));
        let left = delta;
        for (let i = next.length - 1; i >= 0 && Math.abs(left) > 0.001; i--) {
          const row = next[i]!;
          const newAmt = roundMoney2(row.amount + left);
          if (newAmt > 0.001) {
            next[i] = { ...row, amount: newAmt };
            left = 0;
          } else {
            left = newAmt; // still negative; drop this row and continue
            next.splice(i, 1);
          }
        }
        return next.length ? next : prev;
      }

      // Single tender that still tracked base / previous due.
      if (prev.length === 1) {
        const only = prev[0]!;
        const coversBaseOrPrev =
          Math.abs(only.amount - roundMoney2(baseTotal)) < 0.011 ||
          Math.abs(only.amount - prevTotal) < 0.011;
        if (coversBaseOrPrev) return [{ ...only, amount: total }];
      }

      return prev;
    });
  }, [total, baseTotal, seeded]);

  // When bill discount changes, resize a single auto-covering tender to the new amount due.
  useEffect(() => {
    if (!seeded) return;
    const prevDisc = prevDiscountRef.current;
    prevDiscountRef.current = billDiscountAmount;
    if (Math.abs(prevDisc - billDiscountAmount) < 0.001) return;

    setPayments((prev) => {
      if (prev.length !== 1) return prev;
      const only = prev[0]!;
      const paidSum = roundMoney2(prev.reduce((s, p) => s + p.amount, 0));
      const coveredBefore =
        Math.abs(paidSum - roundMoney2(total + billDiscountAmount - prevDisc)) < 0.051 ||
        Math.abs(only.amount - roundMoney2(baseTotal + tipAmount - (billDiscountAmount - prevDisc))) < 0.051 ||
        Math.abs(only.amount - total) < 0.051;
      if (!coveredBefore) return prev;
      return [{ ...only, amount: total }];
    });
  }, [billDiscountAmount, total, baseTotal, tipAmount, seeded]);

  // Live-update selected payment row from keypad digits
  useEffect(() => {
    if (!selectedPaymentId || bufferAmount == null) return;
    setPayments((prev) =>
      prev.map((p) => (p.id === selectedPaymentId ? { ...p, amount: bufferAmount } : p))
    );
  }, [bufferAmount, selectedPaymentId]);

  const payButtons: Array<{
    id: PosPaymentMethod;
    label: string;
    icon: ReactNode;
    show: boolean;
  }> = [
    { id: 'cash', label: t('webPosCash'), icon: <Banknote size={22} />, show: methods.cash },
    { id: 'card', label: t('webPosCard'), icon: <CreditCard size={22} />, show: methods.card },
    {
      id: 'terminal',
      label: t('webPosOnlinePayment'),
      icon: <MonitorSmartphone size={22} />,
      show: methods.terminal,
    },
    {
      id: 'gift_card',
      label: t('giftCard'),
      icon: <Gift size={22} />,
      show: !!methods.giftCard,
    },
    {
      id: 'pay_later',
      label: t('webPosPayLater'),
      icon: <UserCircle2 size={22} />,
      show: methods.payLater,
    },
  ];

  const methodLabel = (m: PosPaymentMethod) =>
    payButtons.find((b) => b.id === m)?.label || m;

  const clearPaymentSelection = () => {
    setSelectedPaymentId(null);
    setBuffer('');
  };

  const selectPayment = (id: string) => {
    // Re-tap selected row to deselect — frees Cash/Card to add a new tender amount.
    if (selectedPaymentId === id) {
      clearPaymentSelection();
      return;
    }
    setSelectedPaymentId(id);
    setBuffer('');
  };

  const ensureTargetPaymentId = (): string | null => {
    if (selectedPaymentId) return selectedPaymentId;
    if (payments.length > 0) {
      const id = payments[payments.length - 1]!.id;
      setSelectedPaymentId(id);
      return id;
    }
    return null;
  };

  /** Switch method on an existing tender row (keep amount). */
  const switchPaymentMethod = (targetId: string, method: PosPaymentMethod) => {
    setPayments((prev) => prev.map((p) => (p.id === targetId ? { ...p, method } : p)));
    setSelectedPaymentId(targetId);
    setBuffer('');
  };

  /**
   * Quick cash (+20 / +50): customer handed that note toward the due amount.
   * If tender still mirrors the auto-seeded due total, SET to the note value
   * (not due+note). Otherwise stack additional notes.
   */
  const applyQuickAdd = (n: number) => {
    if (busy || !(n > 0)) return;
    const note = roundMoney2(n);
    let targetId = ensureTargetPaymentId();
    if (!targetId) {
      const method: PosPaymentMethod = methods.cash
        ? 'cash'
        : methods.card
          ? 'card'
          : methods.terminal
            ? 'terminal'
            : 'cash';
      const id = newPayId();
      setPayments([{ id, method, amount: note }]);
      setSelectedPaymentId(id);
      setBuffer(String(note));
      return;
    }
    const row = payments.find((p) => p.id === targetId);
    const current = bufferAmount != null ? bufferAmount : row?.amount ?? 0;
    const mirrorsDue = Math.abs(current - total) < 0.051;
    const next = roundMoney2(mirrorsDue || current <= 0.001 ? note : current + note);
    setBuffer(String(next));
    setPayments((prev) => prev.map((p) => (p.id === targetId ? { ...p, amount: next } : p)));
  };

  const applyMethod = (method: PosPaymentMethod) => {
    if (busy) return;

    if (method === 'gift_card') {
      const editingSelected = !!selectedPaymentId;
      const due =
        !editingSelected && bufferAmount != null && bufferAmount > 0
          ? bufferAmount
          : remaining > 0
            ? remaining
            : total;
      setSelectedPaymentId(null);
      setBuffer('');
      onGiftCardRequest?.(roundMoney2(due));
      return;
    }

    // Selected payment line under the total: Cash/Card always retargets that line.
    if (selectedPaymentId) {
      const sel = payments.find((p) => p.id === selectedPaymentId);
      if (sel) {
        if (sel.method !== method) switchPaymentMethod(selectedPaymentId, method);
        else setBuffer('');
        return;
      }
    }

    // Sole tender covering the bill: switch Cash ↔ Card without needing a second tap.
    if (payments.length === 1 && (bufferAmount == null || bufferAmount <= 0)) {
      const sole = payments[0]!;
      const coversBill =
        remaining <= 0.001 || Math.abs(sole.amount - total) < 0.05;
      if (coversBill) {
        if (sole.method !== method) switchPaymentMethod(sole.id, method);
        else setSelectedPaymentId(sole.id);
        return;
      }
    }

    // Fully paid multi-tender: change the last line's method.
    if (remaining <= 0.001 && payments.length > 0 && (bufferAmount == null || bufferAmount <= 0)) {
      const targetId = payments[payments.length - 1]!.id;
      switchPaymentMethod(targetId, method);
      return;
    }

    // Typed amount before method; else remaining; else no-op
    const amount =
      bufferAmount != null && bufferAmount > 0
        ? bufferAmount
        : remaining > 0
          ? remaining
          : 0;
    if (amount <= 0) return;

    if (payments.length === 0) {
      const id = newPayId();
      setPayments([{ id, method, amount: roundMoney2(amount) }]);
      setSelectedPaymentId(id);
      setBuffer('');
      return;
    }

    // Multi-tender: add / top-up same method for remaining
    setPayments((prev) => {
      const sameIdx = prev.findIndex((p) => p.method === method);
      if (sameIdx >= 0 && (bufferAmount == null || bufferAmount <= 0) && remaining > 0) {
        const next = [...prev];
        const row = next[sameIdx]!;
        next[sameIdx] = { ...row, amount: roundMoney2(row.amount + amount) };
        return next;
      }
      return [...prev, { id: newPayId(), method, amount: roundMoney2(amount) }];
    });
    setBuffer('');
    setSelectedPaymentId(null);
  };

  const removePayment = (id: string) => {
    setPayments((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (selectedPaymentId === id) {
        setSelectedPaymentId(next[0]?.id ?? null);
        setBuffer('');
      }
      return next;
    });
  };

  // Block Confirm on empty/zero carts (e.g. after pay-later cleared the cart but left checkout open).
  const canComplete =
    total <= 0.001
      ? !busy
      : total > 0.001 && payments.length > 0 && paid + 0.001 >= total;

  const complete = () => {
    if (!canComplete || busy) return;
    onComplete(payments, changeDue, tipAmount);
  };

  const liveEntryLabel =
    bufferAmount != null
      ? `CHF ${bufferAmount.toFixed(2)}`
      : buffer
        ? `CHF ${buffer}`
        : null;

  const showKeypad = !!selectedPaymentId || payments.length > 0;
  const showQuickAdd = quickAddAmounts.length > 0;

  const actionBtnClass = (active?: boolean) =>
    `inline-flex min-h-[2.75rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1.5 text-[10px] font-semibold leading-tight disabled:opacity-40 ${
      active
        ? 'border-[var(--webpos-accent-ring)] bg-[var(--webpos-accent-soft)] text-[var(--webpos-accent-text)]'
        : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
    }`;

  const clearTip = () => setTipAmount(0);

  const adjustmentCards = (
    <div className="w-full max-w-md space-y-2 text-left">
      {billDiscountAmount > 0.001 ? (
        <div
          role={onBillDiscount ? 'button' : undefined}
          tabIndex={onBillDiscount ? 0 : undefined}
          onClick={() => onBillDiscount?.()}
          onKeyDown={(e) => {
            if (!onBillDiscount) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onBillDiscount();
            }
          }}
          className={`flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 ${
            onBillDiscount ? 'cursor-pointer hover:bg-amber-100/80' : ''
          }`}
        >
          <div className="min-w-0">
            <span className="text-sm font-semibold text-amber-950">{t('webPosBillDiscount')}</span>
            {billDiscountLabel ? (
              <p className="mt-0.5 truncate text-xs text-amber-800/80">{billDiscountLabel}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tabular-nums text-amber-950">
              −CHF {billDiscountAmount.toFixed(2)}
            </span>
            {onClearBillDiscount ? (
              <button
                type="button"
                className="rounded p-1 text-red-500 hover:bg-red-50"
                aria-label={t('webPosRemoveDiscount')}
                title={t('webPosRemoveDiscount')}
                onClick={(e) => {
                  e.stopPropagation();
                  onClearBillDiscount();
                }}
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {tipAmount > 0.001 ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setTipOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setTipOpen(true);
            }
          }}
          className="flex cursor-pointer items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 hover:bg-emerald-100/80"
        >
          <div className="min-w-0">
            <span className="text-sm font-semibold text-emerald-950">{t('webPosTip')}</span>
            <p className="mt-0.5 text-xs text-emerald-800/80">{t('webPosTapToEdit')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tabular-nums text-emerald-950">
              +CHF {tipAmount.toFixed(2)}
            </span>
            <button
              type="button"
              className="rounded p-1 text-red-500 hover:bg-red-50"
              aria-label={t('webPosRemoveTip')}
              title={t('webPosRemoveTip')}
              onClick={(e) => {
                e.stopPropagation();
                clearTip();
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : null}
      {pointsDiscount > 0.001 ? (
        <div className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
          <div className="min-w-0">
            <span className="text-sm font-semibold text-sky-950">{t('webPosPointsDiscount')}</span>
            <p className="mt-0.5 text-xs text-sky-800/80">
              {t('webPosPointsRedeemLine')
                .replace('{pts}', String(pointsRedeemed))
                .replace('{amount}', pointsDiscount.toFixed(2))}
            </p>
          </div>
          <span className="text-sm font-bold tabular-nums text-sky-950">
            −CHF {pointsDiscount.toFixed(2)}
          </span>
        </div>
      ) : null}
    </div>
  );

  const hasAdjustments =
    billDiscountAmount > 0.001 || tipAmount > 0.001 || pointsDiscount > 0.001;

  const footerBar = (opts: { mobileOnly?: boolean; desktopOnly?: boolean }) => (
    <div
      className={`webpos-checkout-footer flex shrink-0 items-stretch gap-2 border-t border-stone-100 bg-white p-3 sm:p-4 ${
        opts.mobileOnly ? 'lg:hidden' : ''
      } ${opts.desktopOnly ? 'mt-auto hidden lg:flex' : ''}`}
    >
      {onBack ? (
        <button
          type="button"
          disabled={busy}
          onClick={onBack}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-40 sm:px-4"
          aria-label={t('back')}
          title={t('back')}
        >
          <ArrowLeft size={18} />
          <span className="hidden sm:inline">{t('back')}</span>
        </button>
      ) : null}
      {canComplete ? (
        <button
          type="button"
          disabled={busy}
          onClick={complete}
          className="webpos-accent-btn min-h-12 flex-1 rounded-xl px-4 py-3.5 text-sm font-bold disabled:opacity-40"
        >
          {t('webPosConfirmPay')}
          {changeDue > 0 ? ` - ${t('webPosChangeDue')} CHF ${changeDue.toFixed(2)}` : ''}
        </button>
      ) : (
        <div className="min-h-12 flex-1" aria-hidden />
      )}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      {/*
        Mobile: scrollable body + fixed footer (Safari bottom bar safe).
        Desktop: two columns via lg:contents on the scroll wrapper.
      */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="webpos-checkout-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] lg:contents">
          {/* Mobile: total first */}
          <div className="order-1 flex shrink-0 flex-col items-center border-b border-stone-100 px-4 py-3 text-center lg:hidden">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              {t('webPosAmountDue')}
            </p>
            <p className="text-3xl font-light tabular-nums tracking-tight text-stone-800 sm:text-4xl">
              CHF {total.toFixed(2)}
            </p>
            {remaining > 0.001 ? (
              <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--webpos-accent-text)]">
                {t('webPosRemaining')}: CHF {remaining.toFixed(2)}
              </p>
            ) : null}
            {changeDue > 0.001 ? (
              <p className="mt-1 text-sm font-semibold tabular-nums text-emerald-700">
                {t('webPosChangeDue')}: CHF {changeDue.toFixed(2)}
              </p>
            ) : null}
          </div>

          {/* Methods + compact icon actions + keypad */}
          <div className="order-2 flex shrink-0 flex-col gap-2 border-b border-stone-100 p-3 lg:order-1 lg:h-full lg:w-[min(20rem,36vw)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {payButtons
                .filter((b) => b.show)
                .map((b) => {
                  const selected = activeMethod === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      disabled={busy}
                      onClick={() => applyMethod(b.id)}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-center text-sm font-semibold disabled:opacity-40 lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:py-3.5 lg:text-left ${
                        selected
                          ? 'border-[var(--webpos-accent-ring)] bg-[var(--webpos-accent-soft)] text-[var(--webpos-accent-text)] ring-1 ring-[var(--webpos-accent-ring)]'
                          : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
                      }`}
                    >
                      {b.icon}
                      {b.label}
                    </button>
                  );
                })}
            </div>

            {/* One row: customer / split / discount / tip / drawer */}
            <div className="flex items-stretch gap-1.5">
              <button
                type="button"
                disabled={busy || !onCustomer}
                onClick={() => onCustomer?.()}
                className={actionBtnClass(!!customerLabel)}
                title={customerLabel || t('webPosCustomer')}
              >
                <UserCircle2 size={18} />
                <span className="max-w-full truncate">
                  {customerLabel || t('webPosCustomerShort')}
                </span>
              </button>

              {settings.splitBillsEnabled && onSplit ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onSplit}
                  className={actionBtnClass(!!splitLabel)}
                  title={t('webPosSplitBill')}
                >
                  <ArrowLeftRight size={18} />
                  <span className="max-w-full truncate">{t('webPosSplitBill')}</span>
                </button>
              ) : null}

              {settings.discountsEnabled && onBillDiscount ? (
                <button
                  type="button"
                  disabled={busy || !canApplyBillDiscount}
                  onClick={onBillDiscount}
                  className={actionBtnClass(billDiscountAmount > 0)}
                  title={
                    billDiscountAmount > 0
                      ? `${t('webPosBillDiscount')} - CHF ${billDiscountAmount.toFixed(2)}${
                          billDiscountLabel ? ` (${billDiscountLabel})` : ''
                        }`
                      : t('webPosBillDiscount')
                  }
                >
                  <Percent size={18} />
                  <span className="truncate">
                    {billDiscountAmount > 0 ? `-${billDiscountAmount.toFixed(2)}` : '%'}
                  </span>
                </button>
              ) : null}

              {settings.tipsEnabled ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setTipOpen(true)}
                  className={actionBtnClass(tipAmount > 0)}
                  title={t('webPosTip')}
                >
                  <Coins size={18} />
                  <span className="truncate">
                    {tipAmount > 0 ? `CHF ${tipAmount.toFixed(2)}` : t('webPosTip')}
                  </span>
                </button>
              ) : null}

              {onOpenDrawer ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onOpenDrawer}
                  className={`${actionBtnClass(false)} max-w-[3rem] flex-none px-1`}
                  title={t('webPosOpenDrawer')}
                  aria-label={t('webPosOpenDrawer')}
                >
                  <Vault size={18} />
                  <span className="sr-only">{t('webPosOpenDrawer')}</span>
                </button>
              ) : null}
            </div>

            <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 px-0.5 text-xs font-semibold text-stone-600">
              <input
                type="checkbox"
                checked={invoice}
                onChange={() => setInvoice((v) => !v)}
                className="h-3.5 w-3.5 rounded border-stone-400 text-[var(--webpos-accent)] focus:ring-[var(--webpos-accent-ring)]"
              />
              {t('webPosInvoice')}
            </label>

            {canPayWithPoints && onTogglePayWithPoints ? (
              <div className="space-y-2 pt-1 text-left">
                <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">
                  {t('webPosLoyaltyPoints')}
                </p>
                <label className="inline-flex w-full cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">
                  <input
                    type="checkbox"
                    checked={payWithPoints}
                    onChange={(e) => onTogglePayWithPoints(e.target.checked)}
                    className="h-4 w-4 rounded border-stone-400 text-[var(--webpos-accent)] focus:ring-[var(--webpos-accent-ring)]"
                  />
                  {t('webPosPayWithPoints').replace(
                    '{n}',
                    String(membershipPointsBalance ?? 0)
                  )}
                </label>
              </div>
            ) : null}

            <div className="space-y-2 border-t border-stone-100 pt-2 lg:mt-auto">
              <div className={showKeypad ? '' : 'hidden lg:block'}>
                <WebPosNumericKeypad
                  mode="qty"
                  onModeChange={() => undefined}
                  buffer={buffer}
                  onBufferChange={(buf) => {
                    // Do not auto-select an existing tender while typing a new amount.
                    // User must tap a payment line to edit it, or tap a method to add one.
                    setBuffer(buf);
                  }}
                  onQuickAdd={showQuickAdd ? applyQuickAdd : undefined}
                  onApply={complete}
                  showModeButtons={false}
                  showQuickAdd={showQuickAdd}
                  quickAddAmounts={quickAddAmounts}
                  compact
                  disabled={busy}
                  hideApply
                  showSignToggle={false}
                />
              </div>
              {!showKeypad ? (
                <p className="py-6 text-center text-sm text-stone-400 lg:hidden">
                  {t('webPosTapPaymentMethod')}
                </p>
              ) : null}
            </div>
          </div>

          {/* Payment lines + remaining */}
          <div className="order-3 flex min-h-0 flex-1 flex-col lg:order-2 lg:h-full lg:overflow-hidden">
            <div
              className="flex flex-col items-center px-4 py-3 pb-8 text-center lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:py-8"
              onClick={() => {
                if (selectedPaymentId) clearPaymentSelection();
              }}
            >
              <div className="hidden w-full flex-col items-center lg:flex">
                <p className="text-sm font-semibold uppercase tracking-wide text-stone-400">
                  {t('webPosAmountDue')}
                </p>
                <p className="text-5xl font-light tabular-nums tracking-tight text-stone-700 sm:text-6xl">
                  CHF {total.toFixed(2)}
                </p>
              </div>
              {liveEntryLabel && !selectedPaymentId ? (
                <p className="mt-2 text-base font-semibold tabular-nums text-[var(--webpos-accent-text)]">
                  {t('webPosEntering')}: {liveEntryLabel}
                </p>
              ) : null}
              {perGuest ? (
                <p className="mt-3 text-lg text-stone-500">
                  CHF {perGuest.toFixed(2)} / {t('webPosGuest')}{' '}
                  <span className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded bg-stone-200 text-sm font-bold">
                    {splitGuestCount}
                  </span>
                </p>
              ) : null}
              {splitLabel ? (
                <p className="mt-1 text-sm font-medium text-[var(--webpos-accent-text)]">
                  {splitLabel}
                </p>
              ) : null}

              <div className="mt-3 w-full max-w-md space-y-2 text-left lg:mt-8">
                {payments.length === 0 ? (
                  <p className="hidden text-center text-sm text-stone-400 lg:block">
                    {t('webPosTapPaymentMethod')}
                  </p>
                ) : (
                  payments.map((p) => {
                    const selected = selectedPaymentId === p.id;
                    const displayAmount =
                      selected && bufferAmount != null ? bufferAmount : p.amount;
                    return (
                      <div
                        key={p.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectPayment(p.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            selectPayment(p.id);
                          }
                        }}
                        className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 ${
                          selected
                            ? 'border-[var(--webpos-accent-ring)] bg-[var(--webpos-accent-soft)] ring-1 ring-[var(--webpos-accent-ring)]'
                            : 'border-stone-200 bg-white hover:bg-stone-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="text-sm font-semibold">{methodLabel(p.method)}</span>
                          {selected && liveEntryLabel ? (
                            <p className="mt-0.5 text-xs font-medium text-[var(--webpos-accent-text)]">
                              {t('webPosEntering')}: {liveEntryLabel}
                            </p>
                          ) : selected ? (
                            <p className="mt-0.5 text-xs text-stone-500">{t('webPosEditAmount')}</p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold tabular-nums">
                            CHF {displayAmount.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            className="rounded p-1 text-red-500 hover:bg-red-50"
                            aria-label={t('delete')}
                            onClick={(e) => {
                              e.stopPropagation();
                              removePayment(p.id);
                            }}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
                {hasAdjustments ? (
                  <div
                    className="space-y-2 pt-1"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {adjustmentCards}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 w-full max-w-md space-y-1 text-sm">
                <div
                  className={`flex justify-between font-semibold ${
                    remaining > 0.001 ? 'text-[var(--webpos-accent-text)]' : ''
                  }`}
                >
                  <span>{t('webPosRemaining')}</span>
                  <span className="tabular-nums">CHF {remaining.toFixed(2)}</span>
                </div>
                {changeDue > 0 ? (
                  <div className="flex justify-between font-semibold text-emerald-700">
                    <span>{t('webPosChangeDue')}</span>
                    <span className="tabular-nums">CHF {changeDue.toFixed(2)}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {footerBar({ desktopOnly: true })}
          </div>
        </div>

        {/* Mobile: Confirm stays pinned above Safari chrome; body scrolls above it */}
        {footerBar({ mobileOnly: true })}
      </div>

      <WebPosTipKeypad
        open={tipOpen}
        initial={tipAmount}
        baseAmount={baseTotal}
        presetsPercent={settings.tipPresetsPercent}
        allowPercent
        allowCustom={settings.allowCustomTip !== false}
        onClose={() => setTipOpen(false)}
        onConfirm={(amount) => {
          setTipAmount(roundMoney2(Math.max(0, amount)));
          setTipOpen(false);
        }}
      />
    </div>
  );
}
