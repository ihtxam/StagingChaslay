import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import {
  DIETARY_TAGS,
  type DietaryTagId,
  dietaryTagDef,
} from '@/lib/product-dietary';

type Props = {
  active: DietaryTagId[];
  onChange: (next: DietaryTagId[]) => void;
  onApplied?: () => void;
  t: (key: string) => string;
};

export default function ShopMenuDietaryFilter({ active, onChange, onApplied, t }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setOpen(false), 5000);
    return () => window.clearTimeout(timer);
  }, [open, active]);

  const apply = (next: DietaryTagId[]) => {
    onChange(next);
    setOpen(false);
    window.setTimeout(() => onApplied?.(), 0);
  };

  const toggle = (id: DietaryTagId) => {
    apply(active.includes(id) ? active.filter((x) => x !== id) : [...active, id]);
  };

  const count = active.length;

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3 ${
          count
            ? 'border-stone-900 bg-stone-900 text-white'
            : 'border-stone-200 bg-white text-stone-800 hover:border-stone-400'
        }`}
        aria-expanded={open}
        aria-label={t('shopDietaryFilter')}
        title={t('shopDietaryFilter')}
      >
        <SlidersHorizontal className="h-4 w-4" strokeWidth={2} />
        {count ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--shop-accent,#e11d48)] px-1 text-[10px] font-bold text-white sm:static sm:h-auto sm:min-w-0 sm:bg-transparent sm:text-xs sm:opacity-90">
            {count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,20rem)] rounded-xl border border-stone-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            {t('shopDietaryFilterHint')}
          </p>
          <ul className="space-y-1">
            {DIETARY_TAGS.map((tag) => {
              const def = dietaryTagDef(tag.id)!;
              const checked = active.includes(tag.id);
              return (
                <li key={tag.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-stone-50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-stone-300"
                      checked={checked}
                      onChange={() => toggle(tag.id)}
                    />
                    <span className="flex-1 text-sm font-medium text-stone-800">{t(def.labelKey)}</span>
                    <span
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold"
                      style={{ borderColor: def.color, color: def.color }}
                      aria-hidden
                    >
                      {def.badge}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {count ? (
            <button
              type="button"
              className="mt-2 w-full text-center text-xs font-semibold text-stone-600 hover:text-stone-900"
              onClick={() => apply([])}
            >
              {t('shopDietaryClearFilters')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
