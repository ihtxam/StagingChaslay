import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Search, Plus, Edit2, Trash2, Eye, X, Copy, KeyRound, LogIn, Eraser } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

interface Merchant {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  slug?: string;
  shopEnabled?: boolean;
  status: 'active' | 'trial' | 'suspended' | 'expired';
  subscriptionPlan?: string;
  editionId?: string | null;
  editionName?: string | null;
  lastAppVersion?: string | null;
  lastAppVersionSeenAt?: string | null;
  inventoryAddonEnabled?: boolean;
  inventoryEnabled?: boolean;
  signageAddonEnabled?: boolean;
  signageEnabled?: boolean;
  signageScreenLimit?: number;
  createdAt: string;
  devices: number;
  licenses: number;
  activeLicenses?: number;
}

function PosVersionBadge({ name }: { name?: string | null }) {
  if (!name) {
    return (
      <span
        className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600"
        title="No edition assigned — legacy full access"
      >
        Legacy
      </span>
    );
  }
  return (
    <span
      className="inline-flex max-w-[12rem] truncate px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-800"
      title={name}
    >
      {name}
    </span>
  );
}

interface IssuedLicense {
  deviceId: string;
  deviceName: string;
  licenseKey: string;
  expiresAt: string;
}

const emptyForm = {
  businessName: '',
  email: '',
  password: '',
  phone: '',
  address: '',
  city: '',
  country: 'CH',
  slug: '',
  shopEnabled: true,
  subscriptionPlan: 'starter',
  deviceSeats: 1,
  licenseType: 'yearly' as 'trial' | 'yearly' | 'custom',
  customDays: 365,
  editionId: '',
  resellerId: '',
  businessCategory: 'restaurant' as 'retail' | 'restaurant',
  maxPosPosts: 1,
  maxWaiterPosts: 0,
  inventoryAddonEnabled: false,
  signageAddonEnabled: false,
  signageScreenLimit: 2,
};

export default function Merchants() {
  const navigate = useNavigate();
  const startImpersonation = useAuthStore((s) => s.startImpersonation);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<Merchant | null>(null);
  const [detailFull, setDetailFull] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [issuedKeys, setIssuedKeys] = useState<IssuedLicense[]>([]);
  const [resetPassword, setResetPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [purgeConfirm, setPurgeConfirm] = useState('');
  const [deleteCustomersToo, setDeleteCustomersToo] = useState(false);
  const [purgingSales, setPurgingSales] = useState(false);
  const [posLimits, setPosLimits] = useState({
    maxPosPosts: 0,
    maxWaiterPosts: 0,
    inventoryAddonEnabled: false,
    signageAddonEnabled: false,
    signageScreenLimit: 2,
  });
  const [savingPosLimits, setSavingPosLimits] = useState(false);
  const [editions, setEditions] = useState<Array<{ id: string; name: string; businessCategory: string }>>(
    []
  );
  const [resellers, setResellers] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetchMerchants();
  }, [page, search]);

  useEffect(() => {
    (async () => {
      try {
        await api.post('/superadmin/resellers/ensure-agency').catch(() => null);
        const [ed, rs] = await Promise.all([
          api.get('/superadmin/editions'),
          api.get('/superadmin/resellers'),
        ]);
        setEditions(ed.data.editions || []);
        setResellers(rs.data.resellers || []);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const fetchMerchants = async () => {
    try {
      setLoading(true);
      const response = await api.get('/superadmin/merchants', {
        params: { page, limit: 10, search: search || undefined },
      });
      setMerchants(response.data.merchants || []);
    } catch {
      toast.error('Failed to load merchants');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (merchant: Merchant) => {
    setShowDetail(merchant);
    setResetPassword('');
    setPurgeConfirm('');
    setDeleteCustomersToo(false);
    try {
      const res = await api.get(`/superadmin/merchants/${merchant.id}`);
      setDetailFull(res.data.merchant);
      setPosLimits({
        maxPosPosts: Math.max(0, Number(res.data.merchant?.maxPosPosts) || 0),
        maxWaiterPosts: Math.max(0, Number(res.data.merchant?.maxWaiterPosts) || 0),
        inventoryAddonEnabled: res.data.merchant?.inventoryAddonEnabled === true,
        signageAddonEnabled: res.data.merchant?.signageAddonEnabled === true,
        signageScreenLimit: Math.max(1, Number(res.data.merchant?.signageScreenLimit) || 2),
      });
    } catch {
      toast.error('Failed to load merchant details');
    }
  };

  const handleSavePosLimits = async () => {
    if (!showDetail) return;
    setSavingPosLimits(true);
    try {
      const res = await api.put(`/superadmin/merchants/${showDetail.id}`, {
        maxPosPosts: Number(posLimits.maxPosPosts) || 0,
        maxWaiterPosts: Number(posLimits.maxWaiterPosts) || 0,
        inventoryAddonEnabled: !!posLimits.inventoryAddonEnabled,
        signageAddonEnabled: !!posLimits.signageAddonEnabled,
        signageScreenLimit: Number(posLimits.signageScreenLimit) || 2,
      });
      const saved = res.data?.merchant;
      const inventoryOn = saved?.inventoryAddonEnabled === true || saved?.inventoryEnabled === true;
      const signageOn = saved?.signageAddonEnabled === true || saved?.signageEnabled === true;
      setPosLimits({
        maxPosPosts: Math.max(0, Number(saved?.maxPosPosts ?? posLimits.maxPosPosts) || 0),
        maxWaiterPosts: Math.max(0, Number(saved?.maxWaiterPosts ?? posLimits.maxWaiterPosts) || 0),
        inventoryAddonEnabled: inventoryOn,
        signageAddonEnabled: signageOn,
        signageScreenLimit: Math.max(1, Number(saved?.signageScreenLimit ?? posLimits.signageScreenLimit) || 2),
      });
      setShowDetail((prev) =>
        prev
          ? {
              ...prev,
              inventoryAddonEnabled: inventoryOn,
              inventoryEnabled: inventoryOn,
              signageAddonEnabled: signageOn,
              signageEnabled: signageOn,
              signageScreenLimit: Number(saved?.signageScreenLimit) || 2,
            }
          : prev
      );
      await fetchMerchants();
      toast.success('POS limits & addons updated');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update limits');
    } finally {
      setSavingPosLimits(false);
    }
  };

  const handleResetPassword = async () => {
    if (!showDetail) return;
    if (resetPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setResettingPassword(true);
    try {
      await api.post(`/superadmin/merchants/${showDetail.id}/reset-password`, {
        password: resetPassword,
      });
      toast.success('Password reset - merchant can log in to panel and POS with the new password');
      setResetPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  const handlePurgeSalesData = async () => {
    if (!showDetail) return;
    if (purgeConfirm !== 'DELETE ALL SALES') {
      toast.error('Type DELETE ALL SALES to confirm');
      return;
    }
    if (
      !window.confirm(
        `Permanently delete all orders and sales for "${showDetail.name}"? Menu and settings are kept. This cannot be undone.`
      )
    ) {
      return;
    }
    setPurgingSales(true);
    try {
      const res = await api.post(`/superadmin/merchants/${showDetail.id}/purge-sales-data`, {
        confirm: 'DELETE ALL SALES',
        deleteCustomers: deleteCustomersToo,
      });
      const d = res.data?.result?.deleted;
      toast.success(
        d
          ? `Purged ${d.orders ?? 0} orders, ${d.heldOrders ?? 0} held carts, ${d.dailyReports ?? 0} reports`
          : res.data?.message || 'Sales data purged'
      );
      setPurgeConfirm('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to purge sales data');
    } finally {
      setPurgingSales(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName || !form.email || !form.password) {
      toast.error('Name, email and password are required');
      return;
    }
    setSaving(true);
    try {
      if (!form.editionId) {
        toast.error('Select a POS version');
        setSaving(false);
        return;
      }
      const res = await api.post('/superadmin/merchants', {
        businessName: form.businessName,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        country: form.country || 'CH',
        slug: form.slug || undefined,
        shopEnabled: form.shopEnabled,
        subscriptionPlan: form.subscriptionPlan,
        deviceSeats: Number(form.deviceSeats) || 0,
        licenseType: form.licenseType,
        customDays: form.licenseType === 'custom' ? Number(form.customDays) : undefined,
        editionId: form.editionId,
        resellerId: form.resellerId || undefined,
        businessCategory: form.businessCategory,
        maxPosPosts: Number(form.maxPosPosts) || 0,
        maxWaiterPosts: Number(form.maxWaiterPosts) || 0,
        inventoryAddonEnabled: !!form.inventoryAddonEnabled,
        signageAddonEnabled: !!form.signageAddonEnabled,
        signageScreenLimit: Number(form.signageScreenLimit) || 2,
      });
      const issued = res.data.merchant?.issuedLicenses || [];
      setIssuedKeys(issued);
      toast.success('Merchant created');
      setForm(emptyForm);
      setShowCreate(false);
      fetchMerchants();
      if (issued.length) {
        toast.success(`${issued.length} device license(s) issued - copy keys below`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create merchant');
    } finally {
      setSaving(false);
    }
  };

  const handleSuspend = async (merchantId: string) => {
    try {
      await api.post(`/superadmin/merchants/${merchantId}/suspend`);
      toast.success('Merchant suspended');
      fetchMerchants();
    } catch {
      toast.error('Failed to suspend merchant');
    }
  };

  const handleReactivate = async (merchantId: string) => {
    try {
      await api.post(`/superadmin/merchants/${merchantId}/reactivate`);
      toast.success('Merchant reactivated');
      fetchMerchants();
    } catch {
      toast.error('Failed to reactivate merchant');
    }
  };

  const handleDelete = async (merchantId: string) => {
    if (!window.confirm('Suspend/delete this merchant?')) return;
    try {
      await api.delete(`/superadmin/merchants/${merchantId}`);
      toast.success('Merchant deleted');
      fetchMerchants();
    } catch {
      toast.error('Failed to delete merchant');
    }
  };

  const openMerchantPanel = async (merchant: Merchant) => {
    if (merchant.status === 'suspended' || merchant.status === 'expired') {
      toast.error(`Cannot open panel while merchant is ${merchant.status}`);
      return;
    }
    setOpeningId(merchant.id);
    try {
      const res = await api.post(`/superadmin/merchants/${merchant.id}/impersonate`);
      const { token, merchant: account } = res.data;
      if (!token || !account) {
        throw new Error('Invalid impersonation response');
      }
      startImpersonation(token, {
        id: account.id,
        email: account.email,
        name: account.name,
        role: 'merchant',
        merchantId: account.id,
        impersonatedBy: res.data.impersonatedBy,
        inventoryAddonEnabled: !!(account.inventoryAddonEnabled || account.inventoryEnabled),
        signageAddonEnabled: !!(account.signageAddonEnabled || account.signageEnabled),
      });
      toast.success(`Opened ${account.name}`);
      navigate('/merchant');
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to open merchant panel');
    } finally {
      setOpeningId(null);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'trial':
        return 'bg-blue-100 text-blue-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      case 'expired':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title text-2xl sm:text-3xl font-bold">Merchants</h1>
          <p className="page-sub">
            Create merchants, enable online shop, and issue device licenses
          </p>
        </div>
        <button
          className="btn-primary flex items-center gap-2 shrink-0"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="w-4 h-4" />
          Add Merchant
        </button>
      </div>

      {issuedKeys.length > 0 && (
        <div className="card border-emerald-200 bg-emerald-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> Newly issued device licenses
            </h3>
            <button className="text-sm text-gray-500" onClick={() => setIssuedKeys([])}>
              Dismiss
            </button>
          </div>
          <ul className="space-y-2">
            {issuedKeys.map((k) => (
              <li
                key={k.licenseKey}
                className="flex items-center justify-between gap-3 bg-white rounded-lg px-3 py-2 border"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{k.deviceName}</p>
                  <p className="font-mono text-xs truncate">{k.licenseKey}</p>
                </div>
                <button className="btn-secondary p-2" onClick={() => copyText(k.licenseKey)}>
                  <Copy className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search merchants..."
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          className="input pl-10"
        />
      </div>

      <div className="card !p-0 table-scroll">
        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : merchants.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No merchants found</div>
        ) : (
          <table className="w-full min-w-[860px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 sm:px-4 py-3 text-left text-sm font-semibold">Name</th>
                <th className="px-3 sm:px-4 py-3 text-left text-sm font-semibold">Email</th>
                <th className="px-3 sm:px-4 py-3 text-left text-sm font-semibold">Shop</th>
                <th className="px-3 sm:px-4 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-3 sm:px-4 py-3 text-left text-sm font-semibold">POS version</th>
                <th className="px-3 sm:px-4 py-3 text-left text-sm font-semibold">Inventory</th>
                <th className="px-3 sm:px-4 py-3 text-left text-sm font-semibold">Devices</th>
                <th className="px-3 sm:px-4 py-3 text-left text-sm font-semibold">Licenses</th>
                <th className="px-3 sm:px-4 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((merchant) => (
                <tr key={merchant.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 sm:px-4 py-3 font-medium">
                    <span className="cell-truncate block" title={merchant.name}>
                      {merchant.name}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-gray-600">
                    <span className="cell-truncate block" title={merchant.email}>
                      {merchant.email}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {merchant.shopEnabled ? (
                      <span className="text-emerald-700" title={`/${merchant.slug || '-'}`}>
                        /{merchant.slug || '-'}
                      </span>
                    ) : (
                      <span className="text-gray-400">off</span>
                    )}
                  </td>
                  <td className="px-3 sm:px-4 py-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                        merchant.status
                      )}`}
                    >
                      {merchant.status}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 py-3">
                    <div className="flex flex-col gap-0.5 min-w-[8rem]">
                      <PosVersionBadge name={merchant.editionName} />
                      <span
                        className="text-[11px] text-gray-500"
                        title={
                          merchant.lastAppVersionSeenAt
                            ? `Last seen ${new Date(merchant.lastAppVersionSeenAt).toLocaleString()}`
                            : 'Android app version last reported by a device'
                        }
                      >
                        {merchant.lastAppVersion
                          ? `Android ${merchant.lastAppVersion}`
                          : 'No Android seen'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 py-3">
                    {merchant.inventoryAddonEnabled === true || merchant.inventoryEnabled === true ? (
                      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        Addon on
                      </span>
                    ) : (
                      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                        Off
                      </span>
                    )}
                  </td>
                  <td className="px-3 sm:px-4 py-3">{merchant.devices}</td>
                  <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                    {merchant.activeLicenses ?? merchant.licenses}
                    <span className="text-gray-400 text-xs"> / {merchant.licenses}</span>
                  </td>
                  <td className="px-3 sm:px-4 py-3">
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <button
                        className="p-2 hover:bg-gray-100 rounded"
                        title="View"
                        onClick={() => openDetail(merchant)}
                      >
                        <Eye className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        className="p-2 hover:bg-gray-100 rounded"
                        title="Open merchant panel"
                        disabled={openingId === merchant.id}
                        onClick={() => void openMerchantPanel(merchant)}
                      >
                        <LogIn className="w-4 h-4 text-teal-700" />
                      </button>
                      {merchant.status === 'suspended' ? (
                        <button
                          className="p-2 hover:bg-gray-100 rounded text-xs text-emerald-700"
                          onClick={() => handleReactivate(merchant.id)}
                        >
                          Reactivate
                        </button>
                      ) : (
                        <button
                          className="p-2 hover:bg-gray-100 rounded"
                          title="Suspend"
                          onClick={() => handleSuspend(merchant.id)}
                        >
                          <Edit2 className="w-4 h-4 text-amber-600" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(merchant.id)}
                        className="p-2 hover:bg-gray-100 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Page {page}</p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="btn-secondary disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setPage(page + 1)}
            disabled={merchants.length < 10}
            className="btn-secondary disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-bold">Create merchant</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block md:col-span-2">
                  <span className="text-sm font-medium">Business name *</span>
                  <input
                    className="input mt-1"
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Login email *</span>
                  <input
                    type="email"
                    className="input mt-1"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Temp password *</span>
                  <input
                    type="text"
                    className="input mt-1"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={8}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Phone</span>
                  <input
                    className="input mt-1"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">City</span>
                  <input
                    className="input mt-1"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-sm font-medium">Address</span>
                  <input
                    className="input mt-1"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Shop slug</span>
                  <input
                    className="input mt-1"
                    placeholder="auto from name"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Subscription / License</span>
                  <select
                    className="input mt-1"
                    value={form.subscriptionPlan}
                    onChange={(e) => setForm({ ...form, subscriptionPlan: e.target.value })}
                  >
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Business category</span>
                  <select
                    className="input mt-1"
                    value={form.businessCategory}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        businessCategory: e.target.value as 'retail' | 'restaurant',
                      })
                    }
                  >
                    <option value="restaurant">Restaurant / Catering</option>
                    <option value="retail">Retail</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium">POS version *</span>
                  <select
                    className="input mt-1"
                    value={form.editionId}
                    onChange={(e) => setForm({ ...form, editionId: e.target.value })}
                    required
                  >
                    <option value="">Select POS version…</option>
                    {editions.map((ed) => (
                      <option key={ed.id} value={ed.id}>
                        {ed.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Reseller / dealer</span>
                  <select
                    className="input mt-1"
                    value={form.resellerId}
                    onChange={(e) => setForm({ ...form, resellerId: e.target.value })}
                  >
                    <option value="">None (assign later)</option>
                    {resellers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={form.shopEnabled}
                    onChange={(e) => setForm({ ...form, shopEnabled: e.target.checked })}
                  />
                  Enable online shop
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="block">
                    <span className="text-sm font-medium">Device license seats</span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      className="input mt-1"
                      value={form.deviceSeats}
                      onChange={(e) => setForm({ ...form, deviceSeats: Number(e.target.value) })}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium">License type</span>
                    <select
                      className="input mt-1"
                      value={form.licenseType}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          licenseType: e.target.value as 'trial' | 'yearly' | 'custom',
                        })
                      }
                    >
                      <option value="trial">Trial (7 days)</option>
                      <option value="yearly">Yearly</option>
                      <option value="custom">Custom days</option>
                    </select>
                  </label>
                  {form.licenseType === 'custom' && (
                    <label className="block">
                      <span className="text-sm font-medium">Days</span>
                      <input
                        type="number"
                        min={1}
                        className="input mt-1"
                        value={form.customDays}
                        onChange={(e) => setForm({ ...form, customDays: Number(e.target.value) })}
                      />
                    </label>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Each seat creates a POS device slot + license key the Android/ChaslayReborn app can activate.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <label className="block">
                    <span className="text-sm font-medium">Max main POS stations</span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      className="input mt-1"
                      value={form.maxPosPosts}
                      onChange={(e) => setForm({ ...form, maxPosPosts: Number(e.target.value) })}
                    />
                    <span className="text-xs text-gray-500">0 = unlimited</span>
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium">Max waiter stations</span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      className="input mt-1"
                      value={form.maxWaiterPosts}
                      onChange={(e) => setForm({ ...form, maxWaiterPosts: Number(e.target.value) })}
                    />
                    <span className="text-xs text-gray-500">0 = unlimited</span>
                  </label>
                </div>
                <label className="flex items-start gap-2 text-sm pt-2">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!form.inventoryAddonEnabled}
                    onChange={(e) => setForm({ ...form, inventoryAddonEnabled: e.target.checked })}
                  />
                  <span>
                    <span className="font-medium block">Restaurant inventory addon</span>
                    <span className="text-xs text-gray-500">
                      Ingredients, recipes, suppliers, auto-reorder emails (paid extra).
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm pt-2">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!form.signageAddonEnabled}
                    onChange={(e) => setForm({ ...form, signageAddonEnabled: e.target.checked })}
                  />
                  <span>
                    <span className="font-medium block">Chaslay Screens (digital signage)</span>
                    <span className="text-xs text-gray-500">
                      TV menu boards and promo playlists. Does not consume POS seats.
                    </span>
                  </span>
                </label>
                <label className="block text-sm pt-1">
                  <span className="font-medium">Screen limit</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    className="input mt-1"
                    value={form.signageScreenLimit}
                    onChange={(e) => setForm({ ...form, signageScreenLimit: Number(e.target.value) || 2 })}
                  />
                  <span className="text-xs text-gray-500">Default 2. TVs are not POS stations.</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Creating…' : 'Create merchant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-bold">{showDetail.name}</h2>
              <button
                onClick={() => {
                  setShowDetail(null);
                  setDetailFull(null);
                }}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <p>
                <span className="text-gray-500">Email:</span> {showDetail.email}
              </p>
              <p>
                <span className="text-gray-500">Status:</span> {showDetail.status}
              </p>
              <div className="rounded-lg border border-teal-100 bg-teal-50/60 px-3 py-3 space-y-2">
                <p className="font-semibold text-teal-950">POS version</p>
                <div className="flex flex-wrap items-center gap-2">
                  <PosVersionBadge
                    name={detailFull?.editionName ?? detailFull?.edition?.name ?? showDetail.editionName}
                  />
                  {(detailFull?.subscriptionPlan || showDetail.subscriptionPlan) && (
                    <span className="text-xs text-gray-500">
                      Plan: {detailFull?.subscriptionPlan || showDetail.subscriptionPlan}
                    </span>
                  )}
                </div>
                <p>
                  <span className="text-gray-500">Android app:</span>{' '}
                  {detailFull?.lastAppVersion || showDetail.lastAppVersion ? (
                    <>
                      {detailFull?.lastAppVersion || showDetail.lastAppVersion}
                      {(detailFull?.lastAppVersionSeenAt || showDetail.lastAppVersionSeenAt) && (
                        <span className="text-gray-400">
                          {' '}
                          · last seen{' '}
                          {new Date(
                            detailFull?.lastAppVersionSeenAt || showDetail.lastAppVersionSeenAt || ''
                          ).toLocaleString()}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-400">No device has reported a version yet</span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  WebPOS is the shared platform deploy (same build for every merchant).
                </p>
              </div>
              <p>
                <span className="text-gray-500">Shop:</span>{' '}
                {showDetail.shopEnabled ? `/${showDetail.slug || '-'}` : 'disabled'}
              </p>
              <p>
                <span className="text-gray-500">Devices / licenses:</span> {showDetail.devices} /{' '}
                {showDetail.licenses}
              </p>
              {detailFull?.devices?.length > 0 && (
                <div>
                  <p className="font-semibold mb-2">Devices</p>
                  <ul className="space-y-1">
                    {detailFull.devices.map((d: any) => (
                      <li key={d.id} className="font-mono text-xs bg-gray-50 rounded px-2 py-1">
                        {d.deviceName} · {d.deviceId}
                        {d.appVersion ? ` · Android ${d.appVersion}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {detailFull?.licenses?.length > 0 && (
                <div>
                  <p className="font-semibold mb-2">Licenses</p>
                  <ul className="space-y-1">
                    {detailFull.licenses.map((l: any) => (
                      <li
                        key={l.id}
                        className="flex items-center justify-between gap-2 bg-gray-50 rounded px-2 py-1"
                      >
                        <span className="font-mono text-xs truncate">{l.licenseKey}</span>
                        <button className="p-1" onClick={() => copyText(l.licenseKey)}>
                          <Copy className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="pt-3 border-t space-y-3">
                <div>
                  <p className="font-semibold mb-2">POS station limits</p>
                  <p className="text-xs text-gray-500 mb-2">
                    Concurrent main tills (WebPOS + Android) and waiter stations. Merchants cannot
                    change these — agency/reseller managed.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-xs">
                      Max main POS
                      <input
                        type="number"
                        min={0}
                        max={99}
                        className="input mt-1"
                        value={posLimits.maxPosPosts}
                        onChange={(e) =>
                          setPosLimits({ ...posLimits, maxPosPosts: Number(e.target.value) || 0 })
                        }
                      />
                    </label>
                    <label className="block text-xs">
                      Max waiter
                      <input
                        type="number"
                        min={0}
                        max={99}
                        className="input mt-1"
                        value={posLimits.maxWaiterPosts}
                        onChange={(e) =>
                          setPosLimits({
                            ...posLimits,
                            maxWaiterPosts: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </label>
                  </div>
                  <label className="flex items-start gap-2 text-sm mt-3">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={!!posLimits.inventoryAddonEnabled}
                      onChange={(e) =>
                        setPosLimits({ ...posLimits, inventoryAddonEnabled: e.target.checked })
                      }
                    />
                    <span>
                      <span className="font-medium block">Restaurant inventory addon</span>
                      <span className="text-xs text-gray-500">
                        Paid extra: recipes, stock, suppliers, low-stock emails.
                      </span>
                      <span
                        className={`mt-1 inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          posLimits.inventoryAddonEnabled
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {posLimits.inventoryAddonEnabled ? 'Currently on' : 'Currently off'}
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm mt-3">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={!!posLimits.signageAddonEnabled}
                      onChange={(e) =>
                        setPosLimits({ ...posLimits, signageAddonEnabled: e.target.checked })
                      }
                    />
                    <span>
                      <span className="font-medium block">Chaslay Screens (digital signage)</span>
                      <span className="text-xs text-gray-500">
                        Paid extra: live menu boards on restaurant TVs. Does not use POS seats.
                      </span>
                      <span
                        className={`mt-1 inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          posLimits.signageAddonEnabled
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {posLimits.signageAddonEnabled ? 'Currently on' : 'Currently off'}
                      </span>
                    </span>
                  </label>
                  <label className="block text-sm mt-2">
                    <span className="font-medium">Screen limit</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      className="input mt-1"
                      value={posLimits.signageScreenLimit}
                      onChange={(e) =>
                        setPosLimits({
                          ...posLimits,
                          signageScreenLimit: Number(e.target.value) || 2,
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="btn-secondary mt-2 text-sm"
                    disabled={savingPosLimits}
                    onClick={() => void handleSavePosLimits()}
                  >
                    {savingPosLimits ? 'Saving…' : 'Save POS limits & addons'}
                  </button>
                </div>
                <div>
                  <p className="font-semibold mb-2 flex items-center gap-2">
                    <KeyRound className="w-4 h-4" /> Reset password
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    Sets a new password for panel + Android POS email login (
                    {showDetail.email}).
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input flex-1"
                      placeholder="New password (min 6)"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="btn-secondary whitespace-nowrap"
                      disabled={resettingPassword || resetPassword.length < 6}
                      onClick={() => void handleResetPassword()}
                    >
                      {resettingPassword ? 'Saving…' : 'Reset'}
                    </button>
                  </div>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-3">
                  <p className="font-semibold text-red-900 flex items-center gap-2">
                    <Eraser className="w-4 h-4" /> Purge test sales data
                  </p>
                  <p className="text-xs text-red-800">
                    Deletes all POS / ChaslayReborn / online orders, held carts, payment records, shifts,
                    daily reports, floor sync orders, and loyalty/gift history. Keeps menu, staff,
                    settings, licenses, and devices. Use after merchant testing to start from zero.
                  </p>
                  <label className="flex items-center gap-2 text-xs text-red-900">
                    <input
                      type="checkbox"
                      checked={deleteCustomersToo}
                      onChange={(e) => setDeleteCustomersToo(e.target.checked)}
                    />
                    Also delete customer profiles (otherwise only reset spend / points stats)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input flex-1 border-red-200"
                      placeholder='Type DELETE ALL SALES'
                      value={purgeConfirm}
                      onChange={(e) => setPurgeConfirm(e.target.value)}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="btn-secondary whitespace-nowrap border-red-300 text-red-800 hover:bg-red-100"
                      disabled={purgingSales || purgeConfirm !== 'DELETE ALL SALES'}
                      onClick={() => void handlePurgeSalesData()}
                    >
                      {purgingSales ? 'Purging…' : 'Purge sales'}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={openingId === showDetail.id}
                    onClick={() => void openMerchantPanel(showDetail)}
                  >
                    <LogIn className="w-4 h-4" />
                    {openingId === showDetail.id ? 'Opening…' : 'Open merchant panel'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
