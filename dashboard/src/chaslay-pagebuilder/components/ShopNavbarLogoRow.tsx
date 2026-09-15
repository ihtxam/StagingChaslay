// @ts-nocheck
'use client';

import React from 'react';
import { BuilderImage } from './BuilderImage';
import { useStorefront } from '../StorefrontContext';

export function ShopNavbarLogoRow({
  logoImageUrl,
  logoText,
  logoWidth = 120,
  logoHeight = 40,
  textColor = '#1a1a2e',
  logoTextStyle = {},
}: {
  logoImageUrl?: string;
  logoText?: string;
  logoWidth?: number;
  logoHeight?: number;
  textColor?: string;
  logoTextStyle?: React.CSSProperties;
}) {
  const { surface, merchantDisplayName } = useStorefront();
  const showStoreName = !!merchantDisplayName && (surface === 'shop' || surface === 'home');
  const storeLabel = showStoreName ? merchantDisplayName : logoText;

  return (
    <div className="shop-navbar-logo-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
      {logoImageUrl ? (
        <BuilderImage
          src={logoImageUrl}
          alt={logoText || merchantDisplayName || 'Shop'}
          className="shop-navbar-logo-image"
          style={{ width: `${logoWidth}px`, height: `${logoHeight}px`, objectFit: 'contain', flexShrink: 0 }}
        />
      ) : (
        <span
          className="shop-navbar-logo-text"
          style={{ fontSize: '24px', fontWeight: 700, color: textColor, ...logoTextStyle }}
        >
          {storeLabel}
        </span>
      )}
      {logoImageUrl && showStoreName ? (
        <span
          className="shop-navbar-store-name"
          style={{
            fontSize: '15px',
            fontWeight: 700,
            color: textColor,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {merchantDisplayName}
        </span>
      ) : null}
    </div>
  );
}
