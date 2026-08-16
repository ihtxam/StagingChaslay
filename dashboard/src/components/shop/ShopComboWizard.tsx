import { useMemo, useState } from 'react';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { ShopSelectedExtra } from '@/lib/shop-cart';
import { roundMoney2 } from '@/lib/money';
import ShopModifierTabGrid from '@/components/shop/ShopModifierTabGrid';
import {
  buildExtrasFromSelection,
  effectiveGroups as modifierGroupsForProduct,
  groupMax,
  initialSelection,
  validateModifierGroups,
  type ShopModifierGroup,
} from '@/components/shop/shop-modifier-utils';

export type ComboOptionProduct = {
  productId: string;
  name: string;
  image?: string | null;
  description?: string | null;
  extraPrice: number;
  allowExtras?: boolean;
  extras?: Array<{ id: string; name: string; price: number; isDefault?: boolean }>;
  modifierGroups?: ShopModifierGroup[];
};

export type ComboSlot = {
  id: string;
  name: string;
  minPick: number;
  maxPick: number;
  options: ComboOptionProduct[];
};

export type ShopComboProduct = {
  id: string;
  name: string;
  price: number;
  description?: string;
  image?: string;
  comboSlots: ComboSlot[];
  allowExtras?: boolean;
  extras?: Array<{ id: string; name: string; price: number }>;
  modifierGroups?: ShopModifierGroup[];
};

export type ComboSelection = {
  slotId: string;
  slotName: string;
  productId: string;
  productName: string;
  image?: string | null;
  extraPrice: number;
  selectedExtras: ShopSelectedExtra[];
};

type Props = {
  product: ShopComboProduct;
  onClose: () => void;
  onConfirm: (payload: {
    comboSelections: ComboSelection[];
    selectedExtras: ShopSelectedExtra[];
    unitPrice: number;
  }) => void;
};

type SlotPick = {
  pickId: string;
  productId: string;
  productName: string;
  image?: string | null;
  extraPrice: number;
  selectedExtras: ShopSelectedExtra[];
  qty: number;
};

type NestedState = {
  slot: ComboSlot;
  option: ComboOptionProduct;
  extraSelection: Record<string, string[]>;
  replacePickId?: string;
};

function optionHasExtras(opt: ComboOptionProduct) {
  return (
    (opt.modifierGroups?.some((g) => g.options?.length) ?? false) ||
    (!!(opt.allowExtras && opt.extras?.length))
  );
}

function effectiveGroups(opt: ComboOptionProduct): ShopModifierGroup[] {
  return modifierGroupsForProduct({
    id: opt.productId,
    name: opt.name,
    price: opt.extraPrice,
    allowExtras: opt.allowExtras,
    extras: opt.extras,
    modifierGroups: opt.modifierGroups,
  });
}

function productHasComboSlots(product: { productType?: string; comboSlots?: ComboSlot[] }) {
  return product.productType === 'combo' && (product.comboSlots?.length ?? 0) > 0;
}

function pickKey(productId: string, extras: ShopSelectedExtra[]) {
  const sig = extras
    .map((e) => e.id)
    .sort()
    .join(',');
  return `${productId}:${sig}`;
}

function slotQty(picks: SlotPick[]) {
  return picks.reduce((s, p) => s + p.qty, 0);
}

function comboGroupsSeed(product: ShopComboProduct): ShopModifierGroup[] {
  if (product.modifierGroups?.length) return product.modifierGroups;
  if (product.allowExtras && product.extras?.length) {
    return [
      {
        id: '__legacy_combo__',
        title: 'Extras',
        selectionType: 'optional' as const,
        minSelectable: 0,
        maxSelectable: product.extras.length,
        options: product.extras,
      },
    ];
  }
  return [];
}

export { productHasComboSlots };

export default function ShopComboWizard({ product, onClose, onConfirm }: Props) {
  const { t } = useI18n();
  const slots = product.comboSlots || [];
  const [picksBySlot, setPicksBySlot] = useState<Record<string, SlotPick[]>>({});
  const [comboExtraSelection, setComboExtraSelection] = useState<Record<string, string[]>>(() =>
    initialSelection(comboGroupsSeed(product))
  );
  const [nested, setNested] = useState<NestedState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const comboGroups = useMemo(() => comboGroupsSeed(product), [product]);

  const validateGroups = (groups: ShopModifierGroup[], selection: Record<string, string[]>) =>
    validateModifierGroups(groups, selection, {
      chooseOne: (name) => t('shopChooseOptionFor').replace('{name}', name),
      chooseAtLeast: (n, name) =>
        t('shopChooseAtLeastOptions').replace('{n}', String(n)).replace('{name}', name),
      tooMany: (name) => t('shopTooManyOptions').replace('{name}', name),
      groupTitle: (title) => (title === 'Extras' ? t('shopExtras') : title),
    });

  const slotHeader = (slot: ComboSlot) => {
    const qty = slotQty(picksBySlot[slot.id] || []);
    const min = slot.minPick || 1;
    const max = slot.maxPick || 1;
    if (min === max) {
      return t('shopSlotIncluded').replace('{n}', String(max));
    }
    if (qty > 0) {
      return t('shopSlotSelected').replace('{current}', String(qty)).replace('{max}', String(max));
    }
    return t('shopSlotPickRange').replace('{min}', String(min)).replace('{max}', String(max));
  };

  const isSlotValid = (slot: ComboSlot) => {
    const qty = slotQty(picksBySlot[slot.id] || []);
    const min = slot.minPick || 1;
    const max = slot.maxPick || 1;
    return qty >= min && qty <= max;
  };

  const allSlotsValid = slots.every(isSlotValid);
  const comboExtrasValid =
    comboGroups.length === 0 || !validateGroups(comboGroups, comboExtraSelection);
  const canConfirm = allSlotsValid && comboExtrasValid;

  const comboExtras = buildExtrasFromSelection(comboGroups, comboExtraSelection);

  const unitPrice = roundMoney2(
    product.price +
      slots.reduce((sum, slot) => {
        const picks = picksBySlot[slot.id] || [];
        return (
          sum +
          picks.reduce(
            (s, p) =>
              s + (p.extraPrice + p.selectedExtras.reduce((x, e) => x + e.price, 0)) * p.qty,
            0
          )
        );
      }, 0) +
      comboExtras.reduce((s, e) => s + e.price, 0)
  );

  const openNested = (slot: ComboSlot, option: ComboOptionProduct, replacePickId?: string) => {
    const groups = effectiveGroups(option);
    setNested({
      slot,
      option,
      extraSelection: initialSelection(groups),
      replacePickId,
    });
    setError(null);
  };

  const handleTileClick = (slot: ComboSlot, option: ComboOptionProduct) => {
    setError(null);
    const picks = picksBySlot[slot.id] || [];
    const max = slot.maxPick || 1;

    if (optionHasExtras(option)) {
      openNested(slot, option);
      return;
    }

    const key = pickKey(option.productId, []);
    const existing = picks.find((p) => pickKey(p.productId, p.selectedExtras) === key);

    if (max <= 1) {
      setPicksBySlot((prev) => ({
        ...prev,
        [slot.id]: [
          {
            pickId: key,
            productId: option.productId,
            productName: option.name,
            image: option.image,
            extraPrice: option.extraPrice || 0,
            selectedExtras: [],
            qty: 1,
          },
        ],
      }));
      return;
    }

    const total = slotQty(picks);
    if (existing) {
      if (existing.qty > 1) {
        setPicksBySlot((prev) => ({
          ...prev,
          [slot.id]: picks.map((p) =>
            p.pickId === existing.pickId ? { ...p, qty: p.qty - 1 } : p
          ).filter((p) => p.qty > 0),
        }));
      } else {
        setPicksBySlot((prev) => ({
          ...prev,
          [slot.id]: picks.filter((p) => p.pickId !== existing.pickId),
        }));
      }
      return;
    }

    if (total >= max) return;

    setPicksBySlot((prev) => ({
      ...prev,
      [slot.id]: [
        ...picks,
        {
          pickId: `${key}:${Date.now()}`,
          productId: option.productId,
          productName: option.name,
          image: option.image,
          extraPrice: option.extraPrice || 0,
          selectedExtras: [],
          qty: 1,
        },
      ],
    }));
  };

  const adjustPickQty = (slotId: string, pickId: string, delta: number) => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;
    const picks = picksBySlot[slotId] || [];
    const max = slot.maxPick || 1;
    const total = slotQty(picks);
    setPicksBySlot((prev) => {
      const current = prev[slotId] || [];
      if (delta > 0 && total >= max) return prev;
      return {
        ...prev,
        [slotId]: current
          .map((p) => (p.pickId === pickId ? { ...p, qty: p.qty + delta } : p))
          .filter((p) => p.qty > 0),
      };
    });
  };

  const confirmNested = () => {
    if (!nested) return;
    const groups = effectiveGroups(nested.option);
    const err = validateGroups(groups, nested.extraSelection);
    if (err) {
      setError(err);
      return;
    }
    const extras = buildExtrasFromSelection(groups, nested.extraSelection);
    const key = pickKey(nested.option.productId, extras);
    const slot = nested.slot;
    const max = slot.maxPick || 1;
    const picks = picksBySlot[slot.id] || [];

    if (max <= 1) {
      setPicksBySlot((prev) => ({
        ...prev,
        [slot.id]: [
          {
            pickId: key,
            productId: nested.option.productId,
            productName: nested.option.name,
            image: nested.option.image,
            extraPrice: nested.option.extraPrice || 0,
            selectedExtras: extras,
            qty: 1,
          },
        ],
      }));
    } else {
      const total = slotQty(picks);
      const existing = picks.find((p) => pickKey(p.productId, p.selectedExtras) === key);
      if (existing) {
        if (total >= max) {
          setError(t('shopTooManyOptions').replace('{name}', slot.name));
          return;
        }
        setPicksBySlot((prev) => ({
          ...prev,
          [slot.id]: picks.map((p) =>
            p.pickId === existing.pickId ? { ...p, qty: p.qty + 1 } : p
          ),
        }));
      } else {
        if (total >= max) {
          setError(t('shopTooManyOptions').replace('{name}', slot.name));
          return;
        }
        setPicksBySlot((prev) => ({
          ...prev,
          [slot.id]: [
            ...picks,
            {
              pickId: `${key}:${Date.now()}`,
              productId: nested.option.productId,
              productName: nested.option.name,
              image: nested.option.image,
              extraPrice: nested.option.extraPrice || 0,
              selectedExtras: extras,
              qty: 1,
            },
          ],
        }));
      }
    }
    setNested(null);
    setError(null);
  };

  const isOptionSelected = (slot: ComboSlot, option: ComboOptionProduct) => {
    const picks = picksBySlot[slot.id] || [];
    return picks.some((p) => p.productId === option.productId);
  };

  const pickQtyForOption = (slot: ComboSlot, option: ComboOptionProduct) => {
    const picks = picksBySlot[slot.id] || [];
    return picks
      .filter((p) => p.productId === option.productId && p.selectedExtras.length === 0)
      .reduce((s, p) => s + p.qty, 0);
  };

  const nestedGroups = nested ? effectiveGroups(nested.option) : [];
  const nestedUnitPrice = nested
    ? roundMoney2(
        (nested.option.extraPrice || 0) +
          buildExtrasFromSelection(nestedGroups, nested.extraSelection).reduce(
            (s, e) => s + e.price,
            0
          )
      )
    : 0;
  const nestedSummary = nested
    ? selectionSummary(nestedGroups, nested.extraSelection, t('shopDefaultToppings'))
    : '';

  const handleConfirm = () => {
    if (!canConfirm) {
      for (const slot of slots) {
        if (!isSlotValid(slot)) {
          const min = slot.minPick || 1;
          setError(
            min === 1
              ? t('shopChooseOptionFor').replace('{name}', slot.name)
              : t('shopChooseNOptions').replace('{n}', String(min)).replace('{name}', slot.name)
          );
          return;
        }
      }
      const comboErr = validateGroups(comboGroups, comboExtraSelection);
      if (comboErr) setError(comboErr);
      return;
    }

    const comboSelections: ComboSelection[] = [];
    for (const slot of slots) {
      for (const pick of picksBySlot[slot.id] || []) {
        for (let i = 0; i < pick.qty; i++) {
          comboSelections.push({
            slotId: slot.id,
            slotName: slot.name,
            productId: pick.productId,
            productName: pick.productName,
            image: pick.image,
            extraPrice: pick.extraPrice,
            selectedExtras: pick.selectedExtras,
          });
        }
      }
    }
    onConfirm({ comboSelections, selectedExtras: comboExtras, unitPrice });
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
        onClick={onClose}
      >
        <div
          className="flex max-h-[92vh] w-full flex-col bg-white shadow-2xl sm:max-w-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-stone-200 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold tracking-tight text-stone-900">
                  {product.name}
                </h2>
                <p className="mt-0.5 text-sm text-stone-500">
                  {t('shopCombo')} · CHF {product.price.toFixed(2)}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg p-1 text-stone-500 hover:bg-stone-100"
                onClick={onClose}
                aria-label={t('close')}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
            {slots.map((slot) => {
              const max = slot.maxPick || 1;
              const picks = picksBySlot[slot.id] || [];
              return (
                <section key={slot.id}>
                  <div className="mb-3 flex items-baseline justify-between gap-2">
                    <h3 className="text-base font-semibold text-stone-900">{slot.name}</h3>
                    <span
                      className={`text-xs font-medium ${
                        isSlotValid(slot) ? 'text-teal-700' : 'text-stone-500'
                      }`}
                    >
                      {slotHeader(slot)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {slot.options.map((opt) => {
                      const selected = isOptionSelected(slot, opt);
                      const qty = pickQtyForOption(slot, opt);
                      const showQty = max > 1 && selected && qty > 0 && !optionHasExtras(opt);
                      return (
                        <div key={opt.productId} className="relative">
                          <button
                            type="button"
                            onClick={() => handleTileClick(slot, opt)}
                            className={`group w-full overflow-hidden border-2 text-left transition-colors ${
                              selected
                                ? 'border-stone-900 ring-1 ring-stone-900'
                                : 'border-stone-200 hover:border-stone-400'
                            }`}
                          >
                            <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
                              {opt.image ? (
                                <img
                                  src={opt.image}
                                  alt=""
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-3xl font-light text-stone-300">
                                  {opt.name.slice(0, 1)}
                                </div>
                              )}
                              {opt.extraPrice > 0 ? (
                                <span className="absolute right-1.5 top-1.5 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                  +{opt.extraPrice.toFixed(2)}
                                </span>
                              ) : null}
                            </div>
                            <div className="p-2">
                              <div className="line-clamp-2 text-sm font-semibold text-stone-900">
                                {opt.name}
                              </div>
                              {optionHasExtras(opt) ? (
                                <div className="mt-0.5 text-[10px] text-stone-500">
                                  {t('shopCustomizeItem')}
                                </div>
                              ) : null}
                            </div>
                          </button>
                          {showQty ? (
                            <div className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-stone-300 bg-white px-1 shadow-sm">
                              <button
                                type="button"
                                className="rounded-full p-0.5 hover:bg-stone-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const pick = picks.find(
                                    (p) =>
                                      p.productId === opt.productId && p.selectedExtras.length === 0
                                  );
                                  if (pick) adjustPickQty(slot.id, pick.pickId, -1);
                                }}
                              >
                                <Minus size={14} />
                              </button>
                              <span className="min-w-[1.25rem] text-center text-xs font-bold">
                                {qty}
                              </span>
                              <button
                                type="button"
                                className="rounded-full p-0.5 hover:bg-stone-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTileClick(slot, opt);
                                }}
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  {picks.some((p) => p.selectedExtras.length > 0) ? (
                    <ul className="mt-2 space-y-1">
                      {picks
                        .filter((p) => p.selectedExtras.length > 0)
                        .map((p) => (
                          <li key={p.pickId} className="text-xs text-stone-600">
                            {p.productName}
                            {p.qty > 1 ? ` ×${p.qty}` : ''}:{' '}
                            {p.selectedExtras.map((e) => e.name).join(', ')}
                          </li>
                        ))}
                    </ul>
                  ) : null}
                </section>
              );
            })}

            {comboGroups.length > 0 ? (
              <section>
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <h3 className="text-base font-semibold text-stone-900">{t('shopComboExtras')}</h3>
                  <span className="text-xs text-stone-500">{t('shopOptional')}</span>
                </div>
                <div className="overflow-hidden rounded-lg border border-stone-200">
                  <ShopModifierTabGrid
                    groups={comboGroups}
                    selection={comboExtraSelection}
                    onSelectionChange={(updater) => {
                      setError(null);
                      setComboExtraSelection(updater);
                    }}
                  />
                </div>
              </section>
            ) : null}
          </div>

          <div className="space-y-3 border-t border-stone-200 px-5 py-4">
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-stone-600">{t('shopRunningTotal')}</span>
              <span className="text-lg font-bold tabular-nums text-stone-900">
                CHF {unitPrice.toFixed(2)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="w-full bg-stone-900 py-3.5 text-sm font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('shopAddToOrder')} · CHF {unitPrice.toFixed(2)}
            </button>
          </div>
        </div>
      </div>

      {nested ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
          onClick={() => setNested(null)}
        >
          <div
            className="flex max-h-[88vh] w-full flex-col bg-white shadow-2xl sm:max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-stone-200 px-4 py-3 sm:px-5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-bold text-stone-900">{nested.option.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-stone-600">{nestedSummary}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNested(null)}
                    className="rounded-lg border border-stone-200 p-1.5 text-stone-500 hover:bg-red-50 hover:text-red-600"
                    aria-label={t('shopDiscard')}
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={confirmNested}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                  >
                    {t('shopAdd')} · CHF {nestedUnitPrice.toFixed(2)}
                  </button>
                </div>
              </div>
            </div>
            <ShopModifierTabGrid
              groups={nestedGroups}
              selection={nested.extraSelection}
              onSelectionChange={(updater) => {
                setError(null);
                setNested((prev) => {
                  if (!prev) return prev;
                  const next =
                    typeof updater === 'function' ? updater(prev.extraSelection) : updater;
                  return { ...prev, extraSelection: next };
                });
              }}
            />
            {error ? (
              <div className="border-t border-stone-200 px-4 py-2">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
