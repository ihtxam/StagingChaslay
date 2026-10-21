import type { PanelLocationHeaderLabels } from '@/lib/panel-location-header';
import { useI18n } from '@/lib/i18n';

type Props = {
  labels: PanelLocationHeaderLabels;
  /** compact = top bar; default = sidebar */
  variant?: 'compact' | 'sidebar';
};

export default function PanelLocationTitle({ labels, variant = 'compact' }: Props) {
  const { t } = useI18n();
  if (!labels.primary) return null;

  const primaryClass =
    variant === 'sidebar'
      ? 'truncate text-sm font-semibold text-white'
      : 'truncate text-sm font-semibold text-[var(--text)]';

  const secondaryClass =
    variant === 'sidebar'
      ? 'truncate text-[10px] text-white/70'
      : 'truncate text-[10px] text-[var(--text-muted)]';

  return (
    <div className="min-w-0 flex flex-col leading-tight" title={labels.primary}>
      <div className="flex min-w-0 items-center gap-1.5">
        <span className={primaryClass}>{labels.primary}</span>
        {labels.showHqBadge ? (
          <span
            className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
              variant === 'sidebar'
                ? 'bg-white/15 text-white'
                : 'bg-[var(--bg-muted)] text-[var(--text-muted)] ring-1 ring-[var(--border-default)]'
            }`}
          >
            {t('navHq')}
          </span>
        ) : null}
        {labels.scopeTag ? (
          <span
            className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium capitalize ${
              variant === 'sidebar'
                ? 'bg-white/10 text-white/80'
                : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
            }`}
          >
            {labels.scopeTag}
          </span>
        ) : null}
      </div>
      {labels.secondary ? <span className={secondaryClass}>{labels.secondary}</span> : null}
    </div>
  );
}
