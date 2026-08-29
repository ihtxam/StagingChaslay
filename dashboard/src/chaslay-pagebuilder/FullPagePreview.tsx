// @ts-nocheck
'use client';

import React, { useEffect } from 'react';
import { Frame, useEditor } from '@craftjs/core';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { X, Monitor, Tablet, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { ViewportSize, VIEWPORT_SIZES, STOREFRONT_MAX_WIDTH } from '@/chaslay-pagebuilder/types/homepage-builder';
import { cn } from '@/lib/chaslay-pagebuilder/utils';
import { useTranslations } from '@/lib/chaslay-pagebuilder/i18n-stub';
import { usePageContext } from './PageContext';

interface FullPagePreviewProps {
  onExit: () => void;
}

export const FullPagePreview: React.FC<FullPagePreviewProps> = ({ onExit }) => {
  const [viewportSize, setViewportSize] = useState<ViewportSize>('desktop');
  const t = useTranslations('homepageBuilder');

  const { actions } = useEditor();
  const { pages, setCurrentPage } = usePageContext();

  const handlePreviewLinkClick = (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest('a');
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();

    const href = target.getAttribute('href');
    if (!href) return;

    // Strip leading slash and hash fragments to get the slug
    const slug = href.replace(/^\//, '').replace(/#.*$/, '');
    if (!slug) return;

    const matchedPage = pages.find((p) => p.slug === slug);
    if (matchedPage) {
      setCurrentPage(matchedPage);
      if (matchedPage.editor_state) {
        try {
          actions.deserialize(matchedPage.editor_state);
        } catch (err) {
          console.error('Failed to deserialize page state in preview:', err);
        }
      }
    }
  };

  // Disable editing in full preview mode
  useEffect(() => {
    actions.setOptions((options) => {
      options.enabled = false;
    });

    return () => {
      actions.setOptions((options) => {
        options.enabled = true;
      });
    };
  }, [actions]);

  // Handle escape key to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit]);

  const viewportIcons: Record<ViewportSize, React.ReactNode> = {
    desktop: <Monitor className="w-4 h-4" />,
    tablet: <Tablet className="w-4 h-4" />,
    mobile: <Smartphone className="w-4 h-4" />,
  };

  const getViewportWidth = () => {
    return `${VIEWPORT_SIZES[viewportSize].width}px`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Top Bar */}
      <div className="h-12 border-b bg-background/95 backdrop-blur flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-medium text-muted-foreground">{t('fullPagePreview')}</h2>
          <span className="text-xs text-muted-foreground">{t('pressEscToExit')}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Viewport Size Toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {(Object.keys(VIEWPORT_SIZES) as ViewportSize[]).map((size) => (
              <Button
                key={size}
                variant={viewportSize === size ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewportSize(size)}
                className={cn(
                  'gap-2 h-8',
                  viewportSize === size ? '' : 'hover:bg-background'
                )}
              >
                {viewportIcons[size]}
                <span className="hidden sm:inline text-xs">{VIEWPORT_SIZES[size].label}</span>
                <span className="text-xs text-muted-foreground hidden md:inline">
                  ({VIEWPORT_SIZES[size].width}px)
                </span>
              </Button>
            ))}
          </div>

          <div className="h-6 w-px bg-border mx-2" />

          {/* Exit Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onExit}
            className="gap-2"
          >
            <X className="w-4 h-4" />
            {t('exitPreview')}
          </Button>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 overflow-auto bg-muted/30" style={{ scrollBehavior: 'smooth' }} onClickCapture={handlePreviewLinkClick}>
        <div
          className={cn(
            'mx-auto bg-white transition-all duration-300',
            viewportSize !== 'desktop' && 'my-4 shadow-2xl rounded-lg'
          )}
          style={{
            width: getViewportWidth(),
            maxWidth: '100%',
            minHeight: viewportSize === 'desktop' ? '100%' : 'calc(100vh - 80px)',
            containerType: 'inline-size',
          }}
        >
          <Frame />
        </div>
      </div>
    </div>
  );
};
