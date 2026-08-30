import { useMemo, useState } from 'react';
import { MessageSquarePlus, Minus, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { ShopSelectedExtra } from '@/lib/shop-cart';
import { roundMoney2 } from '@/lib/money';
import ShopModifierTabGrid from '@/components/shop/ShopModifierTabGrid';
import {
  buildExtrasFromSelection,
  effectiveGroups,
  initialSelection,
  productHasModifiers,
  productRequiresModifierModal,
  defaultConfiguredAdd,
  selectionSummary,
  validateModifierGroups,
  type ShopProductForModifiers,
} from '@/components/shop/shop-modifier-utils';

export type {
  ShopModifierOption,
  ShopModifierGroup,
  ShopProductForModifiers,
} from '@/components/shop/shop-modifier-utils';

export { productHasModifiers, productRequiresModifierModal, defaultConfiguredAdd };

type ConfirmOptions = {
  qty?: number;
  note?: string;
};

type Props = {
  product: ShopProductForModifiers;
  onClose: () => void;
  onConfirm: (extras: ShopSelectedExtra[], unitPrice: number, options?: ConfirmOptions) => void;
  /** POS-style header with qty, note, and blue add button */
  variant?: 'shop' | 'pos';
  initialQty?: number;
  showProductImages?: boolean;
  /** false = wider grid (kiosk / POS-style modifier picker) */
  compact?: boolean;
  /** Larger option photo tiles */
  touchLarge?: boolean;
  /** Wider modal (kiosk) */
  wide?: boolean;
};

export default function ShopProductModifiersModal({
  product,
  onClose,
  onConfirm,
  variant = 'shop',
  initialQty = 1,
  showProductImages = true,
  compact,
  touchLarge = false,
  wide = false,
}: Props) {
  const { t } = useI18n();
  const groups = useMemo(() => effectiveGroups(product), [product]);
  const [selection, setSelection] = useState<Record<string, string[]>>(() => initialSelection(groups));
  const [qty, setQty] = useState(Math.max(1, initialQty));
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedExtras = useMemo(
    () => buildExtrasFromSelection(groups, selection),
    [groups, selection]
  );

  const extrasTotal = roundMoney2(selectedExtras.reduce((s, e) => s + e.price, 0));
  const unitPrice = roundMoney2(product.price + extrasTotal);
  const lineTotal = roundMoney2(unitPrice * qty);
  const summary = selectionSummary(groups, selection, t('shopDefaultToppings'));

  const confirm = () => {
    const err = validateModifierGroups(groups, selection, {
      chooseOne: (name) => t('shopChooseOptionFor').replace('{name}', name),
      chooseAtLeast: (n, name) =>
        t('shopChooseAtLeastOptions').replace('{n}', String(n)).replace('{name}', name),
      tooMany: (name) => t('shopTooManyOptions').replace('{name}', name),
      groupTitle: (title) =>
        title === 'Extras' ? t('shopExtras') : title === 'Sizes' ? t('sizes') : title,
    });
    if (err) {
      setError(err);
      return;
    }
    onConfirm(selectedExtras, unitPrice, variant === 'pos' ? { qty, note: note.trim() || undefined } : undefined);
  };

  const isPos = variant === 'pos';
  const gridCompact = compact ?? !isPos;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
        onClick={onClose}
      >
        <div
          className={`flex w-full flex-col bg-white shadow-2xl ${
            isPos || wide
              ? 'max-h-[92vh] sm:max-w-2xl'
              : 'max-h-[90vh] sm:max-w-md'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-stone-200 px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-bold tracking-tight text-stone-900">
                  {product.name}
                </h2>
                {!isPos ? (
                  <p className="mt-0.5 text-sm text-stone-500">{t('shopCustomizeItem')}</p>
                ) : null}
                <p className="mt-1.5 line-clamp-2 text-sm text-stone-600">{summary}</p>
              </div>

              {isPos ? (
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setNoteOpen(true)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold ${
                        note.trim()
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <MessageSquarePlus size={14} />
                      {note.trim() ? t('shopEditNote') : t('shopAddNote')}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-lg border border-stone-200 p-1.5 text-stone-500 hover:bg-red-50 hover:text-red-600"
                      aria-label={t('shopDiscard')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-lg border border-stone-300 bg-stone-50">
                      <button
                        type="button"
                        className="p-1.5 text-stone-700 hover:bg-stone-100 disabled:opacity-40"
                        disabled={qty <= 1}
                        onClick={() => setQty((n) => Math.max(1, n - 1))}
                        aria-label={t('shopDecreaseQty')}
                      >
                        <Minus size={16} />
                      </button>
                      <span className="min-w-[2rem] text-center text-sm font-bold tabular-nums">{qty}</span>
                      <button
                        type="button"
                        className="p-1.5 text-stone-700 hover:bg-stone-100"
                        onClick={() => setQty((n) => n + 1)}
                        aria-label={t('shopIncreaseQty')}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={confirm}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
                    >
                      {t('shopAdd')} · CHF {lineTotal.toFixed(2)}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="shrink-0 text-sm font-semibold text-stone-600"
                  onClick={onClose}
                >
                  {t('close')}
                </button>
              )}
            </div>
          </div>

          <ShopModifierTabGrid
            groups={groups}
            selection={selection}
            onSelectionChange={(updater) => {
              setError(null);
              setSelection(updater);
            }}
            compact={gridCompact}
            showProductImages={showProductImages}
            touchLarge={touchLarge}
          />

          {!isPos ? (
            <div className="space-y-3 border-t border-stone-200 px-5 py-4">
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">{t('shopItemTotal')}</span>
                <span className="font-semibold">CHF {unitPrice.toFixed(2)}</span>
              </div>
              <button
                type="button"
                onClick={confirm}
                className="w-full bg-stone-900 py-3 font-semibold text-white"
              >
                {t('shopAddToBasket')}
              </button>
            </div>
          ) : error ? (
            <div className="border-t border-stone-200 px-4 py-2">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : null}
        </div>
      </div>

      {noteOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-3"
          onClick={() => setNoteOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-stone-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-stone-100 px-4 py-3">
              <h3 className="font-semibold">{t('shopAddNote')}</h3>
            </div>
            <div className="space-y-3 p-4">
              <textarea
                className="input min-h-[5rem] w-full text-sm"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('shopItemNotePlaceholder')}
                autoFocus
              />
              <div className="flex gap-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setNoteOpen(false)}>
                  {t('cancel')}
                </button>
                <button type="button" className="btn-primary flex-1" onClick={() => setNoteOpen(false)}>
                  {t('save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
