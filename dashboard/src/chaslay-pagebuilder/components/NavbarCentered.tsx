// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { ImageUpload } from './ImageUpload';
import { TranslatableInput } from './TranslatableInput';
import { MenuItemsEditor } from './MenuItemsEditor';
import { normalizeLink } from '../utils/normalizeLink';
import { useStorefront } from '../StorefrontContext';
import { useNavbarDisplay } from '../utils/use-navbar-display';

interface MenuItem {
  label: string;
  link: string;
}

export interface NavbarCenteredProps {
  logoText?: string;
  logoImageUrl?: string;
  logoWidth?: number;
  logoHeight?: number;
  menuItems?: MenuItem[];
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  useSitePagesNav?: boolean;
}

const defaultProps: NavbarCenteredProps = {
  logoText: 'Restaurant',
  logoImageUrl: '',
  logoWidth: 150,
  logoHeight: 50,
  menuItems: [
    { label: 'Home', link: '/' },
    { label: 'Menu', link: '/menu' },
    { label: 'About', link: '/about' },
    { label: 'Contact', link: '/contact' },
  ],
  backgroundColor: '#ffffff',
  textColor: '#1a1a2e',
  accentColor: '#e94560',
  useSitePagesNav: true,
};

export const NavbarCentered: React.FC<NavbarCenteredProps> & {
  craft: {
    props: NavbarCenteredProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();
  const { shopHref } = useStorefront();
  const { menuItems, t } = useNavbarDisplay(
    mergedProps as Record<string, unknown>,
    mergedProps.menuItems,
    mergedProps.useSitePagesNav
  );
  const logoText = t('logoText') || mergedProps.logoText;

  const midPoint = Math.ceil((menuItems?.length || 0) / 2);
  const leftMenu = menuItems?.slice(0, midPoint) || [];
  const rightMenu = menuItems?.slice(midPoint) || [];

  return (
    <>
      <nav
        ref={(ref) => { if (ref) connect(drag(ref)); }}
        className="hb-navbar-centered"
        style={{
          backgroundColor: mergedProps.backgroundColor,
          padding: '20px 40px',
          width: '100%',
          borderBottom: `1px solid ${mergedProps.textColor}15`,
        }}
      >
        <div className="navbar-centered-inner" style={{ maxWidth: '1350px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '60px' }}>
          {/* Left Menu */}
          <div className="navbar-centered-left" style={{ display: 'flex', gap: '32px' }}>
            {leftMenu.map((item, i) => (
              <a key={i} href={shopHref(item.link)} style={{ color: mergedProps.textColor, textDecoration: 'none', fontSize: '14px', fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase' }}>
                {item.label}
              </a>
            ))}
          </div>

          {/* Center Logo */}
          <div style={{ textAlign: 'center' }}>
            {mergedProps.logoImageUrl ? (
              <img src={mergedProps.logoImageUrl} alt={logoText} style={{ width: `${mergedProps.logoWidth}px`, height: `${mergedProps.logoHeight}px`, objectFit: 'contain' }} />
            ) : (
              <div>
                <span style={{ fontSize: '28px', fontWeight: 700, color: mergedProps.textColor, letterSpacing: '2px' }}>{logoText}</span>
                <div style={{ width: '40px', height: '2px', backgroundColor: mergedProps.accentColor, margin: '8px auto 0' }} />
              </div>
            )}
          </div>

          {/* Right Menu */}
          <div className="navbar-centered-right" style={{ display: 'flex', gap: '32px' }}>
            {rightMenu.map((item, i) => (
              <a key={i} href={shopHref(item.link)} style={{ color: mergedProps.textColor, textDecoration: 'none', fontSize: '14px', fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase' }}>
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </nav>
      <style>{`
        @container (max-width: 768px) {
          .navbar-centered-inner { flex-direction: column; gap: 16px !important; }
          .navbar-centered-left, .navbar-centered-right { display: none !important; }
        }
      `}</style>
    </>
  );
};

const NavbarCenteredSettings: React.FC = () => {
  const { actions: { setProp }, ...props } = useNode((node) => ({
    logoText: node.data.props.logoText,
    logoImageUrl: node.data.props.logoImageUrl,
    logoWidth: node.data.props.logoWidth ?? defaultProps.logoWidth,
    logoHeight: node.data.props.logoHeight ?? defaultProps.logoHeight,
    menuItems: node.data.props.menuItems || defaultProps.menuItems,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    accentColor: node.data.props.accentColor,
    useSitePagesNav: node.data.props.useSitePagesNav ?? defaultProps.useSitePagesNav,
    nodeProps: node.data.props,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput
        label="Logo Text"
        propKey="logoText"
        value={props.logoText || ''}
        onChange={(v) => setProp((p: NavbarCenteredProps) => (p.logoText = v))}
        nodeProps={props.nodeProps}
        setProp={setProp}
      />

      <ImageUpload label="Logo Image" value={props.logoImageUrl} onChange={(v) => setProp((p: NavbarCenteredProps) => (p.logoImageUrl = v))} aspectRatio="auto" maxSizeKB={200} />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Logo Width (px)</Label>
          <Input type="number" value={props.logoWidth} onChange={(e) => setProp((p: NavbarCenteredProps) => (p.logoWidth = parseInt(e.target.value) || 150))} />
        </div>
        <div className="space-y-2">
          <Label>Logo Height (px)</Label>
          <Input type="number" value={props.logoHeight} onChange={(e) => setProp((p: NavbarCenteredProps) => (p.logoHeight = parseInt(e.target.value) || 50))} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Background Color</Label>
        <Input type="color" value={props.backgroundColor} onChange={(e) => setProp((p: NavbarCenteredProps) => (p.backgroundColor = e.target.value))} className="h-10 w-full" />
      </div>

      <div className="space-y-2">
        <Label>Text Color</Label>
        <Input type="color" value={props.textColor} onChange={(e) => setProp((p: NavbarCenteredProps) => (p.textColor = e.target.value))} className="h-10 w-full" />
      </div>

      <div className="space-y-2">
        <Label>Accent Color</Label>
        <Input type="color" value={props.accentColor} onChange={(e) => setProp((p: NavbarCenteredProps) => (p.accentColor = e.target.value))} className="h-10 w-full" />
      </div>

      <MenuItemsEditor
        menuItems={props.menuItems}
        setProp={setProp}
        nodeProps={props.nodeProps}
        useSitePagesNav={props.useSitePagesNav}
        showSitePagesNavToggle
      />
    </div>
  );
};

NavbarCentered.craft = {
  props: defaultProps,
  related: { settings: NavbarCenteredSettings },
  displayName: 'Navbar Centered',
};
