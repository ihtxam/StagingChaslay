import { Rows2, Rows3 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { WebPosCategoryLayoutMode } from '@/lib/webpos-category-layout';

type Props = {
  value: WebPosCategoryLayoutMode;
  onChange: (mode: WebPosCategoryLayoutMode) => void;
  compact?: boolean;
};

const MODES: Array<{
  id: WebPosCategoryLayoutMode;
  icon: typeof Rows2;
  labelKey: string;
}> = [
  { id: 'rows-2', icon: Rows2, labelKey: 'webPosCategoryLayoutRows2' },
  { id: 'rows-3', icon: Rows3, labelKey: 'webPosCategoryLayoutRows3' },
];

export default function WebPosCategoryLayoutPicker({ value, onChange, compact = false }: Props) {
  const { t } = useI18n();
  const selectedClass =
    'border-[var(--webpos-accent)] bg-[var(--webpos-accent)] text-white';
  const idleClass =
    'border-stone-300 bg-white text-stone-600 hover:bg-stone-50 webpos-toolbar-btn';
  const btnSize = compact ? 'h-7 w-7 rounded-md' : 'h-8 w-8 rounded-lg';
  const iconSize = compact ? 14 : 16;

  return (
    <div
      className="inline-flex items-center gap-1"
      role="group"
      aria-label={t('webPosCategoryLayoutLabel')}
    >
      {MODES.map(({ id, icon: Icon, labelKey }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          title={t(labelKey)}
          aria-label={t(labelKey)}
          onClick={() => onChange(id)}
          className={`inline-flex shrink-0 items-center justify-center border ${btnSize} ${
            value === id ? selectedClass : idleClass
          }`}
        >
          <Icon size={iconSize} aria-hidden />
        </button>
      ))}
    </div>
  );
}
