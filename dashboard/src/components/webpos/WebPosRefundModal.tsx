import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Delete, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { resolveOrderItemName } from '@/lib/order-item-name';

export type RefundReasonOption = {
  id: string;
  en: string;
  fr: string;
  de: string;
};

export type RefundOrderItem = {
  id: string;
  name?: string | null;
  quantity: number;
  totalPrice: number;
  refundedQuantity?: number;
};

type Props = {
  open: boolean;
  orderNumber: string;
  total: number;
  alreadyRefunded: number;
  items: RefundOrderItem[];
  reasons?: RefundReasonOption[];
  busy?: boolean;
  /** Order includes an Adyen terminal portion (card reversal on refund). */
  hasTerminalPortion?: boolean;
  /** Merchant has terminal enabled (goodwill terminal payout). */
  terminalEnabled?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    refundKind: 'referenced' | 'goodwill';
    mode: 'full' | 'items';
    reason: string;
    reasonId: string;
    items?: Array<{ orderItemId: string; quantity: number }>;
    goodwillAmount?: number;
    goodwillMethod?: 'cash' | 'terminal';
  }) => void;
};

const FALLBACK_REASONS: RefundReasonOption[] = [
  {
    id: 'didnt_like_food',
    en: "Client didn't like the food",
    fr: "Le client n'a pas aimé le plat",
    de: 'Gast mochte das Essen nicht',
  },
  {
    id: 'service_slow',
    en: 'Service was slow',
    fr: 'Service trop lent',
    de: 'Service war zu langsam',
  },
  {
    id: 'wrong_order',
    en: 'Wrong order',
    fr: 'Mauvaise commande',
    de: 'Falsche Bestellung',
  },
  {
    id: 'change_of_mind',
    en: 'Change of mind',
    fr: "Changement d'avis",
    de: 'Meinungsänderung',
  },
  {
    id: 'quality_issue',
    en: 'Quality / preparation issue',
    fr: 'Problème de qualité / préparation',
    de: 'Qualitäts- / Zubereitungsproblem',
  },
  { id: 'other', en: 'Other (custom)', fr: 'Autre (personnalisé)', de: 'Sonstiges (frei)' },
];

const LETTER_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

function money(n: number) {
  return `CHF ${Number(n || 0).toFixed(2)}`;
}

export default function WebPosRefundModal({
  open,
  orderNumber,
  total,
  alreadyRefunded,
  items,
  reasons: apiReasons,
  busy,
  hasTerminalPortion = false,
  terminalEnabled = false,
  onClose,
  onConfirm,
}: Props) {
  const { t, locale } = useI18n();
  const remaining = Math.max(0, Number(total || 0) - Number(alreadyRefunded || 0));
  const options = useMemo(() => {
    const src = apiReasons?.length ? apiReasons : FALLBACK_REASONS;
    return src.map((r) => ({
      id: r.id,
      label: locale === 'fr' ? r.fr : locale === 'de' ? r.de : r.en,
    }));
  }, [apiReasons, locale]);

  const [refundKind, setRefundKind] = useState<'referenced' | 'goodwill'>('referenced');
  const [mode, setMode] = useState<'full' | 'items'>('full');
  const [reasonId, setReasonId] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({});
  const [goodwillAmountText, setGoodwillAmountText] = useState('');
  const [goodwillMethod, setGoodwillMethod] = useState<'cash' | 'terminal'>('cash');

  const refundableItems = useMemo(
    () =>
      items
        .map((it) => {
          const qty = Number(it.quantity) || 0;
          const refunded = Number(it.refundedQuantity || 0) || 0;
          const left = Math.max(0, qty - refunded);
          return { ...it, left, unit: qty > 0 ? Number(it.totalPrice) / qty : 0 };
        })
        .filter((it) => it.left > 0.0005),
    [items]
  );

  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;
    setRefundKind('referenced');
    setMode('full');
    setReasonId(options[0]?.id || '');
    setCustomReason('');
    setGoodwillAmountText('');
    setGoodwillMethod('cash');
    const init: Record<string, number> = {};
    for (const it of refundableItems) init[it.id] = 0;
    setSelectedQty(init);
  }, [open, options, refundableItems]);

  if (!open || typeof document === 'undefined') return null;

  const selectedItems = refundableItems
    .map((it) => ({
      orderItemId: it.id,
      quantity: Number(selectedQty[it.id] || 0),
      amount: (Number(selectedQty[it.id] || 0) || 0) * it.unit,
    }))
    .filter((it) => it.quantity > 0);

  const itemsRefundAmount = selectedItems.reduce((s, it) => s + it.amount, 0);
  const goodwillAmount = Number(goodwillAmountText.replace(',', '.')) || 0;
  const previewAmount =
    refundKind === 'goodwill'
      ? goodwillAmount
      : mode === 'full'
        ? remaining
        : Math.min(remaining, itemsRefundAmount);
  const isOther = reasonId === 'other';
  const reasonLabel =
    isOther
      ? customReason.trim()
      : options.find((o) => o.id === reasonId)?.label || '';
  const canConfirm =
    !!reasonLabel &&
    previewAmount > 0.001 &&
    (refundKind === 'goodwill' ||
      mode === 'full' ||
      selectedItems.length > 0) &&
    !busy;

  const pushChar = (ch: string) => {
    setCustomReason((prev) => (prev + ch).slice(0, 120));
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-3 sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div>
            <h2 className="font-semibold text-rose-700">{t('webPosRefund')}</h2>
            <p className="text-xs text-[var(--text-muted)]">
              {orderNumber} · {t('webPosRefundRemaining').replace('{amount}', money(remaining))}
            </p>
          </div>
          <button type="button" className="p-2" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              className={`rounded-xl px-3 py-2.5 text-sm font-bold ${
                refundKind === 'referenced'
                  ? 'bg-rose-600 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
              onClick={() => setRefundKind('referenced')}
            >
              {t('webPosRefund')}
            </button>
            <button
              type="button"
              className={`rounded-xl px-3 py-2.5 text-sm font-bold ${
                refundKind === 'goodwill'
                  ? 'bg-amber-600 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
              onClick={() => setRefundKind('goodwill')}
            >
              {t('webPosRefundGoodwill')}
            </button>
          </div>

          {refundKind === 'referenced' && hasTerminalPortion ? (
            <p className="text-xs text-violet-700">{t('webPosRefundTerminalNote')}</p>
          ) : null}

          {refundKind === 'goodwill' ? (
            <p className="text-xs text-stone-500">{t('webPosRefundGoodwillHint')}</p>
          ) : null}

          {refundKind === 'goodwill' ? (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600">
                {t('webPosGoodwillAmount')}
              </label>
              <input
                type="number"
                min="0"
                step="0.05"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-bold"
                value={goodwillAmountText}
                onChange={(e) => setGoodwillAmountText(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">
                {t('webPosGoodwillMethod')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`rounded-lg px-3 py-2 text-sm font-bold ${
                    goodwillMethod === 'cash'
                      ? 'bg-stone-800 text-white'
                      : 'bg-white ring-1 ring-stone-200'
                  }`}
                  onClick={() => setGoodwillMethod('cash')}
                >
                  {t('webPosGoodwillCash')}
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-2 text-sm font-bold ${
                    goodwillMethod === 'terminal'
                      ? 'bg-stone-800 text-white'
                      : 'bg-white ring-1 ring-stone-200'
                  }`}
                  disabled={!terminalEnabled}
                  onClick={() => setGoodwillMethod('terminal')}
                >
                  {t('webPosGoodwillTerminal')}
                </button>
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`rounded-xl px-3 py-2.5 text-sm font-bold ${
                mode === 'full'
                  ? 'bg-rose-600 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
              onClick={() => setMode('full')}
            >
              {t('webPosRefundFullTicket')}
            </button>
            <button
              type="button"
              className={`rounded-xl px-3 py-2.5 text-sm font-bold ${
                mode === 'items'
                  ? 'bg-rose-600 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
              onClick={() => setMode('items')}
            >
              {t('webPosRefundSomeItems')}
            </button>
          </div>
          )}

          {refundKind === 'referenced' && mode === 'items' ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                {t('webPosRefundSelectItems')}
              </p>
              {refundableItems.length === 0 ? (
                <p className="text-sm text-stone-500">{t('webPosRefundNoItemsLeft')}</p>
              ) : (
                refundableItems.map((it) => {
                  const qty = Number(selectedQty[it.id] || 0);
                  return (
                    <div
                      key={it.id}
                      className="flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {resolveOrderItemName(it.name)}
                        </p>
                        <p className="text-[11px] text-stone-500">
                          {money(it.unit)} · {t('webPosRefundLeftQty').replace('{n}', String(it.left))}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="h-8 w-8 rounded-lg bg-stone-100 font-bold"
                          disabled={qty <= 0}
                          onClick={() =>
                            setSelectedQty((prev) => ({
                              ...prev,
                              [it.id]: Math.max(0, (prev[it.id] || 0) - 1),
                            }))
                          }
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-bold tabular-nums">{qty}</span>
                        <button
                          type="button"
                          className="h-8 w-8 rounded-lg bg-stone-100 font-bold"
                          disabled={qty >= it.left}
                          onClick={() =>
                            setSelectedQty((prev) => ({
                              ...prev,
                              [it.id]: Math.min(it.left, (prev[it.id] || 0) + 1),
                            }))
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              {t('webPosRefundReasonPrompt')}
            </p>
            {options.map((r) => (
              <label
                key={r.id}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                  reasonId === r.id
                    ? 'border-rose-500 bg-rose-50 font-semibold text-rose-900'
                    : 'border-[var(--border)]'
                }`}
              >
                <input
                  type="radio"
                  name="webpos-refund-reason"
                  checked={reasonId === r.id}
                  onChange={() => setReasonId(r.id)}
                  className="accent-rose-600"
                />
                {r.label}
              </label>
            ))}
          </div>

          {isOther ? (
            <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-3">
              <p className="text-xs font-semibold text-stone-600">{t('webPosRefundCustomReason')}</p>
              <div className="min-h-[2.5rem] rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium">
                {customReason || (
                  <span className="text-stone-400">{t('webPosRefundCustomHint')}</span>
                )}
              </div>
              <div className="space-y-1">
                {LETTER_ROWS.map((row) => (
                  <div key={row.join('')} className="flex justify-center gap-1">
                    {row.map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        className="h-9 min-w-[1.75rem] flex-1 rounded-md bg-white text-xs font-bold shadow-sm ring-1 ring-stone-200 active:bg-stone-100"
                        onClick={() => pushChar(ch.toLowerCase())}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                ))}
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="h-9 flex-[2] rounded-md bg-white text-xs font-bold shadow-sm ring-1 ring-stone-200"
                    onClick={() => pushChar(' ')}
                  >
                    {t('webPosRefundSpace')}
                  </button>
                  <button
                    type="button"
                    className="h-9 flex-1 rounded-md bg-white text-xs font-bold shadow-sm ring-1 ring-stone-200"
                    onClick={() => pushChar('.')}
                  >
                    .
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-stone-200"
                    onClick={() => setCustomReason((p) => p.slice(0, -1))}
                    aria-label={t('webPosRefundBackspace')}
                  >
                    <Delete size={16} />
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <p className="text-sm font-bold text-rose-700">
            {t('webPosRefundAmountPreview').replace('{amount}', money(previewAmount))}
          </p>
        </div>

        <div className="flex gap-2 border-t border-[var(--border)] p-4">
          <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={busy}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-40"
            disabled={!canConfirm}
            onClick={() =>
              onConfirm({
                refundKind,
                mode,
                reason: reasonLabel,
                reasonId,
                items:
                  refundKind === 'referenced' && mode === 'items'
                    ? selectedItems.map((it) => ({
                        orderItemId: it.orderItemId,
                        quantity: it.quantity,
                      }))
                    : undefined,
                goodwillAmount: refundKind === 'goodwill' ? goodwillAmount : undefined,
                goodwillMethod: refundKind === 'goodwill' ? goodwillMethod : undefined,
              })
            }
          >
            {busy ? t('saving') : t('webPosRefundSubmit')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
