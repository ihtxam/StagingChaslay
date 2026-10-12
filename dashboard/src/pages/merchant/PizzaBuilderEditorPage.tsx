import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import SearchableMultiSelect from '@/components/SearchableMultiSelect';
import { MERCHANT_PIZZA_BUILDER_PATH } from '@/lib/permissions';
import {
  createEmptyPizzaTemplate,
  defaultQuantityLevels,
  defaultSizeRows,
  defaultToppingsStep,
  newPizzaId,
  type PizzaBuilderStep,
  type PizzaBuilderTemplate,
  type PizzaPortionType,
  type PizzaQuantityLevel,
  type PizzaStepKind,
  type PizzaToppingItem,
} from '@/lib/pizza-builder';

type ModifierGroup = {
  id: string;
  title: string;
  options?: Array<{ id: string; name: string; price: number }>;
};

type CatalogProduct = {
  id: string;
  name: string;
  price?: number | string;
  category?: { name?: string } | null;
};

export default function PizzaBuilderEditorPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { templateId } = useParams<{ templateId: string }>();
  const isNew = !templateId || templateId === 'new';
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PizzaBuilderTemplate>(() => createEmptyPizzaTemplate());
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [pickerStepId, setPickerStepId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [g, p] = await Promise.all([
        api.get('/merchant/modifiers').catch(() => ({ data: { groups: [] } })),
        api.get('/merchant/products', { params: { limit: 500 } }).catch(() => ({ data: { products: [] } })),
      ]);
      setGroups(g.data.groups || []);
      setProducts(p.data.products || []);
      if (!isNew && templateId) {
        const res = await api.get(`/merchant/pizza-templates/${templateId}`);
        if (res.data.template) setForm(res.data.template);
      }
    } catch {
      toast.error(t('pizzaBuilderLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [isNew, t, templateId]);

  useEffect(() => {
    void load();
  }, [load]);

  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        id: product.id,
        label: product.category?.name ? `${product.name} · ${product.category.name}` : product.name,
      })),
    [products]
  );

  const updateStep = (stepId: string, patch: Partial<PizzaBuilderStep>) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
    }));
  };

  const changeStepKind = (stepId: string, kind: PizzaStepKind) => {
    setForm((prev) => {
      let steps = prev.steps.map((step) => {
        if (step.id !== stepId) {
          return kind === 'size' && step.kind === 'size'
            ? { ...step, kind: 'toppings' as const, sizes: [], items: step.items }
            : step;
        }
        if (kind === 'size') {
          return { ...step, kind, title: step.title || 'Size', sizes: step.sizes.length ? step.sizes : defaultSizeRows(), items: [] };
        }
        return { ...step, kind, sizes: [], items: step.items };
      });
      if (kind !== 'size' && !steps.some((s) => s.kind === 'size')) {
        steps = [{ ...defaultToppingsStep(), kind: 'size', title: 'Size', sizes: defaultSizeRows() }, ...steps];
      }
      return { ...prev, steps };
    });
  };

  const addStep = () => {
    setForm((prev) => ({ ...prev, steps: [...prev.steps, defaultToppingsStep()] }));
  };

  const removeStep = (stepId: string) => {
    setForm((prev) => {
      const next = prev.steps.filter((step) => step.id !== stepId);
      if (!next.some((s) => s.kind === 'size')) {
        return { ...prev, steps: [ { ...defaultToppingsStep(), kind: 'size', title: 'Size', sizes: defaultSizeRows() }, ...next ] };
      }
      return { ...prev, steps: next.length ? next : prev.steps };
    });
  };

  const addQuantity = () => {
    setForm((prev) => ({
      ...prev,
      quantityLevels: [
        ...prev.quantityLevels,
        { id: newPizzaId('qty'), name: '', multiplier: 1, isDefault: prev.quantityLevels.length === 0 },
      ],
    }));
  };

  const updateQuantity = (id: string, patch: Partial<PizzaQuantityLevel>) => {
    setForm((prev) => ({
      ...prev,
      quantityLevels: prev.quantityLevels.map((row) => {
        if (row.id !== id) {
          return patch.isDefault ? { ...row, isDefault: false } : row;
        }
        return { ...row, ...patch };
      }),
    }));
  };

  const removeQuantity = (id: string) => {
    setForm((prev) => {
      const next = prev.quantityLevels.filter((row) => row.id !== id);
      if (!next.length) return { ...prev, quantityLevels: defaultQuantityLevels() };
      if (!next.some((row) => row.isDefault)) next[0] = { ...next[0], isDefault: true };
      return { ...prev, quantityLevels: next };
    });
  };

  const addItem = (stepId: string, item: PizzaToppingItem) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((step) => {
        if (step.id !== stepId) return step;
        const exists = step.items.some(
          (row) => row.sourceId && item.sourceId && row.sourceId === item.sourceId
        );
        if (exists) return step;
        return { ...step, items: [...step.items, item] };
      }),
    }));
    setPickerStepId(null);
  };

  const removeItem = (stepId: string, itemId: string) => {
    updateStep(stepId, {
      items: (form.steps.find((s) => s.id === stepId)?.items || []).filter((item) => item.id !== itemId),
    });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(t('pizzaBuilderNameRequired'));
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await api.post('/merchant/pizza-templates', form);
      } else {
        await api.put(`/merchant/pizza-templates/${form.id}`, form);
      }
      toast.success(t('pizzaBuilderSaved'));
      navigate(MERCHANT_PIZZA_BUILDER_PATH);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(message || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-[var(--text-muted)]">{t('loading')}</div>;
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="pb-24">
      <div className="px-4 sm:px-6 py-5 space-y-1">
        <p className="text-xs text-[var(--text-muted)]">
          <Link to={MERCHANT_PIZZA_BUILDER_PATH} className="hover:underline">
            {t('pizzaBuilderTitle')}
          </Link>
          {' / '}
          {isNew ? t('pizzaBuilderNewTemplate') : t('pizzaBuilderEditTemplate')}
        </p>
        <h1 className="text-2xl font-semibold">
          {isNew ? t('pizzaBuilderNewTemplate') : t('pizzaBuilderEditTemplate')}
        </h1>
      </div>

      <Section title={t('pizzaBuilderTemplateSettings')}>
        <Field label={t('pizzaBuilderTemplateName')} required>
          <input
            className="field-input w-full max-w-xl"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
        </Field>

        <Field
          label={t('pizzaBuilderSteps')}
          action={
            <button type="button" className="btn-secondary !px-2 !py-1" onClick={addStep} aria-label={t('pizzaBuilderAddStep')}>
              <Plus size={16} />
            </button>
          }
        >
          <div className="space-y-5 max-w-3xl">
            {form.steps.map((step, index) => (
              <div key={step.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium shrink-0">
                    {t('pizzaBuilderStepN').replace('{n}', String(index + 1))}
                  </span>
                  <select
                    className="field-input !py-1.5 max-w-[160px]"
                    value={step.kind}
                    onChange={(e) => changeStepKind(step.id, e.target.value as PizzaStepKind)}
                  >
                    <option value="size">{t('pizzaBuilderStepTypeSize')}</option>
                    <option value="toppings">{t('pizzaBuilderStepTypeToppings')}</option>
                  </select>
                  <button
                    type="button"
                    className="ml-auto text-[var(--text-muted)] hover:text-red-600"
                    aria-label={t('delete')}
                    onClick={() => removeStep(step.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {step.kind === 'size' ? (
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[var(--text-muted)]">
                          <th className="font-medium pb-2">{t('pizzaBuilderSizes')}</th>
                          <th className="font-medium pb-2">{t('pizzaBuilderMaxCapacity')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {step.sizes.map((size) => (
                          <tr key={size.id}>
                            <td className="py-1.5 pr-3">
                              <input
                                className="field-input w-full"
                                value={size.name}
                                onChange={(e) =>
                                  updateStep(step.id, {
                                    sizes: step.sizes.map((row) =>
                                      row.id === size.id ? { ...row, name: e.target.value } : row
                                    ),
                                  })
                                }
                              />
                            </td>
                            <td className="py-1.5">
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={99}
                                  className="field-input w-20"
                                  value={size.maxToppings}
                                  onChange={(e) =>
                                    updateStep(step.id, {
                                      sizes: step.sizes.map((row) =>
                                        row.id === size.id
                                          ? { ...row, maxToppings: Number(e.target.value) || 0 }
                                          : row
                                      ),
                                    })
                                  }
                                />
                                <span className="text-xs text-[var(--text-muted)]">{t('pizzaBuilderItems')}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <aside className="rounded-md bg-[var(--bg-muted)] px-3 py-2 text-xs text-[var(--text-muted)] min-w-[160px]">
                      <p className="font-medium text-[var(--text)] mb-1">{t('pizzaBuilderRecommended')}</p>
                      <p>{t('pizzaBuilderSizeSmall')}: 6 {t('pizzaBuilderItems')}</p>
                      <p>{t('pizzaBuilderSizeMedium')}: 8 {t('pizzaBuilderItems')}</p>
                      <p>{t('pizzaBuilderSizeLarge')}: 10 {t('pizzaBuilderItems')}</p>
                    </aside>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      className="field-input w-full max-w-md"
                      placeholder={t('pizzaBuilderStepTitle')}
                      value={step.title}
                      onChange={(e) => updateStep(step.id, { title: e.target.value })}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-[var(--text-muted)]">{t('pizzaBuilderAddToppings')}</p>
                      <button
                        type="button"
                        className="btn-secondary !px-2 !py-1"
                        onClick={() => setPickerStepId(pickerStepId === step.id ? null : step.id)}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    {pickerStepId === step.id ? (
                      <ToppingPicker
                        groups={groups}
                        products={products}
                        onPick={(item) => addItem(step.id, item)}
                      />
                    ) : null}
                    <div className="rounded-md border border-[var(--border)] overflow-hidden">
                      <div className="px-3 py-2 text-xs font-medium text-[var(--text-muted)] bg-[var(--bg-muted)]">
                        {t('pizzaBuilderItems')}
                      </div>
                      {step.items.length === 0 ? (
                        <p className="px-3 py-6 text-sm text-center text-[var(--text-muted)]">
                          {t('pizzaBuilderNoDataYet')}
                        </p>
                      ) : (
                        <ul className="divide-y divide-[var(--border)]">
                          {step.items.map((item) => (
                            <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                              <span className="truncate">
                                {item.name}
                                {item.price > 0 ? (
                                  <span className="text-[var(--text-muted)]"> · {item.price.toFixed(2)}</span>
                                ) : null}
                              </span>
                              <button
                                type="button"
                                className="text-[var(--text-muted)] hover:text-red-600"
                                onClick={() => removeItem(step.id, item.id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Field>
      </Section>

      <Section title={t('pizzaBuilderPricingSettings')}>
        <Field label={t('pizzaBuilderPortionType')} required>
          <div className="flex flex-wrap gap-4 text-sm">
            {(['whole', 'half', 'quarter'] as PizzaPortionType[]).map((value) => (
              <label key={value} className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="portionType"
                  checked={form.portionType === value}
                  onChange={() => setForm((prev) => ({ ...prev, portionType: value }))}
                />
                {value === 'whole'
                  ? t('pizzaBuilderPortionWhole')
                  : value === 'half'
                    ? t('pizzaBuilderPortionHalf')
                    : t('pizzaBuilderPortionQuarter')}
              </label>
            ))}
          </div>
        </Field>

        <Field
          label={t('pizzaBuilderQuantityLevels')}
          action={
            <button type="button" className="btn-secondary !px-2 !py-1" onClick={addQuantity}>
              <Plus size={16} />
            </button>
          }
        >
          <div className="grid gap-3 md:grid-cols-[1fr_auto] max-w-3xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--text-muted)]">
                  <th className="font-medium pb-2 w-8" />
                  <th className="font-medium pb-2">{t('pizzaBuilderItems')}</th>
                  <th className="font-medium pb-2">{t('pizzaBuilderPriceMultiplier')}</th>
                  <th className="font-medium pb-2">{t('pizzaBuilderDefaultSelection')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {form.quantityLevels.map((row) => (
                  <tr key={row.id}>
                    <td className="text-[var(--text-muted)]">
                      <GripVertical size={14} />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        className="field-input w-full"
                        value={row.name}
                        onChange={(e) => updateQuantity(row.id, { name: e.target.value })}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        className="field-input w-24"
                        value={row.multiplier}
                        onChange={(e) => updateQuantity(row.id, { multiplier: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="py-1.5">
                      <input
                        type="radio"
                        name="defaultQty"
                        checked={row.isDefault}
                        onChange={() => updateQuantity(row.id, { isDefault: true })}
                      />
                    </td>
                    <td>
                      <button type="button" className="text-[var(--text-muted)] hover:text-red-600" onClick={() => removeQuantity(row.id)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <aside className="rounded-md bg-[var(--bg-muted)] px-3 py-2 text-xs text-[var(--text-muted)] min-w-[180px]">
              <p className="font-medium text-[var(--text)] mb-1">{t('pizzaBuilderQuantityExample')}</p>
              <p>{t('pizzaBuilderQtyExampleLight')}</p>
              <p>{t('pizzaBuilderQtyExampleExtra')}</p>
            </aside>
          </div>
        </Field>

        <Field label={t('pizzaBuilderFreeAllowance')}>
          <div className="space-y-3 max-w-xl">
            <button
              type="button"
              role="switch"
              aria-checked={form.freeToppingEnabled}
              onClick={() => setForm((prev) => ({ ...prev, freeToppingEnabled: !prev.freeToppingEnabled }))}
              className={`relative h-7 w-12 rounded-full transition ${
                form.freeToppingEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                  form.freeToppingEnabled ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
            {form.freeToppingEnabled ? (
              <div className="rounded-lg border border-[var(--border)] p-3 space-y-3">
                <label className="flex items-center gap-3 text-sm">
                  <span className="min-w-[180px]">{t('pizzaBuilderFreeCount')}</span>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    className="field-input w-20"
                    value={form.freeToppingCount}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, freeToppingCount: Number(e.target.value) || 0 }))
                    }
                  />
                </label>
                <div className="space-y-2 text-sm">
                  <p className="text-[var(--text-muted)]">{t('pizzaBuilderApplyDiscount')}</p>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.applyDiscount === 'lowest'}
                      onChange={() => setForm((prev) => ({ ...prev, applyDiscount: 'lowest' }))}
                    />
                    {t('pizzaBuilderDiscountLowest')}
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.applyDiscount === 'highest'}
                      onChange={() => setForm((prev) => ({ ...prev, applyDiscount: 'highest' }))}
                    />
                    {t('pizzaBuilderDiscountHighest')}
                  </label>
                </div>
              </div>
            ) : null}
          </div>
        </Field>

        <Field label={t('pizzaBuilderLinkedProducts')}>
          <div className="max-w-xl">
            <SearchableMultiSelect
              label={t('pizzaBuilderLinkedProducts')}
              helperText={t('pizzaBuilderLinkedHint')}
              placeholder={t('pizzaBuilderSearchProducts')}
              options={productOptions}
              value={form.linkedProductIds}
              onChange={(ids) => setForm((prev) => ({ ...prev, linkedProductIds: ids }))}
            />
          </div>
        </Field>
      </Section>

      <div className="fixed bottom-0 inset-x-0 border-t border-[var(--border)] bg-[var(--bg-elevated)] px-4 sm:px-6 py-3 flex justify-end gap-2">
        <Link to={MERCHANT_PIZZA_BUILDER_PATH} className="btn-secondary">
          {t('cancel')}
        </Link>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? t('loading') : t('save')}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-[var(--border)]">
      <div className="bg-[var(--bg-muted)] px-4 sm:px-6 py-2 text-sm font-medium">{title}</div>
      <div className="px-4 sm:px-6 py-5 space-y-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  action,
  children,
}: {
  label: string;
  required?: boolean;
  action?: React.ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-[200px_1fr] md:items-start">
      <div className="flex items-center gap-2 pt-2 text-sm">
        {required ? <span className="text-red-500">*</span> : null}
        <span>{label}</span>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ToppingPicker({
  groups,
  products,
  onPick,
}: {
  groups: ModifierGroup[];
  products: CatalogProduct[];
  onPick: (item: PizzaToppingItem) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filteredGroups = groups
    .map((group) => ({
      ...group,
      options: (group.options || []).filter((opt) => !q || `${group.title} ${opt.name}`.toLowerCase().includes(q)),
    }))
    .filter((group) => (group.options || []).length > 0);
  const filteredProducts = products.filter((product) => !q || product.name.toLowerCase().includes(q));

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 space-y-3">
      <input
        className="field-input w-full"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('pizzaBuilderSearchToppings')}
      />
      <div className="grid gap-4 md:grid-cols-2 max-h-64 overflow-y-auto">
        <div>
          <p className="text-xs font-medium text-[var(--text-muted)] mb-2">{t('pizzaBuilderFromModifiers')}</p>
          {filteredGroups.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">{t('pizzaBuilderNoGroups')}</p>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.id} className="mb-2">
                <p className="text-xs font-semibold">{group.title}</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {(group.options || []).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs hover:bg-[var(--bg-muted)]"
                      onClick={() =>
                        onPick({
                          id: newPizzaId('it'),
                          name: opt.name,
                          price: Number(opt.price) || 0,
                          sourceType: 'modifier',
                          sourceId: opt.id,
                          groupId: group.id,
                        })
                      }
                    >
                      {opt.name}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-[var(--text-muted)] mb-2">{t('pizzaBuilderFromProducts')}</p>
          {filteredProducts.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">{t('pizzaBuilderNoProducts')}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {filteredProducts.slice(0, 40).map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs hover:bg-[var(--bg-muted)]"
                  onClick={() =>
                    onPick({
                      id: newPizzaId('it'),
                      name: product.name,
                      price: Number(product.price) || 0,
                      sourceType: 'product',
                      sourceId: product.id,
                    })
                  }
                >
                  {product.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
