// @ts-nocheck
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getBusinessInfo } from '@/lib/chaslay-pagebuilder/api';

interface LanguageConfig {
  code: string;
  is_default: number;
}

interface BuilderLanguageContextType {
  languages: LanguageConfig[];
  defaultLanguage: string;
  isLoaded: boolean;
}

const defaultLanguages: LanguageConfig[] = [
  { code: 'en', is_default: 1 },
  { code: 'de', is_default: 0 },
  { code: 'fr', is_default: 0 },
  { code: 'it', is_default: 0 },
];

const BuilderLanguageContext = createContext<BuilderLanguageContextType>({
  languages: defaultLanguages,
  defaultLanguage: 'en',
  isLoaded: false,
});

export function useBuilderLanguage() {
  return useContext(BuilderLanguageContext);
}

export function BuilderLanguageProvider({
  children,
  locale,
  defaultLanguage: defaultLanguageProp,
}: {
  children: React.ReactNode;
  locale?: string;
  defaultLanguage?: string;
}) {
  const [languages, setLanguages] = useState<LanguageConfig[]>(defaultLanguages);
  const [defaultLanguage, setDefaultLanguage] = useState(defaultLanguageProp || 'en');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (locale) {
      const codes = ['en', 'de', 'fr', 'it'];
      const active = codes.includes(locale) ? codes : [locale, ...codes.filter((c) => c !== locale)];
      setLanguages(
        active.map((code) => ({
          code,
          is_default: code === (defaultLanguageProp || locale) ? 1 : 0,
        }))
      );
      setDefaultLanguage(defaultLanguageProp || locale);
      setIsLoaded(true);
      return;
    }
    getBusinessInfo().then((res) => {
      if (res.data) {
        const langs = (res.data as any).selected_language;
        if (Array.isArray(langs) && langs.length > 0) {
          setLanguages(langs);
          const defaultLang = langs.find((l: LanguageConfig) => l.is_default === 1);
          setDefaultLanguage(defaultLang?.code || langs[0].code);
        } else {
          const panelLang = (res.data as any).panelLanguage || (res.data as any).shopLanguage;
          if (panelLang && typeof panelLang === 'string') {
            setDefaultLanguage(panelLang.slice(0, 2));
          }
        }
      }
      setIsLoaded(true);
    }).catch(() => setIsLoaded(true));
  }, [locale, defaultLanguageProp]);

  return (
    <BuilderLanguageContext.Provider value={{ languages, defaultLanguage, isLoaded }}>
      {children}
    </BuilderLanguageContext.Provider>
  );
}
