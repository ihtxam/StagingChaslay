import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CreditCard, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type PaymentProfile = {
  id: string;
  name: string;
  locationId: string | null;
  isDefault: boolean;
  adyenMerchantAccount: string | null;
  adyenClientId: string | null;
  adyenApiKeySet?: boolean;
  terminalCount?: number;
};

type TerminalRow = {
  id: string;
  terminalId: string;
  terminalName: string;
  paymentProfileId?: string;
};

export default function PaymentProfilesSection() {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState<PaymentProfile[]>([]);
  const [terminals, setTerminals] = useState<TerminalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, tRes] = await Promise.all([
        api.get('/merchant/payment-profiles'),
        api.get('/terminals'),
      ]);
      setProfiles(pRes.data?.profiles || []);
      setTerminals(
        (tRes.data?.terminals || []).map((row: TerminalRow) => ({
          id: row.id,
          terminalId: row.terminalId,
          terminalName: row.terminalName,
          paymentProfileId: row.paymentProfileId,
        }))
      );
      const first = pRes.data?.profiles?.[0]?.id;
      if (first && !selectedId) setSelectedId(first);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { error?: string } } }).response?.data?.error || '')
          : '';
      toast.error(msg || t('saveFailed'));
    } finally {
      setLoading(false);
    }
  }, [selectedId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = profiles.find((p) => p.id === selectedId) || profiles[0];

  const createProfile = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await api.post('/merchant/payment-profiles', { name });
      setNewName('');
      await load();
      toast.success(t('saved'));
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { error?: string } } }).response?.data?.error || '')
          : '';
      toast.error(msg || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const assignTerminal = async (terminalId: string, profileId: string) => {
    try {
      await api.put(`/merchant/payment-profiles/${profileId}/terminals`, {
        terminalIds: [terminalId],
      });
      await load();
      toast.success(t('saved'));
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { error?: string } } }).response?.data?.error || '')
          : '';
      toast.error(msg || t('saveFailed'));
    }
  };

  const removeProfile = async (id: string) => {
    if (!window.confirm(t('paymentProfileDeleteConfirm'))) return;
    try {
      await api.delete(`/merchant/payment-profiles/${id}`);
      await load();
      toast.success(t('saved'));
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { error?: string } } }).response?.data?.error || '')
          : '';
      toast.error(msg || t('saveFailed'));
    }
  };

  if (loading) {
    return <p className="text-sm muted">{t('loading')}</p>;
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/20 p-4">
      <div className="flex items-start gap-2">
        <CreditCard className="mt-0.5 h-5 w-5 text-[var(--text-muted)]" aria-hidden />
        <div>
          <h3 className="text-sm font-semibold">{t('paymentProfilesTitle')}</h3>
          <p className="text-xs text-[var(--text-muted)]">{t('paymentProfilesHint')}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              selected?.id === p.id
                ? 'border-teal-600 bg-teal-50 text-teal-900'
                : 'border-[var(--border)] bg-white'
            }`}
            onClick={() => setSelectedId(p.id)}
          >
            {p.name}
            {p.isDefault ? ` (${t('default')})` : ''}
          </button>
        ))}
      </div>

      {selected ? (
        <div className="space-y-3 rounded-lg border border-[var(--border)] bg-white p-3">
          <p className="text-xs text-[var(--text-muted)]">
            {t('paymentProfileAdyenAccount')}:{' '}
            <span className="font-mono text-[var(--text)]">
              {selected.adyenMerchantAccount || t('paymentProfileInheritMerchant')}
            </span>
          </p>
          {!selected.isDefault ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-semibold text-red-700"
              onClick={() => void removeProfile(selected.id)}
            >
              <Trash2 size={14} />
              {t('delete')}
            </button>
          ) : null}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {t('paymentProfileAssignTerminals')}
            </p>
            <ul className="space-y-1">
              {terminals.map((term) => {
                const assigned = term.paymentProfileId === selected.id;
                return (
                  <li
                    key={term.id}
                    className="flex items-center justify-between gap-2 rounded border border-[var(--border)] px-2 py-1.5 text-sm"
                  >
                    <span>{term.terminalName || term.terminalId}</span>
                    <button
                      type="button"
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        assigned
                          ? 'bg-teal-100 text-teal-900'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                      onClick={() => void assignTerminal(term.id, selected.id)}
                    >
                      {assigned ? t('paymentProfileAssigned') : t('paymentProfileAssign')}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2 border-t border-[var(--border)] pt-3">
        <label className="flex-1 text-sm">
          <span className="mb-1 block text-xs font-medium">{t('paymentProfileNewName')}</span>
          <input
            className="input w-full"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('paymentProfileNewNamePlaceholder')}
          />
        </label>
        <button
          type="button"
          className="btn-primary inline-flex items-center gap-1"
          disabled={saving || !newName.trim()}
          onClick={() => void createProfile()}
        >
          <Plus size={16} />
          {t('paymentProfileAdd')}
        </button>
      </div>
    </div>
  );
}
