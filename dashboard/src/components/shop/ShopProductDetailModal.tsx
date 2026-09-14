import { useState } from 'react';
import { X, Minus, Plus } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

type Product = {
  id: string;
  name: string;
  price: number;
  description?: string;
  image?: string;
};

type Props = {
  product: Product;
  displayPrice: number;
  showImage?: boolean;
  onClose: () => void;
  onAdd: (quantity: number) => void;
};

export default function ShopProductDetailModal({
  product,
  displayPrice,
  showImage = true,
  onClose,
  onAdd,
}: Props) {
  const { t } = useI18n();
  const [qty, setQty] = useState(1);
  const lineTotal = displayPrice * qty;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label={t('shopClose')}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex w-full max-w-lg max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl"
      >
        <div className="relative shrink-0">
          {showImage && product.image ? (
            <img src={product.image} alt="" className="h-52 w-full object-cover sm:h-56" />
          ) : (
            <div className="flex h-40 items-center justify-center bg-stone-100 text-4xl font-light text-stone-300">
              {(product.name || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-stone-700 shadow"
            aria-label={t('shopClose')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <h2 className="text-xl font-bold text-stone-900">{product.name}</h2>
          {product.description ? (
            <p className="text-sm text-stone-500 leading-relaxed">{product.description}</p>
          ) : null}
          <p className="text-base font-bold text-stone-900 tabular-nums">
            CHF {displayPrice.toFixed(2)}
          </p>
        </div>

        <div className="shrink-0 border-t border-stone-100 px-5 py-4 space-y-3 bg-white">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center"
                onClick={() => setQty((n) => Math.max(1, n - 1))}
                aria-label="-"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-[2rem] text-center font-semibold tabular-nums">{qty}</span>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center"
                onClick={() => setQty((n) => n + 1)}
                aria-label="+"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                onAdd(qty);
                onClose();
              }}
              className="flex-1 rounded-xl bg-[var(--shop-accent,#e11d48)] py-3 text-sm font-semibold text-white"
            >
              CHF {lineTotal.toFixed(2)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
