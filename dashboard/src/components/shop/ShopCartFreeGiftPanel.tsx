import { Gift } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { CartGiftTierStatus } from '@/lib/cart-free-gift';
import { roundMoney2 } from '@/lib/money';

type ProductLookup = (id: string) => { name: string } | null;

export type ShopCartFreeGiftLayout = 'strip' | 'drawer';

type Props = {
  offerName: string;
  offerDescription?: string | null;
  tiers: CartGiftTierStatus[];
  productName: ProductLookup;
  formatMoney: (amount: number) => string;
  onChooseTier: (tierIndex: number) => void;
  layout?: ShopCartFreeGiftLayout;
};

export default function ShopCartFreeGiftPanel({
  offerName,
  offerDescription,
  tiers,
  productName,
  formatMoney,
  onChooseTier,
  layout = 'drawer',
}: Props) {
  const { t } = useI18n();
  if (!tiers.length) return null;

  const nextLocked = tiers.find((x) => !x.unlocked);
  const firstPickTier = tiers.find((x) => x.unlocked && !x.claimedProductId);

  if (layout === 'strip') {
    const subtitle = firstPickTier
      ? t('shopCartFreeGiftPickInCart')
      : nextLocked
        ? t('shopCartFreeGiftSpendMin').replace('{amount}', formatMoney(nextLocked.minCartTotal))
        : offerDescription?.trim() || t('shopCartFreeGiftHint');

    const handleClick = () => {
      if (firstPickTier) onChooseTier(firstPickTier.tierIndex);
    };

    return (
      <div
        className={`flex items-center gap-3 rounded-lg bg-stone-800 px-3 py-2.5 text-white shadow-sm ${
          firstPickTier ? 'cursor-pointer active:opacity-90' : ''
        }`}
        role={firstPickTier ? 'button' : undefined}
        tabIndex={firstPickTier ? 0 : undefined}
        onClick={firstPickTier ? handleClick : undefined}
        onKeyDown={
          firstPickTier
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClick();
                }
              }
            : undefined
        }
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{offerName}</p>
          <p className="mt-0.5 text-xs leading-snug text-stone-300">{subtitle}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
          <Gift size={22} className="text-white" strokeWidth={1.75} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-stone-800">
          <Gift size={16} className="text-amber-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-stone-900">{offerName}</p>
          <p className="mt-0.5 text-xs text-stone-600">
            {offerDescription?.trim() || t('shopCartFreeGiftHint')}
          </p>
        </div>
      </div>

      <ul className="mt-2.5 space-y-1.5">
        {tiers.map((tier) => {
          const minLabel = formatMoney(tier.minCartTotal);
          const label =
            tier.label || t('shopCartFreeGiftTierDefault').replace('{min}', minLabel);
          if (tier.claimedProductId) {
            const name = productName(tier.claimedProductId)?.name || t('shopFreeProduct');
            return (
              <li
                key={tier.tierIndex}
                className="flex items-center justify-between gap-2 rounded-md bg-white px-2.5 py-1.5 text-xs"
              >
                <span className="text-stone-600">{label}</span>
                <span className="font-medium text-teal-700">{name}</span>
              </li>
            );
          }
          if (tier.unlocked) {
            return (
              <li key={tier.tierIndex}>
                <button
                  type="button"
                  onClick={() => onChooseTier(tier.tierIndex)}
                  className="w-full rounded-md bg-stone-900 px-2.5 py-2 text-left text-xs font-semibold text-white hover:bg-stone-800"
                >
                  {t('shopChooseFreeProduct')}
                </button>
              </li>
            );
          }
          return (
            <li key={tier.tierIndex} className="text-xs text-stone-500">
              {t('shopCartFreeGiftLocked')
                .replace('{amount}', formatMoney(tier.remaining))
                .replace('{min}', minLabel)}
            </li>
          );
        })}
      </ul>

      {nextLocked && !firstPickTier ? (
        <p className="mt-2 text-[11px] text-stone-500">
          {t('shopCartFreeGiftNext').replace(
            '{amount}',
            formatMoney(roundMoney2(nextLocked.remaining))
          )}
        </p>
      ) : null}
    </div>
  );
}
