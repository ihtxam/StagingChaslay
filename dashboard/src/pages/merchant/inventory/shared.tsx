import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { isInventoryLicensed } from '@/lib/inventory-addon';
import { useI18n } from '@/lib/i18n';

export type Supplier = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  notes?: string | null;
  archivedAt?: string | null;
  lastOrderEmailAt?: string | null;
  linkedItemCount?: number;
};

export type InvItem = {
  id: string;
  name: string;
  unit: string;
  cost: number;
  onHand: number;
  minStock: number;
  reorderQty: number;
  supplierId?: string | null;
  categoryId?: string | null;
  perishable: boolean;
  autoReorderEnabled: boolean;
  lowStock: boolean;
  outOfStock?: boolean;
  supplier?: { id: string; name: string; email?: string | null } | null;
  category?: { id: string; name: string } | null;
};

export type StockCategory = { id: string; name: string };
export type InvUnit = { id: string; code: string; name: string };
export type UnitRatio = { id: string; fromCode: string; toCode: string; factor: number };

export type CookbookEntry = {
  productId: string;
  name: string;
  sku?: string | null;
  isActive: boolean;
  productType?: string;
  recipeYield: number;
  lines: Array<{ itemId: string; qty: number; itemName?: string; itemUnit?: string }>;
};

export function useInventoryLicense() {
  const [licensed, setLicensed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const res = await api.get('/merchant/inventory/status');
    let on = isInventoryLicensed(res.data);
    if (!on) {
      try {
        const setRes = await api.get('/merchant/settings');
        on = isInventoryLicensed(setRes?.data?.settings);
      } catch {
        /* keep status */
      }
    }
    setLicensed(on);
    return on;
  };

  useEffect(() => {
    refresh()
      .catch(() => setLicensed(false))
      .finally(() => setLoading(false));
  }, []);

  return { licensed, loading, refresh };
}

export function InventoryUpsell() {
  const { t } = useI18n();
  return (
    <div className="card max-w-xl space-y-3">
      <h1 className="page-title">{t('invTitle')}</h1>
      <p className="text-sm">{t('invUpsellBody')}</p>
      <p className="text-xs muted">{t('invUpsellHint')}</p>
      <Link to="/merchant/settings?tab=pos#inventory-addon" className="btn-secondary inline-flex">
        {t('invOpenSettings')}
      </Link>
    </div>
  );
}

export async function loadItems(): Promise<InvItem[]> {
  const res = await api.get('/merchant/inventory/items');
  return res.data.items || [];
}

export async function loadSuppliers(): Promise<Supplier[]> {
  const res = await api.get('/merchant/inventory/suppliers');
  return res.data.suppliers || [];
}

export async function loadUnits(): Promise<{ units: InvUnit[]; ratios: UnitRatio[] }> {
  const res = await api.get('/merchant/inventory/units');
  return { units: res.data.units || [], ratios: res.data.ratios || [] };
}
