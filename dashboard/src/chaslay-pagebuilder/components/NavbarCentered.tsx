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
import { useStorefront } from '../StorefrontContext';

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

  const midPoint = Math.ceil((mergedProps.menuItems?.length || 0) / 2);
  const leftMenu = mergedProps.menuItems?.slice(0, midPoint) || [];
  const rightMenu = mergedProps.menuItems?.slice(midPoint) || [];

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
              <img src={mergedProps.logoImageUrl} alt={mergedProps.logoText} style={{ width: `${mergedProps.logoWidth}px`, height: `${mergedProps.logoHeight}px`, objectFit: 'contain' }} />
            ) : (
              <div>
                <span style={{ fontSize: '28px', fontWeight: 700, color: mergedProps.textColor, letterSpacing: '2px' }}>{mergedProps.logoText}</span>
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
    nodeProps: node.data.props,
  }));

  const addMenuItem = () => setProp((p: NavbarCenteredProps) => { p.menuItems = [...(p.menuItems || []), { label: 'New', link: '/' }]; });
  const removeMenuItem = (i: number) => setProp((p: NavbarCenteredProps) => { p.menuItems = p.menuItems?.filter((_, idx) => idx !== i); });
  const updateMenuItem = (i: number, field: 'label' | 'link', value: string) => {
    if (field === 'link') {
      value = normalizeLink(value);
    }
    setProp((p: NavbarCenteredProps) => { if (p.menuItems?.[i]) p.menuItems[i][field] = value; });
  };

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
    </div>
  );
};

NavbarCentered.craft = {
  props: defaultProps,
  related: { settings: NavbarCenteredSettings },
  displayName: 'Navbar Centered',
};
