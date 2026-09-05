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
import { NavbarDesktopLinks, NavbarMobileMenu, DEFAULT_SMOOTH_SCROLL_MENU } from './NavbarMenuLinks';

interface MenuItem {
  label: string;
  link: string;
}

export interface NavbarMinimalProps {
  logoText?: string;
  logoImageUrl?: string;
  logoWidth?: number;
  logoHeight?: number;
  menuItems?: MenuItem[];
  backgroundColor?: string;
  textColor?: string;
  useSitePagesNav?: boolean;
}

const defaultProps: NavbarMinimalProps = {
  logoText: 'RESTAURANT',
  logoImageUrl: '',
  logoWidth: 100,
  logoHeight: 32,
  menuItems: DEFAULT_SMOOTH_SCROLL_MENU,
  backgroundColor: '#faf9f6',
  textColor: '#1a1a2e',
  useSitePagesNav: false,
};

export const NavbarMinimal: React.FC<NavbarMinimalProps> & {
  craft: {
    props: NavbarMinimalProps;
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

  return (
    <>
      <nav
        ref={(ref) => { if (ref) connect(drag(ref)); }}
        className="hb-navbar-minimal"
        style={{
          backgroundColor: mergedProps.backgroundColor,
          padding: '24px 40px',
          width: '100%',
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: '1350px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div>
            {mergedProps.logoImageUrl ? (
              <img src={mergedProps.logoImageUrl} alt={logoText} style={{ width: `${mergedProps.logoWidth}px`, height: `${mergedProps.logoHeight}px`, objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: '18px', fontWeight: 400, color: mergedProps.textColor, letterSpacing: '4px' }}>{logoText}</span>
            )}
          </div>

          <div className="navbar-minimal-menu navbar-minimal-desktop" style={{ display: 'flex', gap: '40px' }}>
            <NavbarDesktopLinks
              menuItems={menuItems}
              textColor={mergedProps.textColor || '#1a1a2e'}
              className=""
            />
          </div>

          <NavbarMobileMenu
            menuItems={menuItems}
            textColor={mergedProps.textColor || '#1a1a2e'}
            backgroundColor={mergedProps.backgroundColor || '#faf9f6'}
          />
        </div>
      </nav>
    </>
  );
};

const NavbarMinimalSettings: React.FC = () => {
  const { actions: { setProp }, ...props } = useNode((node) => ({
    logoText: node.data.props.logoText,
    logoImageUrl: node.data.props.logoImageUrl,
    logoWidth: node.data.props.logoWidth ?? defaultProps.logoWidth,
    logoHeight: node.data.props.logoHeight ?? defaultProps.logoHeight,
    menuItems: node.data.props.menuItems || defaultProps.menuItems,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    useSitePagesNav: node.data.props.useSitePagesNav ?? defaultProps.useSitePagesNav,
    nodeProps: node.data.props,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput
        label="Logo Text"
        propKey="logoText"
        value={props.logoText || ''}
        onChange={(v) => setProp((p: NavbarMinimalProps) => (p.logoText = v))}
        nodeProps={props.nodeProps}
        setProp={setProp}
      />

      <ImageUpload label="Logo Image" value={props.logoImageUrl} onChange={(v) => setProp((p: NavbarMinimalProps) => (p.logoImageUrl = v))} aspectRatio="auto" maxSizeKB={200} />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Logo Width (px)</Label>
          <Input type="number" value={props.logoWidth} onChange={(e) => setProp((p: NavbarMinimalProps) => (p.logoWidth = parseInt(e.target.value) || 100))} />
        </div>
        <div className="space-y-2">
          <Label>Logo Height (px)</Label>
          <Input type="number" value={props.logoHeight} onChange={(e) => setProp((p: NavbarMinimalProps) => (p.logoHeight = parseInt(e.target.value) || 32))} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Background Color</Label>
        <Input type="color" value={props.backgroundColor} onChange={(e) => setProp((p: NavbarMinimalProps) => (p.backgroundColor = e.target.value))} className="h-10 w-full" />
      </div>

      <div className="space-y-2">
        <Label>Text Color</Label>
        <Input type="color" value={props.textColor} onChange={(e) => setProp((p: NavbarMinimalProps) => (p.textColor = e.target.value))} className="h-10 w-full" />
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

NavbarMinimal.craft = {
  props: defaultProps,
  related: { settings: NavbarMinimalSettings },
  displayName: 'Navbar Minimal',
};
