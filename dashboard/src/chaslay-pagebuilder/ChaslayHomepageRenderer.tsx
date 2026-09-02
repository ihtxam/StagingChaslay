// @ts-nocheck
'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Editor as CraftEditor, Frame } from '@craftjs/core';
import { chaslayPageBuilderResolver } from './resolver';
import { MenuDataProvider } from './MenuDataContext';
import { StorefrontProvider, type SitePageLink } from './StorefrontContext';
import { BuilderLanguageProvider } from './BuilderLanguageContext';
import '@/chaslay-pagebuilder/chaslay-pagebuilder.css';

type ChaslayHomepageRendererProps = {
  editorState: string;
  shopKey: string;
  basePath: string;
  className?: string;
  locale?: string;
  defaultLanguage?: string;
  sitePages?: SitePageLink[];
};

/**
 * Read-only Craft.js renderer for the public shop homepage.
 */
export default function ChaslayHomepageRenderer({
  editorState,
  shopKey,
  basePath,
  className,
  locale = 'en',
  defaultLanguage = 'en',
  sitePages = [],
}: ChaslayHomepageRendererProps) {
  const [navPages, setNavPages] = useState<SitePageLink[]>(sitePages);

  useEffect(() => {
    document.documentElement.classList.add('chaslay-storefront');
    return () => document.documentElement.classList.remove('chaslay-storefront');
  }, []);

  useEffect(() => {
    if (sitePages.length > 0) {
      setNavPages(sitePages);
      return;
    }
    let cancelled = false;
    axios
      .get(`/api/shop/${shopKey}/site-pages`)
      .then((res) => {
        if (cancelled) return;
        const rows = res.data?.data;
        if (Array.isArray(rows)) setNavPages(rows);
      })
      .catch(() => {
        /* optional nav enrichment */
      });
    return () => {
      cancelled = true;
    };
  }, [shopKey, sitePages]);

  return (
    <StorefrontProvider
      shopKey={shopKey}
      basePath={basePath}
      locale={locale}
      defaultLanguage={defaultLanguage}
      sitePages={navPages}
    >
      <BuilderLanguageProvider locale={locale} defaultLanguage={defaultLanguage}>
        <MenuDataProvider>
          <div className={`chaslay-pagebuilder-root chaslay-storefront-page ${className || ''}`}>
            <CraftEditor enabled={false} resolver={chaslayPageBuilderResolver}>
              <Frame data={editorState} />
            </CraftEditor>
          </div>
        </MenuDataProvider>
      </BuilderLanguageProvider>
    </StorefrontProvider>
  );
}
