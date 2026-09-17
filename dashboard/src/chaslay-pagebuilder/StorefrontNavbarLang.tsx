'use client';

import ChaslayLangSwitcher from './components/ChaslayLangSwitcher';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';
import { useStorefront } from './StorefrontContext';

type ChaslayLocale = 'en' | 'fr' | 'de' | 'it';

function toChaslayLocale(code: string | undefined): ChaslayLocale {
  const loc = String(code || 'en').toLowerCase().slice(0, 2);
  if (loc === 'fr' || loc === 'de' || loc === 'it') return loc;
  return 'en';
}

/** Language switcher for the storefront navbar (hidden in the builder canvas). */
export function StorefrontNavbarLang({ className = '' }: { className?: string }) {
  const { isStorefront, locale, setLocale, surface } = useStorefront();
  if (!isStorefront) return null;

  if (surface === 'shop') {
    return <ShopLangSwitcher className={`hb-navbar-lang shrink-0 ${className}`} />;
  }

  return (
    <ChaslayLangSwitcher
      className={`hb-navbar-lang shrink-0 ${className}`}
      locale={toChaslayLocale(locale)}
      onLocaleChange={(code) => setLocale?.(code)}
    />
  );
}
