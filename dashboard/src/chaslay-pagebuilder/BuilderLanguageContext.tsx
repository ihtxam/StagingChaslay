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

export function BuilderLanguageProvider({ children }: { children: React.ReactNode }) {
  const [languages, setLanguages] = useState<LanguageConfig[]>(defaultLanguages);
  const [defaultLanguage, setDefaultLanguage] = useState('en');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    getBusinessInfo().then((res) => {
      if (res.data) {
        const langs = (res.data as any).selected_language;
        if (Array.isArray(langs) && langs.length > 0) {
          setLanguages(langs);
          const defaultLang = langs.find((l: LanguageConfig) => l.is_default === 1);
          setDefaultLanguage(defaultLang?.code || langs[0].code);
        }
        // If no selected_language from API, keep the defaults (EN/DE/FR/IT)
      }
      setIsLoaded(true);
    }).catch(() => setIsLoaded(true));
  }, []);

  return (
    <BuilderLanguageContext.Provider value={{ languages, defaultLanguage, isLoaded }}>
      {children}
    </BuilderLanguageContext.Provider>
  );
}
