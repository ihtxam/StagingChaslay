import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type Message = {
  id: string;
  kind: string;
  audience: string;
  title: string;
  body: string;
  severity: string;
  externalUrl?: string | null;
  externalLabel?: string | null;
  showOnLogin: boolean;
  showInBanner: boolean;
  isActive: boolean;
  targetMerchantId?: string | null;
  targetResellerId?: string | null;
  createdAt: string;
};

const emptyForm = {
  kind: 'announcement',
  audience: 'all_merchants',
  title: '',
  body: '',
  severity: 'info',
  externalUrl: '',
  externalLabel: '',
  showOnLogin: true,
  showInBanner: false,
  targetMerchantId: '',
  targetResellerId: '',
};

export default function PlatformMessagesAdmin() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [editing, setEditing] = useState<Message | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/platform-messages', { params: { all: '1' } });
      setMessages(res.data.messages || []);
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Load failed'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = (kind: string) => {
    setCreating(true);
    setEditing(null);
    setForm({
      ...emptyForm,
      kind,
      showInBanner: kind === 'incident',
      showOnLogin: kind !== 'incident',
      severity: kind === 'incident' ? 'warning' : 'info',
    });
  };

  const openEdit = (msg: Message) => {
    setCreating(false);
    setEditing(msg);
    setForm({
      kind: msg.kind,
      audience: msg.audience,
      title: msg.title,
      body: msg.body,
      severity: msg.severity,
      externalUrl: msg.externalUrl || '',
      externalLabel: msg.externalLabel || '',
      showOnLogin: msg.showOnLogin,
      showInBanner: msg.showInBanner,
      targetMerchantId: msg.targetMerchantId || '',
      targetResellerId: msg.targetResellerId || '',
    });
  };

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error(t('titleAndBodyRequired'));
      return;
    }
    setSaving(true);
    try {
      const body = {
        kind: form.kind,
        audience: form.audience,
        title: form.title,
        body: form.body,
        severity: form.severity,
        externalUrl: form.externalUrl || null,
        externalLabel: form.externalLabel || null,
        showOnLogin: form.showOnLogin,
        showInBanner: form.showInBanner,
        targetMerchantId: form.audience === 'merchant' ? form.targetMerchantId || null : null,
        targetResellerId: form.audience === 'reseller' ? form.targetResellerId || null : null,
      };
      if (editing) {
        await api.put(`/superadmin/platform-messages/${editing.id}`, body);
        toast.success(t('saved'));
      } else {
        await api.post('/superadmin/platform-messages', body);
        toast.success(t('platformMessagePublished'));
      }
      setCreating(false);
      setEditing(null);
      setForm(emptyForm);
      await load();
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Save failed'
      );
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (msg: Message) => {
    if (!window.confirm(`${t('deactivate')} "${msg.title}"?`)) return;
    try {
      await api.delete(`/superadmin/platform-messages/${msg.id}`);
      toast.success(t('deactivated'));
      await load();
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'
      );
    }
  };

  const showForm = creating || editing;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900">{t('platformMessagesAdmin')}</h1>
          <p className="text-sm text-stone-600 mt-1">{t('platformMessagesAdminHint')}</p>
        </div>
        {!showForm ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => openCreate('whats_new')}>
              {t('platformWhatsNew')}
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={() => openCreate('announcement')}>
              {t('platformAnnouncement')}
            </button>
            <button type="button" className="btn-primary text-sm" onClick={() => openCreate('incident')}>
              {t('platformIncident')}
            </button>
          </div>
        ) : null}
      </div>

      {showForm ? (
        <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
          <h2 className="font-medium">
            {editing ? t('edit') : t('create')} — {form.kind}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="whats_new">{t('platformWhatsNew')}</option>
              <option value="announcement">{t('platformAnnouncement')}</option>
              <option value="incident">{t('platformIncident')}</option>
            </select>
            <select className="input" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
              <option value="all_merchants">{t('platformAudienceAllMerchants')}</option>
              <option value="all_resellers">{t('platformAudienceAllResellers')}</option>
              <option value="all">{t('platformAudienceAll')}</option>
              <option value="merchant">{t('platformAudienceMerchant')}</option>
              <option value="reseller">{t('platformAudienceReseller')}</option>
            </select>
            {form.audience === 'merchant' ? (
              <input
                className="input sm:col-span-2"
                placeholder={t('platformTargetMerchantId')}
                value={form.targetMerchantId}
                onChange={(e) => setForm({ ...form, targetMerchantId: e.target.value })}
              />
            ) : null}
            {form.audience === 'reseller' ? (
              <input
                className="input sm:col-span-2"
                placeholder={t('platformTargetResellerId')}
                value={form.targetResellerId}
                onChange={(e) => setForm({ ...form, targetResellerId: e.target.value })}
              />
            ) : null}
            <select className="input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <input className="input w-full" placeholder={t('title')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className="input w-full min-h-[120px]" placeholder={t('description')} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="input" placeholder={t('platformExternalUrl')} value={form.externalUrl} onChange={(e) => setForm({ ...form, externalUrl: e.target.value })} />
            <input className="input" placeholder={t('platformExternalLabel')} value={form.externalLabel} onChange={(e) => setForm({ ...form, externalLabel: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.showOnLogin} onChange={(e) => setForm({ ...form, showOnLogin: e.target.checked })} />
              {t('platformShowOnLogin')}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.showInBanner} onChange={(e) => setForm({ ...form, showInBanner: e.target.checked })} />
              {t('platformShowInBanner')}
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary text-sm" disabled={saving} onClick={() => void save()}>
              {t('publish')}
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => {
                setCreating(false);
                setEditing(null);
                setForm(emptyForm);
              }}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : null}

      <div className="card !p-0 table-scroll overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50 text-left text-stone-600">
            <tr>
              <th className="px-3 py-2">{t('date')}</th>
              <th className="px-3 py-2">{t('kind')}</th>
              <th className="px-3 py-2">{t('audience')}</th>
              <th className="px-3 py-2">{t('title')}</th>
              <th className="px-3 py-2">{t('status')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-stone-500">
                  {t('loading')}
                </td>
              </tr>
            ) : (
              messages.map((msg) => (
                <tr key={msg.id} className="border-t border-stone-100">
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{new Date(msg.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2 capitalize">{msg.kind.replace('_', ' ')}</td>
                  <td className="px-3 py-2 text-xs">{msg.audience}</td>
                  <td className="px-3 py-2 font-medium">{msg.title}</td>
                  <td className="px-3 py-2">{msg.isActive ? t('active') : t('inactive')}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button type="button" className="text-xs text-blue-600 mr-2" onClick={() => openEdit(msg)}>
                      {t('edit')}
                    </button>
                    {msg.isActive ? (
                      <button type="button" className="text-xs text-red-600" onClick={() => void deactivate(msg)}>
                        {t('deactivate')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
