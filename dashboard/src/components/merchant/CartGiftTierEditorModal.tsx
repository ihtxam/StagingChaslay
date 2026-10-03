import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export type CartGiftTierForm = {
  id: string;
  minCartTotal: string;
  label: string;
  productIds: string[];
};

type ProductOpt = { id: string; name: string };

type Props = {
  open: boolean;
  tier: CartGiftTierForm | null;
  products: ProductOpt[];
  onClose: () => void;
  onSave: (tier: CartGiftTierForm) => void;
};

export default function CartGiftTierEditorModal({
  open,
  tier,
  products,
  onClose,
  onSave,
}: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<CartGiftTierForm | null>(tier);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open && tier) {
      setDraft({ ...tier });
      setQuery('');
    }
  }, [open, tier]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, query]);

  if (!open || !draft) return null;

  const toggleProduct = (id: string) => {
    setDraft((d) => {
      if (!d) return d;
      const has = d.productIds.includes(id);
      return {
        ...d,
        productIds: has ? d.productIds.filter((x) => x !== id) : [...d.productIds, id],
      };
    });
  };

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-hidden rounded-t-2xl sm:rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-gift-tier-title"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
          <h2 id="cart-gift-tier-title" className="text-sm font-semibold">
            {t('offerCartGiftTierModalTitle')}
          </h2>
          <button type="button" className="rounded-lg p-1 hover:bg-[var(--bg-muted)]" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm block">
              <span className="muted block mb-1 text-xs">{t('offerCartGiftMinTotal')}</span>
              <input
                className="input"
                type="number"
                min="0"
                step="0.05"
                value={draft.minCartTotal}
                onChange={(e) => setDraft({ ...draft, minCartTotal: e.target.value })}
              />
            </label>
            <label className="text-sm block">
              <span className="muted block mb-1 text-xs">{t('offerCartGiftTierLabel')}</span>
              <input
                className="input"
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              />
            </label>
          </div>
          <div>
            <p className="text-xs font-medium mb-1">{t('offerCartGiftPickProducts')}</p>
            <input
              className="input mb-2"
              placeholder={t('search')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`rounded-full px-2.5 py-1 text-[11px] border ${
                    draft.productIds.includes(p.id)
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-white border-[var(--border)]'
                  }`}
                  onClick={() => toggleProduct(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <p className="text-[11px] muted mt-1">
              {t('offerCartGiftSelectedCount').replace('{n}', String(draft.productIds.length))}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="button" className="btn-primary" onClick={handleSave}>
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
