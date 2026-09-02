// @ts-nocheck
'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { SitePagesPicker } from './SitePagesPicker';
import { normalizeLink } from '../utils/normalizeLink';
import type { NavMenuItem } from '../utils/page-nav-links';

export interface LinkColumn {
  title: string;
  links: NavMenuItem[];
}

interface FooterColumnsEditorProps {
  columns: LinkColumn[];
  setProp: (fn: (p: Record<string, unknown>) => void) => void;
}

export const FooterColumnsEditor: React.FC<FooterColumnsEditorProps> = ({ columns, setProp }) => {
  const updateColumnLinks = (columnIndex: number, links: NavMenuItem[]) => {
    setProp((p) => {
      const cols = [...((p.columns as LinkColumn[]) || [])];
      if (cols[columnIndex]) cols[columnIndex] = { ...cols[columnIndex], links };
      p.columns = cols;
    });
  };

  const addLink = (columnIndex: number) => {
    setProp((p) => {
      const cols = [...((p.columns as LinkColumn[]) || [])];
      if (cols[columnIndex]) {
        cols[columnIndex] = {
          ...cols[columnIndex],
          links: [...(cols[columnIndex].links || []), { label: 'New', link: '/' }],
        };
      }
      p.columns = cols;
    });
  };

  const removeLink = (columnIndex: number, linkIndex: number) => {
    setProp((p) => {
      const cols = [...((p.columns as LinkColumn[]) || [])];
      if (cols[columnIndex]) {
        cols[columnIndex] = {
          ...cols[columnIndex],
          links: cols[columnIndex].links.filter((_, i) => i !== linkIndex),
        };
      }
      p.columns = cols;
    });
  };

  const updateLink = (
    columnIndex: number,
    linkIndex: number,
    field: 'label' | 'link',
    value: string
  ) => {
    if (field === 'link') value = normalizeLink(value);
    setProp((p) => {
      const cols = [...((p.columns as LinkColumn[]) || [])];
      if (cols[columnIndex]?.links[linkIndex]) {
        const links = [...cols[columnIndex].links];
        links[linkIndex] = { ...links[linkIndex], [field]: value };
        cols[columnIndex] = { ...cols[columnIndex], links };
      }
      p.columns = cols;
    });
  };

  const updateColumnTitle = (columnIndex: number, title: string) => {
    setProp((p) => {
      const cols = [...((p.columns as LinkColumn[]) || [])];
      if (cols[columnIndex]) cols[columnIndex] = { ...cols[columnIndex], title };
      p.columns = cols;
    });
  };

  return (
    <div className="border-t pt-4 space-y-4">
      <Label className="font-semibold">Link Columns</Label>
      {columns.map((column, colIdx) => (
        <div key={colIdx} className="rounded-md border p-3 space-y-3 bg-muted/20">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Column title</Label>
            <Input
              value={column.title}
              onChange={(e) => updateColumnTitle(colIdx, e.target.value)}
              className="h-8"
            />
          </div>

          <SitePagesPicker
            menuItems={column.links || []}
            onAddPages={(newItems) =>
              updateColumnLinks(colIdx, [...(column.links || []), ...newItems])
            }
            compact
          />

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm">Links</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => addLink(colIdx)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {(column.links || []).map((link, linkIdx) => (
                <div key={linkIdx} className="flex gap-2 items-center">
                  <Input
                    value={link.label}
                    onChange={(e) => updateLink(colIdx, linkIdx, 'label', e.target.value)}
                    className="h-8 flex-1"
                    placeholder="Label"
                  />
                  <Input
                    value={link.link}
                    onChange={(e) => updateLink(colIdx, linkIdx, 'link', e.target.value)}
                    className="h-8 flex-1"
                    placeholder="Link"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLink(colIdx, linkIdx)}
                    className="h-8 w-8 p-0 text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
