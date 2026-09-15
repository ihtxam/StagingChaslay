import { Plus } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export type ShopCartSimilarProduct = {
  id: string;
  name: string;
  price: number;
  image?: string | null;
};

type Props = {
  products: ShopCartSimilarProduct[];
  onAdd: (product: ShopCartSimilarProduct) => void;
  showImages?: boolean;
  className?: string;
};

/** Horizontal upsell strip in cart drawer ("Customers also add"). */
export default function ShopCartSimilarProducts({
  products,
  onAdd,
  showImages = true,
  className = '',
}: Props) {
  const { t } = useI18n();
  if (!products.length) return null;

  return (
    <div className={`border-t border-stone-100 px-5 py-4 ${className}`}>
      <h3 className="text-sm font-bold text-stone-900">{t('shopCustomersAlsoAdd')}</h3>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {products.map((product) => (
          <div
            key={product.id}
            className="relative w-[7.5rem] shrink-0 rounded-xl border border-stone-200 bg-white p-2 shadow-sm"
          >
            <button
              type="button"
              className="absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-stone-900 text-white shadow"
              aria-label={`${t('shopAddToCart')} ${product.name}`}
              onClick={() => onAdd(product)}
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
            </button>
            {showImages && product.image ? (
              <img
                src={product.image}
                alt=""
                className="mb-2 aspect-square w-full rounded-lg object-cover bg-stone-100"
              />
            ) : (
              <div className="mb-2 aspect-square w-full rounded-lg bg-stone-100" />
            )}
            <p className="line-clamp-2 text-xs font-semibold leading-snug text-stone-900">
              {product.name}
            </p>
            <p className="mt-1 text-xs tabular-nums text-stone-600">CHF {product.price.toFixed(2)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
