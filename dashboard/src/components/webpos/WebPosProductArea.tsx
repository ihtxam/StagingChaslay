import {
  ArrowDownAZ,
  ArrowRight,
  Banknote,
  CreditCard,
  Gift,
  Image as ImageIcon,
  LayoutGrid,
  MonitorSmartphone,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { categoryColor, categoryColorMap } from './categoryColors';
import {
  POS_GIFT_CARDS_CATEGORY,
  type PosCategoryId,
  type PosPaymentMethod,
  type Category,
  type Product,
} from './types';

export type ProductGridTileSize = 'sm' | 'md' | 'lg';
export type ProductGridSort = 'default' | 'alpha' | 'bestseller';

type Props = {
  categories: Category[];
  products: Product[];
  categoryId: PosCategoryId;
  onCategoryChange: (id: PosCategoryId) => void;
  onProductClick: (product: Product) => void;
  cartQtyByProduct: Map<string, number>;
  productHasCombo: (p: Product) => boolean;
  productHasMods: (p: Product) => boolean;
  showProductImages?: boolean;
  onToggleShowImages?: () => void;
  tileSize?: ProductGridTileSize;
  /** Phone layout step: 0 = 2×2, 1 = 3× cat / 2× prod, 2 = 3× both */
  mobileGridStep?: 0 | 1 | 2;
  isPhoneLayout?: boolean;
  onCycleTileSize?: () => void;
  productSort?: ProductGridSort;
  onToggleSortAlpha?: () => void;
  onToggleSortBestseller?: () => void;
  expressCheckout?: boolean;
  expressMethods?: { cash: boolean; card: boolean; terminal: boolean };
  onExpressPay?: (method: PosPaymentMethod) => void;
  expressDisabled?: boolean;
  onOpenCheckout?: () => void;
  checkoutDisabled?: boolean;
  giftCardsEnabled?: boolean;
  onGiftCards?: () => void;
  onSellGiftCard?: () => void;
  onSellMembership?: () => void;
  membershipEnabled?: boolean;
  onCustomAmount?: () => void;
  /** Click empty grid area (not a product tile) — e.g. deselect cart line. */
  onBackgroundClick?: () => void;
};

const TILE_GRID: Record<ProductGridTileSize, string> = {
  sm: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8',
  md: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7',
  lg: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
};

export default function WebPosProductArea({
  categories,
  products,
  categoryId,
  onCategoryChange,
  onProductClick,
  cartQtyByProduct,
  productHasCombo,
  productHasMods,
  showProductImages = false,
  onToggleShowImages,
  tileSize = 'md',
  mobileGridStep = 0,
  isPhoneLayout = false,
  onCycleTileSize,
  productSort = 'default',
  onToggleSortAlpha,
  onToggleSortBestseller,
  expressCheckout = false,
  expressMethods,
  onExpressPay,
  expressDisabled,
  onOpenCheckout,
  checkoutDisabled,
  giftCardsEnabled = false,
  onGiftCards,
  onSellGiftCard,
  onSellMembership,
  membershipEnabled = false,
  onCustomAmount,
  onBackgroundClick,
}: Props) {
  const { t } = useI18n();
  const colorByCat = useMemo(() => categoryColorMap(categories), [categories]);
  const isGiftCardCategory = categoryId === POS_GIFT_CARDS_CATEGORY;
  const gridClass = TILE_GRID[tileSize] || TILE_GRID.md;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--webpos-bg)]">
      <div className="shrink-0 border-b border-[var(--webpos-border)] bg-[var(--webpos-bg)] px-3 py-2">
        <div className="mb-2 flex items-center justify-end gap-1">
          {onToggleShowImages ? (
            <button
              type="button"
              onClick={onToggleShowImages}
              title={t('webPosGridShowImages')}
              aria-label={t('webPosGridShowImages')}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${
                showProductImages
                  ? 'border-[var(--webpos-accent)] bg-[var(--webpos-accent)] text-white'
                  : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              <ImageIcon size={16} aria-hidden />
            </button>
          ) : null}
          {onCycleTileSize ? (
            <button
              type="button"
              onClick={onCycleTileSize}
              title={t('webPosGridTileSize')}
              aria-label={t('webPosGridTileSize')}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${
                isPhoneLayout && mobileGridStep > 0
                  ? 'border-[var(--webpos-accent)] bg-[var(--webpos-accent)] text-white'
                  : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              <LayoutGrid size={16} aria-hidden />
            </button>
          ) : null}
          {onToggleSortAlpha ? (
            <button
              type="button"
              onClick={onToggleSortAlpha}
              title={t('webPosGridSortAlpha')}
              aria-label={t('webPosGridSortAlpha')}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${
                productSort === 'alpha'
                  ? 'border-[var(--webpos-accent)] bg-[var(--webpos-accent)] text-white'
                  : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              <ArrowDownAZ size={16} aria-hidden />
            </button>
          ) : null}
          {onToggleSortBestseller ? (
            <button
              type="button"
              onClick={onToggleSortBestseller}
              title={t('webPosGridSortBestseller')}
              aria-label={t('webPosGridSortBestseller')}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${
                productSort === 'bestseller'
                  ? 'border-[var(--webpos-accent)] bg-[var(--webpos-accent)] text-white'
                  : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              <TrendingUp size={16} aria-hidden />
            </button>
          ) : null}
        </div>
        <div className="webpos-cat-scroll flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onCategoryChange('all')}
            className={`webpos-category-chip ${
              categoryId === 'all' ? 'ring-2 ring-[var(--webpos-accent-ring)] ring-offset-1' : ''
            }`}
            style={{ backgroundColor: '#e7e5e4' }}
            title={t('webPosAllCategories')}
          >
            <span className="min-w-0 w-full truncate">{t('webPosAllCategories')}</span>
          </button>
          {giftCardsEnabled ? (
            <button
              type="button"
              onClick={() => onCategoryChange(POS_GIFT_CARDS_CATEGORY)}
              className={`webpos-category-chip inline-flex items-center justify-center gap-1 ${
                categoryId === POS_GIFT_CARDS_CATEGORY
                  ? 'ring-2 ring-[var(--webpos-accent-ring)] ring-offset-1'
                  : ''
              } bg-teal-600 text-white`}
              title={t('giftCard')}
            >
              <Gift size={14} />
              <span className="min-w-0 truncate">{t('webPosGiftCardsCategory')}</span>
            </button>
          ) : null}
          {categories.map((c, i) => {
            const color = categoryColor(c.id, i, c.color);
            const active = categoryId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onCategoryChange(c.id)}
                className={`webpos-category-chip ${
                  active ? 'ring-2 ring-[var(--webpos-accent-ring)] ring-offset-1' : ''
                }`}
                style={{ backgroundColor: color }}
                title={c.name}
              >
                <span className="min-w-0 w-full truncate">{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="webpos-product-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-2 pb-3 touch-pan-y"
        data-webpos-product-grid="1"
        onClick={() => onBackgroundClick?.()}
      >
        {isGiftCardCategory ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onSellGiftCard) onSellGiftCard();
                else onGiftCards?.();
              }}
              className="flex min-h-[8rem] flex-col items-center justify-center rounded-xl bg-teal-600 px-4 py-6 text-center text-white hover:bg-teal-700 sm:col-span-2"
            >
              <Gift size={28} className="mb-2 opacity-90" />
              <span className="text-base font-bold">{t('giftCardSell')}</span>
            </button>
            {membershipEnabled && onSellMembership ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSellMembership();
                }}
                className="flex min-h-[8rem] flex-col items-center justify-center rounded-xl bg-indigo-600 px-4 py-6 text-center text-white hover:bg-indigo-700 sm:col-span-2"
              >
                <Gift size={28} className="mb-2 opacity-90" />
                <span className="text-base font-bold">{t('membershipSellTitle')}</span>
              </button>
            ) : null}
          </div>
        ) : products.length === 0 ? (
          <div className="flex h-full min-h-[10rem] items-center justify-center text-sm text-stone-500">
            {t('webPosNoProductsMatch')}
          </div>
        ) : (
          <div className={`grid gap-2 ${gridClass}`}>
            {onCustomAmount ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCustomAmount();
              }}
              className="webpos-product-card group min-h-[5.5rem] !bg-[#5C4B7A] text-white hover:!bg-[#4a3d62]"
                title={t('webPosCustomAmount')}
              >
                <div className="flex min-h-[4rem] flex-1 flex-col items-center justify-center px-2 py-2.5">
                  <Wallet size={22} className="mb-1 opacity-90" aria-hidden />
                  <span className="line-clamp-2 text-center text-sm font-bold leading-snug">
                    {t('webPosCustomAmount')}
                  </span>
                </div>
                <div className="relative h-1.5 w-full rounded-b-lg bg-[#4a3d62]" />
              </button>
            ) : null}
            {products.map((p) => {
              const accent =
                (p.categoryId && colorByCat.get(p.categoryId)) ||
                categoryColor(p.categoryId, 0);
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
                  className="webpos-product-card group"
                >
                  {showProductImages && imageSrc ? (
                    <div className="mx-auto mt-1 h-12 w-12 overflow-hidden rounded-md bg-stone-100">
                      <img
                        src={imageSrc}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : null}
                  <div className="flex min-h-[4rem] flex-1 flex-col px-2 pt-2.5 pb-1">
                    <span className="line-clamp-3 text-center text-sm font-medium leading-snug text-stone-800">
                      {p.name}
                    </span>
                    {(isCombo || hasMods || isWeighed) && (
                      <span className="mx-auto mt-1 rounded bg-stone-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-stone-500">
                        {isWeighed
                          ? `${Number(p.price || 0).toFixed(2)}/kg`
                          : isCombo
                            ? t('webPosCombo')
                            : t('webPosOpts')}
                      </span>
                    )}
                  </div>
                  <div className="relative h-1.5 w-full rounded-b-lg" style={{ backgroundColor: accent }} />
                  {qty > 0 ? (
                    <span className="absolute bottom-2 right-2 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md bg-stone-900 px-1 text-xs font-bold text-white">
                      {qty}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {(() => {
        const showCash = expressMethods?.cash !== false;
        const showCard = expressMethods?.card !== false;
        const showTerminal = expressMethods?.terminal === true;
        const hasQuickPay = (showCash || showCard || showTerminal) && !!onExpressPay;
        const showPayRow = hasQuickPay || !!onOpenCheckout;
        if (!showPayRow) return null;
        return (
          <div className="hidden shrink-0 border-t border-stone-200 bg-white p-3 lg:block">
            <div className="flex items-stretch gap-2">
              <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
                {hasQuickPay && showCash ? (
                  <button
                    type="button"
                    disabled={expressDisabled}
                    onClick={() => onExpressPay!('cash')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
                  >
                    <Banknote size={18} />
                    {t('webPosCash')}
                  </button>
                ) : null}
                {hasQuickPay && showCard ? (
                  <button
                    type="button"
                    disabled={expressDisabled}
                    onClick={() => onExpressPay!('card')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 py-3.5 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-40"
                  >
                    <CreditCard size={18} />
                    {t('webPosCard')}
                  </button>
                ) : null}
                {hasQuickPay && showTerminal ? (
                  <button
                    type="button"
                    disabled={expressDisabled}
                    onClick={() => onExpressPay!('terminal')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 py-3.5 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-40"
                  >
                    <MonitorSmartphone size={18} />
                    {t('webPosTerminal')}
                  </button>
                ) : null}
              </div>
              {onOpenCheckout ? (
                <button
                  type="button"
                  disabled={checkoutDisabled}
                  onClick={onOpenCheckout}
                  className="inline-flex w-16 shrink-0 items-center justify-center rounded-xl border-2 border-stone-300 bg-stone-50 text-stone-800 hover:bg-stone-100 disabled:opacity-40"
                  title={t('webPosOpenCheckout')}
                >
                  <ArrowRight size={28} strokeWidth={2.5} />
                </button>
              ) : null}
            </div>
          </div>
        );
      })()}
    </section>
  );
}
