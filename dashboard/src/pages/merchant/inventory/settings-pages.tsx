import { FormEvent, useEffect, useState } from 'react';
import { Mail, Pencil, Plus, Trash2, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  loadItems,
  loadSuppliers,
  loadUnits,
  type CookbookEntry,
  type InvItem,
  type InvUnit,
  type StockCategory,
  type Supplier,
  type UnitRatio,
} from './shared';

const emptyItem = () => ({
  name: '',
  unit: 'kg',
  cost: '0',
  onHand: '0',
  minStock: '0',
  reorderQty: '0',
  supplierId: '',
  categoryId: '',
  perishable: false,
  autoReorderEnabled: false,
});

export function StockItemsPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<InvItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<StockCategory[]>([]);
  const [units, setUnits] = useState<InvUnit[]>([]);
  const [form, setForm] = useState(emptyItem());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modal, setModal] = useState(false);

  const reload = async () => {
    const [i, s, c, u] = await Promise.all([
      loadItems(),
      loadSuppliers(),
      api.get('/merchant/inventory/categories').then((r) => r.data.categories || []),
      loadUnits().catch(() => ({ units: [], ratios: [] })),
    ]);
    setItems(i);
    setSuppliers(s);
    setCategories(c);
    setUnits(u.units);
  };

  useEffect(() => {
    void reload().catch(() => undefined);
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const body = {
        ...form,
        cost: Number(form.cost) || 0,
        onHand: Number(form.onHand) || 0,
        minStock: Number(form.minStock) || 0,
        reorderQty: Number(form.reorderQty) || 0,
        supplierId: form.supplierId || null,
        categoryId: form.categoryId || null,
      };
      if (editingId) {
        const { onHand: _onHand, ...rest } = body;
        await api.put(`/merchant/inventory/items/${editingId}`, rest);
      } else {
        await api.post('/merchant/inventory/items', body);
      }
      toast.success(editingId ? t('invItemUpdated') : t('invItemCreated'));
      setModal(false);
      await reload();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('invSaveFailed'));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setEditingId(null);
            setForm(emptyItem());
            setModal(true);
          }}
        >
          <Plus size={14} /> {t('invAddItem')}
        </button>
      </div>
      <div className="card !p-0 table-scroll">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-[var(--bg-muted)] text-left">
            <tr>
              <th className="px-3 py-2">{t('invItemName')}</th>
              <th className="px-3 py-2">{t('invNavCategories')}</th>
              <th className="px-3 py-2">{t('invOnHand')}</th>
              <th className="px-3 py-2">{t('invPreferredSupplier')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-[11px] muted">{item.unit}</div>
                </td>
                <td className="px-3 py-2 text-xs">{item.category?.name || '—'}</td>
                <td className="px-3 py-2 tabular-nums">
                  {item.onHand} {item.unit}
                </td>
                <td className="px-3 py-2">{item.supplier?.name || '—'}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="rounded-lg p-2 hover:bg-[var(--bg-muted)]"
                    onClick={() => {
                      setEditingId(item.id);
                      setForm({
                        name: item.name,
                        unit: item.unit,
                        cost: String(item.cost ?? 0),
                        onHand: String(item.onHand ?? 0),
                        minStock: String(item.minStock ?? 0),
                        reorderQty: String(item.reorderQty ?? 0),
                        supplierId: item.supplierId || '',
                        categoryId: item.categoryId || '',
                        perishable: !!item.perishable,
                        autoReorderEnabled: !!item.autoReorderEnabled,
                      });
                      setModal(true);
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-red-600"
                    onClick={() => {
                      if (!confirm(t('invItemDeleteConfirm'))) return;
                      void api.delete(`/merchant/inventory/items/${item.id}`).then(() => reload());
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3" onClick={() => setModal(false)}>
          <form className="w-full max-w-lg rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4 space-y-3" onClick={(e) => e.stopPropagation()} onSubmit={(e) => void save(e)}>
            <h2 className="font-semibold">{editingId ? t('invEditItem') : t('invAddItem')}</h2>
            <input className="input" required placeholder={t('invItemName')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {(units.length ? units.map((u) => u.code) : ['kg', 'g', 'L', 'ml', 'piece']).map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">{t('invNavCategories')}…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input className="input" type="number" min={0} step="any" placeholder={t('invCost')} value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
              {!editingId && (
                <input className="input" type="number" min={0} step="any" placeholder={t('invOnHand')} value={form.onHand} onChange={(e) => setForm({ ...form, onHand: e.target.value })} />
              )}
              <input className="input" type="number" min={0} step="any" placeholder={t('invParLevel')} value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
              <input className="input" type="number" min={0} step="any" placeholder={t('invReorderQty')} value={form.reorderQty} onChange={(e) => setForm({ ...form, reorderQty: e.target.value })} />
            </div>
            <select className="input" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              <option value="">{t('invPreferredSupplier')}…</option>
              {suppliers.filter((s) => !s.archivedAt).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.perishable} onChange={(e) => setForm({ ...form, perishable: e.target.checked })} />
              {t('invPerishable')}
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setModal(false)}>{t('cancel')}</button>
              <button type="submit" className="btn-primary">{t('save')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function StockCategoriesPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<StockCategory[]>([]);
  const [name, setName] = useState('');
  const reload = async () => {
    const res = await api.get('/merchant/inventory/categories');
    setRows(res.data.categories || []);
  };
  useEffect(() => {
    void reload().catch(() => undefined);
  }, []);
  return (
    <div className="space-y-3 max-w-lg">
      <form
        className="card flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void api.post('/merchant/inventory/categories', { name }).then(() => {
            setName('');
            return reload();
          });
        }}
      >
        <input className="input flex-1" required placeholder={t('invCategoryName')} value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn-primary"><Plus size={14} /> {t('addShort')}</button>
      </form>
      <div className="card !p-0">
        {rows.map((c) => (
          <div key={c.id} className="flex items-center justify-between border-t border-[var(--border)] first:border-t-0 px-3 py-2">
            <span>{c.name}</span>
            <button type="button" className="text-red-600 p-1" onClick={() => void api.delete(`/merchant/inventory/categories/${c.id}`).then(() => reload())}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {rows.length === 0 && <p className="px-3 py-6 text-center text-sm muted">{t('invNoCategories')}</p>}
      </div>
    </div>
  );
}

export function CookbookPage() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<CookbookEntry[]>([]);
  const [items, setItems] = useState<InvItem[]>([]);
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [yieldQty, setYieldQty] = useState('1');
  const [lines, setLines] = useState<Array<{ itemId: string; qty: string }>>([]);

  const reload = async () => {
    const [c, i] = await Promise.all([
      api.get('/merchant/inventory/cookbook'),
      loadItems(),
    ]);
    setEntries(c.data.entries || []);
    setItems(i);
  };
  useEffect(() => {
    void reload().catch(() => undefined);
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    await api.put(`/merchant/inventory/products/${productId}/recipe`, {
      recipeYield: Number(yieldQty) || 1,
      lines: lines.filter((l) => l.itemId && Number(l.qty) > 0).map((l) => ({ itemId: l.itemId, qty: Number(l.qty) })),
    });
    toast.success(t('invCookbookSaved'));
    setOpen(false);
    await reload();
  };

  return (
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
            {entries.map((entry) => (
              <tr key={entry.productId} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">
                  <div className="font-medium">{entry.name}</div>
                  <div className="text-[11px] muted">{entry.sku || ''}</div>
                </td>
                <td className="px-3 py-2 tabular-nums">{entry.recipeYield}</td>
                <td className="px-3 py-2 text-xs">
                  {entry.lines.length
                    ? entry.lines.map((l) => `${l.qty} ${l.itemUnit || ''} ${l.itemName || ''}`.trim()).join(', ')
                    : <span className="muted">{t('invNoRecipe')}</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => {
                      setProductId(entry.productId);
                      setYieldQty(String(entry.recipeYield || 1));
                      setLines(entry.lines.map((l) => ({ itemId: l.itemId, qty: String(l.qty) })));
                      setOpen(true);
                    }}
                  >
                    <Pencil size={12} /> {t('edit')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3" onClick={() => setOpen(false)}>
          <form className="w-full max-w-lg rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4 space-y-3" onClick={(e) => e.stopPropagation()} onSubmit={(e) => void save(e)}>
            <h2 className="font-semibold">{t('invNavCookbook')}</h2>
            <label className="block space-y-1">
              <span className="text-xs font-medium">{t('invRecipeYield')}</span>
              <input className="input" type="number" min={0.0001} step="any" value={yieldQty} onChange={(e) => setYieldQty(e.target.value)} />
            </label>
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_90px_auto] gap-2">
                <select className="input" value={line.itemId} onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...line, itemId: e.target.value };
                  setLines(next);
                }}>
                  <option value="">{t('invSelectItem')}</option>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                </select>
                <input className="input" type="number" min={0} step="any" value={line.qty} onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...line, qty: e.target.value };
                  setLines(next);
                }} />
                <button type="button" className="p-2 text-red-600" onClick={() => setLines(lines.filter((_, i) => i !== idx))}><Trash2 size={14} /></button>
              </div>
            ))}
            <button type="button" className="btn-secondary text-xs" onClick={() => setLines([...lines, { itemId: '', qty: '' })]}>
              <Plus size={12} /> {t('invAddIngredient')}
            </button>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>{t('cancel')}</button>
              <button type="submit" className="btn-primary">{t('save')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function SuppliersPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Supplier[]>([]);
  const [detail, setDetail] = useState<{ supplier: Supplier; items: InvItem[] } | null>(null);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', contactPerson: '', notes: '' });

  const reload = async () => setRows(await loadSuppliers());
  useEffect(() => {
    void reload().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" className="btn-primary" onClick={() => { setEditingId(null); setForm({ name: '', email: '', phone: '', address: '', contactPerson: '', notes: '' }); setModal(true); }}>
          <Plus size={14} /> {t('invAddSupplier')}
        </button>
      </div>
      <div className="card !p-0 table-scroll">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-[var(--bg-muted)] text-left">
            <tr>
              <th className="px-3 py-2">{t('invSupplierName')}</th>
              <th className="px-3 py-2">{t('email')}</th>
              <th className="px-3 py-2">{t('invLinkedItems')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">
                  <button type="button" className="font-medium hover:underline" onClick={() => void api.get(`/merchant/inventory/suppliers/${s.id}`).then((r) => setDetail({ supplier: r.data.supplier, items: r.data.items || [] }))}>{s.name}</button>
                </td>
                <td className="px-3 py-2">{s.email || '—'}</td>
                <td className="px-3 py-2">{s.linkedItemCount ?? 0}</td>
                <td className="px-3 py-2 text-right">
                  {s.email && (
                    <button type="button" className="p-2" onClick={() => void api.post(`/merchant/inventory/suppliers/${s.id}/reorder-email`).then(() => toast.success(t('invReorderEmailSent')))}><Mail size={16} /></button>
                  )}
                  <button type="button" className="p-2" onClick={() => { setEditingId(s.id); setForm({ name: s.name, email: s.email || '', phone: s.phone || '', address: s.address || '', contactPerson: s.contactPerson || '', notes: s.notes || '' }); setModal(true); }}><Pencil size={16} /></button>
                  <button type="button" className="p-2 text-red-600" onClick={() => { if (confirm(t('invSupplierDeleteConfirm'))) void api.delete(`/merchant/inventory/suppliers/${s.id}`).then(() => reload()); }}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detail && (
        <div className="card space-y-2">
          <div className="flex justify-between">
            <h2 className="font-semibold flex items-center gap-2"><Truck size={16} /> {detail.supplier.name}</h2>
            <button type="button" className="btn-secondary" onClick={() => setDetail(null)}>{t('close')}</button>
          </div>
          {detail.items.map((i) => (
            <p key={i.id} className="text-sm">{i.name}: {i.onHand} {i.unit}</p>
          ))}
        </div>
      )}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" onClick={() => setModal(false)}>
          <form className="w-full max-w-lg rounded-lg border bg-[var(--bg-elevated)] p-4 space-y-3" onClick={(e) => e.stopPropagation()} onSubmit={(e) => {
            e.preventDefault();
            const req = editingId ? api.put(`/merchant/inventory/suppliers/${editingId}`, form) : api.post('/merchant/inventory/suppliers', form);
            void req.then(() => { setModal(false); return reload(); });
          }}>
            <input className="input" required placeholder={t('invSupplierName')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" type="email" placeholder={t('email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="input" placeholder={t('invPhone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setModal(false)}>{t('cancel')}</button>
              <button type="submit" className="btn-primary">{t('save')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function UnitsPage() {
  const { t } = useI18n();
  const [units, setUnits] = useState<InvUnit[]>([]);
  const [ratios, setRatios] = useState<UnitRatio[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [fromCode, setFromCode] = useState('kg');
  const [toCode, setToCode] = useState('g');
  const [factor, setFactor] = useState('1000');

  const reload = async () => {
    const data = await loadUnits();
    setUnits(data.units);
    setRatios(data.ratios);
  };
  useEffect(() => {
    void reload().catch(() => undefined);
  }, []);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="card space-y-3">
        <h2 className="font-semibold">{t('invNavUnits')}</h2>
        <p className="text-xs muted">{t('invUnitsHint')}</p>
        <form className="flex gap-2" onSubmit={(e) => {
          e.preventDefault();
          void api.post('/merchant/inventory/units', { code, name }).then(() => { setCode(''); setName(''); return reload(); });
        }}>
          <input className="input w-24" required placeholder="kg" value={code} onChange={(e) => setCode(e.target.value)} />
          <input className="input flex-1" placeholder={t('invUnitName')} value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="btn-primary"><Plus size={14} /></button>
        </form>
        {units.map((u) => (
          <div key={u.id} className="flex items-center justify-between text-sm border-t border-[var(--border)] pt-2">
            <span><strong>{u.code}</strong> · {u.name}</span>
            <button type="button" className="text-red-600" onClick={() => void api.delete(`/merchant/inventory/units/${u.id}`).then(() => reload())}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <div className="card space-y-3">
        <h2 className="font-semibold">{t('invUnitRatio')}</h2>
        <p className="text-xs muted">{t('invUnitRatioHint')}</p>
        <form className="grid grid-cols-[1fr_auto_1fr_90px_auto] gap-2 items-center" onSubmit={(e) => {
          e.preventDefault();
          void api.post('/merchant/inventory/unit-ratios', { fromCode, toCode, factor: Number(factor) }).then(() => reload());
        }}>
          <select className="input" value={fromCode} onChange={(e) => setFromCode(e.target.value)}>
            {units.map((u) => <option key={u.id} value={u.code}>{u.code}</option>)}
          </select>
          <span className="text-xs">=</span>
          <select className="input" value={toCode} onChange={(e) => setToCode(e.target.value)}>
            {units.map((u) => <option key={u.id} value={u.code}>{u.code}</option>)}
          </select>
          <input className="input" type="number" min={0.000001} step="any" value={factor} onChange={(e) => setFactor(e.target.value)} />
          <button type="submit" className="btn-primary"><Plus size={14} /></button>
        </form>
        {ratios.map((r) => (
          <div key={r.id} className="flex items-center justify-between text-sm border-t border-[var(--border)] pt-2">
            <span>1 {r.fromCode} = {r.factor} {r.toCode}</span>
            <button type="button" className="text-red-600" onClick={() => void api.delete(`/merchant/inventory/unit-ratios/${r.id}`).then(() => reload())}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
