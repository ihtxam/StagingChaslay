/** Reservation status pill classes — light + dashboard dark (`html.dark`). */
export function reservationStatusBadgeClass(status: string): string {
  const colors: Record<string, string> = {
    pending:
      'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100',
    confirmed:
      'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100',
    seated: 'bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-100',
    completed:
      'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300',
    cancelled:
      'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200',
    no_show: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  };
  return colors[status] || 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300';
}

/** Active chip for date/time/party pickers in reservation forms. */
export const reservationChipActiveClass =
  'bg-sky-100 border-sky-300 text-sky-900 font-medium dark:bg-sky-950/50 dark:border-sky-800 dark:text-sky-100';

/** Default chip for date/time/party pickers in reservation forms. */
export const reservationChipIdleClass =
  'border-[var(--border)] hover:bg-[var(--bg-muted)]';
