// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { useMenuData } from '../MenuDataContext';

interface FeaturedProductsPickerProps {
  value: string[];
  onChange: (next: string[]) => void;
}

export const FeaturedProductsPicker: React.FC<FeaturedProductsPickerProps> = ({ value, onChange }) => {
  const { products, loading } = useMenuData();
  const [search, setSearch] = useState('');

  const featured = value
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is typeof products[number] => Boolean(p));

  const available = products.filter(
    (p) =>
      !value.includes(p.id) &&
      (!search || p.product_name.toLowerCase().includes(search.toLowerCase())),
  );

  const add = (id: string) => onChange([...value, id]);
  const remove = (id: string) => onChange(value.filter((x) => x !== id));
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Featured Products</Label>
        <p className="text-xs text-muted-foreground">
          Pick products to show in your preferred order. Leave empty to show newest first.
        </p>
      </div>

      {featured.length > 0 && (
        <div className="space-y-1 rounded-md border bg-muted/30 p-2">
          {featured.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center gap-2 bg-background rounded px-2 py-1.5 text-xs"
            >
              <span className="text-muted-foreground w-5 text-right tabular-nums">{i + 1}.</span>
              <span className="flex-1 truncate font-medium">{p.product_name}</span>
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                title="Move up"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === featured.length - 1}
                className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                title="Move down"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="p-1 rounded hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                title="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Input
          placeholder="Search products to add…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs"
        />
        <div className="max-h-48 overflow-y-auto rounded-md border">
          {loading ? (
            <div className="text-xs text-muted-foreground p-3 text-center">Loading products…</div>
          ) : products.length === 0 ? (
            <div className="text-xs text-muted-foreground p-3 text-center">
              No products available. Add products in the Products section.
            </div>
          ) : available.length === 0 ? (
            <div className="text-xs text-muted-foreground p-3 text-center">
              {search ? 'No matching products' : 'All products added'}
            </div>
          ) : (
            available.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => add(p.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted text-left border-b last:border-b-0"
              >
                <Plus className="h-3 w-3 text-muted-foreground" />
                <span className="flex-1 truncate">{p.product_name}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
