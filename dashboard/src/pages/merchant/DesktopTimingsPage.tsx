import { Navigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import { isDesktopApp } from '@/lib/platform';
import SettingsHoursTab from '@/pages/merchant/settings/SettingsHoursTab';
import { SettingsPageHeader } from '@/components/settings/SettingsReportUi';

export default function DesktopTimingsPage() {
  const { t } = useI18n();

  if (!isDesktopApp()) {
    return <Navigate to="/merchant/settings?tab=hours" replace />;
  }

  return (
    <div className="desktop-hub-page mx-auto max-w-5xl p-4 pt-2">
      <SettingsPageHeader title={t('desktopHubTimings')} subtitle={t('desktopHubTimingsHint')} />
      <SettingsHoursTab />
      <p className="mt-4 text-xs text-[var(--text-muted)]">{t('desktopHubAdvancedWebHint')}</p>
    </div>
  );
}
