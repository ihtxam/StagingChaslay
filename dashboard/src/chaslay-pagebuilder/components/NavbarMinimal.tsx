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

export interface NavbarMinimalProps {
  logoText?: string;
  logoImageUrl?: string;
  logoWidth?: number;
  logoHeight?: number;
  menuItems?: MenuItem[];
  backgroundColor?: string;
  textColor?: string;
}

const defaultProps: NavbarMinimalProps = {
  logoText: 'RESTAURANT',
  logoImageUrl: '',
  logoWidth: 100,
  logoHeight: 32,
  menuItems: [
    { label: 'Menu', link: '/menu' },
    { label: 'About', link: '/about' },
    { label: 'Contact', link: '/contact' },
  ],
  backgroundColor: '#faf9f6',
  textColor: '#1a1a2e',
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

  return (
    <>
      <nav
        ref={(ref) => { if (ref) connect(drag(ref)); }}
        className="hb-navbar-minimal"
        style={{
          backgroundColor: mergedProps.backgroundColor,
          padding: '24px 40px',
          width: '100%',
        }}
      >
        <div style={{ maxWidth: '1350px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div>
            {mergedProps.logoImageUrl ? (
              <img src={mergedProps.logoImageUrl} alt={mergedProps.logoText} style={{ width: `${mergedProps.logoWidth}px`, height: `${mergedProps.logoHeight}px`, objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: '18px', fontWeight: 400, color: mergedProps.textColor, letterSpacing: '4px' }}>{mergedProps.logoText}</span>
            )}
          </div>

          {/* Desktop Menu */}
          <div className="navbar-minimal-menu" style={{ display: 'flex', gap: '40px' }}>
            {mergedProps.menuItems?.map((item, i) => (
              <a key={i} href={item.link} style={{ color: mergedProps.textColor, textDecoration: 'none', fontSize: '13px', fontWeight: 400, letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.7 }}>
                {item.label}
              </a>
            ))}
          </div>

          {/* Mobile Menu Button */}
          <div className="navbar-minimal-mobile" style={{ display: 'none', padding: '8px' }}>
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
          .navbar-minimal-menu { display: none !important; }
          .navbar-minimal-mobile { display: block !important; }
        }
      `}</style>
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
    nodeProps: node.data.props,
  }));

  const addMenuItem = () => setProp((p: NavbarMinimalProps) => { p.menuItems = [...(p.menuItems || []), { label: 'New', link: '/' }]; });
  const removeMenuItem = (i: number) => setProp((p: NavbarMinimalProps) => { p.menuItems = p.menuItems?.filter((_, idx) => idx !== i); });
  const updateMenuItem = (i: number, field: 'label' | 'link', value: string) => {
    if (field === 'link') {
      value = normalizeLink(value);
    }
    setProp((p: NavbarMinimalProps) => { if (p.menuItems?.[i]) p.menuItems[i][field] = value; });
  };

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

NavbarMinimal.craft = {
  props: defaultProps,
  related: { settings: NavbarMinimalSettings },
  displayName: 'Navbar Minimal',
};
