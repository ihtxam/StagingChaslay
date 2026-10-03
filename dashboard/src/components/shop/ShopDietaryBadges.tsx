import type { DietaryTagId } from '@/lib/product-dietary';
import { DIETARY_TAGS, dietaryTagDef, normalizeDietaryTags } from '@/lib/product-dietary';

type Props = {
  tags: DietaryTagId[] | unknown;
  /** icons only on cards; withLabel in product detail */
  mode: 'icons' | 'labels';
  t: (key: string) => string;
  className?: string;
};

export default function ShopDietaryBadges({ tags, mode, t, className = '' }: Props) {
  const list = normalizeDietaryTags(tags);
  if (!list.length) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {list.map((id) => {
        const def = dietaryTagDef(id);
        if (!def) return null;
        if (mode === 'icons') {
          return (
            <span
              key={id}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold leading-none"
              style={{ borderColor: def.color, color: def.color }}
              title={t(def.labelKey)}
              aria-label={t(def.labelKey)}
            >
              {def.badge}
            </span>
          );
        }
        return (
          <span
            key={id}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700"
          >
            <span
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold"
              style={{ borderColor: def.color, color: def.color }}
              aria-hidden
            >
              {def.badge}
            </span>
            {t(def.labelKey)}
          </span>
        );
      })}
    </div>
  );
}

export { DIETARY_TAGS };
