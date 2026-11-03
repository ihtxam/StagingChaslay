import { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Package, Send } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth';
import { SettingsPageHeader, SettingsReportCard, settingsDash } from '@/components/settings/SettingsReportUi';
import {
  listInactiveExtraModules,
  type ExtraModuleDefinition,
  type MerchantAddonSettings,
} from './settings-extra-modules';

export default function SettingsExtraModulesTab({
  settings,
  isRetailMerchant,
}: {
  settings: MerchantAddonSettings;
  isRetailMerchant: boolean;
}) {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const modules = useMemo(
    () => listInactiveExtraModules(settings, { isRetailMerchant }),
    [settings, isRetailMerchant]
  );

  const submitRequest = useCallback(
    async (mod: ExtraModuleDefinition) => {
      setPendingId(mod.id);
      try {
        const moduleName = t(mod.titleKey);
        await api.post('/merchant/support/module-request', {
          moduleId: mod.id,
          moduleName,
        });
        toast.success(t('extraModuleRequestSent'));
      } catch (err: unknown) {
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
            : null;
        toast.error(msg || t('extraModuleRequestFailed'));
      } finally {
        setPendingId(null);
      }
    },
    [t]
  );

  const onRequestClick = (mod: ExtraModuleDefinition) => {
    const moduleName = t(mod.titleKey);
    const ok = window.confirm(
      t('extraModuleRequestConfirm')
        .replace('{module}', moduleName)
        .replace('{email}', user?.email || settings.email || '')
    );
    if (!ok) return;
    void submitRequest(mod);
  };

  return (
    <div className="space-y-5">
      <SettingsPageHeader title={t('settingsExtraModules')} subtitle={t('settingsExtraModulesHint')} />
      {modules.length === 0 ? (
        <SettingsReportCard icon={Package} accent={settingsDash.success} title={t('extraModuleAllActiveTitle')}>
          <p className="text-sm text-[var(--text-muted)] m-0">{t('extraModuleAllActiveHint')}</p>
        </SettingsReportCard>
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
          {modules.map((mod) => (
            <li key={mod.id}>
              <SettingsReportCard icon={Package} accent={settingsDash.accent} title={t(mod.titleKey)}>
                <p className="text-sm text-[var(--text-muted)] m-0 mb-4">{t(mod.descriptionKey)}</p>
                <button
                  type="button"
                  className="btn-primary inline-flex items-center gap-2 text-sm"
                  disabled={pendingId === mod.id}
                  onClick={() => onRequestClick(mod)}
                >
                  <Send className="h-4 w-4" aria-hidden />
                  {t('extraModuleRequest')}
                </button>
              </SettingsReportCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
