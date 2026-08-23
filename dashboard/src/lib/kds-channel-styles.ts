/** KDS ticket colors — match WebPOS order screen channel styling. */
export function kdsChannelHeaderClass(channel?: string | null): string {
  const ch = String(channel || '').toLowerCase();
  switch (ch) {
    case 'dine_in':
      return 'bg-emerald-600 text-white';
    case 'delivery':
      return 'bg-orange-500 text-white';
    case 'takeaway':
      return 'bg-sky-600 text-white';
    default:
      return 'bg-stone-600 text-white';
  }
}

export function kdsChannelBorderClass(channel?: string | null): string {
  const ch = String(channel || '').toLowerCase();
  switch (ch) {
    case 'dine_in':
      return 'border-emerald-600';
    case 'delivery':
      return 'border-orange-500';
    case 'takeaway':
      return 'border-sky-600';
    default:
      return 'border-stone-600';
  }
}

export function kdsChannelLabel(channel?: string | null): string {
  const ch = String(channel || '').toLowerCase();
  if (ch === 'dine_in') return 'Dine in';
  if (ch === 'delivery') return 'Delivery';
  if (ch === 'takeaway') return 'Takeaway';
  return ch || '—';
}

export type KdsShellTheme = 'dark' | 'light' | 'teal';

export const KDS_SHELL_THEMES: Record<
  KdsShellTheme,
  { shell: string; card: string; text: string; muted: string; item: string; itemReady: string }
> = {
  dark: {
    shell: 'bg-stone-950 text-white',
    card: 'bg-stone-900 border-stone-800',
    text: 'text-white',
    muted: 'text-stone-400',
    item: 'border-stone-700 bg-stone-800 hover:border-teal-500',
    itemReady: 'border-emerald-700/50 bg-emerald-950/40 opacity-70',
  },
  light: {
    shell: 'bg-stone-100 text-stone-900',
    card: 'bg-white border-stone-200 shadow-sm',
    text: 'text-stone-900',
    muted: 'text-stone-500',
    item: 'border-stone-200 bg-stone-50 hover:border-teal-500',
    itemReady: 'border-emerald-300 bg-emerald-50 opacity-80',
  },
  teal: {
    shell: 'bg-teal-950 text-teal-50',
    card: 'bg-teal-900/80 border-teal-800',
    text: 'text-teal-50',
    muted: 'text-teal-300/80',
    item: 'border-teal-700 bg-teal-900/60 hover:border-teal-400',
    itemReady: 'border-emerald-600/50 bg-emerald-950/30 opacity-70',
  },
};
