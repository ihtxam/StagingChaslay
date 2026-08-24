import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';

export type PrinterRoutingProfile = {
  linkedCategoryIds?: string[];
  linkedProductIds?: string[];
  printAllProducts?: boolean;
};

type CategoryRow = { id: string; name: string };
type ProductRow = { id: string; name: string; categoryId?: string | null };

function printsAllCategories(p: PrinterRoutingProfile, categoryCount: number): boolean {
  if (!categoryCount) return true;
  return !(p.linkedCategoryIds?.length) && p.printAllProducts !== false;
}

function isCategoryLinked(p: PrinterRoutingProfile, categoryId: string, categoryCount: number): boolean {
  if (printsAllCategories(p, categoryCount)) return true;
  return (p.linkedCategoryIds || []).includes(categoryId);
}

function isProductLinked(
  p: PrinterRoutingProfile,
  product: ProductRow,
  categoryCount: number
): boolean {
  if (product.categoryId && isCategoryLinked(p, product.categoryId, categoryCount)) return true;
  return (p.linkedProductIds || []).includes(product.id);
}

function toggleCategory(
  p: PrinterRoutingProfile,
  categoryId: string,
  allCategoryIds: string[],
  checked: boolean
): PrinterRoutingProfile {
  const allMode = printsAllCategories(p, allCategoryIds.length);
  let nextIds: string[];

  if (allMode && !checked) {
    nextIds = allCategoryIds.filter((id) => id !== categoryId);
  } else if (allMode) {
    return p;
  } else {
    const current = new Set(p.linkedCategoryIds || []);
    if (checked) current.add(categoryId);
    else current.delete(categoryId);
    nextIds = allCategoryIds.filter((id) => current.has(id));
  }

  if (!nextIds.length || nextIds.length === allCategoryIds.length) {
    return { ...p, linkedCategoryIds: [], printAllProducts: true };
  }
  return { ...p, linkedCategoryIds: nextIds, printAllProducts: false };
}

function toggleProduct(
  p: PrinterRoutingProfile,
  product: ProductRow,
  allCategoryIds: string[],
  checked: boolean
): PrinterRoutingProfile {
  const catId = product.categoryId || '';
  const categoryCount = allCategoryIds.length;
  const viaCategory = catId && isCategoryLinked(p, catId, categoryCount);
  if (viaCategory) return p;

  const current = new Set(p.linkedProductIds || []);
  if (checked) current.add(product.id);
  else current.delete(product.id);
  const linkedProductIds = [...current];

  if (!linkedProductIds.length && !(p.linkedCategoryIds?.length)) {
    return { ...p, linkedProductIds: [], printAllProducts: true };
  }

  return {
    ...p,
    linkedProductIds,
    printAllProducts: false,
    linkedCategoryIds: p.linkedCategoryIds || [],
  };
}

function toggleAllInCategory(
  p: PrinterRoutingProfile,
  categoryId: string,
  productsInCat: ProductRow[],
  allCategoryIds: string[],
  checked: boolean
): PrinterRoutingProfile {
  if (checked) {
    return toggleCategory(p, categoryId, allCategoryIds, true);
  }
  const productIds = new Set(productsInCat.map((pr) => pr.id));
  const next = toggleCategory(p, categoryId, allCategoryIds, false);
  const linkedProductIds = (next.linkedProductIds || []).filter((id) => !productIds.has(id));
  return { ...next, linkedProductIds };
}

type Props = {
  profile: PrinterRoutingProfile;
  categories: CategoryRow[];
  products: ProductRow[];
  onChange: (next: PrinterRoutingProfile) => void;
};

export default function PrinterKitchenRoutingPicker({
  profile,
  categories,
  products,
  onChange,
}: Props) {
  const { t } = useI18n();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    () => categories[0]?.id ?? null
  );

  const allCategoryIds = useMemo(() => categories.map((c) => c.id), [categories]);
  const allMode = printsAllCategories(profile, categories.length);

  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? categories[0] ?? null;
  const productsInActive = useMemo(
    () =>
      activeCategory
        ? products.filter((p) => p.categoryId === activeCategory.id)
        : [],
    [products, activeCategory]
  );

  const selectedInActive = productsInActive.filter((p) =>
    isProductLinked(profile, p, categories.length)
  ).length;
  const allInActiveSelected =
    productsInActive.length > 0 && selectedInActive === productsInActive.length;

  if (!categories.length) {
    return <p className="text-xs text-[var(--muted)] m-0">{t('printerLinkedCategoriesEmpty')}</p>;
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium m-0">{t('printerKitchenRoutingTitle')}</p>
        <p className="text-xs text-[var(--muted)] m-0 mt-0.5">{t('printerKitchenRoutingHint')}</p>
      </div>
      {allMode ? (
        <p className="text-xs text-emerald-700 m-0">{t('printerLinkedCategoriesAll')}</p>
      ) : null}
      <div className="grid min-h-0 gap-0 overflow-hidden rounded-lg border border-[var(--border)] sm:grid-cols-[minmax(9rem,34%)_1fr] h-[min(28rem,55vh)] min-h-[14rem]">
        <div
          className="min-h-0 max-h-[min(28rem,55vh)] border-b sm:border-b-0 sm:border-r border-[var(--border)] overflow-y-auto overscroll-contain bg-stone-50/80"
          onWheel={(e) => e.stopPropagation()}
        >
          {categories.map((cat) => {
            const active = cat.id === (activeCategory?.id ?? null);
            const linked = isCategoryLinked(profile, cat.id, categories.length);
            const count = products.filter((p) => p.categoryId === cat.id).length;
            return (
              <div
                key={cat.id}
                className={`flex items-start gap-1 border-b border-[var(--border)] last:border-b-0 ${
                  active ? 'bg-teal-50' : 'hover:bg-white'
                }`}
              >
                <label className="flex shrink-0 items-center px-2 py-2.5">
                  <input
                    type="checkbox"
                    checked={linked}
                    onChange={(e) => {
                      onChange(toggleCategory(profile, cat.id, allCategoryIds, e.target.checked));
                    }}
                  />
                </label>
                <button
                  type="button"
                  className={`min-w-0 flex-1 py-2.5 pr-2 text-left text-sm ${
                    active ? 'font-semibold text-teal-900' : 'text-stone-800'
                  }`}
                  onClick={() => setActiveCategoryId(cat.id)}
                >
                  <span className="block truncate">{cat.name}</span>
                  <span className="text-[10px] font-normal text-stone-500">{count}</span>
                </button>
              </div>
            );
          })}
        </div>
        <div
          className="min-h-0 max-h-[min(28rem,55vh)] overflow-y-auto overscroll-contain p-2"
          onWheel={(e) => e.stopPropagation()}
        >
          {!activeCategory ? (
            <p className="text-xs text-[var(--muted)] m-0 p-2">{t('printerPickCategory')}</p>
          ) : !productsInActive.length ? (
            <p className="text-xs text-[var(--muted)] m-0 p-2">{t('printerNoProductsInCategory')}</p>
          ) : (
            <>
              <label className="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold hover:bg-stone-50">
                <input
                  type="checkbox"
                  checked={allInActiveSelected}
                  onChange={(e) => {
                    onChange(
                      toggleAllInCategory(
                        profile,
                        activeCategory.id,
                        productsInActive,
                        allCategoryIds,
                        e.target.checked
                      )
                    );
                  }}
                />
                {t('printerAllInCategory').replace('{count}', String(selectedInActive)).replace(
                  '{total}',
                  String(productsInActive.length)
                )}
              </label>
              <ul className="space-y-0.5">
                {productsInActive.map((product) => {
                  const linked = isProductLinked(profile, product, categories.length);
                  const viaCategory =
                    product.categoryId &&
                    isCategoryLinked(profile, product.categoryId, categories.length);
                  return (
                    <li key={product.id}>
                      <label
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone-50 ${
                          viaCategory ? 'text-stone-600' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={linked}
                          disabled={!!viaCategory}
                          onChange={(e) => {
                            onChange(
                              toggleProduct(profile, product, allCategoryIds, e.target.checked)
                            );
                          }}
                        />
                        <span className="truncate">{product.name}</span>
                        {viaCategory ? (
                          <span className="ml-auto shrink-0 text-[10px] text-stone-400">
                            {t('printerViaCategory')}
                          </span>
                        ) : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
      <p className="text-xs text-[var(--muted)] m-0">{t('printerCrossStationHint')}</p>
    </div>
  );
}
