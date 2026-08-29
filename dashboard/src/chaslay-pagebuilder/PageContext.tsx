// @ts-nocheck
'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { HomepageBuilderPage } from '@/chaslay-pagebuilder/types/homepage-builder';
import { DEFAULT_EMPTY_CANVAS_STATE } from '@/chaslay-pagebuilder/constants';
import {
  getHomepageBuilderPages,
  createHomepageBuilderPage,
  updateHomepageBuilderPage,
  deleteHomepageBuilderPage,
} from '@/lib/chaslay-pagebuilder/api';
import { toast } from 'react-hot-toast';

interface PageContextState {
  pages: HomepageBuilderPage[];
  currentPage: HomepageBuilderPage | null;
  isLoading: boolean;
  builderId: number | null;
  setCurrentPage: (page: HomepageBuilderPage) => void;
  addPage: (title: string, slug: string) => Promise<HomepageBuilderPage | null>;
  updatePage: (pageId: number, data: Partial<HomepageBuilderPage>) => Promise<void>;
  removePage: (pageId: number) => Promise<void>;
  reorderPages: (pages: HomepageBuilderPage[]) => void;
  loadPages: (builderId: number) => Promise<void>;
  isMultiPageEnabled: boolean;
}

const PageContext = createContext<PageContextState | null>(null);

export const usePageContext = () => {
  const context = useContext(PageContext);
  if (!context) {
    throw new Error('usePageContext must be used within a PageContextProvider');
  }
  return context;
};

interface PageContextProviderProps {
  children: React.ReactNode;
  builderId?: number;
  initialEditorState?: string | null;
  onPageChange?: (pageId: number | null) => void;
}

export const PageContextProvider: React.FC<PageContextProviderProps> = ({ children, builderId, initialEditorState, onPageChange }) => {
  const [pages, setPages] = useState<HomepageBuilderPage[]>([]);
  const [currentPage, setCurrentPage] = useState<HomepageBuilderPage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMultiPageEnabled, setIsMultiPageEnabled] = useState(false);

  const loadPages = useCallback(async (id: number) => {
    setIsLoading(true);
    try {
      const response = await getHomepageBuilderPages(id);
      if (response.data && response.data.length > 0) {
        setPages(response.data);
        setIsMultiPageEnabled(true);
        // Set current page to homepage or first page
        const homepage = response.data.find((p) => p.is_homepage) || response.data[0];
        setCurrentPage(homepage);
      } else {
        // Pages API works but no pages exist yet — auto-create a Home page
        try {
          const createResponse = await createHomepageBuilderPage(id, {
            title: 'Home',
            slug: 'home',
            editor_state: initialEditorState?.trim() ? initialEditorState : DEFAULT_EMPTY_CANVAS_STATE,
            sort_order: 0,
            is_homepage: true,
          });
          if (createResponse.data) {
            setPages([createResponse.data]);
            setCurrentPage(createResponse.data);
            setIsMultiPageEnabled(true);
            return;
          }
        } catch {
          // Auto-create failed, fall through to fallback
        }
        // Fallback: single page mode
        const fallbackPage: HomepageBuilderPage = {
          homepage_builder_id: id,
          title: 'Home',
          slug: 'home',
          editor_state: initialEditorState || null,
          sort_order: 0,
          is_homepage: true,
        };
        setPages([fallbackPage]);
        setCurrentPage(fallbackPage);
        setIsMultiPageEnabled(false);
      }
    } catch {
      // API not available - use single page fallback
      const fallbackPage: HomepageBuilderPage = {
        homepage_builder_id: id,
        title: 'Home',
        slug: 'home',
        editor_state: initialEditorState || null,
        sort_order: 0,
        is_homepage: true,
      };
      setPages([fallbackPage]);
      setCurrentPage(fallbackPage);
      setIsMultiPageEnabled(false);
    } finally {
      setIsLoading(false);
    }
  }, [initialEditorState]);

  useEffect(() => {
    if (builderId) {
      loadPages(builderId);
    }
  }, [builderId, loadPages]);

  // Notify parent when current page changes
  useEffect(() => {
    onPageChange?.(currentPage?.id ?? null);
  }, [currentPage, onPageChange]);

  const addPage = useCallback(async (title: string, slug: string): Promise<HomepageBuilderPage | null> => {
    if (!builderId) return null;
    try {
      const response = await createHomepageBuilderPage(builderId, {
        title,
        slug,
        editor_state: DEFAULT_EMPTY_CANVAS_STATE,
        sort_order: pages.length,
        is_homepage: false,
      });
      if (response.data) {
        setPages((prev) => [...prev, response.data!]);
        return response.data;
      }
    } catch {
      toast.error('Failed to create page');
    }
    return null;
  }, [builderId, pages.length]);

  const updatePage = useCallback(async (pageId: number, data: Partial<HomepageBuilderPage>) => {
    if (!builderId) return;
    try {
      const apiData: Partial<{ title: string; slug: string; editor_state: string; sort_order: number; is_homepage: boolean }> = {};
      if (data.title !== undefined) apiData.title = data.title;
      if (data.slug !== undefined) apiData.slug = data.slug;
      if (data.editor_state !== undefined && data.editor_state !== null) apiData.editor_state = data.editor_state;
      if (data.sort_order !== undefined) apiData.sort_order = data.sort_order;
      if (data.is_homepage !== undefined) apiData.is_homepage = data.is_homepage;
      await updateHomepageBuilderPage(builderId, pageId, apiData);
      setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, ...data } : p)));
      if (currentPage?.id === pageId) {
        setCurrentPage((prev) => prev ? { ...prev, ...data } : prev);
      }
    } catch {
      toast.error('Failed to update page');
    }
  }, [builderId, currentPage?.id]);

  const removePage = useCallback(async (pageId: number) => {
    if (!builderId) return;
    try {
      await deleteHomepageBuilderPage(builderId, pageId);
      setPages((prev) => {
        const filtered = prev.filter((p) => p.id !== pageId);
        if (currentPage?.id === pageId && filtered.length > 0) {
          setCurrentPage(filtered[0]);
        }
        return filtered;
      });
    } catch {
      toast.error('Failed to delete page');
    }
  }, [builderId, currentPage?.id]);

  const reorderPages = useCallback((reorderedPages: HomepageBuilderPage[]) => {
    setPages(reorderedPages);
  }, []);

  return (
    <PageContext.Provider
      value={{
        pages,
        currentPage,
        isLoading,
        builderId: builderId || null,
        setCurrentPage,
        addPage,
        updatePage,
        removePage,
        reorderPages,
        loadPages,
        isMultiPageEnabled,
      }}
    >
      {children}
    </PageContext.Provider>
  );
};
