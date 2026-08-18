import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Mail,
  Package,
  Pencil,
  Plus,
  Trash2,
  Truck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { isInventoryLicensed } from '@/lib/inventory-addon';
import { useI18n } from '@/lib/i18n';

type Tab = 'items' | 'cookbook' | 'stockin' | 'waste' | 'suppliers' | 'alerts' | 'usage';

type CookbookLine = { itemId: string; qty: string; name?: string; unit?: string };

type CookbookEntry = {
  productId: string;
  name: string;
  sku?: string | null;
  isActive: boolean;
  productType?: string;
  recipeYield: number;
  lines: Array<{ itemId: string; qty: number; itemName?: string; itemUnit?: string }>;
};

type Supplier = {
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

type InvItem = {
  id: string;
  name: string;
  unit: string;
  cost: number;
  onHand: number;
  minStock: number;
  reorderQty: number;
  supplierId?: string | null;
  perishable: boolean;
  autoReorderEnabled: boolean;
  lowStock: boolean;
  supplier?: { id: string; name: string; email?: string | null } | null;
};

const UNITS = ['kg', 'L', 'piece'] as const;

const emptySupplier = () => ({
  name: '',
  email: '',
  phone: '',
  address: '',
  contactPerson: '',
  notes: '',
});

const emptyItem = () => ({
  name: '',
  unit: 'kg',
  cost: '0',
  onHand: '0',
  minStock: '0',
  reorderQty: '0',
  supplierId: '',
  perishable: false,
  autoReorderEnabled: false,
});

export default function Inventory() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'items';
  const setTab = (next: Tab) => {
    const nextParams = new URLSearchParams(params);
    nextParams.set('tab', next);
    setParams(nextParams, { replace: true });
  };

  const [licensed, setLicensed] = useState<boolean | null>(null);
  const [items, setItems] = useState<InvItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [usage, setUsage] = useState<Array<InvItem & { theoreticalUsage: number; wasteQty: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [itemForm, setItemForm] = useState(emptyItem());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemModal, setItemModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState(emptySupplier());
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierModal, setSupplierModal] = useState(false);
  const [supplierDetail, setSupplierDetail] = useState<{
    supplier: Supplier;
    items: InvItem[];
  } | null>(null);
  const [moveItemId, setMoveItemId] = useState('');
  const [moveQty, setMoveQty] = useState('');
  const [moveNote, setMoveNote] = useState('');
  const [moveCost, setMoveCost] = useState('');
  const [cookbook, setCookbook] = useState<CookbookEntry[]>([]);
  const [cookbookModal, setCookbookModal] = useState(false);
  const [cookbookProductId, setCookbookProductId] = useState('');
  const [cookbookYield, setCookbookYield] = useState('1');
  const [cookbookLines, setCookbookLines] = useState<CookbookLine[]>([]);

  const loadStatus = async () => {
    const res = await api.get('/merchant/inventory/status');
    let on = isInventoryLicensed(res.data);
    if (!on) {
      const setRes = await api.get('/merchant/settings').catch(() => null);
      on = isInventoryLicensed(setRes?.data?.settings);
    }
    setLicensed(on);
    return on;
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const on = await loadStatus();
      if (!on) return;
      const [i, s, u, c] = await Promise.all([
        api.get('/merchant/inventory/items'),
        api.get('/merchant/inventory/suppliers'),
        api.get('/merchant/inventory/usage', { params: { days: 30 } }).catch(() => ({ data: { rows: [] } })),
        api.get('/merchant/inventory/cookbook').catch(() => ({ data: { entries: [] } })),
      ]);
      setItems(i.data.items || []);
      setSuppliers(s.data.suppliers || []);
      setUsage(u.data.rows || []);
      setCookbook(c.data.entries || []);
    } catch (error: any) {
      if (error.response?.data?.code !== 'INVENTORY_ADDON_REQUIRED') {
        toast.error(error.response?.data?.error || t('invLoadFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const lowItems = useMemo(() => items.filter((i) => i.lowStock), [items]);

  const openCreateItem = () => {
    setEditingItemId(null);
    setItemForm(emptyItem());
    setItemModal(true);
  };

  const openEditItem = (item: InvItem) => {
    setEditingItemId(item.id);
    setItemForm({
      name: item.name,
      unit: item.unit,
      cost: String(item.cost ?? 0),
      onHand: String(item.onHand ?? 0),
      minStock: String(item.minStock ?? 0),
      reorderQty: String(item.reorderQty ?? 0),
      supplierId: item.supplierId || '',
      perishable: !!item.perishable,
      autoReorderEnabled: !!item.autoReorderEnabled,
    });
    setItemModal(true);
  };

  const saveItem = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const body = {
        name: itemForm.name,
        unit: itemForm.unit,
        cost: Number(itemForm.cost) || 0,
        onHand: Number(itemForm.onHand) || 0,
        minStock: Number(itemForm.minStock) || 0,
        reorderQty: Number(itemForm.reorderQty) || 0,
        supplierId: itemForm.supplierId || null,
        perishable: itemForm.perishable,
        autoReorderEnabled: itemForm.autoReorderEnabled,
      };
      if (editingItemId) {
        const { onHand: _onHand, ...rest } = body;
        await api.put(`/merchant/inventory/items/${editingItemId}`, rest);
        toast.success(t('invItemUpdated'));
      } else {
        await api.post('/merchant/inventory/items', body);
        toast.success(t('invItemCreated'));
      }
      setItemModal(false);
      await loadAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('invSaveFailed'));
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm(t('invItemDeleteConfirm'))) return;
    try {
      await api.delete(`/merchant/inventory/items/${id}`);
      toast.success(t('invItemDeleted'));
      await loadAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('invSaveFailed'));
    }
  };

  const openCreateSupplier = () => {
    setEditingSupplierId(null);
    setSupplierForm(emptySupplier());
    setSupplierModal(true);
  };

  const openEditSupplier = (s: Supplier) => {
    setEditingSupplierId(s.id);
    setSupplierForm({
      name: s.name,
      email: s.email || '',
      phone: s.phone || '',
      address: s.address || '',
      contactPerson: s.contactPerson || '',
      notes: s.notes || '',
    });
    setSupplierModal(true);
  };

  const saveSupplier = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const body = { ...supplierForm };
      if (editingSupplierId) {
        await api.put(`/merchant/inventory/suppliers/${editingSupplierId}`, body);
        toast.success(t('invSupplierUpdated'));
      } else {
        await api.post('/merchant/inventory/suppliers', body);
        toast.success(t('invSupplierCreated'));
      }
      setSupplierModal(false);
      await loadAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('invSaveFailed'));
    }
  };

  const deleteSupplier = async (id: string) => {
    if (!confirm(t('invSupplierDeleteConfirm'))) return;
    try {
      const res = await api.delete(`/merchant/inventory/suppliers/${id}`);
      toast.success(res.data?.softDeleted ? t('invSupplierArchived') : t('invSupplierDeleted'));
      setSupplierDetail(null);
      await loadAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('invSaveFailed'));
    }
  };

  const openSupplier = async (id: string) => {
    try {
      const res = await api.get(`/merchant/inventory/suppliers/${id}`);
      setSupplierDetail({ supplier: res.data.supplier, items: res.data.items || [] });
      setTab('suppliers');
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('invLoadFailed'));
    }
  };

  const emailReorder = async (opts: { itemId?: string; supplierId?: string }) => {
    try {
      if (opts.itemId) {
        await api.post(`/merchant/inventory/items/${opts.itemId}/reorder-email`);
      } else if (opts.supplierId) {
        await api.post(`/merchant/inventory/suppliers/${opts.supplierId}/reorder-email`);
      }
      toast.success(t('invReorderEmailSent'));
      await loadAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('invReorderEmailFailed'));
    }
  };

  const submitMove = async (e: FormEvent, kind: 'in' | 'waste') => {
    e.preventDefault();
    if (!moveItemId) return;
    try {
      if (kind === 'in') {
        await api.post(`/merchant/inventory/items/${moveItemId}/stock-in`, {
          qty: Number(moveQty),
          unitCost: moveCost ? Number(moveCost) : undefined,
          note: moveNote || undefined,
        });
        toast.success(t('invStockInSaved'));
      } else {
        await api.post(`/merchant/inventory/items/${moveItemId}/waste`, {
          qty: Number(moveQty),
          note: moveNote || undefined,
        });
        toast.success(t('invWasteSaved'));
      }
      setMoveQty('');
      setMoveNote('');
      setMoveCost('');
      await loadAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('invSaveFailed'));
    }
  };

  if (loading && licensed === null) {
    return <div className="py-12 text-center text-sm muted">{t('loading')}</div>;
  }

  if (licensed === false) {
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

  const openCookbook = (entry: CookbookEntry) => {
    setCookbookProductId(entry.productId);
    setCookbookYield(String(entry.recipeYield || 1));
    setCookbookLines(
      entry.lines.map((l) => ({
        itemId: l.itemId,
        qty: String(l.qty),
        name: l.itemName,
        unit: l.itemUnit,
      }))
    );
    setCookbookModal(true);
  };

  const saveCookbook = async (e: FormEvent) => {
    e.preventDefault();
    if (!cookbookProductId) return;
    try {
      await api.put(`/merchant/inventory/products/${cookbookProductId}/recipe`, {
        recipeYield: Number(cookbookYield) || 1,
        lines: cookbookLines
          .filter((l) => l.itemId && Number(l.qty) > 0)
          .map((l) => ({ itemId: l.itemId, qty: Number(l.qty) })),
      });
      toast.success(t('invCookbookSaved'));
      setCookbookModal(false);
      await loadAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('invSaveFailed'));
    }
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'items', label: t('invTabItems') },
    { id: 'cookbook', label: t('invTabCookbook') },
    { id: 'stockin', label: t('invTabStockIn') },
    { id: 'waste', label: t('invTabWaste') },
    { id: 'suppliers', label: t('invTabSuppliers') },
    { id: 'alerts', label: t('invTabAlerts') },
    { id: 'usage', label: t('invTabUsage') },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="page-title">{t('invTitle')}</h1>
          <p className="page-sub">{t('invHint')}</p>
        </div>
        {tab === 'items' && (
          <button type="button" className="btn-primary" onClick={openCreateItem}>
            <Plus size={14} /> {t('invAddItem')}
          </button>
        )}
        {tab === 'suppliers' && (
          <button type="button" className="btn-primary" onClick={openCreateSupplier}>
            <Plus size={14} /> {t('invAddSupplier')}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === tb.id ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-muted)]'
            }`}
          >
            {tb.label}
            {tb.id === 'alerts' && lowItems.length ? ` (${lowItems.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'items' && (
        <div className="card !p-0 table-scroll">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-[var(--bg-muted)] text-left">
              <tr>
                <th className="px-3 py-2">{t('invItemName')}</th>
                <th className="px-3 py-2">{t('invOnHand')}</th>
                <th className="px-3 py-2">{t('invParLevel')}</th>
                <th className="px-3 py-2">{t('invReorderQty')}</th>
                <th className="px-3 py-2">{t('invPreferredSupplier')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center muted">
                    {t('invNoItems')}
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-[11px] muted">
                      {item.unit}
                      {item.perishable ? ` · ${t('invPerishable')}` : ''}
                    </div>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {item.onHand} {item.unit}
                    {item.lowStock && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                        <AlertTriangle size={10} /> {t('invLowStock')}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {item.minStock} {item.unit}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {item.reorderQty} {item.unit}
                  </td>
                  <td className="px-3 py-2">
                    {item.supplier ? (
                      <button
                        type="button"
                        className="text-teal-700 hover:underline"
                        onClick={() => void openSupplier(item.supplier!.id)}
                      >
                        {item.supplier.name}
                      </button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {item.supplier?.email && (
                      <button
                        type="button"
                        className="rounded-lg p-2 hover:bg-[var(--bg-muted)]"
                        title={t('invEmailReorderNow')}
                        onClick={() => void emailReorder({ itemId: item.id })}
                      >
                        <Mail size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-lg p-2 hover:bg-[var(--bg-muted)]"
                      onClick={() => openEditItem(item)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                      onClick={() => void deleteItem(item.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'cookbook' && (
        <div className="space-y-2">
          <p className="text-xs muted">{t('invCookbookHint')}</p>
          <div className="card !p-0 table-scroll">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-[var(--bg-muted)] text-left">
                <tr>
                  <th className="px-3 py-2">{t('products')}</th>
                  <th className="px-3 py-2">{t('invRecipeYield')}</th>
                  <th className="px-3 py-2">{t('invRecipeTab')}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {cookbook.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center muted">
                      {t('invCookbookEmpty')}
                    </td>
                  </tr>
                )}
                {cookbook.map((entry) => (
                  <tr key={entry.productId} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2">
                      <div className="font-medium">{entry.name}</div>
                      <div className="text-[11px] muted">
                        {entry.sku || entry.productType || ''}
                        {!entry.isActive ? ` · ${t('invInactive')}` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{entry.recipeYield}</td>
                    <td className="px-3 py-2 text-xs">
                      {entry.lines.length
                        ? entry.lines.map((l) => `${l.qty} ${l.itemUnit || ''} ${l.itemName || ''}`.trim()).join(', ')
                        : <span className="muted">{t('invNoRecipe')}</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" className="btn-secondary text-xs" onClick={() => openCookbook(entry)}>
                        <Pencil size={12} /> {t('edit')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'stockin' && (
        <form className="card max-w-lg space-y-3" onSubmit={(e) => void submitMove(e, 'in')}>
          <h2 className="text-sm font-semibold">{t('invTabStockIn')}</h2>
          <p className="text-xs muted">{t('invStockInHint')}</p>
          <select className="input" value={moveItemId} onChange={(e) => setMoveItemId(e.target.value)} required>
            <option value="">{t('invSelectItem')}</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.onHand} {i.unit})
              </option>
            ))}
          </select>
          <input className="input" type="number" min={0.0001} step="any" placeholder={t('invQty')} value={moveQty} onChange={(e) => setMoveQty(e.target.value)} required />
          <input className="input" type="number" min={0} step="any" placeholder={t('invUnitCost')} value={moveCost} onChange={(e) => setMoveCost(e.target.value)} />
          <input className="input" placeholder={t('invNote')} value={moveNote} onChange={(e) => setMoveNote(e.target.value)} />
          <button type="submit" className="btn-primary">
            <Package size={14} /> {t('invRecordStockIn')}
          </button>
        </form>
      )}

      {tab === 'waste' && (
        <form className="card max-w-lg space-y-3" onSubmit={(e) => void submitMove(e, 'waste')}>
          <h2 className="text-sm font-semibold">{t('invTabWaste')}</h2>
          <p className="text-xs muted">{t('invWasteHint')}</p>
          <select className="input" value={moveItemId} onChange={(e) => setMoveItemId(e.target.value)} required>
            <option value="">{t('invSelectItem')}</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.onHand} {i.unit})
              </option>
            ))}
          </select>
          <input className="input" type="number" min={0.0001} step="any" placeholder={t('invQty')} value={moveQty} onChange={(e) => setMoveQty(e.target.value)} required />
          <input className="input" placeholder={t('invNote')} value={moveNote} onChange={(e) => setMoveNote(e.target.value)} />
          <button type="submit" className="btn-primary">
            {t('invRecordWaste')}
          </button>
        </form>
      )}

      {tab === 'suppliers' && (
        <div className="space-y-3">
          <div className="card !p-0 table-scroll">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-[var(--bg-muted)] text-left">
                <tr>
                  <th className="px-3 py-2">{t('invSupplierName')}</th>
                  <th className="px-3 py-2">{t('email')}</th>
                  <th className="px-3 py-2">{t('invPhone')}</th>
                  <th className="px-3 py-2">{t('invLinkedItems')}</th>
                  <th className="px-3 py-2">{t('invLastOrderEmail')}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {suppliers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center muted">
                      {t('invNoSuppliers')}
                    </td>
                  </tr>
                )}
                {suppliers.map((s) => (
                  <tr key={s.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2">
                      <button type="button" className="font-medium hover:underline" onClick={() => void openSupplier(s.id)}>
                        {s.name}
                      </button>
                      {s.contactPerson ? <div className="text-[11px] muted">{s.contactPerson}</div> : null}
                      {s.archivedAt ? <div className="text-[11px] text-amber-700">{t('invArchived')}</div> : null}
                    </td>
                    <td className="px-3 py-2">{s.email || '—'}</td>
                    <td className="px-3 py-2">{s.phone || '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{s.linkedItemCount ?? 0}</td>
                    <td className="px-3 py-2 text-xs">
                      {s.lastOrderEmailAt ? new Date(s.lastOrderEmailAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {s.email && (
                        <button
                          type="button"
                          className="rounded-lg p-2 hover:bg-[var(--bg-muted)]"
                          title={t('invEmailReorderNow')}
                          onClick={() => void emailReorder({ supplierId: s.id })}
                        >
                          <Mail size={16} />
                        </button>
                      )}
                      <button type="button" className="rounded-lg p-2 hover:bg-[var(--bg-muted)]" onClick={() => openEditSupplier(s)}>
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                        onClick={() => void deleteSupplier(s.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {supplierDetail && (
            <div className="card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Truck size={16} /> {supplierDetail.supplier.name}
                  </h2>
                  <p className="text-xs muted mt-1">
                    {[supplierDetail.supplier.contactPerson, supplierDetail.supplier.email, supplierDetail.supplier.phone]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {supplierDetail.supplier.address ? (
                    <p className="text-xs muted">{supplierDetail.supplier.address}</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {supplierDetail.supplier.email && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => void emailReorder({ supplierId: supplierDetail.supplier.id })}
                    >
                      <Mail size={14} /> {t('invEmailReorderNow')}
                    </button>
                  )}
                  <button type="button" className="btn-secondary" onClick={() => setSupplierDetail(null)}>
                    {t('close')}
                  </button>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs muted">
                  <tr>
                    <th className="py-1">{t('invItemName')}</th>
                    <th className="py-1">{t('invOnHand')}</th>
                    <th className="py-1">{t('invParLevel')}</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierDetail.items.map((item) => (
                    <tr key={item.id} className="border-t border-[var(--border)]">
                      <td className="py-1.5">{item.name}</td>
                      <td className="py-1.5">
                        {item.onHand} {item.unit}
                        {Number(item.onHand) <= Number(item.minStock) && Number(item.minStock) > 0 ? (
                          <span className="ml-2 text-[10px] font-semibold text-amber-800">{t('invLowStock')}</span>
                        ) : null}
                      </td>
                      <td className="py-1.5">
                        {item.minStock} {item.unit}
                      </td>
                    </tr>
                  ))}
                  {supplierDetail.items.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-3 muted">
                        {t('invNoLinkedItems')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'alerts' && (
        <div className="card !p-0">
          {lowItems.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm muted">{t('invNoLowStock')}</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {lowItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs muted">
                      {item.onHand} / {item.minStock} {item.unit}
                      {item.supplier ? ` · ${item.supplier.name}` : ''}
                    </div>
                  </div>
                  {item.supplier?.email && (
                    <button type="button" className="btn-secondary" onClick={() => void emailReorder({ itemId: item.id })}>
                      <Mail size={14} /> {t('invEmailReorderNow')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'usage' && (
        <div className="card !p-0 table-scroll">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-[var(--bg-muted)] text-left">
              <tr>
                <th className="px-3 py-2">{t('invItemName')}</th>
                <th className="px-3 py-2">{t('invTheoreticalUsage')}</th>
                <th className="px-3 py-2">{t('invWaste')}</th>
                <th className="px-3 py-2">{t('invOnHand')}</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.theoreticalUsage} {row.unit}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.wasteQty} {row.unit}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.onHand} {row.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {itemModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3" onClick={() => setItemModal(false)}>
          <form
            className="w-full max-w-lg rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void saveItem(e)}
          >
            <h2 className="font-semibold">{editingItemId ? t('invEditItem') : t('invAddItem')}</h2>
            <input className="input" required placeholder={t('invItemName')} value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <select className="input" value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <input className="input" type="number" min={0} step="any" placeholder={t('invCost')} value={itemForm.cost} onChange={(e) => setItemForm({ ...itemForm, cost: e.target.value })} />
              {!editingItemId && (
                <input className="input" type="number" min={0} step="any" placeholder={t('invOnHand')} value={itemForm.onHand} onChange={(e) => setItemForm({ ...itemForm, onHand: e.target.value })} />
              )}
              <input className="input" type="number" min={0} step="any" placeholder={t('invParLevel')} value={itemForm.minStock} onChange={(e) => setItemForm({ ...itemForm, minStock: e.target.value })} />
              <input className="input" type="number" min={0} step="any" placeholder={t('invReorderQty')} value={itemForm.reorderQty} onChange={(e) => setItemForm({ ...itemForm, reorderQty: e.target.value })} />
            </div>
            <select className="input" value={itemForm.supplierId} onChange={(e) => setItemForm({ ...itemForm, supplierId: e.target.value })}>
              <option value="">{t('invPreferredSupplier')}…</option>
              {suppliers.filter((s) => !s.archivedAt).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={itemForm.perishable} onChange={(e) => setItemForm({ ...itemForm, perishable: e.target.checked })} />
              {t('invPerishable')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={itemForm.autoReorderEnabled}
                onChange={(e) => setItemForm({ ...itemForm, autoReorderEnabled: e.target.checked })}
              />
              {t('invAutoReorderItem')}
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setItemModal(false)}>
                {t('cancel')}
              </button>
              <button type="submit" className="btn-primary">
                {t('save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {cookbookModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3" onClick={() => setCookbookModal(false)}>
          <form
            className="w-full max-w-lg rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void saveCookbook(e)}
          >
            <h2 className="font-semibold">{t('invTabCookbook')}</h2>
            <p className="text-xs muted">
              {cookbook.find((c) => c.productId === cookbookProductId)?.name}
            </p>
            <label className="block space-y-1">
              <span className="text-xs font-medium">{t('invRecipeYield')}</span>
              <input
                className="input"
                type="number"
                min={0.0001}
                step="any"
                value={cookbookYield}
                onChange={(e) => setCookbookYield(e.target.value)}
              />
              <span className="text-[11px] muted">{t('invRecipeYieldHint')}</span>
            </label>
            {cookbookLines.map((line, idx) => (
              <div key={`${line.itemId}-${idx}`} className="grid grid-cols-[1fr_90px_auto] gap-2">
                <select
                  className="input"
                  value={line.itemId}
                  onChange={(e) => {
                    const next = [...cookbookLines];
                    const found = items.find((i) => i.id === e.target.value);
                    next[idx] = { ...line, itemId: e.target.value, unit: found?.unit, name: found?.name };
                    setCookbookLines(next);
                  }}
                >
                  <option value="">{t('invSelectItem')}</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unit})
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="any"
                  value={line.qty}
                  onChange={(e) => {
                    const next = [...cookbookLines];
                    next[idx] = { ...line, qty: e.target.value };
                    setCookbookLines(next);
                  }}
                />
                <button
                  type="button"
                  className="rounded-md p-2 text-red-600"
                  onClick={() => setCookbookLines(cookbookLines.filter((_, i) => i !== idx))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => setCookbookLines([...cookbookLines, { itemId: '', qty: '' }])}
            >
              <Plus size={12} /> {t('invAddIngredient')}
            </button>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setCookbookModal(false)}>
                {t('cancel')}
              </button>
              <button type="submit" className="btn-primary">
                {t('save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {supplierModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3" onClick={() => setSupplierModal(false)}>
          <form
            className="w-full max-w-lg rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void saveSupplier(e)}
          >
            <h2 className="font-semibold">{editingSupplierId ? t('invEditSupplier') : t('invAddSupplier')}</h2>
            <input className="input" required placeholder={t('invSupplierName')} value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} />
            <input className="input" type="email" placeholder={t('email')} value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} />
            <input className="input" placeholder={t('invPhone')} value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
            <input className="input" placeholder={t('invContactPerson')} value={supplierForm.contactPerson} onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })} />
            <input className="input" placeholder={t('invAddress')} value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} />
            <textarea className="input min-h-[80px]" placeholder={t('invNotes')} value={supplierForm.notes} onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })} />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setSupplierModal(false)}>
                {t('cancel')}
              </button>
              <button type="submit" className="btn-primary">
                {t('save')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
