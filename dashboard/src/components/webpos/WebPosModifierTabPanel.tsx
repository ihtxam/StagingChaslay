import { useMemo, useState } from 'react';
import { Check, MessageSquare, Minus, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { roundMoney2 } from '@/lib/money';
import type { ShopModifierGroup } from '@/components/shop/shop-modifier-utils';
import { buildExtrasFromSelection, groupMin, toggleGroupOption } from '@/components/shop/shop-modifier-utils';
import { translateModifierGroupTitle } from '@/components/webpos/webpos-modifier-utils';

type Props = {
  title: string;
  groups: ShopModifierGroup[];
  selection: Record<string, string[]>;
  onSelectionChange: (next: Record<string, string[]>) => void;
  /** Base catalog price before extras */
  basePrice: number;
  /** Optional slot upcharge (combo nested) */
  extraPrice?: number;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  lineNote: string;
  onLineNoteChange: (note: string) => void;
  onConfirm: () => void;
  onDiscard: () => void;
  confirmDisabled?: boolean;
  error?: string | null;
  /** z-index class for stacking nested modals */
  zClass?: string;
};

function money(n: number) {
  return `CHF ${Number(n || 0).toFixed(2)}`;
}

function formatExtraPrice(price: number, includedLabel: string) {
  if (price <= 0) return includedLabel;
  return `+${money(price)}`;
}

export default function WebPosModifierTabPanel({
  title,
  groups,
  selection,
  onSelectionChange,
  basePrice,
  extraPrice = 0,
  quantity,
  onQuantityChange,
  lineNote,
  onLineNoteChange,
  onConfirm,
  onDiscard,
  confirmDisabled = false,
  error = null,
  zClass = 'z-[70]',
}: Props) {
  const { t } = useI18n();
  const [activeTabId, setActiveTabId] = useState(() => groups[0]?.id ?? '');
  const [noteOpen, setNoteOpen] = useState(!!lineNote.trim());

  const translateTitle = (groupTitle: string) => translateModifierGroupTitle(groupTitle, t);

  const selectedExtras = useMemo(
    () => buildExtrasFromSelection(groups, selection),
    [groups, selection]
  );

  const unitPrice = roundMoney2(
    basePrice + extraPrice + selectedExtras.reduce((s, e) => s + e.price, 0)
  );
  const lineTotal = roundMoney2(unitPrice * Math.max(1, quantity));

  const summaryText = useMemo(() => {
    if (!selectedExtras.length) return t('webPosModNoSelection');
    return selectedExtras.map((e) => e.name).join(' / ');
  }, [selectedExtras, t]);

  const activeGroup = groups.find((g) => g.id === activeTabId) ?? groups[0];

  const handleToggle = (group: ShopModifierGroup, optionId: string) => {
    onSelectionChange(toggleGroupOption(group, optionId, selection));
  };

  return (
    <div
      className={`fixed inset-0 ${zClass} flex flex-col bg-[var(--webpos-surface,#fff)] text-[var(--webpos-text,#1c1917)] shadow-2xl sm:inset-3 sm:rounded-2xl sm:border sm:border-[var(--webpos-border,#e7e5e4)]`}
      onClick={(e) => e.stopPropagation()}
    >
      <header className="shrink-0 border-b border-[var(--webpos-border,#e7e5e4)] px-3 py-3 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold leading-tight sm:text-xl">
            {title}
          </h2>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setNoteOpen((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold sm:text-sm ${
                noteOpen || lineNote.trim()
                  ? 'border-[var(--webpos-accent-ring)] bg-[var(--webpos-accent-soft)] text-[var(--webpos-accent-text)]'
                  : 'border-[var(--webpos-border,#e7e5e4)] bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              <MessageSquare size={14} />
              {t('webPosAddNote')}
            </button>
            <button
              type="button"
              onClick={onDiscard}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--webpos-border,#e7e5e4)] text-stone-500 hover:bg-red-50 hover:text-red-600"
              aria-label={t('webPosDiscardItem')}
            >
              <Trash2 size={18} />
            </button>
            <div className="inline-flex items-center rounded-lg border border-[var(--webpos-border,#e7e5e4)] bg-white">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-l-lg hover:bg-stone-100 disabled:opacity-40"
                disabled={quantity <= 1}
                onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                aria-label={t('webPosDecreaseQty')}
              >
                <Minus size={16} />
              </button>
              <span className="min-w-[2rem] text-center text-sm font-bold tabular-nums">{quantity}</span>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-r-lg hover:bg-stone-100"
                onClick={() => onQuantityChange(quantity + 1)}
                aria-label={t('webPosIncreaseQty')}
              >
                <Plus size={16} />
              </button>
            </div>
            <button
              type="button"
              disabled={confirmDisabled}
              onClick={onConfirm}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-45 sm:px-4"
            >
              <Check size={16} strokeWidth={3} />
              {t('webPosModAdd')} · {money(lineTotal)}
            </button>
          </div>
        </div>

        <p className="mt-2 truncate text-sm text-[var(--webpos-text-muted,#78716c)]">{summaryText}</p>

        {noteOpen ? (
          <textarea
            className="input mt-2 min-h-[2.75rem] w-full text-sm"
            value={lineNote}
            onChange={(e) => onLineNoteChange(e.target.value)}
            placeholder={t('webPosLineNotePlaceholder')}
            rows={2}
          />
        ) : null}
      </header>

      {groups.length > 0 ? (
        <>
          <div className="shrink-0 border-b border-[var(--webpos-border,#e7e5e4)] px-3 py-2 sm:px-5">
            <div className="flex gap-2 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
              {groups.map((g) => {
                const active = g.id === (activeGroup?.id ?? '');
                const required = groupMin(g) > 0;
                const count = (selection[g.id] || []).length;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setActiveTabId(g.id)}
                    className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {translateTitle(g.title)}
                    {required ? <span className="ml-0.5 text-red-400">*</span> : null}
                    {count > 0 && !active ? (
                      <span className="ml-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--webpos-accent)] px-1 text-[10px] font-bold text-white">
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4">
            {activeGroup ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {activeGroup.options.map((opt) => {
                  const checked = (selection[activeGroup.id] || []).includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleToggle(activeGroup, opt.id)}
                      className={`flex min-h-[4.5rem] flex-col items-center justify-center rounded-xl border-2 px-2 py-2.5 text-center transition-colors ${
                        checked
                          ? 'border-stone-900 bg-stone-900 text-white shadow-sm'
                          : 'border-stone-200 bg-white text-stone-900 hover:border-stone-400'
                      }`}
                    >
                      <span
                        className={`text-xs font-semibold tabular-nums ${
                          checked ? 'text-white/90' : 'text-stone-500'
                        }`}
                      >
                        {formatExtraPrice(Number(opt.price) || 0, t('shopIncluded'))}
                      </span>
                      <span className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">
                        {opt.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center px-5 text-sm text-stone-500">
          {t('webPosModNoGroups')}
        </div>
      )}

      {error ? (
        <div className="shrink-0 border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}
