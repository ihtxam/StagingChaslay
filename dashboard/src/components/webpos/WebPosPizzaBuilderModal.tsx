import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { roundMoney2 } from '@/lib/money';
import type { ShopSelectedExtra } from '@/lib/shop-cart';
import {
  defaultQuantityLevel,
  portionsForType,
  pricePizzaSelection,
  resolveSizePrice,
  sizeStep,
  toppingSteps,
  type PizzaBuilderTemplate,
  type PizzaPickedTopping,
  type PizzaPortionKey,
  type PizzaSizeRow,
  type PizzaToppingItem,
} from '@/lib/pizza-builder';

type ProductLike = {
  id: string;
  name: string;
  price: number;
  specifications?: Array<{ name: string; price: number }>;
};

type Props = {
  product: ProductLike;
  template: PizzaBuilderTemplate;
  onClose: () => void;
  onConfirm: (payload: {
    selectedExtras: ShopSelectedExtra[];
    unitPrice: number;
    quantity: number;
    lineNote: string;
  }) => void;
};

export default function WebPosPizzaBuilderModal({ product, template, onClose, onConfirm }: Props) {
  const { t } = useI18n();
  const sizes = sizeStep(template)?.sizes || [];
  const steps = toppingSteps(template);
  const portions = portionsForType(template.portionType);
  const defaultQty = defaultQuantityLevel(template);
  const [size, setSize] = useState<PizzaSizeRow | null>(sizes[0] || null);
  const [stepIndex, setStepIndex] = useState(0);
  const [portion, setPortion] = useState<PizzaPortionKey>(portions[0]);
  const [picks, setPicks] = useState<PizzaPickedTopping[]>([]);
  const [lineNote, setLineNote] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const basePrice = resolveSizePrice(product.price, product.specifications, size?.name || '');
  const priced = useMemo(() => pricePizzaSelection(template, basePrice, picks), [template, basePrice, picks]);
  const currentStep = steps[stepIndex];
  const usedForPortion = picks.filter((p) => p.portion === portion).length;
  const maxToppings = size?.maxToppings ?? 0;
  const atCapacity = maxToppings > 0 && usedForPortion >= maxToppings;

  const portionLabel = (key: PizzaPortionKey) => {
    if (key === 'left') return t('pizzaBuilderPosLeft');
    if (key === 'right') return t('pizzaBuilderPosRight');
    if (key === 'q1') return t('pizzaBuilderPosQ1');
    if (key === 'q2') return t('pizzaBuilderPosQ2');
    if (key === 'q3') return t('pizzaBuilderPosQ3');
    if (key === 'q4') return t('pizzaBuilderPosQ4');
    return t('pizzaBuilderPortionWhole');
  };

  const pickCount = (item: PizzaToppingItem) =>
    picks.filter((p) => p.itemId === item.id && p.portion === portion).length;

  const toggleItem = (item: PizzaToppingItem) => {
    const existing = picks.find((p) => p.itemId === item.id && p.portion === portion);
    if (existing) {
      setPicks((prev) => prev.filter((p) => !(p.itemId === item.id && p.portion === portion)));
      setError(null);
      return;
    }
    if (atCapacity) {
      setError(t('pizzaBuilderPosCapacityFull'));
      return;
    }
    setPicks((prev) => [
      ...prev,
      {
        itemId: item.id,
        name: item.name,
        basePrice: item.price,
        quantityLevelId: defaultQty?.id || '',
        multiplier: defaultQty?.multiplier ?? 1,
        portion,
      },
    ]);
    setError(null);
  };

  const cycleQuantity = (item: PizzaToppingItem) => {
    if (!template.quantityLevels.length) return;
    setPicks((prev) =>
      prev.map((p) => {
        if (p.itemId !== item.id || p.portion !== portion) return p;
        const idx = template.quantityLevels.findIndex((q) => q.id === p.quantityLevelId);
        const next = template.quantityLevels[(idx + 1) % template.quantityLevels.length];
        return { ...p, quantityLevelId: next.id, multiplier: next.multiplier };
      })
    );
  };

  const handleConfirm = () => {
    onConfirm({
      selectedExtras: [
        ...(size
          ? [{ id: `size:${size.id}`, name: size.name, price: 0, groupTitle: t('pizzaBuilderPosSize') }]
          : []),
        ...priced.extras,
      ],
      unitPrice: priced.unitPrice,
      quantity,
      lineNote: lineNote.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[92vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h2 className="font-semibold truncate">{product.name}</h2>
          <p className="text-xs text-[var(--text-muted)]">
            {size ? `${size.name} · ` : ''}
            {t('pizzaBuilderPosCapacity')
              .replace('{used}', String(usedForPortion))
              .replace('{max}', String(maxToppings || '—'))}
            {template.freeToppingEnabled
              ? ` · ${t('pizzaBuilderPosFree').replace('{n}', String(template.freeToppingCount))}`
              : ''}
          </p>
        </div>

        <div className="px-4 py-3 overflow-y-auto space-y-4 flex-1">
          <div>
            <p className="text-xs font-medium text-[var(--text-muted)] mb-2">{t('pizzaBuilderPosSize')}</p>
            <div className="flex flex-wrap gap-2">
              {sizes.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSize(row)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                    size?.id === row.id
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                      : 'border-[var(--border)]'
                  }`}
                >
                  {row.name}
                </button>
              ))}
            </div>
          </div>

          {template.portionType !== 'whole' ? (
            <div>
              <p className="text-xs font-medium text-[var(--text-muted)] mb-2">{t('pizzaBuilderPosPortion')}</p>
              <div className="flex flex-wrap gap-2">
                {portions.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPortion(key)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      portion === key
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                        : 'border-[var(--border)]'
                    }`}
                  >
                    {portionLabel(key)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {steps.length > 0 ? (
            <div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {steps.map((step, i) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setStepIndex(i)}
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
                      i === stepIndex
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                        : 'border-[var(--border)] text-[var(--text-muted)]'
                    }`}
                  >
                    {step.title || t('pizzaBuilderPosToppings')}
                  </button>
                ))}
              </div>
              {currentStep ? (
                currentStep.items.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">{t('pizzaBuilderNoDataYet')}</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {currentStep.items.map((item) => {
                      const selected = pickCount(item) > 0;
                      const pick = picks.find((p) => p.itemId === item.id && p.portion === portion);
                      const qty = template.quantityLevels.find((q) => q.id === pick?.quantityLevelId);
                      return (
                        <div
                          key={item.id}
                          className={`rounded-lg border p-2 text-left ${
                            selected
                              ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                              : 'border-[var(--border)]'
                          }`}
                        >
                          <button type="button" className="w-full text-left" onClick={() => toggleItem(item)}>
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <p className="text-xs text-[var(--text-muted)]">{roundMoney2(item.price).toFixed(2)}</p>
                          </button>
                          {selected && template.quantityLevels.length > 1 ? (
                            <button
                              type="button"
                              className="mt-1 text-xs underline text-[var(--accent)]"
                              onClick={() => cycleQuantity(item)}
                            >
                              {qty?.name || t('pizzaBuilderPosQuantity')}
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : null}
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <label className="block text-sm">
            <span className="text-xs text-[var(--text-muted)]">{t('pizzaBuilderPosQuantity')}</span>
            <input
              type="number"
              min={1}
              className="field-input w-24 mt-1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          <textarea
            className="field-input w-full min-h-[64px]"
            value={lineNote}
            onChange={(e) => setLineNote(e.target.value)}
            placeholder={t('webPosLineNotePlaceholder')}
          />
        </div>

        <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between gap-3">
          <p className="font-semibold">{roundMoney2(priced.unitPrice * quantity).toFixed(2)}</p>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {t('cancel')}
            </button>
            <button type="button" className="btn-primary" onClick={handleConfirm}>
              {t('pizzaBuilderPosAdd')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
