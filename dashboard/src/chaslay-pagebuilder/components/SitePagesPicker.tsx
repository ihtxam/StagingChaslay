// @ts-nocheck
'use client';

import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { usePageContext } from '../PageContext';
import {
  existingPageSlugsInMenu,
  pageNavLink,
  type NavMenuItem,
} from '../utils/page-nav-links';

interface SitePagesPickerProps {
  menuItems: NavMenuItem[];
  onAddPages: (items: NavMenuItem[]) => void;
  compact?: boolean;
}

export const SitePagesPicker: React.FC<SitePagesPickerProps> = ({
  menuItems,
  onAddPages,
  compact = false,
}) => {
  const { pages, isLoading, isMultiPageEnabled } = usePageContext();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const usedSlugs = useMemo(
    () => existingPageSlugsInMenu(menuItems, pages),
    [menuItems, pages]
  );

  const available = useMemo(() => {
    const sorted = [...pages].sort((a, b) => {
      if (a.is_homepage && !b.is_homepage) return -1;
      if (!a.is_homepage && b.is_homepage) return 1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
    return sorted.filter((page) => {
      if (usedSlugs.has(page.slug)) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return page.title.toLowerCase().includes(q) || page.slug.toLowerCase().includes(q);
    });
  }, [pages, usedSlugs, search]);

  const addPage = (page: (typeof pages)[number]) => {
    onAddPages([pageNavLink(page)]);
    setSearch('');
  };

  const addAllAvailable = () => {
    if (available.length === 0) return;
    onAddPages(available.map(pageNavLink));
    setSearch('');
    setOpen(false);
  };

  if (!isMultiPageEnabled && pages.length <= 1) {
    return (
      <p className="text-xs text-muted-foreground">
        Create more pages in the page manager to add them to the menu.
      </p>
    );
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label className="text-sm">Add pages</Label>
          {!compact && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Pick published builder pages — links are set automatically.
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Done' : 'Add pages'}
        </Button>
      </div>

      {open && (
        <div className="space-y-2 rounded-md border bg-muted/20 p-2">
          <Input
            placeholder="Search pages…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs"
          />
          {available.length > 1 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={addAllAvailable}
            >
              Add all {available.length} pages
            </Button>
          )}
          <div className="max-h-40 overflow-y-auto rounded-md border bg-background">
            {isLoading ? (
              <div className="text-xs text-muted-foreground p-3 text-center">Loading pages…</div>
            ) : available.length === 0 ? (
              <div className="text-xs text-muted-foreground p-3 text-center">
                {search ? 'No matching pages' : 'All pages already in menu'}
              </div>
            ) : (
              available.map((page) => (
                <button
                  key={page.id ?? page.slug}
                  type="button"
                  onClick={() => addPage(page)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted text-left border-b last:border-b-0"
                >
                  <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate font-medium">{page.title}</span>
                  <span className="text-muted-foreground truncate max-w-[40%]">
                    {page.is_homepage ? '/' : `/pages/${page.slug}`}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
