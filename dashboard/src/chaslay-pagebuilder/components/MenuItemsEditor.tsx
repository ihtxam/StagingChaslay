// @ts-nocheck
'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { TranslatableArrayInput } from './TranslatableInput';
import { SitePagesPicker } from './SitePagesPicker';
import { normalizeLink } from '../utils/normalizeLink';
import type { NavMenuItem } from '../utils/page-nav-links';

interface MenuItemsEditorProps {
  label?: string;
  menuItems: NavMenuItem[];
  setProp: (fn: (p: Record<string, unknown>) => void) => void;
  menuItemsKey?: string;
  nodeProps?: Record<string, unknown>;
  translatableLabels?: boolean;
  useSitePagesNav?: boolean;
  showSitePagesNavToggle?: boolean;
}

export const MenuItemsEditor: React.FC<MenuItemsEditorProps> = ({
  label = 'Menu Items',
  menuItems,
  setProp,
  menuItemsKey = 'menuItems',
  nodeProps,
  translatableLabels = true,
  useSitePagesNav,
  showSitePagesNavToggle = false,
}) => {
  const items = menuItems || [];

  const updateItems = (next: NavMenuItem[], disableAutoNav = false) => {
    setProp((p) => {
      p[menuItemsKey] = next;
      if (disableAutoNav && 'useSitePagesNav' in p) {
        p.useSitePagesNav = false;
      }
    });
  };

  const addMenuItem = () => {
    setProp((p) => {
      const current = (p[menuItemsKey] as NavMenuItem[]) || [];
      p[menuItemsKey] = [...current, { label: 'New', link: '/' }];
      if ('useSitePagesNav' in p) p.useSitePagesNav = false;
    });
  };

  const removeMenuItem = (i: number) => {
    setProp((p) => {
      const current = (p[menuItemsKey] as NavMenuItem[]) || [];
      p[menuItemsKey] = current.filter((_, idx) => idx !== i);
      if ('useSitePagesNav' in p) p.useSitePagesNav = false;
    });
  };

  const updateMenuItem = (i: number, field: 'label' | 'link', value: string) => {
    if (field === 'link') value = normalizeLink(value);
    setProp((p) => {
      const current = [...((p[menuItemsKey] as NavMenuItem[]) || [])];
      if (current[i]) current[i] = { ...current[i], [field]: value };
      p[menuItemsKey] = current;
      if ('useSitePagesNav' in p) p.useSitePagesNav = false;
    });
  };

  const handleAddPages = (newItems: NavMenuItem[]) => {
    if (newItems.length === 0) return;
    updateItems([...items, ...newItems], true);
  };

  return (
    <div className="border-t pt-4 space-y-3">
      {showSitePagesNavToggle && (
        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2">
          <div>
            <Label className="text-sm">Auto site navigation</Label>
            <p className="text-xs text-muted-foreground">
              When on, the live storefront ignores manual links and lists all pages automatically.
            </p>
          </div>
          <input
            type="checkbox"
            checked={useSitePagesNav !== false}
            onChange={(e) =>
              setProp((p) => {
                if ('useSitePagesNav' in p) p.useSitePagesNav = e.target.checked;
              })
            }
            className="h-4 w-4 shrink-0"
          />
        </div>
      )}

      <SitePagesPicker menuItems={items} onAddPages={handleAddPages} />

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>{label}</Label>
          <Button type="button" variant="outline" size="sm" onClick={addMenuItem} title="Add custom link">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Custom links for external URLs or routes like /menu and /reservations.
        </p>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="border rounded-md p-2 space-y-2 bg-muted/30">
              {translatableLabels && nodeProps ? (
                <TranslatableArrayInput
                  propKey="label"
                  arrayPropKey={menuItemsKey}
                  index={i}
                  nodeProps={nodeProps}
                  setProp={setProp}
                  value={item.label}
                  onChange={(v) => updateMenuItem(i, 'label', v)}
                  placeholder="Label"
                />
              ) : (
                <Input
                  value={item.label}
                  onChange={(e) => updateMenuItem(i, 'label', e.target.value)}
                  className="h-8"
                  placeholder="Label"
                />
              )}
              <div className="flex gap-2 items-center">
                <Input
                  value={item.link}
                  onChange={(e) => updateMenuItem(i, 'link', e.target.value)}
                  className="h-8 flex-1"
                  placeholder="/menu, /pages/about, https://…"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMenuItem(i)}
                  className="h-8 w-8 p-0 text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
