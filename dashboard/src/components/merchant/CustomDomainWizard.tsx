import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '@/lib/api';
import { SHOP_HOST } from '@/lib/brand';
import { useI18n } from '@/lib/i18n';

export type CustomDomainSetupStatus = {
  enabled: boolean;
  shopHost: string;
  domain: string | null;
  pendingDomain: string | null;
  activeDomain: string | null;
  dnsStatus: 'none' | 'pending' | 'verified' | 'failed';
  sslStatus: 'none' | 'pending' | 'active' | 'failed';
  verifiedAt: string | null;
  shopUrl: string | null;
  step: 'enter' | 'verify_dns' | 'ssl' | 'active';
  dnsHintHost: string;
};

type Props = {
  initialActiveDomain?: string | null;
  initialShopUrl?: string | null;
  onStatusChange?: (status: CustomDomainSetupStatus | null) => void;
};

const STEPS = ['enter', 'verify_dns', 'ssl', 'active'] as const;

function stepIndex(step: CustomDomainSetupStatus['step']): number {
  return STEPS.indexOf(step === 'enter' ? 'enter' : step);
}

function bootstrapStatus(
  activeDomain?: string | null,
  shopUrl?: string | null
): CustomDomainSetupStatus | null {
  const active = activeDomain?.trim();
  if (!active) return null;
  return {
    enabled: true,
    shopHost: SHOP_HOST,
    domain: active,
    pendingDomain: null,
    activeDomain: active,
    dnsStatus: 'verified',
    sslStatus: 'active',
    verifiedAt: null,
    shopUrl: shopUrl || `https://${active}`,
    step: 'active',
    dnsHintHost: active.split('.')[0] === 'www' ? 'www' : active.split('.')[0] || 'www',
  };
}

export default function CustomDomainWizard({
  initialActiveDomain,
  initialShopUrl,
  onStatusChange,
}: Props) {
  const { t } = useI18n();
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const [status, setStatus] = useState<CustomDomainSetupStatus | null>(() =>
    bootstrapStatus(initialActiveDomain, initialShopUrl)
  );
  const [domainInput, setDomainInput] = useState(() => initialActiveDomain?.trim() || '');
  const [loading, setLoading] = useState(() => !bootstrapStatus(initialActiveDomain, initialShopUrl));
  const [busy, setBusy] = useState<'start' | 'verify' | 'ssl' | 'remove' | null>(null);
  const [error, setError] = useState('');

  const applyStatus = useCallback((next: CustomDomainSetupStatus) => {
    setStatus(next);
    onStatusChangeRef.current?.(next);
    if (next.pendingDomain) setDomainInput(next.pendingDomain);
    else if (next.activeDomain) setDomainInput(next.activeDomain);
  }, []);

  const loadStatus = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get('/merchant/custom-domain');
      applyStatus(data.status as CustomDomainSetupStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('customDomainWizardLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [applyStatus, t]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!status || status.step !== 'ssl' || status.sslStatus === 'active') return;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const { data } = await api.post('/merchant/custom-domain/refresh-ssl');
          applyStatus(data.status as CustomDomainSetupStatus);
        } catch {
          /* keep polling until SSL is ready */
        }
      })();
    }, 12000);
    return () => window.clearInterval(timer);
  }, [applyStatus, status]);

  const currentStep = status?.step ?? 'enter';
  const activeIndex = stepIndex(currentStep);

  const stepLabels = useMemo(
    () => [
      t('customDomainWizardStepEnter'),
      t('customDomainWizardStepDns'),
      t('customDomainWizardStepSsl'),
      t('customDomainWizardStepActive'),
    ],
    [t]
  );

  async function startSetup() {
    setBusy('start');
    setError('');
    try {
      const { data } = await api.post('/merchant/custom-domain/start', {
        domain: domainInput.trim(),
      });
      applyStatus(data.status as CustomDomainSetupStatus);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? String((err as { response?: { data?: { error?: string } } }).response?.data?.error || '')
          : '';
      setError(msg || (err instanceof Error ? err.message : t('customDomainWizardStartFailed')));
    } finally {
      setBusy(null);
    }
  }

  async function verifyDns() {
    setBusy('verify');
    setError('');
    try {
      const { data } = await api.post('/merchant/custom-domain/verify-dns');
      applyStatus(data.status as CustomDomainSetupStatus);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? String((err as { response?: { data?: { error?: string } } }).response?.data?.error || '')
          : '';
      setError(msg || t('customDomainWizardVerifyFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function refreshSsl() {
    setBusy('ssl');
    setError('');
    try {
      const { data } = await api.post('/merchant/custom-domain/refresh-ssl');
      applyStatus(data.status as CustomDomainSetupStatus);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? String((err as { response?: { data?: { error?: string } } }).response?.data?.error || '')
          : '';
      setError(msg || t('customDomainWizardSslFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function removeDomain() {
    if (!window.confirm(t('customDomainWizardRemoveConfirm'))) return;
    setBusy('remove');
    setError('');
    try {
      const { data } = await api.delete('/merchant/custom-domain');
      applyStatus(data.status as CustomDomainSetupStatus);
      setDomainInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('customDomainWizardRemoveFailed'));
    } finally {
      setBusy(null);
    }
  }

  if (loading && !status) {
    return <p className="text-sm muted">{t('loading')}</p>;
  }

  const shopHost = status?.shopHost || SHOP_HOST;
  const dnsHost = status?.dnsHintHost || 'www';

  return (
    <div className="space-y-4">
      {loading ? <p className="text-xs muted">{t('loading')}</p> : null}
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stepLabels.map((label, index) => {
          const done = index < activeIndex || (index === 3 && currentStep === 'active');
          const current = index === activeIndex;
          return (
            <li
              key={label}
              className={`rounded-md border px-2 py-2 text-xs ${
                current
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 font-semibold'
                  : done
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : 'border-[var(--border)] bg-[var(--bg-muted)]/40 text-[var(--text-muted)]'
              }`}
            >
              <span className="block font-mono text-[10px] uppercase tracking-wide opacity-70">
                {index + 1}
              </span>
              {label}
            </li>
          );
        })}
      </ol>

      <p className="text-xs muted">{t('customDomainWizardIntro')}</p>

      {currentStep === 'enter' ? (
        <div className="space-y-2">
          <label className="text-xs font-medium block">{t('customDomainWizardDomainLabel')}</label>
          <input
            className="input max-w-md"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="www.mycafe.ch"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={!domainInput.trim() || busy === 'start'}
              onClick={() => void startSetup()}
            >
              {busy === 'start' ? t('saving') : t('customDomainWizardContinue')}
            </button>
          </div>
        </div>
      ) : null}

      {currentStep === 'verify_dns' || currentStep === 'ssl' || currentStep === 'active' ? (
        <div className="rounded-md border border-[var(--border)] bg-[var(--bg-muted)]/30 p-3 space-y-2">
          <p className="text-sm font-medium">{t('cmsDnsRecordTitle')}</p>
          <p className="text-xs muted">{t('cmsDnsGoCreate')}</p>
          <table className="w-full max-w-md text-xs border border-[var(--border)]">
            <tbody>
              <tr className="border-b border-[var(--border)]">
                <th className="bg-[var(--bg-muted)] px-2 py-1.5 text-left font-medium w-24">
                  {t('cmsDnsType')}
                </th>
                <td className="px-2 py-1.5 font-mono">CNAME</td>
              </tr>
              <tr className="border-b border-[var(--border)]">
                <th className="bg-[var(--bg-muted)] px-2 py-1.5 text-left font-medium">
                  {t('cmsDnsHost')}
                </th>
                <td className="px-2 py-1.5 font-mono">{dnsHost}</td>
              </tr>
              <tr>
                <th className="bg-[var(--bg-muted)] px-2 py-1.5 text-left font-medium">
                  {t('cmsDnsPointsTo')}
                </th>
                <td className="px-2 py-1.5 font-mono">{shopHost}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs muted">{t('cmsDnsHostExample')}</p>
          {status?.pendingDomain || status?.activeDomain ? (
            <p className="text-xs">
              <span className="muted">{t('customDomainWizardTarget')} </span>
              <span className="font-mono">{status.pendingDomain || status.activeDomain}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {currentStep === 'verify_dns' ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={busy === 'verify'}
            onClick={() => void verifyDns()}
          >
            {busy === 'verify' ? t('loading') : t('customDomainWizardVerifyDns')}
          </button>
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={busy === 'remove'}
            onClick={() => void removeDomain()}
          >
            {t('customDomainWizardRemove')}
          </button>
        </div>
      ) : null}

      {currentStep === 'ssl' ? (
        <div className="space-y-2">
          <p className="text-sm">{t('customDomainWizardSslPending')}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={busy === 'ssl'}
              onClick={() => void refreshSsl()}
            >
              {busy === 'ssl' ? t('loading') : t('customDomainWizardCheckSsl')}
            </button>
          </div>
        </div>
      ) : null}

      {currentStep === 'active' && status?.shopUrl ? (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 space-y-2">
          <p className="text-sm font-medium text-emerald-900">{t('customDomainWizardActive')}</p>
          <a className="text-sm underline text-emerald-900" href={status.shopUrl} target="_blank" rel="noreferrer">
            {status.shopUrl}
          </a>
          <div>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={busy === 'remove'}
              onClick={() => void removeDomain()}
            >
              {t('customDomainWizardRemove')}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <p className="text-xs muted">{t('customDomainWizardFallbackHint', { shopHost })}</p>
    </div>
  );
}

export const CUSTOM_DOMAIN_WIZARD_ENABLED =
  import.meta.env.VITE_CUSTOM_DOMAIN_WIZARD !== '0';
