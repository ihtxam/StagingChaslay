import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { roundMoney2, splitEqual005 } from '@/lib/money';

export type SplitCartLine = {
  id: string;
  name: string;
  quantity: number;
  lineTotal: number;
};

export type SplitPart = {
  id: string;
  label: string;
  amount: number;
  lineIds: string[];
  /** Per-line quantity assigned to this part (supports partial splits). */
  lineQtys?: Record<string, number>;
};

type Props = {
  open: boolean;
  lines: SplitCartLine[];
  total: number;
  maxParts: number;
  onClose: () => void;
  onConfirm: (parts: SplitPart[]) => void;
};

function lineUnitPrice(line: SplitCartLine) {
  const qty = line.quantity || 1;
  return roundMoney2(line.lineTotal / qty);
}

function initQtyMatrix(lineList: SplitCartLine[], partCount: number): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const line of lineList) {
    const row = Array.from({ length: partCount }, () => 0);
    row[0] = line.quantity;
    out[line.id] = row;
  }
  return out;
}

export default function WebPosSplitBillModal({
  open,
  lines,
  total,
  maxParts,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'equal' | 'items'>('equal');
  const [parts, setParts] = useState(2);
  const [qtyMatrix, setQtyMatrix] = useState<Record<string, number[]>>(() =>
    initQtyMatrix(lines, 2)
  );
  /** For 3+ parts: which secondary ticket (index 1..n-1) is shown in the right column. */
  const [activePartIdx, setActivePartIdx] = useState(1);

  // Reset only when the modal opens — not when `lines` gets a new array reference on parent re-render.
  useEffect(() => {
    if (!open) return;
    setMode('equal');
    setParts(2);
    setQtyMatrix(initQtyMatrix(lines, 2));
    setActivePartIdx(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lines intentionally read at open time only
  }, [open]);

  useEffect(() => {
    setQtyMatrix((prev) => {
      const next = initQtyMatrix(lines, parts);
      for (const line of lines) {
        const old = prev[line.id];
        if (!old) continue;
        const merged = Array.from({ length: parts }, (_, i) => old[i] ?? 0);
        const assigned = merged.reduce((s, q) => s + q, 0);
        if (assigned === line.quantity) {
          next[line.id] = merged;
        }
      }
      return next;
    });
    setActivePartIdx((i) => Math.min(Math.max(1, i), Math.max(1, parts - 1)));
  }, [parts, lines]);

  const equalParts = useMemo(() => {
    const amounts = splitEqual005(total, parts);
    return amounts.map((amount, i) => ({
      id: `eq-${i + 1}`,
      label: `${t('webPosSplitPart')} ${i + 1}/${parts}`,
      amount,
      lineIds: [] as string[],
    }));
  }, [total, parts, t]);

  const itemParts = useMemo(() => {
    return Array.from({ length: parts }, (_, i) => {
      const lineQtys: Record<string, number> = {};
      let amount = 0;
      for (const line of lines) {
        const qty = qtyMatrix[line.id]?.[i] ?? 0;
        if (qty <= 0) continue;
        lineQtys[line.id] = qty;
        amount = roundMoney2(amount + lineUnitPrice(line) * qty);
      }
      return {
        id: `it-${i + 1}`,
        label: `${t('webPosSplitPart')} ${i + 1}`,
        amount,
        lineIds: Object.keys(lineQtys),
        lineQtys,
      };
    }).filter((b) => b.amount > 0.001);
  }, [lines, parts, qtyMatrix, t]);

  const moveQty = (lineId: string, fromIdx: number, toIdx: number, qty = 1) => {
    setQtyMatrix((prev) => {
      const row = [...(prev[lineId] || [])];
      if (row.length < parts) {
        while (row.length < parts) row.push(0);
      }
      const move = Math.min(qty, row[fromIdx] ?? 0);
      if (move <= 0) return prev;
      row[fromIdx] = (row[fromIdx] ?? 0) - move;
      row[toIdx] = (row[toIdx] ?? 0) + move;
      return { ...prev, [lineId]: row };
    });
  };

  const partLines = (partIdx: number) =>
    lines
      .map((line) => ({
        line,
        qty: qtyMatrix[line.id]?.[partIdx] ?? 0,
      }))
      .filter((x) => x.qty > 0);

  const partAmount = (partIdx: number) =>
    roundMoney2(
      partLines(partIdx).reduce((s, { line, qty }) => s + lineUnitPrice(line) * qty, 0)
    );

  const canConfirmItems =
    itemParts.length >= 2 && itemParts.every((p) => p.amount > 0.001);

  if (!open) return null;

  const rightPartIdx = parts === 2 ? 1 : activePartIdx;
  const leftPartIdx = 0;

  const renderColumn = (partIdx: number, side: 'left' | 'right') => {
    const rows = partLines(partIdx);
    const label =
      parts === 2
        ? side === 'left'
          ? `${t('webPosSplitPart')} 1`
          : `${t('webPosSplitPart')} 2`
        : `${t('webPosSplitPart')} ${partIdx + 1}`;

    return (
      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[var(--border)] bg-white">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-sm font-bold tabular-nums">CHF {partAmount(partIdx).toFixed(2)}</span>
        </div>
        <ul className="min-h-[8rem] flex-1 space-y-1 overflow-y-auto p-2">
          {rows.length === 0 ? (
            <li className="py-6 text-center text-xs text-stone-400">{t('webPosSplitEmptyTicket')}</li>
          ) : (
            rows.map(({ line, qty }) => (
              <li
                key={line.id}
                className="flex items-center gap-2 rounded-lg border border-stone-100 bg-stone-50 px-2 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {qty}x {line.name}
                  </p>
                  <p className="text-xs text-stone-500">
                    CHF {roundMoney2(lineUnitPrice(line) * qty).toFixed(2)}
                  </p>
                </div>
                {side === 'left' && qty > 0 ? (
                  <div className="flex shrink-0 items-center gap-1">
                    {line.quantity > 1 ? (
                      <select
                        className="input w-14 px-1 py-1 text-xs"
                        defaultValue="1"
                        id={`split-qty-${line.id}-${partIdx}`}
                        aria-label={t('webPosSplitMoveQty')}
                      >
                        {Array.from({ length: qty }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <button
                      type="button"
                      className="inline-flex items-center gap-0.5 rounded-lg border border-teal-600 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-100"
                      title={t('webPosSplitMoveToTicket')}
                      onClick={() => {
                        const sel = document.getElementById(
                          `split-qty-${line.id}-${partIdx}`
                        ) as HTMLSelectElement | null;
                        const moveQtyN = sel ? Number(sel.value) || 1 : 1;
                        moveQty(line.id, leftPartIdx, rightPartIdx, moveQtyN);
                      }}
                    >
                      <ArrowRight size={14} />
                    </button>
                  </div>
                ) : null}
                {side === 'right' && qty > 0 ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-0.5 rounded-lg border border-stone-200 px-2 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-100"
                    title={t('webPosSplitMoveBack')}
                    onClick={() => moveQty(line.id, partIdx, leftPartIdx, qty)}
                  >
                    <ChevronLeft size={14} />
                  </button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/45 p-3 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 className="font-semibold">{t('webPosSplitBill')}</h2>
          <button type="button" className="p-2" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`rounded-xl border py-3 text-sm font-semibold ${
                mode === 'equal' ? 'border-teal-600 bg-teal-50' : 'border-[var(--border)]'
              }`}
              onClick={() => setMode('equal')}
            >
              {t('webPosSplitEqual')}
            </button>
            <button
              type="button"
              className={`rounded-xl border py-3 text-sm font-semibold ${
                mode === 'items' ? 'border-teal-600 bg-teal-50' : 'border-[var(--border)]'
              }`}
              onClick={() => setMode('items')}
            >
              {t('webPosSplitByItems')}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm muted">{t('webPosSplitParts')}</span>
            {Array.from({ length: Math.min(maxParts, 8) }, (_, i) => i + 2).map((n) => (
              <button
                key={n}
                type="button"
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                  parts === n ? 'border-teal-600 bg-teal-50' : 'border-[var(--border)]'
                }`}
                onClick={() => setParts(n)}
              >
                /{n}
              </button>
            ))}
          </div>

          {mode === 'equal' ? (
            <ul className="space-y-2 text-sm">
              {equalParts.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between rounded-lg border border-[var(--border)] px-3 py-2"
                >
                  <span>{p.label}</span>
                  <span className="font-semibold">CHF {p.amount.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-3">
              {parts > 2 ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: parts - 1 }, (_, i) => i + 1).map((idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                        activePartIdx === idx
                          ? 'border-teal-600 bg-teal-50'
                          : 'border-[var(--border)]'
                      }`}
                      onClick={() => setActivePartIdx(idx)}
                    >
                      {t('webPosSplitPart')} {idx + 1} · CHF {partAmount(idx).toFixed(2)}
                    </button>
                  ))}
                </div>
              ) : null}
              <p className="text-xs text-stone-500">{t('webPosSplitTwoColumnHint')}</p>
              <div className="grid min-h-[14rem] grid-cols-1 gap-3 sm:grid-cols-2">
                {renderColumn(leftPartIdx, 'left')}
                {renderColumn(rightPartIdx, 'right')}
              </div>
              <ul className="space-y-1 border-t border-[var(--border)] pt-2 text-sm">
                {itemParts.map((p) => (
                  <li key={p.id} className="flex justify-between font-semibold">
                    <span>{p.label}</span>
                    <span>CHF {p.amount.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            className="btn-primary w-full py-3 disabled:opacity-40"
            disabled={mode === 'items' && !canConfirmItems}
            onClick={() => onConfirm(mode === 'equal' ? equalParts : itemParts)}
          >
            {t('webPosStartSplitPay')}
          </button>
        </div>
      </div>
    </div>
  );
}
