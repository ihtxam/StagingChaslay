import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useI18n } from '@/lib/i18n';
import {
  groupMax,
  toggleGroupOption,
  type ShopModifierGroup,
} from '@/components/shop/shop-modifier-utils';

type Props = {
  groups: ShopModifierGroup[];
  selection: Record<string, string[]>;
  onSelectionChange: Dispatch<SetStateAction<Record<string, string[]>>>;
  currency?: string;
  compact?: boolean;
  showProductImages?: boolean;
};

function groupLabel(title: string, t: (k: string) => string) {
  if (title === 'Extras') return t('shopExtras');
  return title;
}

export default function ShopModifierTabGrid({
  groups,
  selection,
  onSelectionChange,
  currency = 'CHF',
  compact = false,
  showProductImages = true,
}: Props) {
  const { t } = useI18n();
  const [activeIdx, setActiveIdx] = useState(0);
  const activeGroup = groups[activeIdx] ?? groups[0];

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of groups) {
      counts[g.id] = (selection[g.id] || []).length;
    }
    return counts;
  }, [groups, selection]);

  if (!groups.length || !activeGroup) return null;

  const selected = selection[activeGroup.id] || [];
  const max = groupMax(activeGroup);
  const cols = compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3';

  const handleToggle = (optionId: string) => {
    onSelectionChange((prev) => toggleGroupOption(activeGroup, optionId, prev));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="flex shrink-0 gap-0 overflow-x-auto border-b border-stone-200 bg-stone-50"
        role="tablist"
      >
        {groups.map((g, idx) => {
          const active = idx === activeIdx;
          const count = tabCounts[g.id] || 0;
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveIdx(idx)}
              className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? 'border-blue-600 text-blue-700 bg-white'
                  : 'border-transparent text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
              }`}
            >
              {groupLabel(g.title, t)}
              {count > 0 ? (
                <span
                  className={`ml-1.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                    active ? 'bg-blue-100 text-blue-700' : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        <div className={`grid ${cols} gap-2.5`}>
          {activeGroup.options.map((opt) => {
            const checked = selected.includes(opt.id);
            const price = Number(opt.price) || 0;
            const imageSrc = opt.image || null;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleToggle(opt.id)}
                className={`flex min-h-[5.5rem] flex-col items-center justify-center border-2 px-2 py-2.5 text-center transition-colors ${
                  checked
                    ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                    : 'border-stone-200 bg-white hover:border-stone-400'
                }`}
              >
                {showProductImages && imageSrc ? (
                  <div className="mb-1.5 h-10 w-10 shrink-0 overflow-hidden rounded-md bg-stone-100">
                    <img
                      src={imageSrc}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : null}
                <span
                  className={`mb-1.5 rounded px-1.5 py-0.5 text-[11px] font-bold leading-none ${
                    price > 0
                      ? checked
                        ? 'bg-blue-600 text-white'
                        : 'bg-amber-100 text-amber-900'
                      : checked
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {price > 0 ? `+${currency} ${price.toFixed(2)}` : t('shopIncluded')}
                </span>
                <span
                  className={`line-clamp-3 text-sm font-semibold leading-tight ${
                    checked ? 'text-blue-900' : 'text-stone-900'
                  }`}
                >
                  {opt.name}
                </span>
                {max > 1 && checked ? (
                  <span className="mt-1 text-[10px] font-medium text-blue-700">{t('shopSelected')}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
