import { useI18n } from '@/lib/i18n';

const PREVIEW: Record<
  string,
  { bg: string; accent: string; text: string; sample: string }
> = {
  dark_pizza: { bg: '#120c0a', accent: '#fb7185', text: '#f8f4ef', sample: 'Margherita · 14.50' },
  kebab_green: { bg: '#052e16', accent: '#86efac', text: '#ecfdf5', sample: 'Döner Box · 12.00' },
  cafe_cream: { bg: '#f4efe6', accent: '#7c2d12', text: '#3f2e22', sample: 'Cappuccino · 4.50' },
  portrait_poster: { bg: '#0b1220', accent: '#93c5fd', text: '#f8fafc', sample: 'Daily special' },
  lunch_special: { bg: '#111827', accent: '#fdba74', text: '#fff7ed', sample: 'Lunch menu · 18.90' },
};

type Props = {
  templateId: string;
  className?: string;
};

export default function SignageTemplatePreview({ templateId, className = '' }: Props) {
  const { t } = useI18n();
  const theme = PREVIEW[templateId] || PREVIEW.dark_pizza;
  const labelKey =
    (
      [
        ['dark_pizza', 'signageTemplateDarkPizza'],
        ['kebab_green', 'signageTemplateKebabGreen'],
        ['cafe_cream', 'signageTemplateCafeCream'],
        ['portrait_poster', 'signageTemplatePortraitPoster'],
        ['lunch_special', 'signageTemplateLunchSpecial'],
      ] as const
    ).find(([id]) => id === templateId)?.[1] || 'signageTemplateDarkPizza';

  return (
    <div
      className={`overflow-hidden rounded-xl border border-[var(--border)] shadow-sm ${className}`}
      style={{ background: theme.bg, color: theme.text }}
    >
      <div className="px-3 py-2 text-[10px] uppercase tracking-widest opacity-70">{t('signageTemplatePreview')}</div>
      <div className="px-3 pb-3 space-y-2">
        <p className="text-xs font-bold" style={{ color: theme.accent }}>
          {t(labelKey)}
        </p>
        <div
          className="rounded-lg px-2 py-1.5 text-[11px] font-semibold"
          style={{ background: `${theme.accent}22`, borderLeft: `3px solid ${theme.accent}` }}
        >
          {theme.sample}
        </div>
        <div className="flex gap-1 opacity-60">
          <div className="h-1 flex-1 rounded" style={{ background: theme.accent }} />
          <div className="h-1 flex-1 rounded bg-[var(--bg-elevated)]/20" />
          <div className="h-1 flex-1 rounded bg-[var(--bg-elevated)]/20" />
        </div>
      </div>
    </div>
  );
}

export const SIGNAGE_TEMPLATES = [
  { id: 'dark_pizza', key: 'signageTemplateDarkPizza' },
  { id: 'kebab_green', key: 'signageTemplateKebabGreen' },
  { id: 'cafe_cream', key: 'signageTemplateCafeCream' },
  { id: 'portrait_poster', key: 'signageTemplatePortraitPoster' },
  { id: 'lunch_special', key: 'signageTemplateLunchSpecial' },
] as const;

export const SIGNAGE_SCREEN_SIZES = [10, 15, 23, 32, 43, 55, 65] as const;
