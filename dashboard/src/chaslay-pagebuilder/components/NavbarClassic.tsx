// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { ImageUpload } from './ImageUpload';
import { TranslatableInput, TranslatableArrayInput } from './TranslatableInput';
import { normalizeLink } from '../utils/normalizeLink';

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
}

const defaultProps: NavbarClassicProps = {
  logoText: 'Restaurant',
  logoImageUrl: '',
  logoWidth: 120,
  logoHeight: 40,
  menuItems: [
    { label: 'Home', link: '/' },
    { label: 'Menu', link: '/menu' },
    { label: 'About', link: '/about' },
    { label: 'Contact', link: '/contact' },
  ],
  backgroundColor: '#ffffff',
  textColor: '#1a1a2e',
  showButton: true,
  buttonText: 'Order Now',
  buttonLink: '/order',
  buttonColor: '#e94560',
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
        }}
      >
        <div style={{ maxWidth: '1350px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div>
            {mergedProps.logoImageUrl ? (
              <img src={mergedProps.logoImageUrl} alt={mergedProps.logoText} style={{ width: `${mergedProps.logoWidth}px`, height: `${mergedProps.logoHeight}px`, objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: '24px', fontWeight: 700, color: mergedProps.textColor }}>{mergedProps.logoText}</span>
            )}
          </div>

          {/* Desktop Menu + Button */}
          <div className="navbar-classic-desktop" style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <div style={{ display: 'flex', gap: '24px' }}>
              {mergedProps.menuItems?.map((item, i) => (
                <a key={i} href={item.link} style={{ color: mergedProps.textColor, textDecoration: 'none', fontSize: '15px', fontWeight: 500 }}>
                  {item.label}
                </a>
              ))}
            </div>
            {mergedProps.showButton && (
              <a href={mergedProps.buttonLink} style={{ backgroundColor: mergedProps.buttonColor, color: '#fff', padding: '10px 24px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>
                {mergedProps.buttonText}
              </a>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="navbar-classic-mobile" style={{ display: 'none', padding: '8px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={mergedProps.textColor} strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </div>
        </div>
      </nav>
      <style>{`
        @container (max-width: 768px) {
          .navbar-classic-desktop { display: none !important; }
          .navbar-classic-mobile { display: block !important; }
        }
      `}</style>
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
    nodeProps: node.data.props,
  }));

  const addMenuItem = () => setProp((p: NavbarClassicProps) => { p.menuItems = [...(p.menuItems || []), { label: 'New', link: '/' }]; });
  const removeMenuItem = (i: number) => setProp((p: NavbarClassicProps) => { p.menuItems = p.menuItems?.filter((_, idx) => idx !== i); });
  const updateMenuItem = (i: number, field: 'label' | 'link', value: string) => {
    if (field === 'link') {
      value = normalizeLink(value);
    }
    setProp((p: NavbarClassicProps) => { if (p.menuItems?.[i]) p.menuItems[i][field] = value; });
  };

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

      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-2">
          <Label>Menu Items</Label>
          <Button variant="outline" size="sm" onClick={addMenuItem}><Plus className="w-4 h-4" /></Button>
        </div>
        <div className="space-y-2">
          {props.menuItems?.map((item: MenuItem, i: number) => (
            <div key={i} className="border rounded-md p-2 space-y-2 bg-muted/30">
              <TranslatableArrayInput
                propKey="label"
                arrayPropKey="menuItems"
                index={i}
                nodeProps={props.nodeProps}
                setProp={setProp}
                value={item.label}
                onChange={(v) => updateMenuItem(i, 'label', v)}
                placeholder="Label"
              />
              <div className="flex gap-2 items-center">
                <Input value={item.link} onChange={(e) => updateMenuItem(i, 'link', e.target.value)} className="h-8 flex-1" placeholder="Link" />
                <Button variant="ghost" size="sm" onClick={() => removeMenuItem(i)} className="h-8 w-8 p-0 text-destructive"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>

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
