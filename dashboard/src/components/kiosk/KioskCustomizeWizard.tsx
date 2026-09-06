import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Minus, Plus, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { roundMoney2 } from '@/lib/money';
import type { ShopSelectedExtra } from '@/lib/shop-cart';
import {
  buildExtrasFromSelection,
  effectiveGroups,
  groupMax,
  groupMin,
  initialSelection,
  toggleGroupOption,
  validateModifierGroups,
  SIZE_MODIFIER_GROUP_ID,
  type ShopModifierGroup,
  type ShopProductForModifiers,
} from '@/components/shop/shop-modifier-utils';
import {
  productHasComboSlots,
  type ComboOptionProduct,
  type ComboSelection,
  type ComboSlot,
  type ShopComboProduct,
} from '@/components/shop/ShopComboWizard';

export type KioskWizardProduct = ShopProductForModifiers & {
  productType?: string;
  comboSlots?: ComboSlot[];
};

type Step =
  | { kind: 'size'; group: ShopModifierGroup }
  | { kind: 'slot'; slot: ComboSlot }
  | { kind: 'group'; group: ShopModifierGroup };

type SlotPick = {
  productId: string;
  productName: string;
  image?: string | null;
  extraPrice: number;
  selectedExtras: ShopSelectedExtra[];
};

type NestedExtras = {
  option: ComboOptionProduct;
  selection: Record<string, string[]>;
};

function optionHasExtras(opt: ComboOptionProduct) {
  return (
    (opt.modifierGroups?.some((g) => g.options?.length) ?? false) ||
    !!(opt.allowExtras && opt.extras?.length)
  );
}

function optionGroups(opt: ComboOptionProduct): ShopModifierGroup[] {
  return effectiveGroups({
    id: opt.productId,
    name: opt.name,
    price: opt.extraPrice,
    allowExtras: opt.allowExtras,
    extras: opt.extras,
    modifierGroups: opt.modifierGroups,
  });
}

function money(n: number) {
  return `CHF ${n.toFixed(2)}`;
}

function priceLabel(price: number) {
  if (Math.abs(price) < 0.005) return '';
  return price > 0 ? `+ ${money(price)}` : money(price);
}

export function kioskProductNeedsWizard(product: KioskWizardProduct): boolean {
  if (productHasComboSlots(product)) return true;
  return effectiveGroups(product).length > 0;
}

type Props = {
  product: KioskWizardProduct;
  onClose: () => void;
  onConfirm: (payload: {
    selectedExtras: ShopSelectedExtra[];
    comboSelections: ComboSelection[];
    unitPrice: number;
  }) => void;
};

export default function KioskCustomizeWizard({ product, onClose, onConfirm }: Props) {
  const { t } = useI18n();
  const combo = productHasComboSlots(product) ? (product as ShopComboProduct) : null;
  const slots = combo?.comboSlots || [];
  const groups = useMemo(() => effectiveGroups(product), [product]);
  const sizeGroup = groups.find((g) => g.id === SIZE_MODIFIER_GROUP_ID) || null;
  const extraGroups = groups.filter((g) => g.id !== SIZE_MODIFIER_GROUP_ID);

  const steps = useMemo<Step[]>(() => {
    const next: Step[] = [];
    if (sizeGroup) next.push({ kind: 'size', group: sizeGroup });
    for (const slot of slots) next.push({ kind: 'slot', slot });
    for (const group of extraGroups) next.push({ kind: 'group', group });
    return next;
  }, [sizeGroup, slots, extraGroups]);

  const [stepIndex, setStepIndex] = useState(0);
  const [selection, setSelection] = useState<Record<string, string[]>>(() => initialSelection(groups));
  const [picksBySlot, setPicksBySlot] = useState<Record<string, SlotPick>>({});
  const [nested, setNested] = useState<NestedExtras | null>(null);
  const [error, setError] = useState<string | null>(null);

  const step = steps[stepIndex] || null;
  const isLast = stepIndex >= steps.length - 1;

  const comboExtras = buildExtrasFromSelection(extraGroups, selection);
  const sizeExtras = sizeGroup ? buildExtrasFromSelection([sizeGroup], selection) : [];
  const comboSelections: ComboSelection[] = slots.flatMap((slot) => {
    const pick = picksBySlot[slot.id];
    if (!pick) return [];
    return [
      {
        slotId: slot.id,
        slotName: slot.name,
        productId: pick.productId,
        productName: pick.productName,
        image: pick.image,
        extraPrice: pick.extraPrice,
        selectedExtras: pick.selectedExtras,
      },
    ];
  });

  const unitPrice = roundMoney2(
    product.price +
      sizeExtras.reduce((s, e) => s + e.price, 0) +
      comboSelections.reduce(
        (s, p) => s + (p.extraPrice || 0) + (p.selectedExtras || []).reduce((x, e) => x + e.price, 0),
        0
      ) +
      comboExtras.reduce((s, e) => s + e.price, 0)
  );

  const validateMessages = {
    chooseOne: (name: string) => t('shopChooseOptionFor').replace('{name}', name),
    chooseAtLeast: (n: number, name: string) =>
      t('shopChooseAtLeastOptions').replace('{n}', String(n)).replace('{name}', name),
    tooMany: (name: string) => t('shopTooManyOptions').replace('{name}', name),
    groupTitle: (title: string) =>
      title === 'Extras' ? t('shopExtras') : title === 'Sizes' ? t('kioskWizardSize') : title,
  };

  const currentStepValid = (): string | null => {
    if (!step) return null;
    if (step.kind === 'size' || step.kind === 'group') {
      return validateModifierGroups([step.group], selection, validateMessages);
    }
    const min = step.slot.minPick || 1;
    const pick = picksBySlot[step.slot.id];
    if (min > 0 && !pick) return t('kioskWizardChooseSlot').replace('{name}', step.slot.name);
    return null;
  };

  const goNext = () => {
    const invalid = currentStepValid();
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    if (!isLast) {
      setStepIndex((i) => i + 1);
      return;
    }
    const allGroupsError = validateModifierGroups(groups, selection, validateMessages);
    if (allGroupsError) {
      setError(allGroupsError);
      return;
    }
    for (const slot of slots) {
      if ((slot.minPick || 1) > 0 && !picksBySlot[slot.id]) {
        setError(t('kioskWizardChooseSlot').replace('{name}', slot.name));
        return;
      }
    }
    onConfirm({
      selectedExtras: [...sizeExtras, ...comboExtras],
      comboSelections,
      unitPrice,
    });
  };

  const toggleOption = (group: ShopModifierGroup, optionId: string) => {
    setSelection((prev) => toggleGroupOption(group, optionId, prev));
    setError(null);
  };

  const pickSlotOption = (slot: ComboSlot, opt: ComboOptionProduct) => {
    const apply = (selectedExtras: ShopSelectedExtra[] = []) => {
      setPicksBySlot((prev) => ({
        ...prev,
        [slot.id]: {
          productId: opt.productId,
          productName: opt.name,
          image: opt.image,
          extraPrice: opt.extraPrice,
          selectedExtras,
        },
      }));
      setNested(null);
      setError(null);
    };
    if (optionHasExtras(opt)) {
      setNested({ option: opt, selection: initialSelection(optionGroups(opt)) });
      return;
    }
    apply();
  };

  const confirmNested = () => {
    if (!nested || step?.kind !== 'slot') return;
    const groupsForOpt = optionGroups(nested.option);
    const invalid = validateModifierGroups(groupsForOpt, nested.selection, validateMessages);
    if (invalid) {
      setError(invalid);
      return;
    }
    const extras = buildExtrasFromSelection(groupsForOpt, nested.selection);
    setPicksBySlot((prev) => ({
      ...prev,
      [step.slot.id]: {
        productId: nested.option.productId,
        productName: nested.option.name,
        image: nested.option.image,
        extraPrice: nested.option.extraPrice,
        selectedExtras: extras,
      },
    }));
    setNested(null);
    setError(null);
  };

  const stepTitle =
    step?.kind === 'size'
      ? t('kioskWizardChooseMenu')
      : step?.kind === 'slot'
        ? t('kioskWizardChooseSlot').replace('{name}', step.slot.name)
        : step?.kind === 'group'
          ? step.group.title === 'Extras'
            ? t('kioskWizardExtras')
            : step.group.title
          : t('kioskWizardCustomize');

  return (
    <div className="kiosk-wizard-overlay" role="dialog" aria-modal="true" aria-label={product.name}>
      <div className="kiosk-wizard">
        <header className="kiosk-wizard-head">
          <div className="kiosk-wizard-hero">
            {product.image ? <img src={product.image} alt="" /> : <div className="kiosk-wizard-hero-ph" />}
            <div>
              <p className="kiosk-wizard-kicker">{t('kioskWizardCustomize')}</p>
              <h2>{product.name}</h2>
              {product.description ? <p className="kiosk-wizard-desc">{product.description}</p> : null}
            </div>
          </div>
          <button type="button" className="kiosk-wizard-close" onClick={onClose} aria-label={t('close')}>
            <X className="h-6 w-6" />
          </button>
        </header>

        {steps.length > 1 ? (
          <nav className="kiosk-wizard-steps" aria-label={t('kioskWizardCustomize')}>
            {steps.map((s, i) => (
              <button
                key={s.kind === 'slot' ? s.slot.id : s.group.id}
                type="button"
                className={`kiosk-wizard-step ${i === stepIndex ? 'is-active' : ''} ${
                  i < stepIndex ? 'is-done' : ''
                }`}
                onClick={() => {
                  setError(null);
                  setStepIndex(i);
                }}
              >
                <span className="kiosk-wizard-step-dot">{i < stepIndex ? <Check className="h-4 w-4" /> : i + 1}</span>
                <span>
                  {s.kind === 'size'
                    ? t('kioskWizardSize')
                    : s.kind === 'slot'
                      ? s.slot.name
                      : s.group.title === 'Extras'
                        ? t('kioskWizardExtras')
                        : s.group.title}
                </span>
              </button>
            ))}
          </nav>
        ) : null}

        <div className="kiosk-wizard-body">
          <h3>{stepTitle}</h3>
          {nested ? (
            <div className="kiosk-wizard-nested">
              <p className="kiosk-wizard-nested-title">
                {t('kioskWizardExtrasFor').replace('{name}', nested.option.name)}
              </p>
              {optionGroups(nested.option).map((group) => (
                <div key={group.id} className="kiosk-wizard-grid">
                  {group.options.map((opt) => {
                    const selected = (nested.selection[group.id] || []).includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`kiosk-wizard-card ${selected ? 'is-selected' : ''}`}
                        onClick={() =>
                          setNested((prev) =>
                            prev
                              ? { ...prev, selection: toggleGroupOption(group, opt.id, prev.selection) }
                              : prev
                          )
                        }
                      >
                        {opt.image ? <img src={opt.image} alt="" /> : <div className="kiosk-wizard-card-ph" />}
                        <strong>{opt.name}</strong>
                        <span>{priceLabel(opt.price) || t('shopIncluded')}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : step?.kind === 'slot' ? (
            <div className="kiosk-wizard-grid">
              {step.slot.options.map((opt) => {
                const selected = picksBySlot[step.slot.id]?.productId === opt.productId;
                return (
                  <button
                    key={opt.productId}
                    type="button"
                    className={`kiosk-wizard-card ${selected ? 'is-selected' : ''}`}
                    onClick={() => pickSlotOption(step.slot, opt)}
                  >
                    {opt.image ? <img src={opt.image} alt="" /> : <div className="kiosk-wizard-card-ph" />}
                    <strong>{opt.name}</strong>
                    <span>{priceLabel(opt.extraPrice) || t('shopIncluded')}</span>
                  </button>
                );
              })}
            </div>
          ) : step?.kind === 'size' || step?.kind === 'group' ? (
            <div className="kiosk-wizard-grid">
              {step.group.options.map((opt) => {
                const selected = (selection[step.group.id] || []).includes(opt.id);
                const max = groupMax(step.group);
                const min = groupMin(step.group);
                const qty = selected ? 1 : 0;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`kiosk-wizard-card ${selected ? 'is-selected' : ''}`}
                    onClick={() => toggleOption(step.group, opt.id)}
                  >
                    {opt.image ? <img src={opt.image} alt="" /> : <div className="kiosk-wizard-card-ph" />}
                    <strong>{opt.name}</strong>
                    <span>{priceLabel(opt.price) || (min > 0 ? '' : t('shopIncluded'))}</span>
                    {max > 1 ? (
                      <span className="kiosk-wizard-qty">
                        {qty > 0 ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-stone-500">{t('kioskWizardReady')}</p>
          )}
          {error ? <p className="kiosk-wizard-error">{error}</p> : null}
        </div>

        <footer className="kiosk-wizard-foot">
          <button
            type="button"
            className="kiosk-btn-secondary"
            onClick={() => {
              if (nested) {
                setNested(null);
                setError(null);
                return;
              }
              if (stepIndex > 0) {
                setError(null);
                setStepIndex((i) => i - 1);
                return;
              }
              onClose();
            }}
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            {t('kioskWizardBack')}
          </button>
          <p className="kiosk-wizard-total">{money(unitPrice)}</p>
          {nested ? (
            <button type="button" className="kiosk-btn-primary" onClick={confirmNested}>
              {t('kioskWizardNext')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </button>
          ) : (
            <button type="button" className="kiosk-btn-primary" onClick={goNext}>
              {isLast ? t('kioskWizardAdd') : t('kioskWizardNext')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
