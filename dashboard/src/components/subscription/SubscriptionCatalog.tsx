import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import api from '@/lib/api';

type Plan = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  priceMonthly: string;
  priceYearly?: string | null;
  currency: string;
  editionId?: string | null;
  edition?: { id: string; name: string } | null;
  maxDevices: number;
  maxProducts?: number | null;
  maxPosPosts?: number;
  maxWaiterPosts?: number;
  maxStaff?: number;
  includedAddons?: {
    inventory?: boolean;
    signage?: boolean;
    kds?: boolean;
    ods?: boolean;
    kiosk?: boolean;
    signageScreenLimit?: number;
  } | null;
  features?: string[] | null;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  trialDays: number;
};

type Edition = { id: string; name: string; businessCategory?: string };

type SubscriptionAddon = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  addonKey: string;
  priceMonthly: string;
  priceYearly?: string | null;
  currency: string;
  quantity: number;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
};

const emptyPlan = {
  name: '',
  slug: '',
  description: '',
  priceMonthly: '0',
  priceYearly: '',
  currency: 'CHF',
  editionId: '',
  maxDevices: 1,
  maxProducts: '',
  maxPosPosts: 0,
  maxWaiterPosts: 0,
  maxStaff: 0,
  includedInventory: false,
  includedSignage: false,
  includedKds: false,
  includedOds: false,
  includedKiosk: false,
  signageScreenLimit: 2,
  featuresText: '',
  isActive: true,
  isPublic: true,
  sortOrder: 0,
  trialDays: 0,
};

const emptyAddon = {
  name: '',
  slug: '',
  description: '',
  addonKey: 'inventory',
  priceMonthly: '0',
  priceYearly: '',
  currency: 'CHF',
  quantity: 1,
  isActive: true,
  isPublic: true,
  sortOrder: 0,
};

type Props = {
  apiPrefix: 'superadmin' | 'reseller';
  title: string;
  description: string;
};

export default function SubscriptionCatalog({ apiPrefix, title, description }: Props) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [addons, setAddons] = useState<SubscriptionAddon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [showAddonForm, setShowAddonForm] = useState(false);
  const [editingAddonId, setEditingAddonId] = useState<string | null>(null);
  const [addonForm, setAddonForm] = useState(emptyAddon);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingAddon, setSavingAddon] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [plansRes, editionsRes, addonsRes] = await Promise.all([
        api.get(`/${apiPrefix}/plans`),
        api.get(`/${apiPrefix}/editions`),
        api.get(`/${apiPrefix}/addons`),
      ]);
      setPlans(plansRes.data.plans || []);
      setEditions(editionsRes.data.editions || []);
      setAddons(addonsRes.data.addons || []);
    } catch {
      toast.error('Failed to load subscription catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [apiPrefix]);

  const openCreate = () => {
    setEditingId(null);
    setPlanForm({ ...emptyPlan, sortOrder: (plans.length + 1) * 10 });
    setShowPlanForm(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setPlanForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || '',
      priceMonthly: String(plan.priceMonthly ?? '0'),
      priceYearly: plan.priceYearly != null ? String(plan.priceYearly) : '',
      currency: plan.currency || 'CHF',
      maxDevices: plan.maxDevices ?? 1,
      maxProducts: plan.maxProducts != null ? String(plan.maxProducts) : '',
      editionId: plan.editionId || plan.edition?.id || '',
      maxPosPosts: plan.maxPosPosts ?? 0,
      maxWaiterPosts: plan.maxWaiterPosts ?? 0,
      maxStaff: plan.maxStaff ?? 0,
      includedInventory: !!plan.includedAddons?.inventory,
      includedSignage: !!plan.includedAddons?.signage,
      includedKds: !!plan.includedAddons?.kds,
      includedOds: !!plan.includedAddons?.ods,
      includedKiosk: !!plan.includedAddons?.kiosk,
      signageScreenLimit: plan.includedAddons?.signageScreenLimit ?? 2,
      featuresText: (plan.features || []).join('\n'),
      isActive: plan.isActive,
      isPublic: plan.isPublic,
      sortOrder: plan.sortOrder ?? 0,
      trialDays: plan.trialDays ?? 0,
    });
    setShowPlanForm(true);
  };

  const savePlan = async (e: FormEvent) => {
    e.preventDefault();
    if (!planForm.name.trim()) {
      toast.error('Package name is required');
      return;
    }
    setSavingPlan(true);
    try {
      const payload = {
        name: planForm.name.trim(),
        slug: planForm.slug.trim() || planForm.name,
        description: planForm.description || null,
        priceMonthly: Number(planForm.priceMonthly) || 0,
        priceYearly: planForm.priceYearly === '' ? null : Number(planForm.priceYearly),
        currency: planForm.currency || 'CHF',
        maxDevices: Number(planForm.maxDevices) || 1,
        maxProducts: planForm.maxProducts === '' ? null : Number(planForm.maxProducts),
        editionId: planForm.editionId || null,
        maxPosPosts: Number(planForm.maxPosPosts) || 0,
        maxWaiterPosts: Number(planForm.maxWaiterPosts) || 0,
        maxStaff: Number(planForm.maxStaff) || 0,
        includedAddons: {
          inventory: planForm.includedInventory,
          signage: planForm.includedSignage,
          kds: planForm.includedKds,
          ods: planForm.includedOds,
          kiosk: planForm.includedKiosk,
          signageScreenLimit: planForm.includedSignage ? Number(planForm.signageScreenLimit) || 2 : undefined,
        },
        features: planForm.featuresText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        isActive: planForm.isActive,
        isPublic: planForm.isPublic,
        sortOrder: Number(planForm.sortOrder) || 0,
        trialDays: Number(planForm.trialDays) || 0,
      };
      if (editingId) {
        await api.put(`/${apiPrefix}/plans/${editingId}`, payload);
        toast.success('Package updated');
      } else {
        await api.post(`/${apiPrefix}/plans`, payload);
        toast.success('Package created');
      }
      setShowPlanForm(false);
      await load();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(message || 'Failed to save package');
    } finally {
      setSavingPlan(false);
    }
  };

  const deactivatePlan = async (plan: Plan) => {
    if (!confirm(`Deactivate package "${plan.name}"? Merchants will no longer see it.`)) return;
    try {
      await api.delete(`/${apiPrefix}/plans/${plan.id}`);
      toast.success('Package deactivated');
      await load();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(message || 'Failed to deactivate package');
    }
  };

  const openCreateAddon = () => {
    setEditingAddonId(null);
    setAddonForm({ ...emptyAddon, sortOrder: (addons.length + 1) * 10 });
    setShowAddonForm(true);
  };

  const openEditAddon = (addon: SubscriptionAddon) => {
    setEditingAddonId(addon.id);
    setAddonForm({
      name: addon.name,
      slug: addon.slug,
      description: addon.description || '',
      addonKey: addon.addonKey,
      priceMonthly: String(addon.priceMonthly ?? '0'),
      priceYearly: addon.priceYearly != null ? String(addon.priceYearly) : '',
      currency: addon.currency || 'CHF',
      quantity: addon.quantity ?? 1,
      isActive: addon.isActive,
      isPublic: addon.isPublic,
      sortOrder: addon.sortOrder ?? 0,
    });
    setShowAddonForm(true);
  };

  const saveAddon = async (e: FormEvent) => {
    e.preventDefault();
    setSavingAddon(true);
    try {
      const payload = {
        name: addonForm.name.trim(),
        slug: addonForm.slug.trim() || addonForm.name,
        description: addonForm.description || null,
        addonKey: addonForm.addonKey,
        priceMonthly: Number(addonForm.priceMonthly) || 0,
        priceYearly: addonForm.priceYearly === '' ? null : Number(addonForm.priceYearly),
        currency: addonForm.currency || 'CHF',
        quantity: Number(addonForm.quantity) || 1,
        isActive: addonForm.isActive,
        isPublic: addonForm.isPublic,
        sortOrder: Number(addonForm.sortOrder) || 0,
      };
      if (editingAddonId) {
        await api.put(`/${apiPrefix}/addons/${editingAddonId}`, payload);
        toast.success('Add-on updated');
      } else {
        await api.post(`/${apiPrefix}/addons`, payload);
        toast.success('Add-on created');
      }
      setShowAddonForm(false);
      await load();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(message || 'Failed to save add-on');
    } finally {
      setSavingAddon(false);
    }
  };

  const deactivateAddon = async (addon: SubscriptionAddon) => {
    if (!confirm(`Deactivate add-on "${addon.name}"?`)) return;
    try {
      await api.delete(`/${apiPrefix}/addons/${addon.id}`);
      toast.success('Add-on deactivated');
      await load();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(message || 'Failed to deactivate add-on');
    }
  };

  const limitLabel = (n?: number) => (n === 0 || n == null ? '∞' : String(n));

  if (loading) {
    return <div className="text-gray-500">Loading catalog…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-gray-600 mt-1">{description}</p>
          </div>
          <button type="button" className="btn btn-primary flex items-center gap-2" onClick={openCreate}>
            <Plus size={16} /> New package
          </button>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Package</th>
                <th className="py-2 pr-3">POS version</th>
                <th className="py-2 pr-3">Monthly</th>
                <th className="py-2 pr-3">Limits</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Visible</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-b last:border-0">
                  <td className="py-3 pr-3">
                    <div className="font-medium">{plan.name}</div>
                    <div className="text-xs text-gray-500">{plan.slug}</div>
                  </td>
                  <td className="py-3 pr-3 text-xs">{plan.edition?.name || '—'}</td>
                  <td className="py-3 pr-3">
                    {Number(plan.priceMonthly).toFixed(2)} {plan.currency}
                  </td>
                  <td className="py-3 pr-3 text-xs text-gray-600">
                    POS {limitLabel(plan.maxPosPosts)} · Waiter {limitLabel(plan.maxWaiterPosts)} · Staff{' '}
                    {limitLabel(plan.maxStaff)}
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        plan.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 pr-3">{plan.isPublic ? 'Merchants' : 'Admin only'}</td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="p-1.5 rounded hover:bg-gray-100"
                        onClick={() => openEdit(plan)}
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 rounded hover:bg-red-50 text-red-600"
                        onClick={() => void deactivatePlan(plan)}
                        title="Deactivate"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!plans.length && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-500">
                    No packages yet. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold">Subscription add-ons</h2>
            <p className="text-gray-600 mt-1 text-sm">
              Optional extras merchants can buy on top of their package.
            </p>
          </div>
          <button type="button" className="btn btn-secondary flex items-center gap-2" onClick={openCreateAddon}>
            <Plus size={16} /> New add-on
          </button>
        </div>
        <div className="table-scroll">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Add-on</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Monthly</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {addons.map((addon) => (
                <tr key={addon.id} className="border-b last:border-0">
                  <td className="py-3 pr-3">
                    <div className="font-medium">{addon.name}</div>
                    <div className="text-xs text-gray-500">{addon.slug}</div>
                  </td>
                  <td className="py-3 pr-3 text-xs">{addon.addonKey}</td>
                  <td className="py-3 pr-3">
                    {Number(addon.priceMonthly).toFixed(2)} {addon.currency}
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        addon.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {addon.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="p-1.5 rounded hover:bg-gray-100"
                        onClick={() => openEditAddon(addon)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 rounded hover:bg-red-50 text-red-600"
                        onClick={() => void deactivateAddon(addon)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!addons.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500">
                    No add-ons yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPlanForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{editingId ? 'Edit package' : 'New package'}</h3>
              <button type="button" onClick={() => setShowPlanForm(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={savePlan} className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium">Name</span>
                <input
                  className="input mt-1"
                  required
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Slug</span>
                <input
                  className="input mt-1"
                  placeholder="auto from name"
                  value={planForm.slug}
                  onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Description</span>
                <textarea
                  className="input mt-1"
                  rows={2}
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">POS version (features)</span>
                <select
                  className="input mt-1"
                  value={planForm.editionId}
                  onChange={(e) => setPlanForm({ ...planForm, editionId: e.target.value })}
                >
                  <option value="">— None —</option>
                  {editions.map((ed) => (
                    <option key={ed.id} value={ed.id}>
                      {ed.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-sm font-medium">Monthly</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min="0"
                    step="0.01"
                    value={planForm.priceMonthly}
                    onChange={(e) => setPlanForm({ ...planForm, priceMonthly: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Yearly</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min="0"
                    step="0.01"
                    value={planForm.priceYearly}
                    onChange={(e) => setPlanForm({ ...planForm, priceYearly: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Currency</span>
                  <input
                    className="input mt-1"
                    value={planForm.currency}
                    onChange={(e) => setPlanForm({ ...planForm, currency: e.target.value })}
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-sm font-medium">Max devices</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min="1"
                    value={planForm.maxDevices}
                    onChange={(e) => setPlanForm({ ...planForm, maxDevices: Number(e.target.value) })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Max products</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min="0"
                    placeholder="unlimited"
                    value={planForm.maxProducts}
                    onChange={(e) => setPlanForm({ ...planForm, maxProducts: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Sort order</span>
                  <input
                    className="input mt-1"
                    type="number"
                    value={planForm.sortOrder}
                    onChange={(e) => setPlanForm({ ...planForm, sortOrder: Number(e.target.value) })}
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-sm font-medium">Max POS stations (0 = ∞)</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min="0"
                    value={planForm.maxPosPosts}
                    onChange={(e) => setPlanForm({ ...planForm, maxPosPosts: Number(e.target.value) })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Max waiter devices (0 = ∞)</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min="0"
                    value={planForm.maxWaiterPosts}
                    onChange={(e) => setPlanForm({ ...planForm, maxWaiterPosts: Number(e.target.value) })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Max staff users (0 = ∞)</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min="0"
                    value={planForm.maxStaff}
                    onChange={(e) => setPlanForm({ ...planForm, maxStaff: Number(e.target.value) })}
                  />
                </label>
              </div>
              <div>
                <span className="text-sm font-medium">Bundled add-ons</span>
                <div className="mt-2 flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={planForm.includedInventory}
                      onChange={(e) => setPlanForm({ ...planForm, includedInventory: e.target.checked })}
                    />
                    Inventory
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={planForm.includedSignage}
                      onChange={(e) => setPlanForm({ ...planForm, includedSignage: e.target.checked })}
                    />
                    Signage
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={planForm.includedKds}
                      onChange={(e) => setPlanForm({ ...planForm, includedKds: e.target.checked })}
                    />
                    KDS
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={planForm.includedOds}
                      onChange={(e) => setPlanForm({ ...planForm, includedOds: e.target.checked })}
                    />
                    ODS
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={planForm.includedKiosk}
                      onChange={(e) => setPlanForm({ ...planForm, includedKiosk: e.target.checked })}
                    />
                    Self-order kiosk
                  </label>
                  {planForm.includedSignage ? (
                    <label className="flex items-center gap-2">
                      Screens
                      <input
                        className="input w-16"
                        type="number"
                        min="1"
                        value={planForm.signageScreenLimit}
                        onChange={(e) =>
                          setPlanForm({ ...planForm, signageScreenLimit: Number(e.target.value) })
                        }
                      />
                    </label>
                  ) : null}
                </div>
              </div>
              <label className="block">
                <span className="text-sm font-medium">Marketing bullets (one per line)</span>
                <textarea
                  className="input mt-1"
                  rows={3}
                  value={planForm.featuresText}
                  onChange={(e) => setPlanForm({ ...planForm, featuresText: e.target.value })}
                />
              </label>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={planForm.isActive}
                    onChange={(e) => setPlanForm({ ...planForm, isActive: e.target.checked })}
                  />
                  Active
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={planForm.isPublic}
                    onChange={(e) => setPlanForm({ ...planForm, isPublic: e.target.checked })}
                  />
                  Visible to merchants
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn" onClick={() => setShowPlanForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingPlan}>
                  {savingPlan ? 'Saving…' : 'Save package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddonForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{editingAddonId ? 'Edit add-on' : 'New add-on'}</h3>
              <button type="button" onClick={() => setShowAddonForm(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saveAddon} className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium">Name</span>
                <input
                  className="input mt-1"
                  required
                  value={addonForm.name}
                  onChange={(e) => setAddonForm({ ...addonForm, name: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Type</span>
                <select
                  className="input mt-1"
                  value={addonForm.addonKey}
                  onChange={(e) => setAddonForm({ ...addonForm, addonKey: e.target.value })}
                >
                  <option value="inventory">Inventory & recipes</option>
                  <option value="storekeeper">Storekeeper mobile app</option>
                  <option value="signage">Digital signage</option>
                  <option value="kds">Kitchen display (KDS)</option>
                  <option value="ods">Order display (ODS)</option>
                  <option value="kiosk">Self-order kiosk</option>
                  <option value="just_eat">Just Eat integration</option>
                  <option value="uber_eats">Uber Eats integration</option>
                  <option value="extra_pos_post">Extra POS station</option>
                  <option value="extra_waiter_post">Extra waiter device</option>
                  <option value="extra_staff">Extra staff user</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium">Description</span>
                <textarea
                  className="input mt-1"
                  rows={2}
                  value={addonForm.description}
                  onChange={(e) => setAddonForm({ ...addonForm, description: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium">Monthly price</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min="0"
                    step="0.01"
                    value={addonForm.priceMonthly}
                    onChange={(e) => setAddonForm({ ...addonForm, priceMonthly: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Quantity bump</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min="1"
                    value={addonForm.quantity}
                    onChange={(e) => setAddonForm({ ...addonForm, quantity: Number(e.target.value) })}
                  />
                </label>
              </div>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={addonForm.isActive}
                    onChange={(e) => setAddonForm({ ...addonForm, isActive: e.target.checked })}
                  />
                  Active
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={addonForm.isPublic}
                    onChange={(e) => setAddonForm({ ...addonForm, isPublic: e.target.checked })}
                  />
                  Visible to merchants
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn" onClick={() => setShowAddonForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingAddon}>
                  {savingAddon ? 'Saving…' : 'Save add-on'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
