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

const SUPPORTED_BUILDER_LANGS = ['en', 'de', 'fr', 'it'] as const;

function languagesWithDefault(defaultCode: string): LanguageConfig[] {
  const code = String(defaultCode || 'en').toLowerCase().slice(0, 2);
  const defaultLang = SUPPORTED_BUILDER_LANGS.includes(code as (typeof SUPPORTED_BUILDER_LANGS)[number])
    ? code
    : 'en';
  return SUPPORTED_BUILDER_LANGS.map((lang) => ({
    code: lang,
    is_default: lang === defaultLang ? 1 : 0,
  }));
}

const defaultLanguages: LanguageConfig[] = languagesWithDefault('en');

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
      const defaultCode = defaultLanguageProp || locale;
      setLanguages(languagesWithDefault(defaultCode));
      setDefaultLanguage(defaultCode);
      setIsLoaded(true);
      return;
    }
    getBusinessInfo().then((res) => {
      if (res.data) {
        const langs = (res.data as any).selected_language;
        if (Array.isArray(langs) && langs.length > 0) {
          setLanguages(langs);
          const defaultLang = langs.find((l: LanguageConfig) => l.is_default === 1);
          const code = defaultLang?.code || langs[0].code;
          setDefaultLanguage(code);
        } else {
          const shopLang =
            (res.data as any).shopLanguage || (res.data as any).panelLanguage || 'en';
          const code =
            typeof shopLang === 'string' ? shopLang.slice(0, 2).toLowerCase() : 'en';
          setDefaultLanguage(code);
          setLanguages(languagesWithDefault(code));
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
