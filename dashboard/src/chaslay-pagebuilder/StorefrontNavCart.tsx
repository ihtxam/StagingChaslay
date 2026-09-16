// @ts-nocheck
'use client';

import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { useStorefront } from './StorefrontContext';
import { useStorefrontCart } from './useStorefrontCart';

export function StorefrontNavCart({ color }) {
  const { isStorefront } = useStorefront();
  const { itemCount, cartBump, menuPath } = useStorefrontCart();
  if (!isStorefront) return null;

  return (
    <a
      href={menuPath}
      aria-label="Cart"
      title="Cart"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        color,
        textDecoration: 'none',
      }}
    >
      <ShoppingBag size={20} strokeWidth={1.8} />
      {itemCount > 0 ? (
        <span
          className={cartBump ? 'shop-cart-bump' : ''}
          style={{
            position: 'absolute',
            top: -4,
            right: -2,
            minWidth: 18,
            height: 18,
            borderRadius: 999,
            background: '#e11d48',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
          }}
        >
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      ) : null}
    </a>
  );
}
