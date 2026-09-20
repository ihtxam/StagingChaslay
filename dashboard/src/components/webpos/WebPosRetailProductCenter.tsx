import { Search, Wallet, Gift } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import type { RetailTileSize } from '@/lib/pos-checkout';
import { categoryColor, categoryColorMap } from './categoryColors';
import type { PosCategoryId, Product, Category } from './types';
import { POS_GIFT_CARDS_CATEGORY } from './types';

function formatCartQtyBadge(qty: number, weighed: boolean): string | number {
  if (!weighed) return Math.round(qty);
  return Number(qty.toFixed(3));
}

const RETAIL_TILE_GRID: Record<RetailTileSize, string> = {
  sm: 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
  md: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  lg: 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-3',
};

type Props = {
  products: Product[];
  categories: Category[];
  categoryId: PosCategoryId;
  search: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit?: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  autoFocusSearch?: boolean;
  tileSize?: RetailTileSize;
  onProductClick: (product: Product) => void;
  cartQtyByProduct: Map<string, number>;
  productHasCombo: (p: Product) => boolean;
  productHasMods: (p: Product) => boolean;
  onCustomAmount?: () => void;
  onBackgroundClick?: () => void;
  onSellGiftCard?: () => void;
  onSellMembership?: () => void;
  membershipEnabled?: boolean;
  /** When true and no search, hide grid on All Items (scanner-first empty state). */
  sparseGridOnAllItems?: boolean;
};

export default function WebPosRetailProductCenter({
  products,
  categories,
  categoryId,
  search,
  onSearchChange,
  onSearchSubmit,
  searchInputRef,
  autoFocusSearch = false,
  tileSize = 'lg',
  onProductClick,
  cartQtyByProduct,
  productHasCombo,
  productHasMods,
  onCustomAmount,
  onBackgroundClick,
  onSellGiftCard,
  onSellMembership,
  membershipEnabled = false,
  sparseGridOnAllItems = true,
}: Props) {
  const { t } = useI18n();
  const localRef = useRef<HTMLInputElement>(null);
  const inputRef = searchInputRef || localRef;
  const colorByCat = useMemo(() => categoryColorMap(categories), [categories]);
  const gridClass = RETAIL_TILE_GRID[tileSize] || RETAIL_TILE_GRID.lg;
  const hasSearch = !!search.trim();
  const isGiftCardCategory = categoryId === POS_GIFT_CARDS_CATEGORY;
  const showEmptyBrowse =
    sparseGridOnAllItems && categoryId === 'all' && !hasSearch && products.length > 0;
  const showNoProducts = products.length === 0;

  useEffect(() => {
    if (!autoFocusSearch) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [autoFocusSearch, inputRef]);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--webpos-bg)]">
      <div className="shrink-0 border-b border-[var(--webpos-border)] bg-[var(--webpos-bg)] px-3 py-2.5">
        <label className="relative block">
          <Search
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--webpos-accent-text)]"
            aria-hidden
          />
          <input
            ref={inputRef}
            className="webpos-search-input webpos-retail-search h-11 w-full rounded-xl border border-[var(--webpos-accent-border)] bg-white pl-10 pr-3 text-base font-medium shadow-sm"
            placeholder={t('webPosRetailScanSearch')}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSearchSubmit?.();
              }
            }}
            autoComplete="off"
            inputMode="search"
            enterKeyHint="search"
            aria-label={t('webPosRetailScanSearch')}
          />
        </label>
      </div>

      <div
        className="webpos-product-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 touch-pan-y"
        data-webpos-retail-product-grid="1"
        onClick={() => onBackgroundClick?.()}
      >
        {isGiftCardCategory ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSellGiftCard?.();
              }}
              className="flex min-h-[10rem] flex-col items-center justify-center rounded-xl bg-teal-600 px-4 py-6 text-center text-white hover:bg-teal-700 sm:col-span-2"
            >
              <Gift size={28} className="mb-2 opacity-90" aria-hidden />
              <span className="text-base font-bold">{t('giftCardSell')}</span>
            </button>
            {membershipEnabled && onSellMembership ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSellMembership();
                }}
                className="flex min-h-[10rem] flex-col items-center justify-center rounded-xl bg-indigo-600 px-4 py-6 text-center text-white hover:bg-indigo-700 sm:col-span-2"
              >
                <Gift size={28} className="mb-2 opacity-90" aria-hidden />
                <span className="text-base font-bold">{t('membershipSellTitle')}</span>
              </button>
            ) : null}
          </div>
        ) : showEmptyBrowse ? (
          <div className="flex h-full min-h-[14rem] flex-col items-center justify-center gap-2 px-4 text-center">
            <Search size={32} className="text-stone-300" aria-hidden />
            <p className="text-base font-semibold text-stone-600">{t('webPosRetailScanEmptyTitle')}</p>
            <p className="max-w-sm text-sm text-stone-500">{t('webPosRetailScanEmptyHint')}</p>
          </div>
        ) : showNoProducts ? (
          <div className="flex h-full min-h-[10rem] items-center justify-center text-sm text-stone-500">
            {hasSearch || categoryId !== 'all'
              ? t('webPosNoProductsMatch')
              : t('webPosRetailScanEmptyTitle')}
          </div>
        ) : (
          <div className={`grid gap-2.5 ${gridClass}`}>
            {onCustomAmount ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCustomAmount();
                }}
                className="webpos-retail-product-tile group min-h-[8rem] !bg-[#5C4B7A] text-white hover:!bg-[#4a3d62]"
                title={t('webPosCustomAmount')}
              >
                <div className="flex min-h-[6rem] flex-1 flex-col items-center justify-center px-2 py-3">
                  <Wallet size={26} className="mb-2 opacity-90" aria-hidden />
                  <span className="line-clamp-2 text-center text-sm font-bold leading-snug">
                    {t('webPosCustomAmount')}
                  </span>
                </div>
              </button>
            ) : null}
            {products.map((p) => {
              const accent =
                (p.categoryId && colorByCat.get(p.categoryId)) || categoryColor(p.categoryId, 0);
              const qty = cartQtyByProduct.get(p.id) || 0;
              const isCombo = productHasCombo(p);
              const hasMods = !isCombo && productHasMods(p);
              const isWeighed = !!p.soldByWeight || p.productType === 'weighed';
              const imageSrc = p.image || p.imageUrl || null;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onProductClick(p);
                  }}
                  className="webpos-retail-product-tile group"
                >
                  <div className="aspect-[4/3] w-full shrink-0 overflow-hidden bg-stone-100">
                    {imageSrc ? (
                      <img
                        src={imageSrc}
                        alt=""
                        className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200 px-2">
                        <span className="line-clamp-3 text-center text-xs font-semibold uppercase tracking-wide text-stone-500">
                          {p.name}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col px-2.5 pb-2 pt-2">
                    <span className="line-clamp-2 text-left text-sm font-semibold leading-snug text-stone-800">
                      {p.name}
                    </span>
                    <span className="mt-1 text-left text-sm font-bold tabular-nums text-[var(--webpos-accent-text)]">
                      {isWeighed
                        ? `${Number(p.price || 0).toFixed(2)}/kg`
                        : Number(p.price || 0).toFixed(2)}
                    </span>
                    {(isCombo || hasMods) && (
                      <span className="mt-1 self-start rounded bg-stone-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-stone-500">
                        {isCombo ? t('webPosCombo') : t('webPosOpts')}
                      </span>
                    )}
                  </div>
                  <div
                    className="relative h-1 w-full shrink-0"
                    style={{ backgroundColor: accent }}
                    aria-hidden
                  />
                  {qty > 0 ? (
                    <span className="absolute bottom-3 right-2 inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-lg bg-stone-900 px-1.5 text-xs font-bold text-white shadow">
                      {formatCartQtyBadge(qty, isWeighed)}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
