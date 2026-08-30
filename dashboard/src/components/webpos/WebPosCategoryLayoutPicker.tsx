import { Rows2, Rows3 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { WebPosCategoryLayoutMode } from '@/lib/webpos-category-layout';

type Props = {
  value: WebPosCategoryLayoutMode;
  onChange: (mode: WebPosCategoryLayoutMode) => void;
};

const MODES: Array<{
  id: WebPosCategoryLayoutMode;
  icon: typeof Rows2;
  labelKey: string;
}> = [
  { id: 'rows-2', icon: Rows2, labelKey: 'webPosCategoryLayoutRows2' },
  { id: 'rows-3', icon: Rows3, labelKey: 'webPosCategoryLayoutRows3' },
];

export default function WebPosCategoryLayoutPicker({ value, onChange }: Props) {
  const { t } = useI18n();
  const selectedClass =
    'border-[var(--webpos-accent)] bg-[var(--webpos-accent)] text-white';
  const idleClass =
    'border-stone-300 bg-white text-stone-600 hover:bg-stone-50 webpos-toolbar-btn';

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
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${
            value === id ? selectedClass : idleClass
          }`}
        >
          <Icon size={16} aria-hidden />
        </button>
      ))}
    </div>
  );
}
