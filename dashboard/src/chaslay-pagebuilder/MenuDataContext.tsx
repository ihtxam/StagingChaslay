// @ts-nocheck
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getProducts, getCategories } from '@/lib/chaslay-pagebuilder/api';
import type { ChaslayMenuCategory, ChaslayMenuProduct } from './menu-types';

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

export const MenuDataProvider: React.FC<MenuDataProviderProps> = ({ children }) => {
  const [categories, setCategories] = useState<ChaslayMenuCategory[]>([]);
  const [products, setProducts] = useState<ChaslayMenuProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [categoriesRes, productsRes] = await Promise.all([
          getCategories(),
          getProducts({ per_page: 1000, status: 1 }),
        ]);

        if (categoriesRes.success && categoriesRes.data) {
          setCategories(
            categoriesRes.data.map((c) => ({
              id: String(c.id),
              name: c.name,
            }))
          );
        }

        if (productsRes.success && productsRes.data) {
          setProducts(
            (productsRes.data.products || []).map((p) => ({
              id: String(p.id),
              product_name: p.name,
              product_description: null,
              product_image: p.imageUrl ?? null,
              price: p.price,
              image: p.imageUrl ?? null,
              category_id: p.categoryId ? String(p.categoryId) : null,
            }))
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch menu data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <MenuDataContext.Provider value={{ categories, products, loading, error }}>
      {children}
    </MenuDataContext.Provider>
  );
};
