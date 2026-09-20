import { ChevronLeft, ChevronRight, Gift } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { categoryColor, categoryColorMap } from './categoryColors';
import { POS_GIFT_CARDS_CATEGORY, type PosCategoryId, type Category } from './types';

const COLLAPSE_KEY = 'webpos_retail_sidebar_collapsed';

type Props = {
  categories: Category[];
  categoryId: PosCategoryId;
  onCategoryChange: (id: PosCategoryId) => void;
  giftCardsEnabled?: boolean;
  /** Phones: render as horizontal chip row instead of vertical sidebar. */
  layout?: 'sidebar' | 'chips';
};

export default function WebPosRetailCategorySidebar({
  categories,
  categoryId,
  onCategoryChange,
  giftCardsEnabled = false,
  layout = 'sidebar',
}: Props) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const colorByCat = useMemo(() => categoryColorMap(categories), [categories]);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const items: Array<{ id: PosCategoryId; label: string; color?: string; icon?: 'gift' }> = [
    { id: 'all', label: t('webPosAllCategories'), color: '#e7e5e4' },
    ...(giftCardsEnabled
      ? [{ id: POS_GIFT_CARDS_CATEGORY as PosCategoryId, label: t('webPosGiftCardsCategory'), icon: 'gift' as const }]
      : []),
    ...categories.map((c, i) => ({
      id: c.id as PosCategoryId,
      label: c.name,
      color: categoryColor(c.id, i, c.color),
    })),
  ];

  if (layout === 'chips') {
    return (
      <div className="webpos-retail-cat-chips shrink-0 border-b border-[var(--webpos-border)] bg-[var(--webpos-bg)] px-2 py-2">
        <div className="flex gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5">
          {items.map((item) => {
            const active = categoryId === item.id;
            return (
              <button
                key={String(item.id)}
                type="button"
                onClick={() => onCategoryChange(item.id)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide ${
                  active
                    ? 'bg-[var(--webpos-accent)] text-white ring-2 ring-[var(--webpos-accent-ring)] ring-offset-1'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
                style={!active && item.color && item.id !== POS_GIFT_CARDS_CATEGORY ? { backgroundColor: item.color } : undefined}
              >
                {item.icon === 'gift' ? (
                  <span className="inline-flex items-center gap-1">
                    <Gift size={12} aria-hidden />
                    {item.label}
                  </span>
                ) : (
                  item.label
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <aside
      className={`webpos-retail-sidebar hidden shrink-0 flex-col border-r border-[var(--webpos-border)] bg-[var(--webpos-bg)] lg:flex ${
        collapsed ? 'w-12' : 'w-[min(13rem,18vw)]'
      }`}
      aria-label={t('webPosRetailCategories')}
    >
      <div className="flex shrink-0 items-center justify-between gap-1 border-b border-[var(--webpos-border)] px-2 py-2">
        {!collapsed ? (
          <span className="truncate text-xs font-bold uppercase tracking-wide text-stone-600">
            {t('webPosRetailCategories')}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
          aria-label={collapsed ? t('webPosRetailExpandSidebar') : t('webPosRetailCollapseSidebar')}
          title={collapsed ? t('webPosRetailExpandSidebar') : t('webPosRetailCollapseSidebar')}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-1.5">
        <ul className="space-y-1">
          {items.map((item) => {
            const active = categoryId === item.id;
            const catColor =
              item.id !== 'all' && item.id !== POS_GIFT_CARDS_CATEGORY
                ? colorByCat.get(String(item.id)) || item.color
                : item.color;
            return (
              <li key={String(item.id)}>
                <button
                  type="button"
                  onClick={() => onCategoryChange(item.id)}
                  title={item.label}
                  className={`flex w-full touch-manipulation items-center gap-2 rounded-lg px-2 py-2.5 text-left text-sm font-semibold transition ${
                    active
                      ? 'bg-[var(--webpos-accent)] text-white shadow-sm'
                      : 'text-stone-700 hover:bg-stone-100'
                  } ${collapsed ? 'justify-center px-1' : ''}`}
                >
                  {item.icon === 'gift' ? (
                    <Gift size={16} className="shrink-0" aria-hidden />
                  ) : (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: catColor || '#d6d3d1' }}
                      aria-hidden
                    />
                  )}
                  {!collapsed ? <span className="min-w-0 truncate">{item.label}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
