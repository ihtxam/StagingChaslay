import { FormEvent, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { DEFAULT_CATALOG_VISIBILITY } from '@/lib/catalog-visibility';
import { sanitizeBarcodeFieldValue } from '@/lib/product-scan-codes';
import { BARCODE_FIELD_INPUT_CLASS } from '@/lib/barcode-wedge';
import { parseMoney } from '@/lib/money';
import { useI18n } from '@/lib/i18n';
import WebPosKeypadModalShell from './WebPosKeypadModalShell';

export type ScanCreateCategory = { id: string; name: string };

type Props = {
  open: boolean;
  barcode: string;
  categories: ScanCreateCategory[];
  defaultCategoryId?: string | null;
  onClose: () => void;
  onCreated: (product: Record<string, unknown>) => void;
};

export default function WebPosScanCreateProductModal({
  open,
  barcode,
  categories,
  defaultCategoryId,
  onClose,
  onCreated,
}: Props) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [buyingPrice, setBuyingPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [expiryDate, setExpiryDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [saving, setSaving] = useState(false);

  const categoryOptions = useMemo(
    () => categories.filter((c) => c.id && c.name),
    [categories]
  );

  useEffect(() => {
    if (!open) return;
    setName('');
    setSalePrice('');
    setBuyingPrice('');
    setStock('1');
    setExpiryDate('');
    const fallback =
      (defaultCategoryId && categoryOptions.some((c) => c.id === defaultCategoryId)
        ? defaultCategoryId
        : categoryOptions[0]?.id) || '';
    setCategoryId(fallback);
  }, [open, barcode, defaultCategoryId, categoryOptions]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error(t('productNameRequired'));
      return;
    }
    if (!categoryId) {
      toast.error(t('webPosScanCreateProductCategoryRequired'));
      return;
    }
    const price = parseMoney(salePrice);
    if (!Number.isFinite(price) || price < 0) {
      toast.error(t('webPosScanCreateProductPriceRequired'));
      return;
    }
    const costRaw = buyingPrice.trim();
    const cost = costRaw ? parseMoney(costRaw) : null;
    if (costRaw && (!Number.isFinite(cost) || cost < 0)) {
      toast.error(t('webPosScanCreateProductCostInvalid'));
      return;
    }
    const stockNum = Math.floor(Number(stock));
    if (!Number.isFinite(stockNum) || stockNum < 0) {
      toast.error(t('webPosScanCreateProductStockInvalid'));
      return;
    }
    const normalizedBarcode = sanitizeBarcodeFieldValue(barcode) || barcode.trim();
    setSaving(true);
    try {
      const res = await api.post('/merchant/products', {
        name: trimmedName,
        price,
        categoryId,
        barcode: normalizedBarcode || undefined,
        cost,
        stock: stockNum,
        isTaxable: true,
        visibility: DEFAULT_CATALOG_VISIBILITY,
        productType: 'retail',
      });
      const product = res.data?.product ?? res.data;
      if (!product?.id) {
        throw new Error(t('webPosScanCreateProductFailed'));
      }
      const expiryRaw = expiryDate.trim();
      if (expiryRaw && stockNum > 0 && normalizedBarcode) {
        try {
          const itemsRes = await api.get('/merchant/inventory/items');
          const items: { id: string; barcode?: string | null }[] = itemsRes.data?.items ?? [];
          const match = items.find(
            (item) => String(item.barcode || '').trim() === normalizedBarcode
          );
          let itemId = match?.id;
          if (!itemId) {
            const itemRes = await api.post('/merchant/inventory/items', {
              name: trimmedName,
              barcode: normalizedBarcode,
              perishable: true,
              onHand: 0,
            });
            itemId = itemRes.data?.item?.id;
          }
          if (itemId) {
            await api.post(`/merchant/inventory/items/${itemId}/stock-in`, {
              qty: stockNum,
              expiryDate: expiryRaw,
            });
          }
        } catch {
          toast.error(t('webPosScanCreateProductExpiryFailed'));
        }
      }
      toast.success(t('webPosScanCreateProductCreated'));
      onCreated(product as Record<string, unknown>);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err instanceof Error ? err.message : t('webPosScanCreateProductFailed'));
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <WebPosKeypadModalShell
      open={open}
      onClose={onClose}
      title={t('webPosScanCreateProductTitle')}
      subtitle={t('webPosScanCreateProductHint').replace('{code}', barcode)}
      zIndexClass="z-[85]"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 dark:border-stone-600 dark:text-stone-200"
            onClick={onClose}
            disabled={saving}
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            form="webpos-scan-create-product"
            className="flex-1 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            disabled={saving}
          >
            {saving ? t('saving') : t('createProduct')}
          </button>
        </div>
      }
    >
      <form id="webpos-scan-create-product" className="space-y-3 px-5 py-4" onSubmit={submit}>
        <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
          {t('barcode')}
          <input
            type="text"
            readOnly
            className={`${BARCODE_FIELD_INPUT_CLASS} mt-1 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900`}
            value={barcode}
          />
        </label>
        <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
          {t('productName')}
          <input
            type="text"
            autoFocus
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('productName')}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
            {t('salePrice')}
            <input
              type="text"
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
            {t('productBuyingPrice')}
            <input
              type="text"
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900"
              value={buyingPrice}
              onChange={(e) => setBuyingPrice(e.target.value)}
            />
          </label>
        </div>
        <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
          {t('categories')}
          <select
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categoryOptions.length === 0 ? (
              <option value="">{t('webPosScanCreateProductNoCategories')}</option>
            ) : (
              categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
          {t('stock')}
          <input
            type="text"
            inputMode="numeric"
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900"
            value={stock}
            onChange={(e) => setStock(e.target.value.replace(/[^\d]/g, ''))}
          />
        </label>
        <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
          {t('storekeeperExpiry')}
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
        </label>
      </form>
    </WebPosKeypadModalShell>
  );
}
