import { Gift } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { CartGiftTierStatus } from '@/lib/cart-free-gift';
import { roundMoney2 } from '@/lib/money';

type ProductLookup = (id: string) => { name: string } | null;

type Props = {
  offerName: string;
  offerDescription?: string | null;
  tiers: CartGiftTierStatus[];
  productName: ProductLookup;
  formatMoney: (amount: number) => string;
  onChooseTier: (tierIndex: number) => void;
  compact?: boolean;
};

export default function ShopCartFreeGiftPanel({
  offerName,
  offerDescription,
  tiers,
  productName,
  formatMoney,
  onChooseTier,
  compact = false,
}: Props) {
  const { t } = useI18n();
  if (!tiers.length) return null;

  const nextLocked = tiers.find((x) => !x.unlocked);
  const hasUnlockedUnclaimed = tiers.some((x) => x.unlocked && !x.claimedProductId);

  const freeGiftBubbleCount = tiers.reduce((sum, tier) => {
    if (!tier.unlocked || tier.claimedProductId) return sum;
    return sum + Math.max(1, tier.productIds.length);
  }, 0);

  return (
    <div
      className={`relative rounded-xl border border-stone-700 bg-stone-800 text-white ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      {freeGiftBubbleCount > 1 ? (
        <span
          className="absolute -left-2 top-3 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-amber-400 px-1.5 text-xs font-bold text-stone-900 shadow"
          aria-label={String(freeGiftBubbleCount)}
        >
          {freeGiftBubbleCount}
        </span>
      ) : null}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
          <Gift size={20} className="text-amber-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{offerName}</p>
          {offerDescription ? (
            <p className="mt-0.5 text-xs text-stone-300 line-clamp-2">{offerDescription}</p>
          ) : (
            <p className="mt-0.5 text-xs text-stone-300">{t('shopCartFreeGiftHint')}</p>
          )}
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {tiers.map((tier) => {
          const minLabel = formatMoney(tier.minCartTotal);
          const label =
            tier.label ||
            t('shopCartFreeGiftTierDefault').replace('{min}', minLabel);
          if (tier.claimedProductId) {
            const name = productName(tier.claimedProductId)?.name || t('shopFreeProduct');
            return (
              <li
                key={tier.tierIndex}
                className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm"
              >
                <span className="text-stone-200">{label}</span>
                <span className="font-medium text-teal-300">{name}</span>
              </li>
            );
          }
          if (tier.unlocked) {
            return (
              <li key={tier.tierIndex}>
                <button
                  type="button"
                  onClick={() => onChooseTier(tier.tierIndex)}
                  className="w-full rounded-lg bg-white px-3 py-2.5 text-left text-sm font-semibold text-stone-900 hover:bg-stone-100"
                >
                  {t('shopChooseFreeProduct')}
                </button>
              </li>
            );
          }
          return (
            <li
              key={tier.tierIndex}
              className="rounded-lg border border-dashed border-stone-600 px-3 py-2 text-xs text-stone-400"
            >
              {t('shopCartFreeGiftLocked')
                .replace('{amount}', formatMoney(tier.remaining))
                .replace('{min}', minLabel)}
            </li>
          );
        })}
      </ul>

      {nextLocked && hasUnlockedUnclaimed ? null : nextLocked ? (
        <p className="mt-2 text-[11px] text-stone-400">
          {t('shopCartFreeGiftNext').replace(
            '{amount}',
            formatMoney(roundMoney2(nextLocked.remaining))
          )}
        </p>
      ) : null}
    </div>
  );
}
