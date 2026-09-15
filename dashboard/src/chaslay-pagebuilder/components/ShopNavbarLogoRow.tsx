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

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
      {logoImageUrl ? (
        <BuilderImage
          src={logoImageUrl}
          alt={logoText || merchantDisplayName || 'Shop'}
          style={{ width: `${logoWidth}px`, height: `${logoHeight}px`, objectFit: 'contain', flexShrink: 0 }}
        />
      ) : (
        <span style={{ fontSize: '24px', fontWeight: 700, color: textColor, ...logoTextStyle }}>
          {logoText}
        </span>
      )}
      {showStoreName ? (
        <span
          style={{
            fontSize: '15px',
            fontWeight: 700,
            color: textColor,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 'min(40vw, 12rem)',
          }}
        >
          {merchantDisplayName}
        </span>
      ) : null}
    </div>
  );
}
