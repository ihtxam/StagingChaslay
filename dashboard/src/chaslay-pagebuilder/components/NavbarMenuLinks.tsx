// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { useStorefront } from '../StorefrontContext';
import { handleStorefrontNavClick } from '../utils/anchor-scroll';
import { isHomeNavLink } from '../storefront-href';
import {
  DEFAULT_SMOOTH_SCROLL_MENU,
  type NavbarMenuItem,
} from '../utils/default-nav-menu';
import ShopNavActions from '@/components/shop/ShopNavActions';
import ShopNavbarDrawerExtras from '@/components/shop/ShopNavbarDrawerExtras';

export type { NavbarMenuItem };
export { DEFAULT_SMOOTH_SCROLL_MENU };

type Props = {
  menuItems: NavbarMenuItem[];
  textColor: string;
  className?: string;
};

export function NavbarDesktopLinks({ menuItems, textColor, className = '' }: Props) {
  const { shopHref, isStorefront, surface } = useStorefront();

  const onNavClick = (e: React.MouseEvent<HTMLAnchorElement>, link: string) => {
    const resolved = shopHref(link);
    if (isStorefront && isHomeNavLink(link) && surface === 'home') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    handleStorefrontNavClick(e, resolved);
  };

  return (
    <div className={className} style={{ display: 'flex', gap: '12px 16px', flexWrap: 'wrap', alignItems: 'center', minWidth: 0 }}>
      {menuItems?.map((item, i) => (
        <a
          key={`${item.label}-${i}`}
          href={shopHref(item.link)}
          onClick={(e) => onNavClick(e, item.link)}
          style={{ color: textColor, textDecoration: 'none', fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap' }}
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}

export function NavbarMobileMenu({
  menuItems,
  drawerExtras = [],
  textColor,
  backgroundColor,
  buttonLink,
  buttonText,
  buttonColor,
  showButton,
}: Props & {
  drawerExtras?: NavbarMenuItem[];
  backgroundColor: string;
  buttonLink?: string;
  buttonText?: string;
  buttonColor?: string;
  showButton?: boolean;
}) {
  const { shopHref, isStorefront, surface, accountPath, loggedIn } = useStorefront();
  const [open, setOpen] = useState(false);

  const onNavClick = (e: React.MouseEvent<HTMLAnchorElement>, link: string) => {
    const resolved = shopHref(link);
    if (isStorefront && isHomeNavLink(link) && surface === 'home') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setOpen(false);
      return;
    }
    if (handleStorefrontNavClick(e, resolved, () => setOpen(false))) return;
    setOpen(false);
  };

  return (
    <>
      <div className="navbar-mobile-controls" style={{ display: 'none', alignItems: 'center', gap: '6px' }}>
        {isStorefront && accountPath ? (
          <ShopNavActions accountPath={accountPath} iconOnlyLogin loggedIn={loggedIn} />
        ) : null}
        <button
          type="button"
          className="navbar-mobile-toggle"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={textColor} strokeWidth="2">
            {open ? (
              <>
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>
      {open ? (
        <div
          className="navbar-mobile-drawer"
          style={{
            display: 'none',
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: '16px 24px 20px',
            zIndex: 60,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {menuItems?.map((item, i) => (
              <a
                key={`m-${item.label}-${i}`}
                href={shopHref(item.link)}
                onClick={(e) => onNavClick(e, item.link)}
                style={{ color: textColor, textDecoration: 'none', fontSize: '16px', fontWeight: 500 }}
              >
                {item.label}
              </a>
            ))}
            {drawerExtras?.map((item, i) => (
              <a
                key={`d-${item.label}-${i}`}
                href={shopHref(item.link)}
                onClick={(e) => onNavClick(e, item.link)}
                style={{ color: textColor, textDecoration: 'none', fontSize: '16px', fontWeight: 500 }}
              >
                {item.label}
              </a>
            ))}
            {showButton && buttonText ? (
              <a
                href={shopHref(buttonLink)}
                onClick={(e) => onNavClick(e, buttonLink || '')}
                style={{
                  display: 'inline-block',
                  marginTop: '8px',
                  backgroundColor: buttonColor,
                  color: '#fff',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                {buttonText}
              </a>
            ) : null}
            {isStorefront && accountPath ? (
              <ShopNavbarDrawerExtras accountPath={accountPath} textColor={textColor} loggedIn={loggedIn} />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
