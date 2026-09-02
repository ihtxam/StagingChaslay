// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import {
  emptyDraft,
  loadCart,
  newCartLineId,
  saveCart,
  shopBasePath,
} from '@/lib/shop-cart';
import { productHasModifiers } from '@/components/shop/shop-modifier-utils';
import { productHasComboSlots } from '@/components/shop/ShopComboWizard';
import type { ChaslayMenuProduct } from './menu-types';
import { menuProductPrice } from './menu-product-utils';
import { useStorefront } from './StorefrontContext';

export function useStorefrontCart() {
  const { shopKey, isStorefront, basePath } = useStorefront();
  const [itemCount, setItemCount] = useState(0);
  const [cartBump, setCartBump] = useState(false);

  const refreshCount = useCallback(() => {
    if (!shopKey) {
      setItemCount(0);
      return;
    }
    const draft = loadCart(shopKey);
    const count = (draft?.items || []).reduce((sum, line) => sum + line.quantity, 0);
    setItemCount(count);
  }, [shopKey]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  const addProduct = useCallback(
    (product: ChaslayMenuProduct) => {
      if (!isStorefront || !shopKey) return false;

      const catalogShape = {
        id: product.id,
        name: product.product_name,
        price: menuProductPrice(product),
        description: product.product_description,
        image: product.product_image || product.image,
        categoryId: product.category_id,
        productType: product.productType,
        allowExtras: product.allowExtras,
        extras: product.extras,
        modifierGroups: product.modifierGroups,
        comboSlots: product.comboSlots,
        specifications: product.specifications,
      };

      if (productHasComboSlots(catalogShape) || productHasModifiers(catalogShape)) {
        const menuPath = `${shopBasePath(shopKey)}/menu`;
        window.location.assign(menuPath);
        return false;
      }

      const unitPrice = menuProductPrice(product);
      const draft = loadCart(shopKey) || emptyDraft();
      const existing = draft.items.find(
        (line) =>
          line.id === product.id &&
          !line.loyaltyReward &&
          !line.offerId &&
          !(line.selectedExtras?.length || line.comboSelections?.length)
      );
      const items = existing
        ? draft.items.map((line) =>
            line.lineId === existing.lineId ? { ...line, quantity: line.quantity + 1 } : line
          )
        : [
            ...draft.items,
            {
              lineId: newCartLineId(),
              id: product.id,
              name: product.product_name,
              categoryId: product.category_id != null ? String(product.category_id) : null,
              price: unitPrice,
              basePrice: unitPrice,
              quantity: 1,
              description: product.product_description || undefined,
              image: product.product_image || product.image || undefined,
            },
          ];

      saveCart(shopKey, { ...draft, items });
      refreshCount();
      setCartBump(true);
      window.setTimeout(() => setCartBump(false), 350);
      return true;
    },
    [isStorefront, shopKey, refreshCount]
  );

  return {
    addProduct,
    itemCount,
    cartBump,
    checkoutPath: shopKey ? `${basePath || shopBasePath(shopKey)}/checkout` : '#',
    menuPath: shopKey ? `${basePath || shopBasePath(shopKey)}/menu` : '#',
  };
}
