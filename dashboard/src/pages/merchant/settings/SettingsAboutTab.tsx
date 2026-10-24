import { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { CheckCircle2, Circle, Package } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { REBORN_CORE_PRODUCT_MODULES } from '@/lib/reborn-product-modules';
import SoftwareUpdates from '@/pages/merchant/SoftwareUpdates';
import { SettingsPageHeader, SettingsReportCard, settingsDash } from '@/components/settings/SettingsReportUi';
import {
  EXTRA_MODULE_DEFINITIONS,
  type MerchantAddonSettings,
} from './settings-extra-modules';

export default function SettingsAboutTab({
  settings,
  isRetailMerchant,
}: {
  settings: MerchantAddonSettings;
  isRetailMerchant: boolean;
}) {
  const { t } = useI18n();
  const [aboutHtml, setAboutHtml] = useState('');
  const [aboutLoading, setAboutLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/merchant/platform-about')
      .then((res) => {
        if (!cancelled) setAboutHtml(String(res.data?.html || ''));
      })
      .catch(() => {
        if (!cancelled) setAboutHtml('');
      })
      .finally(() => {
        if (!cancelled) setAboutLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const safeAboutHtml = useMemo(
    () =>
      DOMPurify.sanitize(aboutHtml, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ['target', 'rel'],
      }),
    [aboutHtml]
  );

  const addonModules = useMemo(
    () =>
      EXTRA_MODULE_DEFINITIONS.map((def) => ({
        ...def,
        active: def.isActive(settings, { isRetailMerchant }),
      })),
    [settings, isRetailMerchant]
  );

  return (
    <div className="space-y-8 pb-2">
      <SettingsPageHeader title={t('settingsAbout')} subtitle={t('settingsAboutHint')} />

      <SettingsReportCard icon={Package} accent={settingsDash.accent} title={t('settingsAboutCompany')}>
        {aboutLoading ? (
          <p className="text-sm text-[var(--text-muted)] m-0">{t('loading')}</p>
        ) : safeAboutHtml ? (
          <div
            className="prose prose-sm max-w-none text-[var(--text)] [&_a]:text-[var(--accent)] [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: safeAboutHtml }}
          />
        ) : (
          <p className="text-sm text-[var(--text-muted)] m-0">{t('settingsAboutEmpty')}</p>
        )}
      </SettingsReportCard>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-[var(--text)] m-0">{t('settingsAboutRebornModules')}</h3>
        <p className="text-sm text-[var(--text-muted)] m-0">{t('settingsAboutRebornModulesHint')}</p>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
          {REBORN_CORE_PRODUCT_MODULES.map((mod) => (
            <li
              key={mod.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3"
            >
              <p className="m-0 text-sm font-semibold text-[var(--text)]">{t(mod.titleKey)}</p>
              <p className="mt-1 mb-0 text-xs text-[var(--text-muted)]">{t(mod.descriptionKey)}</p>
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
                <p className="m-0 mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {mod.active ? t('settingsAboutModuleActive') : t('settingsAboutModuleAvailable')}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 border-t border-[var(--border)] pt-6">
        <SoftwareUpdates embedded />
      </section>
    </div>
  );
}
