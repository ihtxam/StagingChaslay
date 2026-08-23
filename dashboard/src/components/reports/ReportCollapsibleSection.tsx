import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

type Props = {
  title: string;
  defaultOpen?: boolean;
  badge?: string;
  variant?: 'default' | 'danger';
  children: ReactNode;
};

export default function ReportCollapsibleSection({
  title,
  defaultOpen = false,
  badge,
  variant = 'default',
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const shellClass =
    variant === 'danger'
      ? 'border-rose-200/80 bg-rose-50/30 dark:border-rose-900/40 dark:bg-rose-950/20'
      : 'border-[var(--border)]';

  const headerClass =
    variant === 'danger'
      ? 'bg-rose-100/60 text-rose-900 hover:bg-rose-100/80 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:bg-rose-950/55'
      : 'bg-[var(--bg-muted)] text-[var(--text)] hover:bg-[var(--bg-muted)]/80';

  return (
    <section className={`rounded-xl border overflow-hidden ${shellClass}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold transition ${headerClass}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{title}</span>
          {badge ? (
            <span className="shrink-0 text-xs font-medium text-[var(--text-muted)]">{badge}</span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open ? children : null}
    </section>
  );
}
