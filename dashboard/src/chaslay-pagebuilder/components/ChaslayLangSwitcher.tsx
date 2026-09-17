// @ts-nocheck
'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useBuilderLanguage } from '../BuilderLanguageContext';
import { useI18n, type Locale } from '@/lib/i18n';

const SHOP_LOCALES: Locale[] = ['en', 'fr', 'de'];

type ChaslayLocale = 'en' | 'fr' | 'de' | 'it';

function toShopLocale(code: string): Locale | null {
  const loc = code.toLowerCase().slice(0, 2);
  return SHOP_LOCALES.includes(loc as Locale) ? (loc as Locale) : null;
}

export default function ChaslayLangSwitcher({
  className = '',
  menuPlacement = 'bottom',
  locale,
  onLocaleChange,
}: {
  className?: string;
  menuPlacement?: 'top' | 'bottom';
  locale: ChaslayLocale;
  onLocaleChange: (code: ChaslayLocale) => void;
}) {
  const { languages } = useBuilderLanguage();
  const { setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const options = languages.length
    ? languages.map((l) => l.code.toLowerCase().slice(0, 2))
    : ['en', 'de', 'fr', 'it'];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pickLocale = (code: string) => {
    const normalized = code.toLowerCase().slice(0, 2) as ChaslayLocale;
    onLocaleChange(normalized);
    const shopLocale = toShopLocale(normalized);
    if (shopLocale) setLocale(shopLocale);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-0.5 border border-stone-200 bg-white px-2 text-xs font-semibold uppercase tracking-wide text-stone-800 hover:border-stone-400"
        aria-label={t('shopLanguage')}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {locale}
        <ChevronDown className={`h-3.5 w-3.5 text-stone-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <ul
          role="listbox"
          className={`absolute right-0 z-40 min-w-full overflow-hidden border border-stone-200 bg-white shadow-sm ${
            menuPlacement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          {options.map((code) => (
            <li key={code} role="option" aria-selected={locale === code}>
              <button
                type="button"
                onClick={() => pickLocale(code)}
                className={`block w-full px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide ${
                  locale === code ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-50'
                }`}
              >
                {code}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
