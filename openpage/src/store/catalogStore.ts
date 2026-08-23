import { create } from 'zustand'

export type CatalogCategory = { id: string; name: string }
export type CatalogProduct = {
  id: string
  name: string
  categoryId?: string | null
  price?: string
  image?: string | null
}

interface CatalogState {
  categories: CatalogCategory[]
  products: CatalogProduct[]
  loaded: boolean
  setCatalog: (categories: CatalogCategory[], products: CatalogProduct[]) => void
}

export const useCatalogStore = create<CatalogState>((set) => ({
  categories: [],
  products: [],
  loaded: false,
  setCatalog: (categories, products) => set({ categories, products, loaded: true }),
}))
