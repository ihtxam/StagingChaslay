import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Edit2,
  FileSpreadsheet,
  Package,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
  Printer,
  Barcode,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { isInventoryLicensed } from '@/lib/inventory-addon';
import { useI18n } from '@/lib/i18n';
import { moneyDigitCount, normalizeMoneyInput, parseMoney } from '@/lib/money';
import { DragHandle, SortableContainer, SortableRow } from '@/components/SortableList';
import { BarcodePreview } from '@/components/BarcodePreview';
import {
  labelMetaLine,
  normalizeLabelOptions,
  printLabelsHtml,
  printLabelsViaAgentOrQueue,
  type LabelHeightMm,
  type LabelPrintOptions,
  type LabelProduct,
  type LabelWidthMm,
} from '@/lib/barcode-labels';

interface Extra {
  id: string;
  name: string;
  price: number;
}

interface BulkTier {
  minQty: number;
  price: number;
}

interface SpecRow {
  id: string;
  name: string;
  /** Raw price text while editing (keeps partial decimals like "0."). */
  price: string;
  saleStatus: 'in_stock' | 'out_of_stock';
  isDefault: boolean;
}

interface ModifierGroupSummary {
  id: string;
  title: string;
  options?: Array<{ id: string; name: string; price: number }>;
  pricingType?: string;
  selectionType?: string;
}

interface ComboOptionForm {
  productId: string;
  /** Raw extra price text while editing. */
  extraPrice: string;
}

interface ComboSlotForm {
  id: string;
  name: string;
  minPick: number;
  maxPick: number;
  options: ComboOptionForm[];
}

interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: string | number;
  stock: number;
  sku?: string | null;
  barcode?: string | null;
  imageUrl?: string | null;
  buttonColor?: string | null;
  productType?: string;
  isOpenPrice?: boolean;
  soldByWeight?: boolean;
  weightUnit?: string | null;
  categoryId?: string | null;
  bulkPricing?: BulkTier[];
  specifications?: SpecRow[];
  extras?: Extra[];
  allowExtras?: boolean;
  loyaltyRewardPoints?: number | null;
  sortOrder?: number;
  modifierGroups?: ModifierGroupSummary[];
  comboItems?: Array<{
    id?: string;
    name?: string;
    minPick?: number;
    maxPick?: number;
    options?: Array<{ productId: string; extraPrice?: number }>;
    productId?: string;
    quantity?: number;
  }>;
}

interface Category {
  id: string;
  name: string;
}

type FormState = {
  name: string;
  description: string;
  price: string;
  stock: string;
  sku: string;
  barcode: string;
  categoryId: string;
  buttonColor: string;
  imageUrl: string;
  isOpenPrice: boolean;
  soldByWeight: boolean;
  /** Catalog price unit for weighed items (default kg). */
  weightUnit: 'kg' | 'g' | 'lb';
  isCombo: boolean;
  comboSlots: ComboSlotForm[];
  specifications: SpecRow[];
  modifierGroupIds: string[];
  /** Empty = not a free reward; otherwise points cost ≥ 1 */
  loyaltyRewardPoints: string;
};

const emptySlot = (name = 'Main'): ComboSlotForm => ({
  id: `slot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name,
  minPick: 1,
  maxPick: 1,
  options: [],
});

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  price: '',
  stock: '0',
  sku: '',
  barcode: '',
  categoryId: '',
  buttonColor: '#0f172a',
  imageUrl: '',
  isOpenPrice: false,
  soldByWeight: false,
  weightUnit: 'kg',
  isCombo: false,
  comboSlots: [],
  specifications: [{ id: 'default', name: '', price: '', saleStatus: 'in_stock', isDefault: true }],
  modifierGroupIds: [],
  loyaltyRewardPoints: '',
});

function normalizeComboSlotsFromProduct(raw: Product['comboItems']): ComboSlotForm[] {
  if (!Array.isArray(raw) || !raw.length) return [];
  return raw
    .map((row, idx) => {
      if (Array.isArray(row.options) && row.options.length) {
        return {
          id: row.id || `slot-${idx + 1}`,
          name: row.name || `Choice ${idx + 1}`,
          minPick: Math.max(1, Number(row.minPick) || 1),
          maxPick: Math.max(1, Number(row.maxPick) || 1),
          options: row.options
            .filter((o) => o?.productId)
            .map((o) => ({
              productId: o.productId,
              extraPrice: String(Math.max(0, Number(o.extraPrice) || 0)),
            })),
        };
      }
      if (row.productId) {
        return {
          id: row.id || `legacy-${row.productId}-${idx}`,
          name: row.name || `Item ${idx + 1}`,
          minPick: 1,
          maxPick: 1,
          options: [{ productId: row.productId, extraPrice: '0' }],
        };
      }
      return null;
    })
    .filter(Boolean) as ComboSlotForm[];
}

const BUTTON_COLORS = ['#ffffff', '#facc15', '#7dd3fc', '#4ade80', '#f9a8d4', '#3370FE', '#0f172a'];

const CATEGORY_COLORS = [
  'bg-rose-50 text-rose-800 border-rose-100',
  'bg-orange-50 text-orange-800 border-orange-100',
  'bg-amber-50 text-amber-800 border-amber-100',
  'bg-emerald-50 text-emerald-800 border-emerald-100',
  'bg-sky-50 text-sky-800 border-sky-100',
  'bg-violet-50 text-violet-800 border-violet-100',
  'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-100',
  'bg-slate-50 text-slate-800 border-slate-100',
];

const money = (value: string | number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'CHF' }).format(Number(value) || 0);

const SKU_MAX_LEN = 100; // matches DB varchar(100)
const MAX_MONEY_DIGITS = 10;
const MAX_STOCK_DIGITS = 5;
const MAX_POINTS = 2_147_483_647; // PG integer max

/** Free-points field: digits only, hard-capped at 10 (PG integer / product rule). */
const sanitizeFreePointsInput = (raw: string) => raw.replace(/\D/g, '').slice(0, MAX_MONEY_DIGITS);

const clampNonNegativeInt = (raw: string, maxDigits = MAX_MONEY_DIGITS) => {
  const digits = raw.replace(/\D/g, '').slice(0, maxDigits);
  if (digits === '') return '';
  return String(Math.max(0, Math.floor(Number(digits))));
};

/** Parse free-points for API; null when empty/invalid. */
const parseFreePoints = (raw: string): number | null | 'too_many_digits' | 'out_of_range' => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (moneyDigitCount(trimmed) > MAX_MONEY_DIGITS) return 'too_many_digits';
  const points = Math.floor(Number(sanitizeFreePointsInput(trimmed)));
  if (!Number.isFinite(points) || points < 1 || points > MAX_POINTS) return 'out_of_range';
  return points;
};

type ProductTypeUi = 'standard' | 'combo' | 'open_price' | 'weighed';

export default function Products() {
  const { t } = useI18n();
  const productTypeLabel = (product: Product) => {
    if (product.productType === 'combo' || (product.comboItems && product.comboItems.length)) {
      return t('productTypeComboShort');
    }
    if (product.soldByWeight) return t('productTypeWeighedShort');
    if (product.isOpenPrice) return t('productTypeOpenPriceShort');
    return product.productType === 'standard' || !product.productType
      ? t('productTypeStandard')
      : product.productType;
  };
  const fileRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingDemo, setImportingDemo] = useState(false);
  const [deletingDemoCatalog, setDeletingDemoCatalog] = useState(false);
  const [hasDemoCatalog, setHasDemoCatalog] = useState(false);
  const [demoImportOpen, setDemoImportOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [allModifierGroups, setAllModifierGroups] = useState<ModifierGroupSummary[]>([]);
  const [modifierPickerOpen, setModifierPickerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [printOpen, setPrintOpen] = useState(false);
  const [printTargets, setPrintTargets] = useState<LabelProduct[]>([]);
  const [labelOpts, setLabelOpts] = useState<LabelPrintOptions>({
    heightMm: 20,
    widthMm: 40,
    showStoreName: true,
    showProductName: true,
    showBarcodeNumber: true,
    showPrice: false,
    showSku: false,
    copies: 1,
  });
  const [inventoryOn, setInventoryOn] = useState(false);
  const [recipeLines, setRecipeLines] = useState<Array<{ itemId: string; qty: string; name?: string; unit?: string }>>([]);
  const [recipeYield, setRecipeYield] = useState('1');
  const [invItems, setInvItems] = useState<Array<{ id: string; name: string; unit: string }>>([]);
  const [storeName, setStoreName] = useState('');
  const [importingPhotos, setImportingPhotos] = useState(false);
  const [productLimit, setProductLimit] = useState<{
    maxProducts: number | null;
    currentCount: number;
    planSlug: string | null;
    planName: string | null;
  } | null>(null);

  const atProductLimit =
    productLimit?.maxProducts != null &&
    (productLimit.currentCount ?? products.length) >= productLimit.maxProducts;

  const productLimitLabel = useMemo(() => {
    if (!productLimit) return null;
    const count = productLimit.currentCount ?? products.length;
    if (productLimit.maxProducts == null) {
      return t('productCountUnlimited').replace('{n}', String(count));
    }
    return t('productCountLimited')
      .replace('{n}', String(count))
      .replace('{max}', String(productLimit.maxProducts));
  }, [productLimit, products.length, t]);

  const onUploadProductImage = async (file: File | null) => {
    if (!file) return;
    setImageUploading(true);
    try {
      const { compressImageIfNeeded } = await import('@/lib/compress-image');
      const compressed = await compressImageIfNeeded(file, {
        maxBytes: 350 * 1024,
        targetBytes: 350 * 1024,
        maxWidth: 1200,
      });
      const fd = new FormData();
      fd.append('file', compressed);
      const res = await api.post('/merchant/media', fd);
      setForm((prev) => ({ ...prev, imageUrl: res.data.url || '' }));
      toast.success(t('imageUploaded'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('uploadFailed'));
    } finally {
      setImageUploading(false);
      if (imageFileRef.current) imageFileRef.current.value = '';
    }
  };

  const load = async () => {
    try {
      const fetchAllProducts = async () => {
        const pageSize = 500;
        let page = 1;
        let all: Product[] = [];
        let total = 0;
        let limitInfo: typeof productLimit = null;
        for (;;) {
          const res = await api.get('/merchant/products', { params: { limit: pageSize, page } });
          const batch = (res.data.products || []) as Product[];
          all = all.concat(batch);
          total = Number(res.data.pagination?.total) || all.length;
          limitInfo = res.data.productLimit || limitInfo;
          if (batch.length < pageSize || all.length >= total) break;
          page += 1;
        }
        return { products: all, productLimit: limitInfo, total };
      };

      const [p, c, m] = await Promise.all([
        fetchAllProducts(),
        api.get('/merchant/categories'),
        api.get('/merchant/modifiers'),
      ]);
      setProducts(p.products || []);
      setProductLimit(p.productLimit || null);
      setCategories(c.data.categories || []);
      setAllModifierGroups(m.data.groups || []);
      try {
        const demoSt = await api.get('/merchant/products/demo-status');
        setHasDemoCatalog(!!demoSt.data?.hasDemoData);
      } catch {
        setHasDemoCatalog(false);
      }
      try {
        const st = await api.get('/merchant/inventory/status');
        let on = isInventoryLicensed(st.data);
        if (!on) {
          const setRes = await api.get('/merchant/settings').catch(() => null);
          on = isInventoryLicensed(setRes?.data?.settings);
        }
        setInventoryOn(on);
        if (on) {
          const inv = await api.get('/merchant/inventory/items');
          setInvItems((inv.data.items || []).map((i: { id: string; name: string; unit: string }) => ({
            id: i.id,
            name: i.name,
            unit: i.unit,
          })));
        }
      } catch {
        setInventoryOn(false);
      }
      try {
        const setRes = await api.get('/merchant/settings');
        const s = setRes.data?.settings;
        setStoreName(s?.name || '');
        const ps = s?.posPrintSettings || {};
        setLabelOpts((prev) => ({
          ...prev,
          storeName: s?.name || '',
          widthMm: ps.labelWidthMm === 58 ? 58 : 40,
          heightMm: ([20, 25, 30, 40] as const).includes(ps.labelHeightMm) ? ps.labelHeightMm : 20,
          showStoreName: ps.labelShowStoreName !== false,
          showProductName: ps.labelShowProductName !== false,
          showBarcodeNumber: ps.labelShowBarcodeNumber !== false,
          showPrice: ps.labelShowPrice === true,
          showSku: ps.labelShowSku === true,
        }));
      } catch {
        /* optional */
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('failedLoadProducts'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const categoryName = (categoryId?: string | null) =>
    categories.find((c) => c.id === categoryId)?.name || t('uncategorized');

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      const key = product.categoryId || '__none__';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [products]);

  const persistProductOrder = async (next: Product[]) => {
    const prev = products;
    setProducts(next);
    setReordering(true);
    try {
      const res = await api.put('/merchant/products/reorder', {
        orderedIds: next.map((p) => p.id),
      });
      if (res.data.products?.length) {
        setProducts(res.data.products);
      }
    } catch (error: any) {
      setProducts(prev);
      toast.error(error.response?.data?.error || t('failedSaveProductOrder'));
    } finally {
      setReordering(false);
    }
  };

  const onReorderFiltered = (nextFiltered: Product[]) => {
    const filteredIds = new Set(nextFiltered.map((p) => p.id));
    let i = 0;
    const merged = products.map((p) => (filteredIds.has(p.id) ? nextFiltered[i++] : p));
    void persistProductOrder(merged);
  };

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((product) => {
      if (selectedCategory === '__none__' && product.categoryId) return false;
      if (selectedCategory && selectedCategory !== '__none__' && product.categoryId !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        product.name.toLowerCase().includes(q) ||
        (product.sku || '').toLowerCase().includes(q) ||
        (product.description || '').toLowerCase().includes(q) ||
        categoryName(product.categoryId).toLowerCase().includes(q)
      );
    });
  }, [products, selectedCategory, search, categories]);

  const openCreate = () => {
    if (atProductLimit) {
      toast.error(t('productLimitReached'));
      return;
    }
    setEditingId(null);
    const base = emptyForm();
    setForm({
      ...base,
      specifications: base.specifications.map((spec, i) =>
        i === 0 ? { ...spec, name: t('default') } : spec
      ),
      comboSlots: [
        emptySlot(t('comboStepMain')),
        emptySlot(t('comboStepSide')),
        emptySlot(t('comboStepDrink')),
      ],
    });
    setRecipeLines([]);
    setRecipeYield('1');
    setModalOpen(true);
  };

  const openEdit = async (product: Product) => {
    setEditingId(product.id);
    setModalOpen(true);
    try {
      const res = await api.get(`/merchant/products/${product.id}`);
      const full = res.data.product as Product;
      const specs =
        full.specifications && full.specifications.length
          ? full.specifications.map((s, i) => ({
              id: s.id || `spec-${i}`,
              name: s.name,
              price: String(s.price ?? ''),
              saleStatus: s.saleStatus === 'out_of_stock' ? 'out_of_stock' : 'in_stock',
              isDefault: !!s.isDefault,
            }))
          : [
              {
                id: 'default',
                name: t('default'),
                price: String(full.price ?? ''),
                saleStatus: 'in_stock' as const,
                isDefault: true,
              },
            ];
      const comboSlots = normalizeComboSlotsFromProduct(full.comboItems);
      if (inventoryOn) {
        try {
          const rec = await api.get(`/merchant/inventory/products/${product.id}/recipe`);
          setRecipeYield(String(rec.data.recipe?.recipeYield || 1));
          setRecipeLines(
            (rec.data.recipe?.lines || []).map((l: { itemId: string; qty: number; itemName?: string; itemUnit?: string }) => ({
              itemId: l.itemId,
              qty: String(l.qty),
              name: l.itemName,
              unit: l.itemUnit,
            }))
          );
        } catch {
          setRecipeLines([]);
          setRecipeYield('1');
        }
      } else {
        setRecipeLines([]);
        setRecipeYield('1');
      }
      setForm({
        name: full.name,
        description: full.description || '',
        price: String(full.price ?? ''),
        stock: String(full.stock ?? 0),
        sku: full.sku || '',
        barcode: full.barcode || '',
        categoryId: full.categoryId || '',
        buttonColor: full.buttonColor || '#0f172a',
        imageUrl: full.imageUrl || '',
      isOpenPrice: !!full.isOpenPrice,
      soldByWeight: !!full.soldByWeight || full.productType === 'weighed',
      weightUnit:
        full.weightUnit === 'g' || full.weightUnit === 'lb' ? full.weightUnit : 'kg',
      isCombo: full.productType === 'combo' || comboSlots.length > 0,
        comboSlots,
        specifications: specs as SpecRow[],
        modifierGroupIds: (full.modifierGroups || []).map((g) => g.id),
        loyaltyRewardPoints:
          full.loyaltyRewardPoints != null && Number(full.loyaltyRewardPoints) >= 1
            ? String(full.loyaltyRewardPoints)
            : '',
      });
    } catch {
      const comboSlots = normalizeComboSlotsFromProduct(product.comboItems);
      setForm({
        name: product.name,
        description: product.description || '',
        price: String(product.price ?? ''),
        stock: String(product.stock ?? 0),
        sku: product.sku || '',
        barcode: product.barcode || '',
        categoryId: product.categoryId || '',
        buttonColor: product.buttonColor || '#0f172a',
        imageUrl: product.imageUrl || '',
        isOpenPrice: !!product.isOpenPrice,
        soldByWeight: !!product.soldByWeight || product.productType === 'weighed',
        weightUnit:
          product.weightUnit === 'g' || product.weightUnit === 'lb'
            ? product.weightUnit
            : 'kg',
        isCombo: product.productType === 'combo' || comboSlots.length > 0,
        comboSlots,
        specifications: [
          {
            id: 'default',
            name: t('default'),
            price: String(product.price ?? ''),
            saleStatus: 'in_stock',
            isDefault: true,
          },
        ],
        modifierGroupIds: [],
        loyaltyRewardPoints:
          product.loyaltyRewardPoints != null && Number(product.loyaltyRewardPoints) >= 1
            ? String(product.loyaltyRewardPoints)
            : '',
      });
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm());
    setModifierPickerOpen(false);
    setMoreOpen(false);
    setRecipeLines([]);
    setRecipeYield('1');
  };

  const linkedModifierGroups = useMemo(
    () => allModifierGroups.filter((g) => form.modifierGroupIds.includes(g.id)),
    [allModifierGroups, form.modifierGroupIds]
  );

  const buildPayload = () => {
    const defaultSpec =
      form.specifications.find((s) => s.isDefault) || form.specifications[0];
    const price = parseMoney(defaultSpec?.price ?? form.price);
    const comboSlots = form.isCombo
      ? form.comboSlots
          .filter((s) => s.name.trim() && s.options.length > 0)
          .map((s) => ({
            id: s.id,
            name: s.name.trim(),
            minPick: Math.max(1, Number(s.minPick) || 1),
            maxPick: Math.max(1, Number(s.maxPick) || 1),
            options: s.options.map((o) => ({
              productId: o.productId,
              extraPrice: Math.max(0, parseMoney(o.extraPrice)),
            })),
          }))
      : [];
    const productType = form.isCombo
      ? 'combo'
      : form.soldByWeight
        ? 'weighed'
        : form.isOpenPrice
          ? 'open_price'
          : 'standard';
    return {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      price,
      stock: Math.max(0, Math.floor(Number(form.stock) || 0)),
      sku: form.sku.trim() || undefined,
      barcode: form.barcode.trim() || undefined,
      categoryId: form.categoryId || undefined,
      buttonColor: form.buttonColor || undefined,
      imageUrl: form.imageUrl.trim() || null,
      isOpenPrice: form.isCombo ? false : form.isOpenPrice,
      soldByWeight: form.isCombo ? false : form.soldByWeight,
      weightUnit: form.soldByWeight && !form.isCombo ? form.weightUnit : 'kg',
      productType,
      comboItems: comboSlots,
      specifications: form.specifications
        .filter((s) => s.name.trim())
        .map((s, i) => ({
          id: s.id || `spec-${i + 1}`,
          name: s.name.trim(),
          price: parseMoney(s.price),
          saleStatus: s.saleStatus,
          isDefault: !!s.isDefault,
          sortOrder: i,
        })),
      modifierGroupIds: form.modifierGroupIds,
      allowExtras: form.modifierGroupIds.length > 0,
      loyaltyRewardPoints: (() => {
        const parsed = parseFreePoints(form.loyaltyRewardPoints);
        return typeof parsed === 'number' ? parsed : null;
      })(),
    };
  };

  const formProductType: ProductTypeUi = form.isCombo
    ? 'combo'
    : form.soldByWeight
      ? 'weighed'
      : form.isOpenPrice
        ? 'open_price'
        : 'standard';

  const setProductType = (next: ProductTypeUi) => {
    setForm({
      ...form,
      isCombo: next === 'combo',
      isOpenPrice: next === 'open_price',
      soldByWeight: next === 'weighed',
      weightUnit: next === 'weighed' ? form.weightUnit || 'kg' : form.weightUnit,
      comboSlots:
        next === 'combo' && form.comboSlots.length === 0
          ? [emptySlot(t('comboStepMain')), emptySlot(t('comboStepSide')), emptySlot(t('comboStepDrink'))]
          : form.comboSlots,
    });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(t('productNameRequired'));
      return;
    }
    if (!form.categoryId) {
      toast.error(t('selectCategory'));
      return;
    }
    if (form.sku.trim().length > SKU_MAX_LEN) {
      toast.error(t('skuMaxLenError').replace('{n}', String(SKU_MAX_LEN)));
      return;
    }
    const parsedPoints = parseFreePoints(form.loyaltyRewardPoints);
    if (parsedPoints === 'too_many_digits') {
      toast.error(t('freePointsMaxDigits'));
      return;
    }
    if (parsedPoints === 'out_of_range') {
      toast.error(t('freePointsRange'));
      return;
    }
    const stockNum = Number(form.stock);
    if (!Number.isFinite(stockNum) || stockNum < 0) {
      toast.error(t('stockNegative'));
      return;
    }
    if (String(Math.floor(stockNum)).replace(/\D/g, '').length > MAX_STOCK_DIGITS) {
      toast.error(t('stockTooManyDigits').replace('{n}', String(MAX_STOCK_DIGITS)));
      return;
    }
    for (const spec of form.specifications) {
      if (moneyDigitCount(String(spec.price)) > MAX_MONEY_DIGITS) {
        toast.error(t('priceMaxDigits'));
        return;
      }
    }
    if (form.price && moneyDigitCount(form.price) > MAX_MONEY_DIGITS) {
      toast.error(t('priceMaxDigits'));
      return;
    }
    if (form.isCombo) {
      const validSlots = form.comboSlots.filter((s) => s.name.trim() && s.options.length > 0);
      if (!validSlots.length) {
        toast.error(t('comboNeedStep'));
        return;
      }
    } else if (!form.isOpenPrice) {
      const namedSizes = form.specifications.filter((s) => s.name.trim());
      if (!namedSizes.length) {
        toast.error(t('sizeNeedName'));
        return;
      }
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      let productId = editingId;
      if (editingId) {
        await api.put(`/merchant/products/${editingId}`, payload);
        toast.success(t('productUpdated'));
      } else {
        const created = await api.post('/merchant/products', payload);
        productId = created.data?.product?.id || null;
        toast.success(t('productCreated'));
      }
      if (inventoryOn && productId) {
        try {
          await api.put(`/merchant/inventory/products/${productId}/recipe`, {
            recipeYield: Number(recipeYield) || 1,
            lines: recipeLines
              .filter((l) => l.itemId && Number(l.qty) > 0)
              .map((l) => ({ itemId: l.itemId, qty: Number(l.qty) })),
          });
        } catch {
          /* recipe optional */
        }
      }
      closeModal();
      await load();
    } catch (error: any) {
      const code = error.response?.data?.code;
      if (code === 'PRODUCT_LIMIT_REACHED') {
        toast.error(error.response?.data?.error || t('productLimitReached'));
        if (error.response?.data?.productLimit) {
          setProductLimit(error.response.data.productLimit);
        }
      } else {
        toast.error(error.response?.data?.error || t('failedSaveProduct'));
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectedProducts = products.filter((p) => selectedIds.includes(p.id));

  const generateMissing = async (ids?: string[], useSku = false) => {
    try {
      const res = await api.post('/merchant/products/barcodes/generate', {
        productIds: ids?.length ? ids : undefined,
        useSku,
      });
      const generated = Number(res.data.generated) || 0;
      if (generated > 0) {
        toast.success(t('barcodeGeneratedCount').replace('{n}', String(generated)));
      } else {
        toast(t('barcodeNoneMissing'));
      }
      const updated = (res.data.products || []) as Array<{ id: string; barcode: string }>;
      if (editingId) {
        const mine = updated.find((p) => p.id === editingId);
        if (mine) setForm((prev) => ({ ...prev, barcode: mine.barcode }));
      }
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('barcodeGenerateFailed'));
    }
  };

  const importMissingPhotos = async (ids?: string[]) => {
    setImportingPhotos(true);
    try {
      const res = await api.post('/merchant/products/photos/import-missing', {
        productIds: ids?.length ? ids : undefined,
        limit: 50,
      });
      const n = Number(res.data.updated) || 0;
      if (n > 0) {
        toast.success(t('productPhotosImported').replace('{n}', String(n)));
      } else {
        toast(t('productPhotosNoneMissing'));
      }
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('productPhotosImportFailed'));
    } finally {
      setImportingPhotos(false);
    }
  };

  const openPrintFor = (list: Array<Pick<Product, 'id' | 'name' | 'barcode' | 'price' | 'sku'>>) => {
    const withCodes = list.filter((p) => String(p.barcode || '').trim());
    if (!withCodes.length) {
      toast.error(t('barcodePrintNone'));
      return;
    }
    setPrintTargets(
      withCodes.map((p) => ({
        id: p.id,
        name: p.name,
        barcode: String(p.barcode || ''),
        price: p.price,
        sku: p.sku,
      }))
    );
    setPrintOpen(true);
  };

  const runPrint = async (mode: 'agent' | 'browser') => {
    const opts = { ...normalizeLabelOptions(labelOpts), storeName: labelOpts.storeName || storeName };
    const payload = printTargets.map((p) => ({
      id: p.id,
      name: p.name,
      barcode: String(p.barcode || ''),
      price: p.price,
      sku: p.sku,
    }));
    try {
      if (mode === 'browser') {
        printLabelsHtml(payload, opts);
      } else {
        const settingsRes = await api.get('/merchant/settings').catch(() => null);
        const modeUsed = await printLabelsViaAgentOrQueue(
          payload,
          opts,
          settingsRes?.data?.settings?.posPrintSettings
        );
        toast.success(modeUsed === 'browser' ? t('barcodePrintedBrowser') : t('barcodePrinted'));
      }
      setPrintOpen(false);
    } catch (error: any) {
      toast.error(error.message || t('barcodePrintFailed'));
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm(t('deleteProductConfirm'))) return;
    try {
      await api.delete(`/merchant/products/${id}`);
      toast.success(t('deletedOk'));
      if (editingId === id) closeModal();
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('deleteFailed'));
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await api.get('/merchant/products/import/template', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chaslayreborn-catalog-template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error(t('failedDownloadTemplate'));
    }
  };

  const exportCatalog = async () => {
    try {
      const response = await api.get('/merchant/products/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chaslay-catalog-export.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(t('exportCatalogSuccess'));
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('exportCatalogFailed'));
    }
  };

  const onImportDemo = async (mode: 'replace' | 'merge') => {
    setImportingDemo(true);
    setDemoImportOpen(false);
    try {
      const response = await api.post('/merchant/products/import-demo', { mode });
      const r = response.data;
      const totalSkipped =
        (r.categoriesSkipped ?? 0) +
        (r.productsSkipped ?? 0) +
        (r.modifierGroupsSkipped ?? 0) +
        (r.combosSkipped ?? 0);
      const totalCreated =
        (r.categoriesCreated ?? 0) +
        (r.productsCreated ?? 0) +
        (r.modifierGroupsCreated ?? 0);
      if (totalSkipped > 0) {
        toast.success(
          t('importDemoSuccessSkipped')
            .replace('{created}', String(totalCreated))
            .replace('{skipped}', String(totalSkipped))
        );
      } else {
        toast.success(
          t('importDemoSuccess')
            .replace('{categories}', String(r.categoriesCreated))
            .replace('{products}', String(r.productsCreated))
            .replace('{modifiers}', String(r.modifierGroupsCreated))
            .replace('{combos}', String(r.combosCreated))
        );
      }
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('importDemoFailed'));
    } finally {
      setImportingDemo(false);
    }
  };

  const onImportDemoClick = () => {
    const catalogEmpty = products.length === 0 && categories.length === 0;
    if (catalogEmpty) {
      if (confirm(t('importDemoEmptyConfirm'))) {
        void onImportDemo('merge');
      }
      return;
    }
    setDemoImportOpen(true);
  };

  const onDeleteDemoCatalog = async () => {
    if (!confirm(t('deleteDemoProductsConfirm'))) return;
    setDeletingDemoCatalog(true);
    try {
      const res = await api.delete('/merchant/products/demo-data');
      toast.success(
        t('deleteDemoProductsSuccess').replace('{products}', String(res.data.productsDeleted ?? 0))
      );
      setHasDemoCatalog(false);
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('deleteDemoProductsFailed'));
    } finally {
      setDeletingDemoCatalog(false);
    }
  };

  const catalogEmpty = products.length === 0 && categories.length === 0;

  const onImport = async (file: File) => {
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/merchant/products/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const r = response.data;
      toast.success(
        t('importDone')
          .replace('{categories}', String(r.categoriesCreated))
          .replace('{products}', String(r.productsCreated))
          .replace('{updated}', String(r.productsUpdated))
      );
      if (r.errors?.length) toast.error(t('importRowErrors').replace('{n}', String(r.errors.length)));
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('importFailed'));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 muted text-sm">
        {t('loadingProducts')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="page-title">{t('products')}</h1>
          <p className="page-sub">
            {t('productsHint')}
          </p>
          {productLimitLabel ? (
            <p className={`text-xs mt-1 ${atProductLimit ? 'text-amber-700 font-medium' : 'muted'}`}>
              {productLimitLabel}
              {atProductLimit ? ` · ${t('productLimitUpgradeHint')}` : ''}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={importingDemo}
            onClick={onImportDemoClick}
            className="btn-secondary"
          >
            <Sparkles size={14} />
            {importingDemo ? t('importDemoLoading') : t('importDemoContent')}
          </button>
          {hasDemoCatalog ? (
            <button
              type="button"
              disabled={deletingDemoCatalog}
              onClick={() => void onDeleteDemoCatalog()}
              className="btn-secondary text-red-700"
              title={t('deleteDemoProductsHint')}
            >
              <Trash2 size={14} />
              {deletingDemoCatalog ? t('deleteDemoProductsLoading') : t('deleteDemoProducts')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void downloadTemplate()}
            className="btn-secondary"
          >
            <Download size={14} />
            {t('templateShort')}
          </button>
          <button
            type="button"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
            className="btn-secondary"
          >
            <FileSpreadsheet size={14} />
            {importing ? t('importing') : t('importExcel')}
          </button>
          <button type="button" onClick={() => void exportCatalog()} className="btn-secondary">
            <Download size={14} />
            {t('exportExcel')}
          </button>
          <button
            type="button"
            disabled={importingPhotos}
            onClick={() => void importMissingPhotos(selectedIds.length ? selectedIds : undefined)}
            className="btn-secondary"
          >
            <Package size={14} />
            {importingPhotos ? t('productPhotosImporting') : t('productPhotosImportMissing')}
          </button>
          <button
            type="button"
            onClick={() => void generateMissing(selectedIds.length ? selectedIds : undefined)}
            className="btn-secondary"
          >
            <Barcode size={14} />
            {t('barcodeGenerateMissing')}
          </button>
          <button
            type="button"
            onClick={() =>
              openPrintFor(selectedIds.length ? selectedProducts : filteredProducts)
            }
            className="btn-secondary"
          >
            <Printer size={14} />
            {t('barcodePrintLabels')}
          </button>
          <button
            type="button"
            onClick={openCreate}
            disabled={atProductLimit}
            className="btn-primary disabled:opacity-50"
            title={atProductLimit ? t('productLimitReached') : undefined}
          >
            <Plus size={14} />
            {t('addShort')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImport(file);
            }}
          />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 muted" size={14} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchProductsPlaceholder')}
          className="input pl-8"
        />
      </div>

      <section className="card">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide muted mb-2">
          {t('categories')}
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-6 gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`rounded-md border p-2 text-left transition ${
              selectedCategory === null
                ? 'border-transparent bg-[var(--accent)] text-white'
                : 'border-[var(--border)] bg-[var(--bg-muted)] hover:opacity-90'
            }`}
          >
            <div className="text-[10px] opacity-80">{t('all')}</div>
            <div className="mt-0.5 text-base font-semibold tabular-nums">{products.length}</div>
          </button>
          {categories.map((cat, idx) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-md border p-2 text-left transition ${
                selectedCategory === cat.id
                  ? 'border-transparent bg-[var(--accent)] text-white'
                  : `${CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} hover:opacity-90`
              }`}
            >
              <div className="text-[10px] opacity-80 truncate">{cat.name}</div>
              <div className="mt-0.5 text-base font-semibold tabular-nums">{categoryCounts.get(cat.id) || 0}</div>
            </button>
          ))}
          {(categoryCounts.get('__none__') || 0) > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCategory('__none__')}
              className={`rounded-md border p-2 text-left transition ${
                selectedCategory === '__none__'
                  ? 'border-transparent bg-[var(--accent)] text-white'
                  : 'border-[var(--border)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-muted)]'
              }`}
            >
              <div className="text-[10px] opacity-80">{t('uncategorized')}</div>
              <div className="mt-0.5 text-base font-semibold tabular-nums">{categoryCounts.get('__none__') || 0}</div>
            </button>
          )}
        </div>
      </section>

      <section className="space-y-2">
        {filteredProducts.length === 0 && (
          <div className="card border-dashed px-4 py-10 text-center">
            <Package className="mx-auto muted" size={28} />
            <p className="mt-2 text-sm font-semibold">{t('noProductsFound')}</p>
            <p className="text-xs muted mt-1 max-w-md mx-auto">
              {catalogEmpty ? t('importDemoEmptyHint') : t('createOrImport')}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {catalogEmpty && (
                <button
                  type="button"
                  disabled={importingDemo}
                  onClick={onImportDemoClick}
                  className="btn-primary"
                >
                  <Sparkles size={14} />
                  {importingDemo ? t('importDemoLoading') : t('importDemoContent')}
                </button>
              )}
              <button
                type="button"
                onClick={openCreate}
                className={catalogEmpty ? 'btn-secondary' : 'btn-primary'}
              >
                <Plus size={14} />
                {t('addProduct')}
              </button>
            </div>
          </div>
        )}

        <SortableContainer
          as="div"
          className="space-y-2"
          items={filteredProducts}
          onReorder={onReorderFiltered}
          disabled={reordering}
        >
          {filteredProducts.map((product) => {
          const extras = product.extras || [];
          const tiers = product.bulkPricing || [];
          const sizes = product.specifications || [];
          const expanded = expandedProduct === product.id;
          const stockOk = product.stock > 20;

          return (
            <SortableRow
              key={product.id}
              id={product.id}
              as="div"
              className="overflow-hidden card !p-0"
              disabled={reordering}
            >
              {({ attributes, listeners }) => (
              <>
              <div className="flex items-stretch gap-2 p-3">
                <div className="flex items-center shrink-0">
                  <input
                    type="checkbox"
                    className="mr-1"
                    checked={selectedIds.includes(product.id)}
                    onChange={() => toggleSelected(product.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <DragHandle attributes={attributes} listeners={listeners} />
                </div>
                <button
                  type="button"
                  className="flex flex-1 items-center gap-4 text-left min-w-0"
                  onClick={() => setExpandedProduct(expanded ? null : product.id)}
                >
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 overflow-hidden">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package size={22} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold text-lg text-slate-900">{product.name}</h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        {productTypeLabel(product)}
                      </span>
                      {product.loyaltyRewardPoints != null &&
                        Number(product.loyaltyRewardPoints) >= 1 && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                            {t('ptsFreeBadge').replace('{n}', String(product.loyaltyRewardPoints))}
                          </span>
                        )}
                    </div>
                    {product.description && (
                      <p className="mt-0.5 text-sm text-slate-500 line-clamp-1">{product.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <button
                        type="button"
                        className="font-semibold text-emerald-700 hover:underline disabled:no-underline"
                        disabled={!product.barcode}
                        title={product.barcode ? t('barcodePrintLabels') : undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (product.barcode) openPrintFor([product]);
                        }}
                      >
                        {money(product.price)}
                      </button>
                      {product.barcode ? (
                        <button
                          type="button"
                          className="inline-flex items-center rounded hover:opacity-80"
                          title={t('barcodePrintLabels')}
                          onClick={(e) => {
                            e.stopPropagation();
                            openPrintFor([product]);
                          }}
                        >
                          <BarcodePreview
                            value={String(product.barcode)}
                            height={18}
                            width={90}
                            className="inline-flex items-center text-slate-600"
                          />
                        </button>
                      ) : null}
                      <span className="text-slate-500">{t('skuColon').replace('{sku}', product.sku || '-')}</span>
                      <span className={stockOk ? 'text-emerald-600' : 'text-amber-600'}>
                        {t('stockColon').replace('{n}', String(product.stock))}
                      </span>
                      <span className="text-slate-500">{categoryName(product.categoryId)}</span>
                      {(extras.length > 0 || tiers.length > 0) && (
                        <span className="text-slate-400">
                          {tiers.length ? t('tiersCount').replace('{n}', String(tiers.length)) : ''}
                          {tiers.length && extras.length ? ' · ' : ''}
                          {extras.length ? t('extrasCount').replace('{n}', String(extras.length)) : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="hidden sm:inline text-slate-400">
                    {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </span>
                </button>

                <div className="flex items-center gap-1">
                  {product.barcode ? (
                    <button
                      type="button"
                      onClick={() => openPrintFor([product])}
                      className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                      title={t('barcodePrintLabels')}
                    >
                      <Printer size={18} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void openEdit(product)}
                    className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                    title={t('edit')}
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(product.id)}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                    title={t('delete')}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="border-t border-[var(--border)] bg-[var(--bg-muted)] p-3 space-y-3">
                  {sizes.length > 0 && (
                    <div>
                      <h4 className="mb-1.5 text-xs font-semibold">{t('sizes')}</h4>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {sizes.map((size, idx) => (
                          <div
                            key={size.id || `${product.id}-size-${idx}`}
                            className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs"
                          >
                            <span>
                              {size.name || t('sizeFallback')}
                              {size.isDefault ? t('sizeDefaultSuffix') : ''}
                            </span>
                            <span className="font-semibold">{money(size.price)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {tiers.length > 0 && (
                    <div>
                      <h4 className="mb-1.5 text-xs font-semibold">{t('bulkPricing')}</h4>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {tiers.map((tier, idx) => (
                          <div
                            key={`${product.id}-tier-${idx}`}
                            className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs"
                          >
                            <span>{t('fromUnits').replace('{n}', String(tier.minQty))}</span>
                            <span className="font-semibold">{money(tier.price)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {extras.length > 0 && (
                    <div>
                      <h4 className="mb-1.5 text-xs font-semibold">{t('addOns')}</h4>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {extras.map((extra) => (
                          <div
                            key={extra.id}
                            className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs"
                          >
                            <span>{extra.name}</span>
                            <span className="font-semibold">+{money(extra.price)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!sizes.length && !tiers.length && !extras.length && (
                    <p className="text-xs muted">{t('noSizeExtraBulk')}</p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 text-sm">
                    <InfoCard label={t('category')} value={categoryName(product.categoryId)} />
                    <InfoCard label={t('type')} value={productTypeLabel(product)} />
                    <InfoCard label={t('productCode')} value={product.sku || '-'} />
                    <InfoCard
                      label={t('stock')}
                      value={t('stockUnits').replace('{n}', String(product.stock))}
                    />
                    <InfoCard label={t('barcode')} value={product.barcode || '-'} />
                  </div>
                </div>
              )}
              </>
              )}
            </SortableRow>
          );
        })}
        </SortableContainer>
      </section>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-3"
          onClick={closeModal}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeModal();
          }}
          role="presentation"
        >
          <div
            className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-lg sm:rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3">
              <h2 className="text-base font-semibold">
                {editingId ? t('editProduct') : t('addProduct')}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md muted hover:bg-[var(--bg-muted)]"
                aria-label={t('close')}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={onSubmit} noValidate className="space-y-3 px-4 py-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label={`${t('productName')} *`}>
                  <input
                    className="field-input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </Field>
                <Field label={`${t('category')} *`}>
                  <select
                    className="field-input"
                    value={form.categoryId}
                    required
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  >
                    <option value="">{t('selectCategory')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('type')}>
                  <select
                    className="field-input"
                    value={formProductType}
                    onChange={(e) => setProductType(e.target.value as ProductTypeUi)}
                  >
                    <option value="standard">{t('productTypeStandard')}</option>
                    <option value="combo">{t('comboMeal')}</option>
                    <option value="open_price">{t('openPriceItem')}</option>
                    <option value="weighed">{t('weighingProduct')}</option>
                  </select>
                </Field>
              </div>

              <Field label={t('description')}>
                <textarea
                  className="field-input min-h-[64px]"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>

              <Field label={t('productPhoto')}>
                <div className="flex flex-wrap items-center gap-3">
                  {form.imageUrl ? (
                    <img
                      src={form.imageUrl}
                      alt=""
                      className="h-16 w-16 rounded-md object-cover border border-[var(--border)]"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-[var(--border)] text-xs muted">
                      -
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      disabled={imageUploading}
                      onClick={() => imageFileRef.current?.click()}
                    >
                      {imageUploading
                        ? t('uploading')
                        : form.imageUrl
                          ? t('replacePhoto')
                          : t('uploadPhoto')}
                    </button>
                    {form.imageUrl ? (
                      <button
                        type="button"
                        className="btn-secondary text-sm"
                        onClick={() => setForm({ ...form, imageUrl: '' })}
                      >
                        {t('remove')}
                      </button>
                    ) : null}
                  </div>
                  <input
                    ref={imageFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void onUploadProductImage(e.target.files?.[0] || null)}
                  />
                </div>
                <p className="mt-1 text-xs muted">{t('photoHint')}</p>
              </Field>

              {form.isCombo && (
                <div className="rounded-md border border-[var(--border)] p-3 space-y-3">
                  <Field label={t('salePriceCombo')}>
                    <div className="flex max-w-xs min-w-0 items-stretch overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20">
                      <input
                        className="field-input money-input min-w-0 flex-1 border-0 !shadow-none focus:!ring-0"
                        type="text"
                        inputMode="decimal"
                        value={form.price}
                        onChange={(e) => {
                          const price = normalizeMoneyInput(e.target.value);
                          if (moneyDigitCount(price) > MAX_MONEY_DIGITS) return;
                          setForm({
                            ...form,
                            price,
                            specifications: form.specifications.map((s, i) =>
                              i === 0 || s.isDefault ? { ...s, price } : s
                            ),
                          });
                        }}
                      />
                      <span className="inline-flex shrink-0 items-center border-l border-[var(--border)] bg-[var(--bg-muted)] px-2 text-[10px] font-semibold muted">
                        CHF
                      </span>
                    </div>
                  </Field>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">{t('comboSteps')}</h3>
                      <p className="text-[11px] muted mt-0.5">{t('comboStepsHint')}</p>
                    </div>
                    <button
                      type="button"
                      className="btn-primary !py-1 !text-xs"
                      onClick={() =>
                        setForm({
                          ...form,
                          comboSlots: [
                            ...form.comboSlots,
                            emptySlot(t('choiceN').replace('{n}', String(form.comboSlots.length + 1))),
                          ],
                        })
                      }
                    >
                      <Plus size={14} /> {t('addStep')}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {form.comboSlots.map((slot, slotIdx) => (
                      <div key={slot.id} className="rounded-md border border-[var(--border)] p-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold muted w-14 shrink-0">
                            #{slotIdx + 1}
                          </span>
                          <input
                            className="field-input"
                            placeholder={t('stepName')}
                            value={slot.name}
                            onChange={(e) => {
                              const next = [...form.comboSlots];
                              next[slotIdx] = { ...next[slotIdx], name: e.target.value };
                              setForm({ ...form, comboSlots: next });
                            }}
                          />
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-[var(--danger)] hover:bg-[var(--bg-muted)]"
                            onClick={() =>
                              setForm({
                                ...form,
                                comboSlots: form.comboSlots.filter((_, i) => i !== slotIdx),
                              })
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          {slot.options.map((opt, optIdx) => {
                            const prod = products.find((p) => p.id === opt.productId);
                            return (
                              <div
                                key={`${slot.id}-${opt.productId}-${optIdx}`}
                                className="grid grid-cols-[1fr_5.5rem_auto] gap-1.5 items-center"
                              >
                                <div className="text-sm truncate px-2 py-1.5 rounded-md bg-[var(--bg-muted)]">
                                  {prod?.name || opt.productId}
                                </div>
                                <div className="relative">
                                  <input
                                    className="field-input money-input pr-8"
                                    type="text"
                                    inputMode="decimal"
                                    title={t('extraPrice')}
                                    value={opt.extraPrice}
                                    onChange={(e) => {
                                      const raw = normalizeMoneyInput(e.target.value);
                                      if (moneyDigitCount(raw) > MAX_MONEY_DIGITS) return;
                                      const next = [...form.comboSlots];
                                      const options = [...next[slotIdx].options];
                                      options[optIdx] = {
                                        ...options[optIdx],
                                        extraPrice: raw,
                                      };
                                      next[slotIdx] = { ...next[slotIdx], options };
                                      setForm({ ...form, comboSlots: next });
                                    }}
                                  />
                                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] muted">
                                    +
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className="rounded-md p-1.5 text-[var(--danger)] hover:bg-[var(--bg-muted)]"
                                  onClick={() => {
                                    const next = [...form.comboSlots];
                                    next[slotIdx] = {
                                      ...next[slotIdx],
                                      options: next[slotIdx].options.filter((_, i) => i !== optIdx),
                                    };
                                    setForm({ ...form, comboSlots: next });
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        <select
                          className="field-input text-sm"
                          value=""
                          onChange={(e) => {
                            const productId = e.target.value;
                            if (!productId) return;
                            if (slot.options.some((o) => o.productId === productId)) return;
                            const next = [...form.comboSlots];
                            next[slotIdx] = {
                              ...next[slotIdx],
                              options: [...next[slotIdx].options, { productId, extraPrice: '0' }],
                            };
                            setForm({ ...form, comboSlots: next });
                          }}
                        >
                          <option value="">{t('addProductToStep')}</option>
                          {products
                            .filter(
                              (p) =>
                                p.id !== editingId &&
                                p.productType !== 'combo' &&
                                !slot.options.some((o) => o.productId === p.id)
                            )
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} · {money(p.price)}
                              </option>
                            ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!form.isCombo && (
              <div className="rounded-md border border-[var(--border)] p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">{t('sizes')}</h3>
                    <p className="text-[11px] muted">{t('sizesHint')}</p>
                  </div>
                  <button
                    type="button"
                    className="btn-primary !py-1 !text-xs"
                    onClick={() =>
                      setForm({
                        ...form,
                        specifications: [
                          ...form.specifications,
                          {
                            id: `size-${Date.now()}`,
                            name: '',
                            price: form.price,
                            saleStatus: 'in_stock',
                            isDefault: false,
                          },
                        ],
                      })
                    }
                  >
                    <Plus size={14} /> {t('addSizeShort')}
                  </button>
                </div>
                <div className="space-y-2">
                  {form.specifications.map((spec, idx) => (
                    <div
                      key={spec.id || idx}
                      className="grid grid-cols-1 sm:grid-cols-[1fr_minmax(8.5rem,9.5rem)_7rem_auto_auto] gap-1.5 items-center"
                    >
                      <input
                        className="field-input"
                        placeholder={t('sizeName')}
                        value={spec.name}
                        onChange={(e) => {
                          const next = [...form.specifications];
                          next[idx] = { ...next[idx], name: e.target.value };
                          setForm({ ...form, specifications: next });
                        }}
                      />
                      <div className="flex min-w-0 items-stretch overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20">
                        <input
                          className="field-input money-input min-w-0 flex-1 border-0 !shadow-none focus:!ring-0"
                          type="text"
                          inputMode="decimal"
                          value={spec.price}
                          onChange={(e) => {
                            const normalized = normalizeMoneyInput(e.target.value);
                            if (moneyDigitCount(normalized) > MAX_MONEY_DIGITS) return;
                            const next = [...form.specifications];
                            next[idx] = { ...next[idx], price: normalized };
                            setForm({ ...form, specifications: next, price: normalized });
                          }}
                        />
                        <span className="inline-flex shrink-0 items-center border-l border-[var(--border)] bg-[var(--bg-muted)] px-2 text-[10px] font-semibold muted">
                          {form.soldByWeight ? 'CHF/kg' : 'CHF'}
                        </span>
                      </div>
                      <select
                        className="field-input"
                        value={spec.saleStatus}
                        onChange={(e) => {
                          const next = [...form.specifications];
                          next[idx] = {
                            ...next[idx],
                            saleStatus: e.target.value as SpecRow['saleStatus'],
                          };
                          setForm({ ...form, specifications: next });
                        }}
                      >
                        <option value="in_stock">{t('inStock')}</option>
                        <option value="out_of_stock">{t('outOfStock')}</option>
                      </select>
                      <label className="inline-flex items-center gap-1 text-[11px] muted">
                        <input
                          type="radio"
                          name="defaultSpec"
                          checked={spec.isDefault}
                          onChange={() =>
                            setForm({
                              ...form,
                              specifications: form.specifications.map((s, i) => ({
                                ...s,
                                isDefault: i === idx,
                              })),
                              price: spec.price,
                            })
                          }
                        />
                        {t('default')}
                      </label>
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-[var(--danger)] hover:bg-[var(--bg-muted)] justify-self-start sm:justify-self-auto"
                        onClick={() => {
                          const remaining = form.specifications.filter((_, i) => i !== idx);
                          if (!remaining.length) {
                            // Allow removing the last size row (esp. open-price); keep a blank default for standard.
                            setForm({
                              ...form,
                              specifications: form.isOpenPrice
                                ? []
                                : [
                                    {
                                      id: `size-${Date.now()}`,
                                      name: '',
                                      price: form.price,
                                      saleStatus: 'in_stock',
                                      isDefault: true,
                                    },
                                  ],
                            });
                            return;
                          }
                          if (!remaining.some((s) => s.isDefault)) {
                            remaining[0] = { ...remaining[0], isDefault: true };
                          }
                          setForm({ ...form, specifications: remaining });
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              )}

              <button
                type="button"
                onClick={() => setMoreOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2.5 text-left transition hover:opacity-90"
                aria-expanded={moreOpen}
              >
                <span>
                  <span className="block text-sm font-semibold">{t('productMoreSection')}</span>
                  {!moreOpen ? (
                    <span className="mt-0.5 block text-[11px] muted">{t('productMoreSectionHint')}</span>
                  ) : null}
                </span>
                {moreOpen ? <ChevronUp size={18} className="shrink-0 muted" /> : <ChevronDown size={18} className="shrink-0 muted" />}
              </button>

              {moreOpen && (
                <div className="space-y-3 rounded-md border border-[var(--border)] p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label={t('productCode')}>
                      <input
                        className="field-input"
                        placeholder={t('skuPlaceholder')}
                        value={form.sku}
                        maxLength={SKU_MAX_LEN}
                        onChange={(e) =>
                          setForm({ ...form, sku: e.target.value.slice(0, SKU_MAX_LEN) })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.preventDefault();
                        }}
                      />
                      <p className="mt-1 text-xs muted">
                        {t('maxCharacters').replace('{n}', String(SKU_MAX_LEN))}
                      </p>
                    </Field>
                    <Field label={t('barcode')}>
                      <input
                        className="field-input"
                        placeholder={t('barcodePlaceholder')}
                        value={form.barcode}
                        maxLength={SKU_MAX_LEN}
                        onChange={(e) =>
                          setForm({ ...form, barcode: e.target.value.slice(0, SKU_MAX_LEN) })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.preventDefault();
                        }}
                      />
                      {form.barcode ? (
                        <BarcodePreview
                          value={form.barcode}
                          height={36}
                          width={160}
                          className="mt-2 flex justify-center"
                        />
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {editingId && !form.barcode.trim() && (
                          <button
                            type="button"
                            className="btn-secondary text-xs"
                            onClick={() => void generateMissing([editingId])}
                          >
                            {t('barcodeGenerateMissing')}
                          </button>
                        )}
                        {form.barcode.trim() && (
                          <button
                            type="button"
                            className="btn-secondary text-xs"
                            onClick={() =>
                              openPrintFor([
                                {
                                  id: editingId || 'draft',
                                  name: form.name,
                                  barcode: form.barcode,
                                  price: form.price,
                                  sku: form.sku,
                                },
                              ])
                            }
                          >
                            {t('barcodePrintLabels')}
                          </button>
                        )}
                      </div>
                    </Field>
                    <Field label={t('stock')}>
                      <input
                        className="field-input"
                        type="number"
                        min={0}
                        step={1}
                        value={form.stock}
                        onChange={(e) =>
                          setForm({ ...form, stock: clampNonNegativeInt(e.target.value, MAX_STOCK_DIGITS) })
                        }
                      />
                    </Field>
                    {form.soldByWeight && !form.isCombo ? (
                      <Field label={t('webPosWeightUnit')}>
                        <select
                          className="field-input"
                          value={form.weightUnit}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              weightUnit: e.target.value as FormState['weightUnit'],
                            })
                          }
                        >
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="lb">lb</option>
                        </select>
                        <p className="mt-1 text-xs muted">{t('webPosWeighedPriceHint')}</p>
                      </Field>
                    ) : null}
                  </div>

                  <Field label={t('freeWithPoints')}>
                    <input
                      className="field-input"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder={t('freeWithPointsPlaceholder')}
                      value={form.loyaltyRewardPoints}
                      onChange={(e) => {
                        setForm({ ...form, loyaltyRewardPoints: sanitizeFreePointsInput(e.target.value) });
                      }}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      {t('freeWithPointsHint').replace('{max}', MAX_POINTS.toLocaleString('en-US'))}
                    </p>
                    {form.loyaltyRewardPoints &&
                    parseFreePoints(form.loyaltyRewardPoints) === 'out_of_range' ? (
                      <p className="mt-1 text-xs font-medium text-rose-600">
                        {t('freeWithPointsRangeError').replace(
                          '{max}',
                          MAX_POINTS.toLocaleString('en-US')
                        )}
                      </p>
                    ) : null}
                  </Field>

                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide muted">
                      {t('buttonColor')}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {BUTTON_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setForm({ ...form, buttonColor: color })}
                          className={`h-6 w-6 rounded-full border ${
                            form.buttonColor === color ? 'border-[var(--text)] ring-1 ring-[var(--text)]' : 'border-[var(--border)]'
                          }`}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                      <input
                        className="field-input w-24"
                        value={form.buttonColor}
                        onChange={(e) => setForm({ ...form, buttonColor: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="rounded-md border border-[var(--border)] p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold">
                          {form.isCombo ? t('comboExtrasOptional') : t('modifiersAddons')}
                        </h3>
                        <p className="text-[11px] muted mt-0.5">
                          {form.isCombo ? t('comboExtrasHint') : t('modifiersHint')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModifierPickerOpen(true)}
                        className="btn-primary !py-1 !text-xs"
                      >
                        <Plus size={14} /> {t('addShort')}
                      </button>
                    </div>
                    <div className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
                      {linkedModifierGroups.length === 0 && (
                        <p className="px-3 py-4 text-center text-xs muted">
                          {t('noModifiersLinked')}
                        </p>
                      )}
                      {linkedModifierGroups.map((g) => (
                        <div key={g.id} className="flex items-center justify-between px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{g.title}</p>
                            <p className="text-[11px] muted truncate">
                              {(g.options || []).map((o) => o.name).join(' · ') || t('noOptions')}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-[var(--danger)] hover:bg-[var(--bg-muted)]"
                            onClick={() =>
                              setForm({
                                ...form,
                                modifierGroupIds: form.modifierGroupIds.filter((id) => id !== g.id),
                              })
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {inventoryOn && (
                <div className="space-y-2 rounded-md border border-[var(--border)] p-3">
                  <p className="text-sm font-semibold">{t('invRecipeTab')}</p>
                  <p className="text-xs muted">{t('invRecipeHint')}</p>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">{t('invRecipeYield')}</span>
                    <input
                      className="field-input"
                      type="number"
                      min={0.0001}
                      step="any"
                      value={recipeYield}
                      onChange={(e) => setRecipeYield(e.target.value)}
                    />
                    <span className="text-[11px] muted">{t('invRecipeYieldHint')}</span>
                  </label>
                  {recipeLines.map((line, idx) => (
                    <div key={`${line.itemId}-${idx}`} className="grid grid-cols-[1fr_90px_auto] gap-2">
                      <select
                        className="field-input"
                        value={line.itemId}
                        onChange={(e) => {
                          const next = [...recipeLines];
                          const found = invItems.find((i) => i.id === e.target.value);
                          next[idx] = {
                            ...line,
                            itemId: e.target.value,
                            unit: found?.unit,
                            name: found?.name,
                          };
                          setRecipeLines(next);
                        }}
                      >
                        <option value="">{t('invSelectItem')}</option>
                        {invItems.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.unit})
                          </option>
                        ))}
                      </select>
                      <input
                        className="field-input"
                        type="number"
                        min={0}
                        step="any"
                        value={line.qty}
                        onChange={(e) => {
                          const next = [...recipeLines];
                          next[idx] = { ...line, qty: e.target.value };
                          setRecipeLines(next);
                        }}
                      />
                      <button
                        type="button"
                        className="rounded-md p-2 text-red-600"
                        onClick={() => setRecipeLines(recipeLines.filter((_, i) => i !== idx))}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => {
                      setRecipeLines([...recipeLines, { itemId: '', qty: '' }]);
                    }}
                  >
                    <Plus size={12} /> {t('invAddIngredient')}
                  </button>
                </div>
              )}

              <div className="flex gap-2 pt-1 sticky bottom-0 bg-[var(--bg-elevated)] pb-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-secondary flex-1"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  {saving ? t('saving') : editingId ? t('save') : t('createProduct')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {printOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-3" onClick={() => setPrintOpen(false)}>
          <div
            className="w-full max-w-lg rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold">{t('barcodePrintLabels')}</h2>
            <p className="text-xs muted">{t('barcodePrintHint')}</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={labelOpts.showStoreName !== false}
                onChange={(e) => setLabelOpts({ ...labelOpts, showStoreName: e.target.checked })}
              />
              {t('barcodeShowStore')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={labelOpts.showProductName !== false}
                onChange={(e) => setLabelOpts({ ...labelOpts, showProductName: e.target.checked })}
              />
              {t('barcodeShowName')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={labelOpts.showBarcodeNumber !== false}
                onChange={(e) => setLabelOpts({ ...labelOpts, showBarcodeNumber: e.target.checked })}
              />
              {t('barcodeShowNumber')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={labelOpts.showPrice === true}
                onChange={(e) => setLabelOpts({ ...labelOpts, showPrice: e.target.checked })}
              />
              {t('barcodeShowPrice')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={labelOpts.showSku === true}
                onChange={(e) => setLabelOpts({ ...labelOpts, showSku: e.target.checked })}
              />
              {t('barcodeShowSku')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <select
                className="input"
                value={labelOpts.widthMm || 40}
                onChange={(e) =>
                  setLabelOpts({ ...labelOpts, widthMm: Number(e.target.value) as LabelWidthMm })
                }
              >
                <option value={40}>40 mm</option>
                <option value={58}>58 mm</option>
              </select>
              <select
                className="input"
                value={labelOpts.heightMm || 20}
                onChange={(e) =>
                  setLabelOpts({ ...labelOpts, heightMm: Number(e.target.value) as LabelHeightMm })
                }
              >
                <option value={20}>20 mm</option>
                <option value={25}>25 mm</option>
                <option value={30}>30 mm</option>
                <option value={40}>40 mm</option>
              </select>
              <input
                className="input"
                type="number"
                min={1}
                max={20}
                value={labelOpts.copies || 1}
                onChange={(e) => setLabelOpts({ ...labelOpts, copies: Number(e.target.value) || 1 })}
              />
            </div>
            {printTargets[0]?.barcode && (
              <div className="rounded-md border border-[var(--border)] p-3 text-center">
                {labelOpts.showStoreName !== false && (labelOpts.storeName || storeName) ? (
                  <div className="text-[11px] font-bold">{labelOpts.storeName || storeName}</div>
                ) : null}
                {labelOpts.showProductName !== false && printTargets[0].name ? (
                  <div className="text-sm font-semibold">{printTargets[0].name}</div>
                ) : null}
                {labelMetaLine(printTargets[0], labelOpts) ? (
                  <div className="text-xs text-slate-600">{labelMetaLine(printTargets[0], labelOpts)}</div>
                ) : null}
                <BarcodePreview
                  value={String(printTargets[0].barcode)}
                  height={36}
                  width={160}
                  className="mt-1 flex justify-center"
                />
                {labelOpts.showBarcodeNumber !== false ? (
                  <div className="text-xs font-mono">{printTargets[0].barcode}</div>
                ) : null}
              </div>
            )}
            <p className="text-xs muted">
              {t('barcodePrintCount').replace('{n}', String(printTargets.length))}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={() => void runPrint('agent')}>
                {t('barcodePrintThermal')}
              </button>
              <button type="button" className="btn-secondary" onClick={() => void runPrint('browser')}>
                {t('barcodePrintBrowser')}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setPrintOpen(false)}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {demoImportOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          onClick={() => setDemoImportOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-t-lg sm:rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-import-title"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <h3 id="demo-import-title" className="text-sm font-semibold">
                {t('importDemoDialogTitle')}
              </h3>
              <button
                type="button"
                onClick={() => setDemoImportOpen(false)}
                className="rounded-md p-1.5 hover:bg-[var(--bg-muted)]"
                aria-label={t('close')}
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 px-4 py-4">
              <p className="text-sm muted">{t('importDemoDialogBody')}</p>
              <button
                type="button"
                disabled={importingDemo}
                onClick={() => void onImportDemo('replace')}
                className="w-full rounded-md border border-red-200 bg-red-50 px-3 py-3 text-left transition hover:bg-red-100"
              >
                <span className="block text-sm font-semibold text-red-900">
                  {t('importDemoReplaceOption')}
                </span>
                <span className="mt-1 block text-xs text-red-800/90">
                  {t('importDemoReplaceWarning')}
                </span>
              </button>
              <button
                type="button"
                disabled={importingDemo}
                onClick={() => void onImportDemo('merge')}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-3 text-left transition hover:opacity-90"
              >
                <span className="block text-sm font-semibold">{t('importDemoMergeOption')}</span>
                <span className="mt-1 block text-xs muted">{t('importDemoMergeHint')}</span>
              </button>
            </div>
            <div className="flex justify-end border-t border-[var(--border)] px-4 py-3">
              <button
                type="button"
                onClick={() => setDemoImportOpen(false)}
                className="btn-secondary"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {modifierPickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="w-full max-w-lg rounded-t-lg sm:rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <h3 className="text-sm font-semibold">{t('addModifiers')}</h3>
              <button
                type="button"
                onClick={() => setModifierPickerOpen(false)}
                className="rounded-md p-1.5 hover:bg-[var(--bg-muted)]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border)]">
              {allModifierGroups.filter((g) => !form.modifierGroupIds.includes(g.id)).length === 0 && (
                <p className="p-6 text-center text-xs muted">
                  {t('noMoreModifierGroups')}
                </p>
              )}
              {allModifierGroups
                .filter((g) => !form.modifierGroupIds.includes(g.id))
                .map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-[var(--bg-muted)]"
                    onClick={() =>
                      setForm({
                        ...form,
                        modifierGroupIds: [...form.modifierGroupIds, g.id],
                      })
                    }
                  >
                    <span>
                      <span className="block text-sm font-medium">{g.title}</span>
                      <span className="text-[11px] muted">
                        {t('modifierGroupMeta')
                          .replace(
                            '{type}',
                            g.selectionType === 'required' ? t('required') : t('optional')
                          )
                          .replace('{n}', String((g.options || []).length))}
                      </span>
                    </span>
                    <Plus size={14} className="muted" />
                  </button>
                ))}
            </div>
            <div className="flex justify-end border-t border-[var(--border)] px-4 py-3">
              <button
                type="button"
                onClick={() => setModifierPickerOpen(false)}
                className="btn-primary"
              >
                {t('done')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .field-input {
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid var(--border);
          padding: 0.4rem 0.625rem;
          font-size: 0.8125rem;
          background: var(--bg-elevated);
          color: var(--text);
        }
        .field-input:focus {
          outline: none;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--ring) 40%, transparent);
          border-color: var(--ring);
        }
        .money-input {
          -moz-appearance: textfield;
        }
        .money-input::-webkit-outer-spin-button,
        .money-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide muted">{label}</span>
      {children}
    </label>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-2">
      <p className="text-[11px] muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold truncate">{value}</p>
    </div>
  );
}
