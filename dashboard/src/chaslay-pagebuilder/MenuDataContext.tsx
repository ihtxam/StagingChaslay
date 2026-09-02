// @ts-nocheck
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { fetchCmsMenuCatalog } from '@/components/shop/cms/CmsDynamicBlocks';
import { getCmsCatalog } from '@/lib/chaslay-pagebuilder/api';
import type { ChaslayMenuCategory, ChaslayMenuProduct } from './menu-types';
import { useStorefront } from './StorefrontContext';

interface MenuDataContextType {
  categories: ChaslayMenuCategory[];
  products: ChaslayMenuProduct[];
  loading: boolean;
  error: string | null;
}

const MenuDataContext = createContext<MenuDataContextType>({
  categories: [],
  products: [],
  loading: true,
  error: null,
});

export const useMenuData = () => useContext(MenuDataContext);

interface MenuDataProviderProps {
  children: ReactNode;
}

function mapShopCatalog(data: {
  categories?: Array<{
    id: string;
    name: string;
    items?: Array<{
      id: string;
      name: string;
      price: number;
      description?: string;
      image?: string;
      categoryId?: string | null;
      productType?: string;
      allowExtras?: boolean;
      extras?: Array<{ id: string; name: string; price: number }>;
      modifierGroups?: Array<{ options?: unknown[] }>;
      comboSlots?: unknown[];
      specifications?: Array<{ id: string; name: string; price: number }>;
    }>;
  }>;
}) {
  const categories: ChaslayMenuCategory[] = (data.categories || []).map((c) => ({
    id: String(c.id),
    name: c.name,
  }));
  const products: ChaslayMenuProduct[] = [];
  for (const cat of data.categories || []) {
    for (const item of cat.items || []) {
      products.push({
        id: String(item.id),
        product_name: item.name,
        product_description: item.description ?? null,
        product_image: item.image ?? null,
        price: Number(item.price) || 0,
        image: item.image ?? null,
        category_id: item.categoryId ? String(item.categoryId) : String(cat.id),
        productType: item.productType,
        allowExtras: item.allowExtras,
        extras: item.extras,
        modifierGroups: item.modifierGroups,
        comboSlots: item.comboSlots,
        specifications: item.specifications,
      });
    }
  }
  return { categories, products };
}

export const MenuDataProvider: React.FC<MenuDataProviderProps> = ({ children }) => {
  const { shopKey, isStorefront } = useStorefront();
  const [categories, setCategories] = useState<ChaslayMenuCategory[]>([]);
  const [products, setProducts] = useState<ChaslayMenuProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        if (isStorefront && shopKey) {
          const catalog = await fetchCmsMenuCatalog(shopKey);
          const mapped = mapShopCatalog({ categories: catalog?.categories || [] });
          setCategories(mapped.categories);
          setProducts(mapped.products);
          return;
        }

        const catalogRes = await getCmsCatalog();
        if (catalogRes.success && catalogRes.data) {
          setCategories(
            catalogRes.data.categories.map((c) => ({
              id: String(c.id),
              name: c.name,
            }))
          );
          setProducts(
            catalogRes.data.products.map((p) => ({
              id: String(p.id),
              product_name: p.name,
              product_description: null,
              product_image: p.imageUrl ?? null,
              price: p.price,
              image: p.imageUrl ?? null,
              category_id: p.categoryId ? String(p.categoryId) : null,
            }))
          );
        } else if (!catalogRes.success) {
          setError(catalogRes.message || 'Failed to fetch menu data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch menu data');
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [isStorefront, shopKey]);

  return (
    <MenuDataContext.Provider value={{ categories, products, loading, error }}>
      {children}
    </MenuDataContext.Provider>
  );
};
