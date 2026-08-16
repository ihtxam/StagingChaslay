import { FormEvent } from 'react';
import { Save, SlidersHorizontal, UtensilsCrossed } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import {
  settingsDash,
  SettingsPageHeader,
  SettingsReportCard,
} from '@/components/settings/SettingsReportUi';
import TableSettings from '../tables/TableSettings';
import TableLayout from '../tables/TableLayout';
import TableQrCodes from '../tables/TableQrCodes';

export type TablesSettingsSlice = {
  floorPlanEnabled?: boolean;
  paxOrderingEnabled?: boolean;
};

type TablesSection = 'settings' | 'layout' | 'qr';

const SECTION_TABS: { id: TablesSection; labelKey: 'tableNavSettings' | 'tableNavLayout' | 'tableNavQr' }[] =
  [
    { id: 'settings', labelKey: 'tableNavSettings' },
    { id: 'layout', labelKey: 'tableNavLayout' },
    { id: 'qr', labelKey: 'tableNavQr' },
  ];

function parseSection(raw: string | null): TablesSection {
  if (raw === 'layout' || raw === 'qr') return raw;
  return 'settings';
}

export default function SettingsTablesTab({
  settings,
  setSettings,
  onSave,
  saving,
  highlightId,
  normalizedQuery,
  isSectionVisible,
  isSectionHighlight,
  onGoToPosTab,
}: {
  settings: TablesSettingsSlice;
  setSettings: (next: TablesSettingsSlice) => void;
  onSave: (e: FormEvent) => void;
  saving: boolean;
  highlightId?: string | null;
  normalizedQuery?: string;
  isSectionVisible: (id: string) => boolean;
  isSectionHighlight: (id: string) => boolean;
  onGoToPosTab: (query: string, sectionId: string) => void;
}) {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const section = parseSection(searchParams.get('section'));

  const setSection = (next: TablesSection) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'tables');
    if (next === 'settings') {
      params.delete('section');
    } else {
      params.set('section', next);
    }
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-5">
      <SettingsPageHeader title={t('settingsTables')} subtitle={t('tableManagementHint')} />

      <form onSubmit={onSave} className="space-y-5">
        <div
          className={`transition-opacity ${
            normalizedQuery && !isSectionVisible('tables-floor') ? 'pointer-events-none opacity-40' : ''
          }`}
        >
          <SettingsReportCard
            id="tables-floor"
            icon={UtensilsCrossed}
            accent={settingsDash.accent}
            title={t('settingsTablesFeatures')}
            description={t('floorPlanSettingsHint')}
            highlight={isSectionHighlight('tables-floor')}
          >
            <label className="flex items-start gap-2.5 rounded-md border border-[var(--border)] px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!settings.floorPlanEnabled}
                onChange={(e) => setSettings({ ...settings, floorPlanEnabled: e.target.checked })}
              />
              <span className="font-medium">{t('floorPlanEnabled')}</span>
            </label>
            <label className="flex items-start gap-2.5 rounded-md border border-[var(--border)] px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!settings.paxOrderingEnabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    paxOrderingEnabled: e.target.checked,
                    floorPlanEnabled: e.target.checked ? true : settings.floorPlanEnabled,
                  })
                }
              />
              <span>
                <span className="font-medium block">{t('paxOrderingEnabled')}</span>
                <span className="text-xs muted">{t('paxOrderingHint')}</span>
              </span>
            </label>
            <p className="rounded-md border border-dashed border-[var(--border)] px-3 py-2.5 text-xs muted">
              {t('coursesMovedToPosHint')}{' '}
              <button
                type="button"
                className="font-medium text-[var(--text)] underline underline-offset-2"
                onClick={() => onGoToPosTab('courses', 'pos-courses')}
              >
                {t('settingsPos')}
              </button>
            </p>
          </SettingsReportCard>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/30 px-4 py-3">
          <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
            <Save className="h-4 w-4" aria-hidden />
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </form>

      <SettingsReportCard
        id="tables-management"
        icon={SlidersHorizontal}
        accent={settingsDash.info}
        title={t('navTableManagement')}
        description={t('settingsTablesManagementHint')}
        highlight={highlightId === 'tables-management' || isSectionHighlight('tables-management')}
      >
        <nav
          className="mb-4 flex flex-wrap gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-1"
          aria-label={t('navTableManagement')}
        >
          {SECTION_TABS.map((tab) => {
            const active = section === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSection(tab.id)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t(tab.labelKey)}
              </button>
            );
          })}
        </nav>

        {section === 'settings' ? <TableSettings /> : null}
        {section === 'layout' ? <TableLayout /> : null}
        {section === 'qr' ? <TableQrCodes /> : null}
      </SettingsReportCard>
    </div>
  );
}
