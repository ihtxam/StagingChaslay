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
import { handleStorefrontNavClick } from '../utils/anchor-scroll';

interface MenuItem {
  label: string;
  link: string;
}

export interface NavbarClassicProps {
  logoText?: string;
  logoImageUrl?: string;
  logoWidth?: number;
  logoHeight?: number;
  menuItems?: MenuItem[];
  backgroundColor?: string;
  textColor?: string;
  showButton?: boolean;
  buttonText?: string;
  buttonLink?: string;
  buttonColor?: string;
  useSitePagesNav?: boolean;
}

const defaultProps: NavbarClassicProps = {
  logoText: 'Restaurant',
  logoImageUrl: '',
  logoWidth: 120,
  logoHeight: 40,
  menuItems: DEFAULT_SMOOTH_SCROLL_MENU,
  backgroundColor: '#ffffff',
  textColor: '#1a1a2e',
  showButton: true,
  buttonText: 'Order Now',
  buttonLink: '/order',
  buttonColor: '#e94560',
  useSitePagesNav: false,
};

export const NavbarClassic: React.FC<NavbarClassicProps> & {
  craft: {
    props: NavbarClassicProps;
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
  const buttonText = t('buttonText') || mergedProps.buttonText;

  return (
    <>
      <nav
        ref={(ref) => { if (ref) connect(drag(ref)); }}
        className="hb-navbar-classic"
        style={{
          backgroundColor: mergedProps.backgroundColor,
          padding: '16px 40px',
          width: '100%',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: '1350px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div>
            {mergedProps.logoImageUrl ? (
              <img src={mergedProps.logoImageUrl} alt={logoText} style={{ width: `${mergedProps.logoWidth}px`, height: `${mergedProps.logoHeight}px`, objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: '24px', fontWeight: 700, color: mergedProps.textColor }}>{logoText}</span>
            )}
          </div>

          {/* Desktop Menu + Button */}
          <div className="navbar-classic-desktop" style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <NavbarDesktopLinks menuItems={menuItems} textColor={mergedProps.textColor || '#1a1a2e'} />
            {mergedProps.showButton && buttonText && (
              <a
                href={shopHref(mergedProps.buttonLink)}
                onClick={(e) => handleStorefrontNavClick(e, shopHref(mergedProps.buttonLink))}
                style={{ backgroundColor: mergedProps.buttonColor, color: '#fff', padding: '10px 24px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}
              >
                {buttonText}
              </a>
            )}
          </div>

          <NavbarMobileMenu
            menuItems={menuItems}
            textColor={mergedProps.textColor || '#1a1a2e'}
            backgroundColor={mergedProps.backgroundColor || '#ffffff'}
            showButton={mergedProps.showButton}
            buttonText={buttonText}
            buttonLink={mergedProps.buttonLink}
            buttonColor={mergedProps.buttonColor}
          />
        </div>
      </nav>
    </>
  );
};

const NavbarClassicSettings: React.FC = () => {
  const { actions: { setProp }, ...props } = useNode((node) => ({
    logoText: node.data.props.logoText,
    logoImageUrl: node.data.props.logoImageUrl,
    logoWidth: node.data.props.logoWidth ?? defaultProps.logoWidth,
    logoHeight: node.data.props.logoHeight ?? defaultProps.logoHeight,
    menuItems: node.data.props.menuItems || defaultProps.menuItems,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    showButton: node.data.props.showButton,
    buttonText: node.data.props.buttonText,
    buttonLink: node.data.props.buttonLink,
    buttonColor: node.data.props.buttonColor,
    useSitePagesNav: node.data.props.useSitePagesNav ?? defaultProps.useSitePagesNav,
    nodeProps: node.data.props,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput
        label="Logo Text"
        propKey="logoText"
        value={props.logoText || ''}
        onChange={(v) => setProp((p: NavbarClassicProps) => (p.logoText = v))}
        nodeProps={props.nodeProps}
        setProp={setProp}
      />

      <ImageUpload label="Logo Image" value={props.logoImageUrl} onChange={(v) => setProp((p: NavbarClassicProps) => (p.logoImageUrl = v))} aspectRatio="auto" maxSizeKB={200} />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Logo Width (px)</Label>
          <Input type="number" value={props.logoWidth} onChange={(e) => setProp((p: NavbarClassicProps) => (p.logoWidth = parseInt(e.target.value) || 120))} />
        </div>
        <div className="space-y-2">
          <Label>Logo Height (px)</Label>
          <Input type="number" value={props.logoHeight} onChange={(e) => setProp((p: NavbarClassicProps) => (p.logoHeight = parseInt(e.target.value) || 40))} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Background Color</Label>
        <Input type="color" value={props.backgroundColor} onChange={(e) => setProp((p: NavbarClassicProps) => (p.backgroundColor = e.target.value))} className="h-10 w-full" />
      </div>

      <div className="space-y-2">
        <Label>Text Color</Label>
        <Input type="color" value={props.textColor} onChange={(e) => setProp((p: NavbarClassicProps) => (p.textColor = e.target.value))} className="h-10 w-full" />
      </div>

      <MenuItemsEditor
        menuItems={props.menuItems}
        setProp={setProp}
        nodeProps={props.nodeProps}
        useSitePagesNav={props.useSitePagesNav}
        showSitePagesNavToggle
      />

      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-2">
          <Label>Show Button</Label>
          <input type="checkbox" checked={props.showButton} onChange={(e) => setProp((p: NavbarClassicProps) => (p.showButton = e.target.checked))} className="h-4 w-4" />
        </div>
        {props.showButton && (
          <div className="space-y-2">
            <TranslatableInput
              label="Button Text"
              propKey="buttonText"
              value={props.buttonText || ''}
              onChange={(v) => setProp((p: NavbarClassicProps) => (p.buttonText = v))}
              nodeProps={props.nodeProps}
              setProp={setProp}
              placeholder="Button Text"
            />
            <Input value={props.buttonLink} onChange={(e) => {
                    const val = normalizeLink(e.target.value);
                    setProp((p: NavbarClassicProps) => (p.buttonLink = val));
                  }} placeholder="/menu, /shop, /about" />
            <Input type="color" value={props.buttonColor} onChange={(e) => setProp((p: NavbarClassicProps) => (p.buttonColor = e.target.value))} className="h-10 w-full" />
          </div>
        )}
      </div>
    </div>
  );
};

NavbarClassic.craft = {
  props: defaultProps,
  related: { settings: NavbarClassicSettings },
  displayName: 'Navbar Classic',
};
