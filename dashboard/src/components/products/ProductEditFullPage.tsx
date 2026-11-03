import { FormEvent, ReactNode, type Ref } from 'react';
import {
  ArrowLeft,
  Boxes,
  ChevronRight,
  ListTree,
  Package,
  SlidersHorizontal,
  Tag,
} from 'lucide-react';
import { LocationSwitcherChip } from '@/components/merchant/LocationPicker';

type CategoryOption = { id: string; name: string };

export type ProductEditFullPageProps = {
  formId: string;
  scrollRef: Ref<HTMLDivElement>;
  onSubmit: (e: FormEvent) => void;
  onBack: () => void;
  saving: boolean;
  t: (key: string) => string;
  cancelLabel: string;
  saveLabel: string;
  productName: string;
  onNameChange: (value: string) => void;
  categoryLabel: string;
  imageUrl: string;
  inStock: boolean;
  categories: CategoryOption[];
  categoryId: string;
  onCategoryChange: (id: string) => void;
  price: string;
  onPriceChange: (value: string) => void;
  taxRateDisplay: string;
  onTaxRateChange: (value: string) => void;
  cost: string;
  onCostChange: (value: string) => void;
  isOpenPrice: boolean;
  onOpenPriceChange: (enabled: boolean) => void;
  soldByWeight: boolean;
  onSoldByWeightChange: (enabled: boolean) => void;
  showWeighedTools: boolean;
  isCombo: boolean;
  variationCount: number;
  moreOptionsCount: number;
  variationsExpanded: boolean;
  onToggleVariations: () => void;
  onAddVariation: () => void;
  moreExpanded: boolean;
  onToggleMore: () => void;
  onConfigureMore: () => void;
  onUploadPhoto: () => void;
  branchPicker?: ReactNode;
  variationsPanel?: ReactNode;
  morePanel?: ReactNode;
  comboPanel?: ReactNode;
  formExtension?: ReactNode;
};

function EditorCard({
  icon,
  title,
  children,
  className = '',
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:p-5 shadow-sm ${className}`}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
          {icon}
        </span>
        <h2 className="text-base font-semibold text-[var(--text)]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="mb-1 block text-sm font-medium text-[var(--text)]">
      {label}
      {required ? <span className="text-red-600"> *</span> : null}
    </label>
  );
}

function SalesToggle({
  title,
  hint,
  enabled,
  disabled,
  onChange,
}: {
  title: string;
  hint: string;
  enabled: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/30 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
          enabled ? 'bg-teal-600' : 'bg-stone-300 dark:bg-stone-600'
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function OptionNavRow({
  icon,
  title,
  hint,
  count,
  expanded,
  onToggle,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/25 px-3 py-3 text-left transition hover:bg-[var(--bg-muted)]/60"
      aria-expanded={expanded}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--text-muted)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--text)]">{title}</span>
        <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{hint}</span>
      </span>
      <span className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-[var(--bg-muted)] px-2 text-xs font-bold tabular-nums text-[var(--text-muted)]">
        {count}
      </span>
      <ChevronRight
        size={18}
        className={`shrink-0 text-[var(--text-muted)] transition ${expanded ? 'rotate-90' : ''}`}
        aria-hidden
      />
    </button>
  );
}

export default function ProductEditFullPage({
  formId,
  scrollRef,
  onSubmit,
  onBack,
  saving,
  t,
  cancelLabel,
  saveLabel,
  productName,
  onNameChange,
  categoryLabel,
  imageUrl,
  inStock,
  categories,
  categoryId,
  onCategoryChange,
  price,
  onPriceChange,
  taxRateDisplay,
  onTaxRateChange,
  cost,
  onCostChange,
  isOpenPrice,
  onOpenPriceChange,
  soldByWeight,
  onSoldByWeightChange,
  showWeighedTools,
  isCombo,
  variationCount,
  moreOptionsCount,
  variationsExpanded,
  onToggleVariations,
  onAddVariation,
  moreExpanded,
  onToggleMore,
  onConfigureMore,
  onUploadPhoto,
  branchPicker,
  variationsPanel,
  morePanel,
  comboPanel,
  formExtension,
}: ProductEditFullPageProps) {
  const priceSuffix = soldByWeight && !isCombo ? 'CHF/kg' : 'CHF';

  return (
    <div className="product-edit-page -mx-3 flex h-[calc(100dvh-7.5rem)] max-h-[calc(100dvh-7.5rem)] min-h-0 flex-col bg-[var(--bg)] text-[var(--text)] sm:-mx-4 md:-mx-6">
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-3 sm:px-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)]"
            >
              <ArrowLeft size={16} aria-hidden />
              {t('backToProducts')}
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-[var(--text)] sm:text-2xl">
                {t('editProductPageTitle')}
              </h1>
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">{t('editProductPageSubtitle')}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <span className="inline-flex max-w-[min(100%,14rem)] items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-muted)]/50 px-3 py-1.5 text-xs font-semibold text-[var(--text)]">
              <span className="flex h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-elevated)]">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    <Package size={16} className="text-[var(--text-muted)]" />
                  </span>
                )}
              </span>
              <span className="min-w-0 truncate">{productName.trim() || '—'}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  inStock
                    ? 'bg-teal-600/15 text-teal-700 dark:text-teal-300'
                    : 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
                }`}
              >
                {inStock ? t('inStock') : t('outOfStock')}
              </span>
            </span>
            <LocationSwitcherChip />
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        data-product-editor-scroll
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] bg-[var(--bg)] px-3 py-4 sm:px-4"
      >
        <form id={formId} onSubmit={onSubmit} noValidate className="mx-auto max-w-6xl space-y-4">
          {branchPicker}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_min(18rem,32%)] lg:items-start">
            <div className="min-w-0 space-y-4">
                <EditorCard icon={<Tag size={18} />} title={t('productGeneralInfo')}>
                  <div className="space-y-3">
                    <div>
                      <FieldLabel label={t('productName')} required />
                      <input
                        className="field-input w-full"
                        value={productName}
                        onChange={(e) => onNameChange(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <FieldLabel label={t('category')} required />
                      <select
                        className="field-input w-full"
                        value={categoryId}
                        required
                        onChange={(e) => onCategoryChange(e.target.value)}
                      >
                        <option value="">{t('selectCategory')}</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <FieldLabel label={t('productPriceChf')} required />
                        <div className="flex min-w-0 items-stretch overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20">
                          <input
                            className="field-input money-input min-w-0 flex-1 border-0 !shadow-none focus:!ring-0"
                            type="text"
                            inputMode="decimal"
                            value={price}
                            required
                            onChange={(e) => onPriceChange(e.target.value)}
                          />
                          <span className="inline-flex shrink-0 items-center border-l border-[var(--border)] bg-[var(--bg-muted)] px-2 text-[10px] font-semibold text-[var(--text-muted)]">
                            {priceSuffix}
                          </span>
                        </div>
                      </div>
                      <div>
                        <FieldLabel label={t('productTaxRatePercent')} />
                        <input
                          className="field-input w-full money-input"
                          type="text"
                          inputMode="decimal"
                          value={taxRateDisplay}
                          onChange={(e) => onTaxRateChange(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <FieldLabel label={t('productBuyingPrice')} />
                      <div className="flex min-w-0 max-w-md items-stretch overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20">
                        <input
                          className="field-input money-input min-w-0 flex-1 border-0 !shadow-none focus:!ring-0"
                          type="text"
                          inputMode="decimal"
                          value={cost}
                          placeholder="0.00"
                          onChange={(e) => onCostChange(e.target.value)}
                        />
                        <span className="inline-flex shrink-0 items-center border-l border-[var(--border)] bg-[var(--bg-muted)] px-2 text-[10px] font-semibold text-[var(--text-muted)]">
                          CHF
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-[var(--text-muted)]">{t('productBuyingPriceHint')}</p>
                    </div>
                  </div>
                </EditorCard>

              <EditorCard icon={<ListTree size={18} />} title={t('productVariationsSection')}>
                <div className="space-y-3">
                  {!isCombo ? (
                    <>
                      <OptionNavRow
                        icon={<Boxes size={18} />}
                        title={t('productVariationsRow')}
                        hint={t('productVariationsHint')}
                        count={variationCount}
                        expanded={variationsExpanded}
                        onToggle={onToggleVariations}
                      />
                      {variationsExpanded && variationsPanel ? (
                        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-muted)]/20 p-3">
                          {variationsPanel}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={onAddVariation}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800 dark:text-teal-400"
                      >
                        {t('addVariationLink')}
                      </button>
                    </>
                  ) : comboPanel ? (
                    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-muted)]/20 p-3">
                      {comboPanel}
                    </div>
                  ) : null}

                  <OptionNavRow
                    icon={<ListTree size={18} />}
                    title={t('productMoreOptionsRow')}
                    hint={t('productMoreOptionsHint')}
                    count={moreOptionsCount}
                    expanded={moreExpanded}
                    onToggle={onToggleMore}
                  />
                  {moreExpanded && morePanel ? (
                    <div className="space-y-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-muted)]/20 p-3">
                      {morePanel}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={onConfigureMore}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800 dark:text-teal-400"
                  >
                    {t('configureMoreOptionsLink')}
                  </button>
                </div>
              </EditorCard>
            </div>

            <aside className="min-w-0 space-y-4 lg:sticky lg:top-2">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-sm">
                <button
                  type="button"
                  onClick={onUploadPhoto}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <div className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--bg-muted)]">
                    {imageUrl ? (
                      <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package size={24} className="text-[var(--text-muted)]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-[var(--text)]">
                      {productName.trim() || '—'}
                    </p>
                    <p className="truncate text-sm text-[var(--text-muted)]">{categoryLabel || '—'}</p>
                    <span
                      className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        inStock
                          ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200'
                          : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${inStock ? 'bg-teal-600' : 'bg-amber-600'}`}
                        aria-hidden
                      />
                      {inStock ? t('inStock') : t('outOfStock')}
                    </span>
                  </div>
                </button>
              </div>

              <EditorCard icon={<SlidersHorizontal size={18} />} title={t('productSalesOptions')}>
                <div className="space-y-3">
                  <SalesToggle
                    title={t('productOpenPriceToggle')}
                    hint={t('productOpenPriceSalesHint')}
                    enabled={isOpenPrice}
                    disabled={isCombo}
                    onChange={onOpenPriceChange}
                  />
                  {showWeighedTools ? (
                    <SalesToggle
                      title={t('productSoldByWeightToggle')}
                      hint={t('productSoldByWeightSalesHint')}
                      enabled={soldByWeight}
                      disabled={isCombo}
                      onChange={onSoldByWeightChange}
                    />
                  ) : null}
                </div>
              </EditorCard>
            </aside>
          </div>
          {formExtension}
        </form>
      </div>

      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-3 sm:px-4">
        <div className="mx-auto flex max-w-6xl justify-end gap-2">
          <button type="button" onClick={onBack} className="btn-secondary min-w-[7rem] px-5">
            {cancelLabel}
          </button>
          <button
            type="submit"
            form={formId}
            disabled={saving}
            className="btn-primary min-w-[7rem] px-5"
          >
            {saving ? t('saving') : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
