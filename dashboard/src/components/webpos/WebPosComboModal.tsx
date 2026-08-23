import { useMemo, useState } from 'react';
import { Check, Minus, Plus, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { ShopComboSelection, ShopSelectedExtra } from '@/lib/shop-cart';
import { roundMoney2 } from '@/lib/money';
import type { ShopModifierGroup } from '@/components/shop/shop-modifier-utils';
import {
  buildExtrasFromSelection,
  effectiveGroups,
  effectiveGroupsForComboOption,
  initialSelection,
  selectionFromExtras,
  validateModifierGroups,
} from '@/components/shop/shop-modifier-utils';
import WebPosModifierTabPanel from '@/components/webpos/WebPosModifierTabPanel';
import { translateModifierGroupTitle } from '@/components/webpos/webpos-modifier-utils';

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
  showProductImages?: boolean;
  initialComboSelections?: ShopComboSelection[];
  initialSelectedExtras?: ShopSelectedExtra[];
  initialQuantity?: number;
  initialLineNote?: string;
  onClose: () => void;
  onConfirm: (payload: {
    comboSelections: ComboSelection[];
    selectedExtras: ShopSelectedExtra[];
    unitPrice: number;
    quantity: number;
    lineNote: string;
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
};

function optionHasExtras(opt: ComboOptionProduct) {
  return effectiveGroupsForComboOption(opt).length > 0;
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

function picksBySlotFromSelections(selections: ShopComboSelection[]): Record<string, SlotPick[]> {
  const out: Record<string, SlotPick[]> = {};
  for (const sel of selections) {
    const slotId = sel.slotId;
    const key = pickKey(sel.productId, sel.selectedExtras || []);
    if (!out[slotId]) out[slotId] = [];
    const existing = out[slotId].find(
      (p) => pickKey(p.productId, p.selectedExtras) === key
    );
    if (existing) {
      existing.qty += 1;
    } else {
      out[slotId].push({
        pickId: key,
        productId: sel.productId,
        productName: sel.productName,
        image: sel.image,
        extraPrice: sel.extraPrice || 0,
        selectedExtras: sel.selectedExtras || [],
        qty: 1,
      });
    }
  }
  return out;
}

function slotQty(picks: SlotPick[]) {
  return picks.reduce((s, p) => s + p.qty, 0);
}

export { productHasComboSlots };

function WebPosComboModifierTabs({
  groups,
  selection,
  onSelectionChange,
  translateTitle,
  onErrorClear,
}: {
  groups: ShopModifierGroup[];
  selection: Record<string, string[]>;
  onSelectionChange: (next: Record<string, string[]>) => void;
  translateTitle: (title: string) => string;
  onErrorClear: () => void;
}) {
  const { t } = useI18n();
  const [tabId, setTabId] = useState(groups[0]?.id ?? '');
  const active = groups.find((g) => g.id === tabId) ?? groups[0];

  return (
    <div>
      <div className="mb-3 flex gap-2 overflow-x-auto">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setTabId(g.id)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${
              g.id === active?.id
                ? 'bg-[var(--webpos-accent)] text-white'
                : 'bg-[var(--webpos-surface-2,#f5f5f4)] text-[var(--webpos-text-muted,#78716c)]'
            }`}
          >
            {translateTitle(g.title)}
          </button>
        ))}
      </div>
      {active ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {active.options.map((opt) => {
            const checked = (selection[active.id] || []).includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onErrorClear();
                  const max = Math.max(1, Number(active.maxSelectable) || 1);
                  const current = selection[active.id] || [];
                  const has = current.includes(opt.id);
                  if (max === 1) {
                    onSelectionChange({ ...selection, [active.id]: has ? [] : [opt.id] });
                    return;
                  }
                  if (has) {
                    onSelectionChange({
                      ...selection,
                      [active.id]: current.filter((id) => id !== opt.id),
                    });
                    return;
                  }
                  if (current.length >= max) {
                    onSelectionChange({
                      ...selection,
                      [active.id]: [...current.slice(1), opt.id],
                    });
                    return;
                  }
                  onSelectionChange({ ...selection, [active.id]: [...current, opt.id] });
                }}
                className={`rounded-xl border-2 px-2 py-2 text-center ${
                  checked
                    ? 'border-[var(--webpos-accent-ring)] bg-[var(--webpos-accent-soft)] text-[var(--webpos-accent-text)] ring-1 ring-[var(--webpos-accent-ring)]'
                    : 'border-[var(--webpos-border,#e7e5e4)] bg-[var(--webpos-surface,#fff)]'
                }`}
              >
                <div className="text-xs font-semibold">
                  {opt.price > 0 ? `+CHF ${Number(opt.price).toFixed(2)}` : t('shopIncluded')}
                </div>
                <div className="mt-1 text-sm font-semibold">{opt.name}</div>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function WebPosComboModal({
  product,
  showProductImages = false,
  initialComboSelections,
  initialSelectedExtras,
  initialQuantity = 1,
  initialLineNote = '',
  onClose,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const slots = product.comboSlots || [];
  const [picksBySlot, setPicksBySlot] = useState<Record<string, SlotPick[]>>(() =>
    initialComboSelections?.length
      ? picksBySlotFromSelections(initialComboSelections)
      : {}
  );
  const comboGroups = useMemo(() => effectiveGroups(product), [product]);
  const [comboExtraSelection, setComboExtraSelection] = useState<Record<string, string[]>>(() =>
    initialSelectedExtras?.length
      ? selectionFromExtras(comboGroups, initialSelectedExtras)
      : initialSelection(comboGroups)
  );
  const [nested, setNested] = useState<NestedState | null>(null);
  const [nestedNote, setNestedNote] = useState('');
  const [quantity, setQuantity] = useState(Math.max(1, initialQuantity));
  const [lineNote, setLineNote] = useState(initialLineNote);
  const [error, setError] = useState<string | null>(null);

  const translateTitle = (title: string) => translateModifierGroupTitle(title, t);

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

  const lineTotal = roundMoney2(unitPrice * Math.max(1, quantity));

  const isSlotValid = (slot: ComboSlot) => {
    const qty = slotQty(picksBySlot[slot.id] || []);
    const min = slot.minPick || 1;
    const max = slot.maxPick || 1;
    return qty >= min && qty <= max;
  };

  const allSlotsValid = slots.every(isSlotValid);
  const comboExtrasValid =
    comboGroups.length === 0 ||
    !validateModifierGroups(comboGroups, comboExtraSelection, {
      chooseOne: (name) => t('shopChooseOptionFor').replace('{name}', name),
      chooseAtLeast: (n, name) =>
        t('shopChooseAtLeastOptions').replace('{n}', String(n)).replace('{name}', name),
      tooMany: (name) => t('shopTooManyOptions').replace('{name}', name),
      groupTitle: (title) => translateTitle(title),
    });
  const canConfirm = allSlotsValid && comboExtrasValid;

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

  const openNested = (slot: ComboSlot, option: ComboOptionProduct) => {
    setNested({
      slot,
      option,
      extraSelection: initialSelection(effectiveGroupsForComboOption(option)),
    });
    setNestedNote('');
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
          [slot.id]: picks
            .map((p) => (p.pickId === existing.pickId ? { ...p, qty: p.qty - 1 } : p))
            .filter((p) => p.qty > 0),
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

  const confirmNested = () => {
    if (!nested) return;
    const groups = effectiveGroupsForComboOption(nested.option);
    const err = validateModifierGroups(groups, nested.extraSelection, {
      chooseOne: (name) => t('shopChooseOptionFor').replace('{name}', name),
      chooseAtLeast: (n, name) =>
        t('shopChooseAtLeastOptions').replace('{n}', String(n)).replace('{name}', name),
      tooMany: (name) => t('shopTooManyOptions').replace('{name}', name),
      groupTitle: (title) => translateTitle(title),
    });
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
      const comboErr = validateModifierGroups(comboGroups, comboExtraSelection, {
        chooseOne: (name) => t('shopChooseOptionFor').replace('{name}', name),
        chooseAtLeast: (n, name) =>
          t('shopChooseAtLeastOptions').replace('{n}', String(n)).replace('{name}', name),
        tooMany: (name) => t('shopTooManyOptions').replace('{name}', name),
        groupTitle: (title) => translateTitle(title),
      });
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
    onConfirm({
      comboSelections,
      selectedExtras: comboExtras,
      unitPrice,
      quantity,
      lineNote: lineNote.trim(),
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/45" onClick={onClose}>
        <div
          className="fixed inset-0 flex flex-col bg-[var(--webpos-surface,#fff)] sm:inset-3 sm:rounded-2xl sm:border sm:border-[var(--webpos-border,#e7e5e4)] sm:shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="shrink-0 border-b border-[var(--webpos-border,#e7e5e4)] px-4 py-3 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold sm:text-xl">{product.name}</h2>
                <p className="text-sm text-[var(--webpos-text-muted,#78716c)]">
                  {t('webPosCombo')} · CHF {product.price.toFixed(2)}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg p-2 text-stone-500 hover:bg-stone-100"
                onClick={onClose}
                aria-label={t('close')}
              >
                <X size={20} />
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {slots.map((slot) => {
              const max = slot.maxPick || 1;
              const picks = picksBySlot[slot.id] || [];
              return (
                <section key={slot.id}>
                  <div className="mb-3 flex items-baseline justify-between gap-2">
                    <h3 className="text-base font-bold text-stone-900">{slot.name}</h3>
                    <span
                      className={`text-xs font-semibold ${
                        isSlotValid(slot) ? 'text-teal-700' : 'text-stone-500'
                      }`}
                    >
                      {slotHeader(slot)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {slot.options.map((opt) => {
                      const selected = isOptionSelected(slot, opt);
                      const qty = pickQtyForOption(slot, opt);
                      const showQty = max > 1 && selected && qty > 0 && !optionHasExtras(opt);
                      return (
                        <div key={opt.productId} className="relative">
                          <button
                            type="button"
                            onClick={() => handleTileClick(slot, opt)}
                            className={`group w-full overflow-hidden rounded-xl border-2 text-left transition-colors ${
                              selected
                                ? 'border-[var(--webpos-accent-ring)] bg-[var(--webpos-accent-softer)] ring-2 ring-[var(--webpos-accent-ring)]'
                                : 'border-[var(--webpos-border,#e7e5e4)] hover:border-[var(--webpos-accent-border)]'
                            }`}
                          >
                            {showProductImages ? (
                              <div className="relative h-14 overflow-hidden bg-stone-100">
                                {opt.image ? (
                                  <img
                                    src={opt.image}
                                    alt=""
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-lg font-light text-stone-300">
                                    {opt.name.slice(0, 1)}
                                  </div>
                                )}
                                {opt.extraPrice > 0 ? (
                                  <span className="absolute right-1.5 top-1.5 rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                    +{opt.extraPrice.toFixed(2)}
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                            <div className="p-2.5">
                              <div className="line-clamp-2 text-sm font-semibold text-stone-900">
                                {opt.name}
                              </div>
                              {optionHasExtras(opt) ? (
                                <div className="mt-0.5 text-[10px] font-medium text-stone-500">
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
                                  if (pick) {
                                    setPicksBySlot((prev) => ({
                                      ...prev,
                                      [slot.id]: (prev[slot.id] || [])
                                        .map((p) =>
                                          p.pickId === pick.pickId ? { ...p, qty: p.qty - 1 } : p
                                        )
                                        .filter((p) => p.qty > 0),
                                    }));
                                  }
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
                  <h3 className="text-base font-bold text-stone-900">{t('shopComboExtras')}</h3>
                  <span className="text-xs text-stone-500">{t('shopOptional')}</span>
                </div>
                <WebPosComboModifierTabs
                  groups={comboGroups}
                  selection={comboExtraSelection}
                  onSelectionChange={(next) => {
                    setError(null);
                    setComboExtraSelection(next);
                  }}
                  translateTitle={translateTitle}
                  onErrorClear={() => setError(null)}
                />
              </section>
            ) : null}
          </div>

          <footer className="shrink-0 space-y-2 border-t border-[var(--webpos-border,#e7e5e4)] px-4 py-3 sm:px-5">
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-stone-600">{t('webPosQty')}</span>
                <div className="inline-flex items-center rounded-lg border border-stone-200">
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center hover:bg-stone-100 disabled:opacity-40"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  >
                    <Minus size={16} />
                  </button>
                  <span className="min-w-[2rem] text-center text-sm font-bold">{quantity}</span>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center hover:bg-stone-100"
                    onClick={() => setQuantity((q) => q + 1)}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-medium uppercase tracking-wide text-stone-500">
                  {t('shopRunningTotal')}
                </div>
                <div className="text-xl font-bold tabular-nums">CHF {lineTotal.toFixed(2)}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check size={18} strokeWidth={3} />
              {t('shopAddToOrder')} · CHF {lineTotal.toFixed(2)}
            </button>
          </footer>
        </div>
      </div>

      {nested ? (
        <div className="fixed inset-0 z-[75] bg-black/50" onClick={() => setNested(null)}>
          <WebPosModifierTabPanel
            title={nested.option.name}
            showProductImages={showProductImages}
            groups={effectiveGroupsForComboOption(nested.option)}
            selection={nested.extraSelection}
            onSelectionChange={(next) => {
              setError(null);
              setNested((prev) => (prev ? { ...prev, extraSelection: next } : prev));
            }}
            basePrice={0}
            extraPrice={nested.option.extraPrice || 0}
            quantity={1}
            onQuantityChange={() => {}}
            lineNote={nestedNote}
            onLineNoteChange={setNestedNote}
            onConfirm={confirmNested}
            onDiscard={() => setNested(null)}
            zClass="z-[76]"
          />
        </div>
      ) : null}
    </>
  );
}
