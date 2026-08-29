// @ts-nocheck
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Frame, useEditor } from '@craftjs/core';
import { ViewportSize, VIEWPORT_SIZES, STOREFRONT_MAX_WIDTH } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Monitor, Tablet, Smartphone } from 'lucide-react';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { cn } from '@/lib/chaslay-pagebuilder/utils';
import { usePageContext } from './PageContext';
import { DEFAULT_EMPTY_CANVAS_STATE } from './constants';

interface ViewportProps {
  initialState?: string | null;
  defaultContent: React.ReactElement;
}

export const Viewport: React.FC<ViewportProps> = ({ initialState, defaultContent }) => {
  const [viewportSize, setViewportSize] = useState<ViewportSize>('desktop');
  const [isLoaded, setIsLoaded] = useState(false);
  const hasLoadedInitialState = useRef(false);
  const currentPageIdRef = useRef<number | string | null>(null);

  const { actions, query, enabled } = useEditor((state) => ({
    enabled: state.options.enabled,
  }));

  const { currentPage, isMultiPageEnabled } = usePageContext();

  // Load initial state - only once
  useEffect(() => {
    if (hasLoadedInitialState.current) return;

    if (initialState) {
      try {
        const parsedState = JSON.parse(initialState);
        if (parsedState && Object.keys(parsedState).length > 0) {
          // Small delay to ensure editor is ready
          setTimeout(() => {
            actions.deserialize(initialState);
            hasLoadedInitialState.current = true;
            setIsLoaded(true);
          }, 100);
        } else {
          hasLoadedInitialState.current = true;
          setIsLoaded(true);
        }
      } catch (e) {
        console.error('Failed to load initial state:', e);
        hasLoadedInitialState.current = true;
        setIsLoaded(true);
      }
    } else {
      hasLoadedInitialState.current = true;
      setIsLoaded(true);
    }
  }, [initialState, actions]);

  // When switching pages in multi-page mode, deserialize the new page's editor_state
  useEffect(() => {
    if (!isMultiPageEnabled || !hasLoadedInitialState.current || !currentPage) return;

    const pageKey = currentPage.id ?? currentPage.slug;
    if (currentPageIdRef.current === pageKey) return;
    currentPageIdRef.current = pageKey;

    if (currentPage.editor_state) {
      try {
        const parsedState = JSON.parse(currentPage.editor_state);
        if (parsedState && Object.keys(parsedState).length > 0) {
          actions.deserialize(currentPage.editor_state);
          return;
        }
      } catch (e) {
        console.error('Failed to deserialize page state:', e);
      }
    }

    // No editor_state or invalid — reset to empty canvas with a droppable RootContainer
    actions.deserialize(DEFAULT_EMPTY_CANVAS_STATE);
  }, [currentPage, isMultiPageEnabled, actions]);

  const viewportIcons: Record<ViewportSize, React.ReactNode> = {
    desktop: <Monitor className="w-4 h-4" />,
    tablet: <Tablet className="w-4 h-4" />,
    mobile: <Smartphone className="w-4 h-4" />,
  };

  const getViewportWidth = () => {
    return `${VIEWPORT_SIZES[viewportSize].width}px`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-muted/50">
      {/* Viewport Size Toggle */}
      <div className="flex items-center justify-center gap-1 py-2 bg-background border-b">
        {(Object.keys(VIEWPORT_SIZES) as ViewportSize[]).map((size) => (
          <Button
            key={size}
            variant={viewportSize === size ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewportSize(size)}
            className="gap-2"
          >
            {viewportIcons[size]}
            <span className="hidden sm:inline">{VIEWPORT_SIZES[size].label}</span>
            <span className="text-xs text-muted-foreground hidden md:inline">
              ({VIEWPORT_SIZES[size].width}px)
            </span>
          </Button>
        ))}
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-auto p-4">
        <div
          className={cn(
            'craftjs-renderer mx-auto bg-white shadow-lg transition-all duration-300 rounded-lg'
          )}
          style={{
            width: getViewportWidth(),
            maxWidth: '100%',
            minHeight: 'calc(100vh - 180px)',
            scrollBehavior: 'smooth',
            containerType: 'inline-size',
          }}
          onClickCapture={(e: React.MouseEvent) => {
            const target = (e.target as HTMLElement).closest('a');
            if (!target) return;
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {isLoaded && (
            <Frame>
              {!initialState && defaultContent}
            </Frame>
          )}
        </div>
      </div>
    </div>
  );
};
