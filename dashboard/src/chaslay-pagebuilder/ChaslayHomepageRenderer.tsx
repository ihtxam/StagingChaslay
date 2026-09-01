// @ts-nocheck
'use client';

import React, { useEffect } from 'react';
import { Editor as CraftEditor, Frame } from '@craftjs/core';
import { chaslayPageBuilderResolver } from './resolver';
import { MenuDataProvider } from './MenuDataContext';
import { StorefrontProvider } from './StorefrontContext';
import { BuilderLanguageProvider } from './BuilderLanguageContext';
import '@/chaslay-pagebuilder/chaslay-pagebuilder.css';

type ChaslayHomepageRendererProps = {
  editorState: string;
  shopKey: string;
  basePath: string;
  className?: string;
};

/**
 * Read-only Craft.js renderer for the public shop homepage.
 */
export default function ChaslayHomepageRenderer({
  editorState,
  shopKey,
  basePath,
  className,
}: ChaslayHomepageRendererProps) {
  useEffect(() => {
    document.documentElement.classList.add('chaslay-storefront');
    return () => document.documentElement.classList.remove('chaslay-storefront');
  }, []);

  return (
    <StorefrontProvider shopKey={shopKey} basePath={basePath}>
      <BuilderLanguageProvider>
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
