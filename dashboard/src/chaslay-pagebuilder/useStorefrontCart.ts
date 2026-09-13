// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import {
  emptyDraft,
  loadCart,
  newCartLineId,
  saveCart,
  shopBasePath,
  SHOP_CART_EVENT,
} from '@/lib/shop-cart';
import {
  defaultConfiguredAdd,
  productHasModifiers,
  productRequiresModifierModal,
} from '@/components/shop/shop-modifier-utils';
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
    const onChange = (event: Event) => {
      const key = (event as CustomEvent)?.detail?.shopKey;
      if (!key || key === shopKey) refreshCount();
    };
    window.addEventListener(SHOP_CART_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(SHOP_CART_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [refreshCount, shopKey]);

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

      const menuPath = `${basePath || shopBasePath(shopKey)}/menu`;
      if (productHasComboSlots(catalogShape) || productRequiresModifierModal(catalogShape)) {
        window.location.assign(`${menuPath}?add=${encodeURIComponent(product.id)}`);
        return false;
      }

      const configured = productHasModifiers(catalogShape)
        ? defaultConfiguredAdd(catalogShape)
        : { selectedExtras: [], unitPrice: menuProductPrice(product) };
      const unitPrice = configured.unitPrice;
      const draft = loadCart(shopKey) || emptyDraft();
      const extrasKey = (configured.selectedExtras || []).map((e) => e.id).sort().join(',');
      const existing = draft.items.find((line) => {
        if (line.id !== product.id || line.loyaltyReward || line.offerId) return false;
        if (line.comboSelections?.length) return false;
        const lineExtras = (line.selectedExtras || []).map((e) => e.id).sort().join(',');
        return lineExtras === extrasKey;
      });
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
              basePrice: menuProductPrice(product),
              quantity: 1,
              description: product.product_description || undefined,
              image: product.product_image || product.image || undefined,
              selectedExtras: configured.selectedExtras?.length ? configured.selectedExtras : undefined,
            },
          ];

      saveCart(shopKey, { ...draft, items });
      refreshCount();
      setCartBump(true);
      window.setTimeout(() => setCartBump(false), 350);
      return true;
    },
    [isStorefront, shopKey, basePath, refreshCount]
  );

  return {
    addProduct,
    itemCount,
    cartBump,
    checkoutPath: shopKey ? `${basePath || shopBasePath(shopKey)}/checkout` : '#',
    menuPath: shopKey ? `${basePath || shopBasePath(shopKey)}/menu` : '#',
  };
}
