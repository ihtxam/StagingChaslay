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

export interface NavbarModernProps {
  logoText?: string;
  logoImageUrl?: string;
  logoWidth?: number;
  logoHeight?: number;
  menuItems?: MenuItem[];
  backgroundColor?: string;
  textColor?: string;
  buttonText?: string;
  buttonLink?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  useSitePagesNav?: boolean;
}

const defaultProps: NavbarModernProps = {
  logoText: 'resto.',
  logoImageUrl: '',
  logoWidth: 120,
  logoHeight: 36,
  menuItems: DEFAULT_SMOOTH_SCROLL_MENU,
  backgroundColor: '#1a1a2e',
  textColor: '#ffffff',
  buttonText: 'Reserve Table',
  buttonLink: '/reserve',
  buttonColor: '#ffffff',
  buttonTextColor: '#1a1a2e',
  useSitePagesNav: false,
};

export const NavbarModern: React.FC<NavbarModernProps> & {
  craft: {
    props: NavbarModernProps;
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
        className="hb-navbar-modern"
        style={{
          backgroundColor: mergedProps.backgroundColor,
          padding: '18px 40px',
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
              <span style={{ fontSize: '26px', fontWeight: 700, color: mergedProps.textColor, fontStyle: 'italic' }}>{logoText}</span>
            )}
          </div>

          <div className="navbar-modern-menu navbar-modern-desktop" style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
            <NavbarDesktopLinks menuItems={menuItems} textColor={mergedProps.textColor || '#ffffff'} />
          </div>

          {buttonText && (
            <a
              className="navbar-modern-button navbar-modern-desktop"
              href={shopHref(mergedProps.buttonLink)}
              onClick={(e) => handleStorefrontNavClick(e, shopHref(mergedProps.buttonLink))}
              style={{ backgroundColor: mergedProps.buttonColor, color: mergedProps.buttonTextColor, padding: '12px 28px', borderRadius: '50px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}
            >
              {buttonText}
            </a>
          )}

          <NavbarMobileMenu
            menuItems={menuItems}
            textColor={mergedProps.textColor || '#ffffff'}
            backgroundColor={mergedProps.backgroundColor || '#1a1a2e'}
            showButton={!!buttonText}
            buttonText={buttonText}
            buttonLink={mergedProps.buttonLink}
            buttonColor={mergedProps.buttonColor}
          />
        </div>
      </nav>
    </>
  );
};

const NavbarModernSettings: React.FC = () => {
  const { actions: { setProp }, ...props } = useNode((node) => ({
    logoText: node.data.props.logoText,
    logoImageUrl: node.data.props.logoImageUrl,
    logoWidth: node.data.props.logoWidth ?? defaultProps.logoWidth,
    logoHeight: node.data.props.logoHeight ?? defaultProps.logoHeight,
    menuItems: node.data.props.menuItems || defaultProps.menuItems,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    buttonText: node.data.props.buttonText,
    buttonLink: node.data.props.buttonLink,
    buttonColor: node.data.props.buttonColor,
    buttonTextColor: node.data.props.buttonTextColor,
    useSitePagesNav: node.data.props.useSitePagesNav ?? defaultProps.useSitePagesNav,
    nodeProps: node.data.props,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput
        label="Logo Text"
        propKey="logoText"
        value={props.logoText || ''}
        onChange={(v) => setProp((p: NavbarModernProps) => (p.logoText = v))}
        nodeProps={props.nodeProps}
        setProp={setProp}
      />

      <ImageUpload label="Logo Image" value={props.logoImageUrl} onChange={(v) => setProp((p: NavbarModernProps) => (p.logoImageUrl = v))} aspectRatio="auto" maxSizeKB={200} />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Logo Width (px)</Label>
          <Input type="number" value={props.logoWidth} onChange={(e) => setProp((p: NavbarModernProps) => (p.logoWidth = parseInt(e.target.value) || 120))} />
        </div>
        <div className="space-y-2">
          <Label>Logo Height (px)</Label>
          <Input type="number" value={props.logoHeight} onChange={(e) => setProp((p: NavbarModernProps) => (p.logoHeight = parseInt(e.target.value) || 36))} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Background Color</Label>
        <Input type="color" value={props.backgroundColor} onChange={(e) => setProp((p: NavbarModernProps) => (p.backgroundColor = e.target.value))} className="h-10 w-full" />
      </div>

      <div className="space-y-2">
        <Label>Text Color</Label>
        <Input type="color" value={props.textColor} onChange={(e) => setProp((p: NavbarModernProps) => (p.textColor = e.target.value))} className="h-10 w-full" />
      </div>

      <MenuItemsEditor
        menuItems={props.menuItems}
        setProp={setProp}
        nodeProps={props.nodeProps}
        useSitePagesNav={props.useSitePagesNav}
        showSitePagesNavToggle
      />

      <div className="border-t pt-4">
        <Label className="mb-2 block">Button</Label>
        <div className="space-y-2">
          <TranslatableInput
            label="Button Text"
            propKey="buttonText"
            value={props.buttonText || ''}
            onChange={(v) => setProp((p: NavbarModernProps) => (p.buttonText = v))}
            nodeProps={props.nodeProps}
            setProp={setProp}
            placeholder="Button Text"
          />
          <Input value={props.buttonLink} onChange={(e) => {
                    const val = normalizeLink(e.target.value);
                    setProp((p: NavbarModernProps) => (p.buttonLink = val));
                  }} placeholder="/menu, /shop, /about" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Background</Label>
              <Input type="color" value={props.buttonColor} onChange={(e) => setProp((p: NavbarModernProps) => (p.buttonColor = e.target.value))} className="h-10 w-full" />
            </div>
            <div>
              <Label className="text-xs">Text Color</Label>
              <Input type="color" value={props.buttonTextColor} onChange={(e) => setProp((p: NavbarModernProps) => (p.buttonTextColor = e.target.value))} className="h-10 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

NavbarModern.craft = {
  props: defaultProps,
  related: { settings: NavbarModernSettings },
  displayName: 'Navbar Modern',
};
