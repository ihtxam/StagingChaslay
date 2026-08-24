import { useI18n } from '@/lib/i18n';

export const KDS_LAYOUT_MODES = ['grid', 'rows', 'slider'] as const;
export type KdsLayoutMode = (typeof KDS_LAYOUT_MODES)[number];

type Props = {
  value: KdsLayoutMode;
  disabled?: boolean;
  compact?: boolean;
  onChange: (mode: KdsLayoutMode) => void;
};

export function kdsLayoutModeStorageKey(token: string): string {
  return `kds-layout-mode:${token}`;
}

export function readKdsLayoutModeOverride(token: string): KdsLayoutMode | null {
  if (!token) return null;
  try {
    const raw = localStorage.getItem(kdsLayoutModeStorageKey(token));
    if (!raw) return null;
    const mode = raw.toLowerCase();
    if (mode === 'grid' || mode === 'rows' || mode === 'slider') return mode;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeKdsLayoutModeOverride(token: string, mode: KdsLayoutMode): KdsLayoutMode {
  if (!token) return mode;
  try {
    localStorage.setItem(kdsLayoutModeStorageKey(token), mode);
  } catch {
    /* ignore */
  }
  return mode;
}

export default function KdsLayoutModePicker({ value, disabled, compact, onChange }: Props) {
  const { t } = useI18n();
  const selectedClass = compact
    ? 'bg-teal-600 text-white ring-1 ring-teal-400/50'
    : 'bg-teal-600 text-white';
  const idleClass = compact
    ? 'bg-black/20 text-inherit hover:bg-black/30'
    : 'border border-stone-200 text-stone-700 hover:border-stone-300';

  return (
    <div className={compact ? 'flex items-center gap-2' : undefined}>
      {!compact ? (
        <>
          <p className="mb-2 text-xs font-medium text-stone-600">{t('kdsLayoutLabel')}</p>
        </>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {KDS_LAYOUT_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            disabled={disabled}
            aria-pressed={value === mode}
            onClick={() => onChange(mode)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold disabled:opacity-50 sm:px-3 sm:py-2 sm:text-sm ${
              value === mode ? selectedClass : idleClass
            }`}
          >
            {t(`kdsLayout_${mode}`)}
          </button>
        ))}
      </div>
      {!compact ? <p className="mt-1 text-xs text-stone-500">{t('kdsLayoutHint')}</p> : null}
    </div>
  );
}
