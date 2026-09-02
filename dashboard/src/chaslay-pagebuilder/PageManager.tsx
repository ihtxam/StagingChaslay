// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { usePageContext } from './PageContext';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Plus, X, Home, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/chaslay-pagebuilder/ui/dialog';
import { Label } from '@/chaslay-pagebuilder/ui/label';

export const PageManager: React.FC = () => {
  const { pages, currentPage, setCurrentPage, addPage, removePage, isMultiPageEnabled } = usePageContext();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageSlug, setNewPageSlug] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  if (!isMultiPageEnabled) return null;

  const handleAddPage = async () => {
    if (!newPageTitle.trim()) return;
    setIsAdding(true);
    const slug = newPageSlug.trim() || newPageTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const page = await addPage(newPageTitle.trim(), slug);
    if (page) {
      setCurrentPage(page);
      setShowAddDialog(false);
      setNewPageTitle('');
      setNewPageSlug('');
    }
    setIsAdding(false);
  };

  const handleDeletePage = async (e: React.MouseEvent, pageId: number | undefined) => {
    e.stopPropagation();
    if (!pageId) return;
    const page = pages.find((p) => p.id === pageId);
    if (page?.is_homepage) return; // Can't delete homepage
    if (pages.length <= 1) return; // Can't delete last page
    await removePage(pageId);
  };

  return (
    <>
      <div className="h-10 border-b bg-muted/30 flex items-center px-4 gap-1 overflow-x-auto">
        {pages.map((page) => (
          <button
            key={page.id || page.slug}
            onClick={() => setCurrentPage(page)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap
              ${currentPage?.id === page.id || (currentPage?.slug === page.slug && !currentPage?.id)
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }
            `}
          >
            {page.is_homepage ? <Home className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
            {page.title}
            {!page.is_homepage && page.id && pages.length > 1 && (
              <button
                onClick={(e) => handleDeletePage(e, page.id)}
                className="ml-1 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAddDialog(true)}
          className="h-7 px-2 text-muted-foreground"
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Page Title</Label>
              <Input
                value={newPageTitle}
                onChange={(e) => {
                  setNewPageTitle(e.target.value);
                  setNewPageSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                }}
                placeholder="e.g., About Us"
              />
            </div>
            <div className="space-y-2">
              <Label>URL Slug</Label>
              <Input
                value={newPageSlug}
                onChange={(e) => setNewPageSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                placeholder="e.g., about-us"
              />
              <p className="text-xs text-muted-foreground">This will be the URL path for the page (e.g. /shop/your-store/pages/about-us)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddPage} disabled={isAdding || !newPageTitle.trim()}>
              {isAdding ? 'Adding...' : 'Add Page'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
