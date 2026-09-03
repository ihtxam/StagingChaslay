import { useI18n } from '@/lib/i18n';
import { REPORT_PRESET_IDS, type ReportPreset } from '@/lib/report-preset';

type Props = {
  preset: ReportPreset;
  onPresetChange: (preset: ReportPreset) => void;
  customFrom?: string;
  customTo?: string;
  onCustomFromChange?: (value: string) => void;
  onCustomToChange?: (value: string) => void;
  onApplyCustom?: () => void;
  className?: string;
};

export default function ReportDatePresetFilter({
  preset,
  onPresetChange,
  customFrom = '',
  customTo = '',
  onCustomFromChange,
  onCustomToChange,
  onApplyCustom,
  className = '',
}: Props) {
  const { t } = useI18n();

  const presetLabels: Record<ReportPreset, string> = {
    today: t('reportsToday'),
    yesterday: t('reportsYesterday'),
    last_week: t('reportsLastWeek'),
    this_month: t('reportsThisMonth'),
    last_month: t('reportsLastMonth'),
    last_3_months: t('reportsLast3Months'),
    custom: t('reportsCustom'),
  };

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      <div className="flex flex-wrap gap-2">
        {REPORT_PRESET_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onPresetChange(id)}
            className={`rounded-lg px-3 py-1.5 text-sm border ${
              preset === id
                ? 'bg-[var(--bg-elevated)] border-[var(--border)] shadow-sm font-medium'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {presetLabels[id]}
          </button>
        ))}
      </div>

      {preset === 'custom' ? (
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm space-y-1">
            <span className="muted">{t('reportsFrom')}</span>
            <input
              type="date"
              className="input"
              value={customFrom}
              onChange={(e) => onCustomFromChange?.(e.target.value)}
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="muted">{t('reportsTo')}</span>
            <input
              type="date"
              className="input"
              value={customTo}
              onChange={(e) => onCustomToChange?.(e.target.value)}
            />
          </label>
          {onApplyCustom ? (
            <button type="button" className="btn-primary" onClick={onApplyCustom}>
              {t('reportsApply')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
