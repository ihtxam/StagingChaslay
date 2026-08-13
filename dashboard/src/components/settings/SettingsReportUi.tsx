import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Report-style palette aligned with merchant Reports / Android SalesReportV5. */
export const settingsDash = {
  accent: '#13A99A',
  success: '#1F8F55',
  info: '#3477D1',
  warning: '#B8862F',
  danger: '#D64545',
  text: 'var(--text)',
  muted: 'var(--text-muted)',
  border: 'var(--border)',
  elevated: 'var(--bg-elevated)',
  mutedBg: 'var(--bg-muted)',
} as const;

export function SettingsPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-[var(--text)]">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function SettingsKpiGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
  );
}

export function SettingsKpiCard({
  icon: Icon,
  accent,
  label,
  value,
  muted = false,
}: {
  icon: LucideIcon;
  accent: string;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-sm">
      <div
        className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${accent}22` }}
      >
        <Icon className="h-[18px] w-[18px]" style={{ color: accent }} aria-hidden />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-extrabold tabular-nums leading-tight ${
          muted ? 'text-[var(--text-muted)]' : 'text-[var(--text)]'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function SettingsReportCard({
  icon: Icon,
  accent,
  title,
  description,
  children,
  id,
  highlight,
}: {
  icon: LucideIcon;
  accent: string;
  title: string;
  description?: string;
  children: ReactNode;
  id?: string;
  highlight?: boolean;
}) {
  return (
    <section
      id={id}
      data-settings-section={id}
      className={`overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-sm transition-colors ${
        highlight ? 'ring-2 ring-[var(--ring)]' : ''
      }`}
    >
      <div className="flex items-start gap-3 border-b border-[var(--border)] bg-[var(--bg-muted)]/40 px-4 py-3.5">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accent}22` }}
        >
          <Icon className="h-[18px] w-[18px]" style={{ color: accent }} aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold tracking-tight text-[var(--text)]">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function SettingsField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </span>
      {children}
      {hint ? <span className="block text-[11px] text-[var(--text-muted)] break-all">{hint}</span> : null}
    </label>
  );
}

export function SettingsToggleRow({
  checked,
  onChange,
  title,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/30 px-3.5 py-3 transition-colors hover:bg-[var(--bg-muted)]/60">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded accent-teal-600"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-sm font-semibold text-[var(--text)]">{title}</span>
        {hint ? <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{hint}</span> : null}
      </span>
    </label>
  );
}
