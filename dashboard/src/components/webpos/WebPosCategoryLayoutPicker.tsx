import { ArrowRightLeft, LayoutGrid, Rows2, Rows3 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { WebPosCategoryLayoutMode } from '@/lib/webpos-category-layout';

type Props = {
  value: WebPosCategoryLayoutMode;
  onChange: (mode: WebPosCategoryLayoutMode) => void;
  /** Tap grid icon to cycle all modes (compact toolbar). */
  onCycle?: () => void;
  compact?: boolean;
};

const MODES: Array<{
  id: WebPosCategoryLayoutMode;
  icon: typeof LayoutGrid;
  labelKey: string;
}> = [
  { id: 'scroll', icon: ArrowRightLeft, labelKey: 'webPosCategoryLayoutScroll' },
  { id: 'rows-2', icon: Rows2, labelKey: 'webPosCategoryLayoutRows2' },
  { id: 'rows-3', icon: Rows3, labelKey: 'webPosCategoryLayoutRows3' },
  { id: 'wrap', icon: LayoutGrid, labelKey: 'webPosCategoryLayoutWrap' },
];

export default function WebPosCategoryLayoutPicker({
  value,
  onChange,
  onCycle,
  compact = true,
}: Props) {
  const { t } = useI18n();
  const selectedClass =
    'border-[var(--webpos-accent)] bg-[var(--webpos-accent)] text-white';
  const idleClass = 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50';

  if (compact) {
    const active = MODES.find((m) => m.id === value) || MODES[0];
    const Icon = active.icon;
    return (
      <button
        type="button"
        onClick={onCycle}
        title={t(active.labelKey)}
        aria-label={t(active.labelKey)}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${selectedClass}`}
      >
        <Icon size={16} aria-hidden />
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t('webPosCategoryLayoutLabel')}>
      {MODES.map(({ id, icon: Icon, labelKey }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          title={t(labelKey)}
          onClick={() => onChange(id)}
          className={`inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-semibold ${
            value === id ? selectedClass : idleClass
          }`}
        >
          <Icon size={14} aria-hidden />
          <span className="hidden sm:inline">{t(labelKey)}</span>
        </button>
      ))}
    </div>
  );
}
