import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type Release = {
  id: string;
  version: string;
  title: string;
  body: string;
  product: string;
  isPublished: boolean;
  publishedAt: string;
};

const emptyForm = {
  version: '',
  title: '',
  body: '',
  product: 'all',
  isPublished: true,
};

export default function SoftwareReleasesAdmin() {
  const { t } = useI18n();
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Release | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/software-releases');
      setReleases(res.data.releases || []);
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          t('softwareUpdatesLoadFailed')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm(emptyForm);
  };

  const openEdit = (release: Release) => {
    setCreating(false);
    setEditing(release);
    setForm({
      version: release.version,
      title: release.title,
      body: release.body,
      product: release.product || 'all',
      isPublished: release.isPublished,
    });
  };

  const save = async () => {
    if (!form.version.trim() || !form.title.trim()) {
      toast.error(t('softwareUpdatesVersionRequired'));
      return;
    }
    setSaving(true);
    try {
      const body = {
        version: form.version,
        title: form.title,
        body: form.body,
        product: form.product,
        isPublished: form.isPublished,
      };
      if (editing) {
        await api.put(`/superadmin/software-releases/${editing.id}`, body);
      } else {
        await api.post('/superadmin/software-releases', body);
      }
      toast.success(t('softwareUpdatesSaved'));
      setCreating(false);
      setEditing(null);
      setForm(emptyForm);
      await load();
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          t('softwareUpdatesSaveFailed')
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (release: Release) => {
    if (!window.confirm(`${t('delete')} v${release.version}?`)) return;
    try {
      await api.delete(`/superadmin/software-releases/${release.id}`);
      toast.success(t('deleted'));
      await load();
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          t('softwareUpdatesSaveFailed')
      );
    }
  };

  const showForm = creating || editing;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900">{t('softwareUpdatesAdminTitle')}</h1>
          <p className="mt-1 text-sm text-stone-600">{t('softwareUpdatesAdminHint')}</p>
        </div>
        {!showForm ? (
          <button type="button" className="btn-primary text-sm" onClick={openCreate}>
            {t('softwareUpdatesAdd')}
          </button>
        ) : null}
      </div>

      {showForm ? (
        <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="font-medium">{editing ? t('edit') : t('softwareUpdatesAdd')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              {t('softwareUpdatesVersion')}
              <input
                className="input mt-1"
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                placeholder="1.4.2"
              />
            </label>
            <label className="block text-sm">
              {t('softwareUpdatesProduct')}
              <select
                className="input mt-1"
                value={form.product}
                onChange={(e) => setForm({ ...form, product: e.target.value })}
              >
                <option value="all">{t('softwareUpdatesProductAll')}</option>
                <option value="platform">{t('softwareUpdatesProductPlatform')}</option>
                <option value="desktop">{t('softwareUpdatesProductDesktop')}</option>
                <option value="android">{t('softwareUpdatesProductAndroid')}</option>
              </select>
            </label>
          </div>
          <label className="block text-sm">
            {t('title')}
            <input
              className="input mt-1 w-full"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            {t('softwareUpdatesNotes')}
            <textarea
              className="input mt-1 min-h-[140px] w-full"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
            />
            {t('softwareUpdatesPublished')}
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn-primary text-sm" disabled={saving} onClick={() => void save()}>
              {saving ? t('saving') : t('save')}
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

      <div className="card table-scroll !p-0 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50 text-left text-stone-600">
            <tr>
              <th className="px-3 py-2">{t('softwareUpdatesVersion')}</th>
              <th className="px-3 py-2">{t('title')}</th>
              <th className="px-3 py-2">{t('date')}</th>
              <th className="px-3 py-2">{t('status')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-stone-500">
                  {t('loading')}
                </td>
              </tr>
            ) : !releases.length ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-stone-500">
                  {t('softwareUpdatesEmpty')}
                </td>
              </tr>
            ) : (
              releases.map((release) => (
                <tr key={release.id} className="border-t border-stone-100">
                  <td className="px-3 py-2 font-mono font-semibold">v{release.version}</td>
                  <td className="px-3 py-2">{release.title}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {new Date(release.publishedAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    {release.isPublished ? t('softwareUpdatesPublished') : t('inactive')}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button type="button" className="mr-2 text-xs text-blue-600" onClick={() => openEdit(release)}>
                      {t('edit')}
                    </button>
                    <button type="button" className="text-xs text-red-600" onClick={() => void remove(release)}>
                      {t('delete')}
                    </button>
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
