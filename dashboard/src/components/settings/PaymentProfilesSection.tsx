import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CreditCard } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { isPanelLocationSwitcherActive } from '@/lib/panel-scope-nav';
import { useLocationStore } from '@/store/location';

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
  const { locationId, location, isHqView, locations, limits } = useLocationStore();
  const branchSwitcher = isPanelLocationSwitcherActive({
    locationCount: locations.length,
    maxLocations: limits?.maxLocations,
  });

  const [profile, setProfile] = useState<PaymentProfile | null>(null);
  const [terminals, setTerminals] = useState<TerminalRow[]>([]);
  const [loading, setLoading] = useState(true);

  const sectionTitle = useMemo(() => {
    const branchName = location?.name?.trim() || profile?.name || '';
    if (branchName) {
      return t('branchPaymentsTitle').replace('{branch}', branchName);
    }
    return t('branchPaymentsTitleFallback');
  }, [location?.name, profile?.name, t]);

  const load = useCallback(async () => {
    if (branchSwitcher && isHqView) {
      setProfile(null);
      setTerminals([]);
      setLoading(false);
      return;
    }
    const scopedLocationId = branchSwitcher ? locationId : locationId || undefined;
    if (branchSwitcher && !scopedLocationId) {
      setProfile(null);
      setTerminals([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = scopedLocationId ? { locationId: scopedLocationId } : undefined;
      const [pRes, tRes] = await Promise.all([
        api.get('/merchant/payment-profiles', { params }),
        api.get('/merchant/payment-profiles/terminals', { params }),
      ]);
      const profiles = (pRes.data?.profiles || []) as PaymentProfile[];
      const branchProfile = profiles[0] || null;
      setProfile(branchProfile);
      setTerminals((tRes.data?.terminals || []) as TerminalRow[]);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { error?: string } } }).response?.data?.error || '')
          : '';
      toast.error(msg || t('saveFailed'));
    } finally {
      setLoading(false);
    }
  }, [branchSwitcher, isHqView, locationId, t]);

  useEffect(() => {
    void load();
  }, [load]);

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

  if (branchSwitcher && isHqView) {
    return null;
  }

  if (branchSwitcher && !locationId) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        {t('hqSettingsPickBranch')}
      </p>
    );
  }

  if (loading) {
    return <p className="text-sm muted">{t('loading')}</p>;
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/20 p-4">
      <div className="flex items-start gap-2">
        <CreditCard className="mt-0.5 h-5 w-5 text-[var(--text-muted)]" aria-hidden />
        <div>
          <h3 className="text-sm font-semibold">{sectionTitle}</h3>
          <p className="text-xs text-[var(--text-muted)]">{t('branchPaymentsHint')}</p>
        </div>
      </div>

      {profile ? (
        <div className="space-y-3 rounded-lg border border-[var(--border)] bg-white p-3">
          <p className="text-xs text-[var(--text-muted)]">
            {t('paymentProfileAdyenAccount')}:{' '}
            <span className="font-mono text-[var(--text)]">
              {profile.adyenMerchantAccount || t('paymentProfileInheritMerchant')}
            </span>
          </p>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {t('paymentProfileAssignTerminals')}
            </p>
            {terminals.length === 0 ? (
              <p className="text-sm muted">{t('paymentTerminalsHint')}</p>
            ) : (
              <ul className="space-y-1">
                {terminals.map((term) => {
                  const assigned = term.paymentProfileId === profile.id;
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
                        onClick={() => void assignTerminal(term.id, profile.id)}
                      >
                        {assigned ? t('paymentProfileAssigned') : t('paymentProfileAssign')}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm muted">{t('saveFailed')}</p>
      )}
    </div>
  );
}
