import { useI18n } from '@/lib/i18n';

type Props = {
  value: number;
  disabled?: boolean;
  compact?: boolean;
  onChange: (columns: number) => void;
};

const COLUMN_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

export function kdsGridColumnsStorageKey(token: string): string {
  return `kds-grid-columns:${token}`;
}

export function readKdsGridColumnsOverride(token: string): number | null {
  if (!token) return null;
  try {
    const raw = localStorage.getItem(kdsGridColumnsStorageKey(token));
    if (!raw) return null;
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 6) return n;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeKdsGridColumnsOverride(token: string, columns: number): number {
  const clamped = Math.min(6, Math.max(1, Math.round(columns)));
  if (!token) return clamped;
  try {
    localStorage.setItem(kdsGridColumnsStorageKey(token), String(clamped));
  } catch {
    /* ignore */
  }
  return clamped;
}

export default function KdsGridColumnsPicker({ value, disabled, compact, onChange }: Props) {
  const { t } = useI18n();
  const selectedClass = compact
    ? 'bg-teal-600 text-white ring-1 ring-teal-400/50'
    : 'bg-teal-600 text-white';
  const idleClass = compact
    ? 'bg-black/20 text-inherit hover:bg-black/30'
    : 'bg-stone-100 text-stone-700 hover:bg-stone-200';

  return (
    <div className={compact ? 'flex items-center gap-2' : undefined}>
      <p className={compact ? 'text-xs font-semibold whitespace-nowrap' : 'mb-2 text-xs font-medium text-stone-600'}>
        {t('kdsGridColumnsLabel')}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {COLUMN_OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-pressed={value === n}
            onClick={() => onChange(n)}
            className={`h-9 min-w-9 rounded-lg px-2 text-sm font-bold disabled:opacity-50 ${
              value === n ? selectedClass : idleClass
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
