// @ts-nocheck
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Frame, useEditor } from '@craftjs/core';
import { ViewportSize, VIEWPORT_SIZES, STOREFRONT_MAX_WIDTH } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Monitor, Tablet, Smartphone } from 'lucide-react';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { cn } from '@/lib/chaslay-pagebuilder/utils';
import { usePageContext } from './PageContext';
import { DEFAULT_EMPTY_CANVAS_STATE } from './constants';
import { isEffectivelyEmptyEditorState } from '@/lib/chaslay-pagebuilder/editor-state';

interface ViewportProps {
  initialState?: string | null;
  defaultContent: React.ReactElement;
}

function resolveEditorState(
  pageState?: string | null,
  builderState?: string | null
): string | null {
  if (pageState && !isEffectivelyEmptyEditorState(pageState)) return pageState;
  if (builderState && !isEffectivelyEmptyEditorState(builderState)) return builderState;
  return null;
}

export const Viewport: React.FC<ViewportProps> = ({ initialState, defaultContent }) => {
  const [viewportSize, setViewportSize] = useState<ViewportSize>('desktop');
  const [isLoaded, setIsLoaded] = useState(false);
  const loadedPageKeyRef = useRef<string | null>(null);

  const { actions } = useEditor((state) => ({
    enabled: state.options.enabled,
  }));

  const { currentPage, isMultiPageEnabled, isLoading: pagesLoading } = usePageContext();

  const resolvedState = useMemo(
    () => resolveEditorState(currentPage?.editor_state, initialState),
    [currentPage?.editor_state, initialState]
  );

  // Wait for pages API before deserializing — avoids empty builder snapshot winning the race.
  useEffect(() => {
    if (pagesLoading) return;

    const pageKey = currentPage
      ? String(currentPage.id ?? currentPage.slug)
      : resolvedState
        ? 'builder'
        : 'empty';

    if (loadedPageKeyRef.current === pageKey) return;
    loadedPageKeyRef.current = pageKey;

    if (resolvedState) {
      try {
        actions.deserialize(resolvedState);
      } catch (e) {
        console.error('Failed to deserialize editor state:', e);
        actions.deserialize(DEFAULT_EMPTY_CANVAS_STATE);
      }
    } else if (!isMultiPageEnabled) {
      actions.deserialize(DEFAULT_EMPTY_CANVAS_STATE);
    }

    setIsLoaded(true);
  }, [pagesLoading, currentPage, resolvedState, isMultiPageEnabled, actions]);

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
              {!resolvedState && defaultContent}
            </Frame>
          )}
        </div>
      </div>
    </div>
  );
};
