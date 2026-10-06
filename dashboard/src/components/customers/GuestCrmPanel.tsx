import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type Profile = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  tags: string[];
  orderCount: number;
  lastVisit?: string | null;
  loyaltyPoints: number;
  lifetimeRevenue: number;
};

export default function GuestCrmPanel() {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [tagEdit, setTagEdit] = useState<{ id: string; value: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (search.trim()) params.set('search', search.trim());
      const res = await api.get(`/merchant/guest-crm/profiles?${params}`);
      setProfiles(res.data.profiles || []);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; code?: string } } };
      if (err.response?.data?.code === 'GUEST_CRM_ADDON') {
        setProfiles([]);
      } else {
        toast.error(err.response?.data?.error || t('customersToastLoadFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveTags = async (id: string, raw: string) => {
    const tags = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
    try {
      await api.patch(`/merchant/guest-crm/profiles/${id}/tags`, { tags });
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, tags } : p)));
      setTagEdit(null);
      toast.success(t('ovSettingsSaved'));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('ovSettingsSaveFailed'));
    }
  };

  const fmtDate = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return '—';
    }
  };

  return (
    <div className="space-y-4">
      <input
        className="input max-w-md"
        placeholder={t('customersEmail')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {loading ? (
        <p className="text-sm muted">{t('loading')}</p>
      ) : profiles.length === 0 ? (
        <p className="text-sm muted">{t('customersEmpty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)] text-[var(--text-muted)]">
                <th className="px-3 py-2 font-medium">{t('customersFirstName')}</th>
                <th className="px-3 py-2 font-medium">{t('customersPhone')}</th>
                <th className="px-3 py-2 font-medium text-right">Visits</th>
                <th className="px-3 py-2 font-medium">Last visit</th>
                <th className="px-3 py-2 font-medium">Tags</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-[var(--border)]/60">
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">
                    {[p.email, p.phone].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.orderCount}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtDate(p.lastVisit)}</td>
                  <td className="px-3 py-2">
                    {tagEdit?.id === p.id ? (
                      <input
                        className="input py-1 text-xs"
                        autoFocus
                        defaultValue={p.tags.join(', ')}
                        onBlur={(e) => void saveTags(p.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void saveTags(p.id, (e.target as HTMLInputElement).value);
                          }
                          if (e.key === 'Escape') setTagEdit(null);
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-left text-xs text-teal-800 hover:underline"
                        onClick={() => setTagEdit({ id: p.id, value: p.tags.join(', ') })}
                      >
                        {p.tags.length ? p.tags.join(', ') : 'Add tags…'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
