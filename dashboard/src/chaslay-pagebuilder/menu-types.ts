// @ts-nocheck
export type ChaslayMenuCategory = {
  id: string | number;
  name: string;
};

export type ChaslayMenuProduct = {
  id: string;
  product_name: string;
  product_description?: string | null;
  product_image?: string | null;
  price?: number | string;
  image?: string | null;
  category_id?: string | number | null;
  /** Legacy CMS catalog shape */
  details?: Array<{ price?: number | string }>;
  productType?: string;
  allowExtras?: boolean;
  extras?: Array<{ id: string; name: string; price: number }>;
  modifierGroups?: Array<{ options?: unknown[] }>;
  comboSlots?: unknown[];
  specifications?: Array<{ id: string; name: string; price: number }>;
};
