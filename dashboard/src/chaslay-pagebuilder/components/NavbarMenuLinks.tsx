// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { useStorefront } from '../StorefrontContext';
import { handleStorefrontNavClick } from '../utils/anchor-scroll';
import {
  DEFAULT_SMOOTH_SCROLL_MENU,
  type NavbarMenuItem,
} from '../utils/default-nav-menu';

export type { NavbarMenuItem };
export { DEFAULT_SMOOTH_SCROLL_MENU };

type Props = {
  menuItems: NavbarMenuItem[];
  textColor: string;
  className?: string;
};

export function NavbarDesktopLinks({ menuItems, textColor, className = '' }: Props) {
  const { shopHref, basePath, isStorefront } = useStorefront();

  const onNavClick = (e: React.MouseEvent<HTMLAnchorElement>, link: string) => {
    const resolved = shopHref(link);
    if (isStorefront && (link === '/' || link === '' || resolved === basePath)) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      try {
        history.replaceState(null, '', basePath || '/');
      } catch {
        /* ignore */
      }
      return;
    }
    handleStorefrontNavClick(e, resolved);
  };

  return (
    <div className={className} style={{ display: 'flex', gap: '24px' }}>
      {menuItems?.map((item, i) => (
        <a
          key={`${item.label}-${i}`}
          href={shopHref(item.link)}
          onClick={(e) => onNavClick(e, item.link)}
          style={{ color: textColor, textDecoration: 'none', fontSize: '15px', fontWeight: 500 }}
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}

export function NavbarMobileMenu({
  menuItems,
  textColor,
  backgroundColor,
  buttonLink,
  buttonText,
  buttonColor,
  showButton,
}: Props & {
  backgroundColor: string;
  buttonLink?: string;
  buttonText?: string;
  buttonColor?: string;
  showButton?: boolean;
}) {
  const { shopHref, basePath, isStorefront } = useStorefront();
  const [open, setOpen] = useState(false);

  const onNavClick = (e: React.MouseEvent<HTMLAnchorElement>, link: string) => {
    const resolved = shopHref(link);
    if (isStorefront && (link === '/' || link === '' || resolved === basePath)) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      try {
        history.replaceState(null, '', basePath || '/');
      } catch {
        /* ignore */
      }
      setOpen(false);
      return;
    }
    if (handleStorefrontNavClick(e, resolved, () => setOpen(false))) return;
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="navbar-mobile-toggle"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'none', padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer' }}
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
            {showButton && buttonText ? (
              <a
                href={shopHref(buttonLink)}
                onClick={(e) => onNavClick(e, buttonLink || '')}
                style={{
                  display: 'inline-block',
                  marginTop: '8px',
                  backgroundColor: buttonColor,
                  color: '#fff',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                {buttonText}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
