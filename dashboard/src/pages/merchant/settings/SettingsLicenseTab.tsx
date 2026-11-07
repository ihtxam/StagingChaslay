import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, KeyRound } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  EDITION_FEATURE_GROUPS,
  hasEditionFeature,
  type EditionFeatureKey,
} from '@/lib/edition-features';
import { SettingsPageHeader, SettingsReportCard, settingsDash } from '@/components/settings/SettingsReportUi';
import {
  EXTRA_MODULE_DEFINITIONS,
  type MerchantAddonSettings,
} from './settings-extra-modules';

type EntitlementsPayload = {
  limits?: {
    maxPosPosts?: number;
    maxWaiterPosts?: number;
    maxStaff?: number;
    maxLocations?: number;
    maxProducts?: number | null;
    planSlug?: string | null;
    planName?: string | null;
  } | null;
  staff?: { maxStaff?: number; currentCount?: number } | null;
  devices?: { maxDevices?: number; currentCount?: number } | null;
  products?: { maxProducts?: number | null; currentCount?: number } | null;
};

function formatPlanLabel(plan?: string | null) {
  const raw = String(plan || '').trim();
  if (!raw) return '—';
  return raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function usageLine(current: number, max: number | null | undefined, unlimitedLabel: string) {
  const used = Math.max(0, Number(current) || 0);
  const cap = max == null ? null : Number(max);
  if (cap == null || cap <= 0) {
    return `${used} / ${unlimitedLabel}`;
  }
  return `${used} / ${cap}`;
}

export default function SettingsLicenseTab({
  settings,
  isRetailMerchant,
}: {
  settings: MerchantAddonSettings & {
    subscriptionPlan?: string | null;
    editionFeatures?: EditionFeatureKey[] | null;
    maxPosPosts?: number;
    maxWaiterPosts?: number;
    status?: string | null;
  };
  isRetailMerchant: boolean;
}) {
  const { t } = useI18n();
  const [entitlements, setEntitlements] = useState<EntitlementsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get('/merchant/entitlements')
      .then((res) => {
        if (!cancelled) setEntitlements(res.data || null);
      })
      .catch(() => {
        if (!cancelled) setEntitlements(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const planLabel = useMemo(() => {
    const fromApi =
      entitlements?.limits?.planName ||
      entitlements?.limits?.planSlug ||
      entitlements?.products?.planName;
    return formatPlanLabel(fromApi || settings.subscriptionPlan);
  }, [entitlements, settings.subscriptionPlan]);

  const editionFeatures = settings.editionFeatures ?? [];
  const editionRows = useMemo(
    () =>
      EDITION_FEATURE_GROUPS.flatMap((group) =>
        group.features.map((f) => ({
          key: f.key,
          label: f.label,
          active: hasEditionFeature(editionFeatures, f.key),
        }))
      ),
    [editionFeatures]
  );

  const addonModules = useMemo(
    () =>
      EXTRA_MODULE_DEFINITIONS.map((def) => ({
        ...def,
        active: def.isActive(settings, { isRetailMerchant }),
      })),
    [settings, isRetailMerchant]
  );

  const unlimited = t('posPostsUnlimited');

  const limits = entitlements?.limits;
  const limitRows = [
    {
      label: t('posPostsMaxMain'),
      value: usageLine(
        entitlements?.devices?.currentCount ?? 0,
        limits?.maxPosPosts ?? settings.maxPosPosts,
        unlimited
      ),
    },
    {
      label: t('posPostsMaxWaiter'),
      value: (() => {
        const cap = limits?.maxWaiterPosts ?? settings.maxWaiterPosts;
        const n = Number(cap);
        if (!Number.isFinite(n) || n <= 0) return unlimited;
        return String(n);
      })(),
    },
    {
      label: t('settingsLicenseStaff'),
      value: usageLine(
        entitlements?.staff?.currentCount ?? 0,
        entitlements?.staff?.maxStaff ?? limits?.maxStaff,
        unlimited
      ),
    },
    {
      label: t('locationsMax'),
      value: (() => {
        const n = Number(limits?.maxLocations);
        if (!Number.isFinite(n) || n <= 0) return unlimited;
        return String(n);
      })(),
    },
    {
      label: t('products'),
      value: usageLine(
        entitlements?.products?.currentCount ?? 0,
        entitlements?.products?.maxProducts ?? limits?.maxProducts ?? null,
        unlimited
      ),
    },
  ];

  const merchantStatus = String(settings.status || '').trim();

  return (
    <div className="space-y-8 pb-2">
      <SettingsPageHeader title={t('settingsNavLicense')} subtitle={t('settingsLicenseHint')} />

      <SettingsReportCard icon={KeyRound} accent={settingsDash.accent} title={t('billingCurrentSubscription')}>
        {loading ? (
          <p className="text-sm text-[var(--text-muted)] m-0">{t('loading')}</p>
        ) : (
          <dl className="m-0 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {t('plan')}
              </dt>
              <dd className="mt-1 text-base font-semibold text-[var(--text)]">{planLabel}</dd>
            </div>
            {merchantStatus ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {t('status')}
                </dt>
                <dd className="mt-1 text-base font-medium text-[var(--text)] capitalize">{merchantStatus}</dd>
              </div>
            ) : null}
          </dl>
        )}
      </SettingsReportCard>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-[var(--text)] m-0">{t('settingsLicenseLimits')}</h3>
        <p className="text-sm text-[var(--text-muted)] m-0">{t('posPostsHint')}</p>
        <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
          {limitRows.map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm"
            >
              <span className="font-medium text-[var(--text)]">{row.label}</span>
              <span className="tabular-nums text-[var(--text-muted)]">{loading ? '…' : row.value}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-[var(--text)] m-0">{t('settingsLicenseEdition')}</h3>
        <p className="text-sm text-[var(--text-muted)] m-0">{t('settingsAboutRebornModulesHint')}</p>
        <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
          {editionRows.map((row) => (
            <li
              key={row.key}
              className="flex items-start gap-2 rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm"
            >
              {row.active ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
              )}
              <span className="min-w-0 text-[var(--text)]">{row.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-[var(--text)] m-0">{t('settingsAboutAddons')}</h3>
        <p className="text-sm text-[var(--text-muted)] m-0">{t('settingsAboutAddonsHint')}</p>
        <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
          {addonModules.map((mod) => (
            <li
              key={mod.id}
              className="flex items-start gap-2 rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm"
            >
              {mod.active ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="m-0 font-medium text-[var(--text)]">{t(mod.titleKey)}</p>
                <p className="m-0 text-xs text-[var(--text-muted)]">{t(mod.descriptionKey)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
