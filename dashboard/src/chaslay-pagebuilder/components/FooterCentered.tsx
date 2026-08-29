// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { ImageUpload } from './ImageUpload';
import { normalizeLink } from '../utils/normalizeLink';
import { TranslatableInput } from './TranslatableInput';

interface MenuItem {
  label: string;
  link: string;
}

export interface FooterCenteredProps {
  logoText?: string;
  logoImageUrl?: string;
  menuItems?: MenuItem[];
  copyrightText?: string;
  backgroundColor?: string;
  textColor?: string;
}

const defaultProps: FooterCenteredProps = {
  logoText: 'Restaurant',
  logoImageUrl: '',
  menuItems: [
    { label: 'Home', link: '/' },
    { label: 'Menu', link: '/menu' },
    { label: 'About', link: '/about' },
    { label: 'Contact', link: '/contact' },
  ],
  copyrightText: '© 2024 Restaurant Name. All rights reserved.',
  backgroundColor: '#f5f5f4',
  textColor: '#1c1917',
};

export const FooterCentered: React.FC<FooterCenteredProps> & {
  craft: {
    props: FooterCenteredProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();

  return (
    <footer
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      className="hb-footer hb-section-padding"
      style={{
        backgroundColor: mergedProps.backgroundColor,
        color: mergedProps.textColor,
        padding: '48px 40px 32px',
        width: '100%',
        textAlign: 'center',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Logo */}
        {mergedProps.logoImageUrl ? (
          <img src={mergedProps.logoImageUrl} alt={mergedProps.logoText} style={{ height: '40px', objectFit: 'contain', margin: '0 auto 20px' }} />
        ) : (
          <div style={{ fontSize: '24px', fontWeight: 700, marginBottom: '20px' }}>{mergedProps.logoText}</div>
        )}

        {/* Menu Links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {mergedProps.menuItems?.map((item, i) => (
            <a key={i} href={item.link} style={{ color: mergedProps.textColor, textDecoration: 'none', fontSize: '14px', opacity: 0.8 }}>
              {item.label}
            </a>
          ))}
        </div>

        {/* Copyright */}
        <p style={{ fontSize: '13px', opacity: 0.6 }}>{mergedProps.copyrightText}</p>
      </div>
    </footer>
  );
};

const FooterCenteredSettings: React.FC = () => {
  const { actions: { setProp }, ...props } = useNode((node) => ({
    nodeProps: node.data.props,
    logoText: node.data.props.logoText,
    logoImageUrl: node.data.props.logoImageUrl,
    menuItems: node.data.props.menuItems || defaultProps.menuItems,
    copyrightText: node.data.props.copyrightText,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
  }));

  const addMenuItem = () => setProp((p: FooterCenteredProps) => { p.menuItems = [...(p.menuItems || []), { label: 'New', link: '/' }]; });
  const removeMenuItem = (i: number) => setProp((p: FooterCenteredProps) => { p.menuItems = p.menuItems?.filter((_, idx) => idx !== i); });
  const updateMenuItem = (i: number, field: 'label' | 'link', value: string) => {
    if (field === 'link') {
      value = normalizeLink(value);
    }
    setProp((p: FooterCenteredProps) => { if (p.menuItems?.[i]) p.menuItems[i][field] = value; });
  };

  return (
    <div className="space-y-4">
      <TranslatableInput
        label="Logo Text"
        propKey="logoText"
        value={props.logoText || ''}
        onChange={(v) => setProp((p: FooterCenteredProps) => (p.logoText = v))}
        nodeProps={props.nodeProps as Record<string, any>}
        setProp={setProp}
      />

      <ImageUpload label="Logo Image" value={props.logoImageUrl} onChange={(v) => setProp((p: FooterCenteredProps) => (p.logoImageUrl = v))} aspectRatio="auto" maxSizeKB={200} />

      <TranslatableInput
        label="Copyright Text"
        propKey="copyrightText"
        value={props.copyrightText || ''}
        onChange={(v) => setProp((p: FooterCenteredProps) => (p.copyrightText = v))}
        nodeProps={props.nodeProps as Record<string, any>}
        setProp={setProp}
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={props.backgroundColor} onChange={(e) => setProp((p: FooterCenteredProps) => (p.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={props.textColor} onChange={(e) => setProp((p: FooterCenteredProps) => (p.textColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-2">
          <Label>Menu Links</Label>
          <Button variant="outline" size="sm" onClick={addMenuItem}><Plus className="w-4 h-4" /></Button>
        </div>
        <div className="space-y-2">
          {props.menuItems?.map((item: MenuItem, i: number) => (
            <div key={i} className="flex gap-2">
              <Input value={item.label} onChange={(e) => updateMenuItem(i, 'label', e.target.value)} className="h-8" placeholder="Label" />
              <Input value={item.link} onChange={(e) => updateMenuItem(i, 'link', e.target.value)} className="h-8" placeholder="Link" />
              <Button variant="ghost" size="sm" onClick={() => removeMenuItem(i)} className="h-8 w-8 p-0 text-destructive"><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

FooterCentered.craft = {
  props: defaultProps,
  related: { settings: FooterCenteredSettings },
  displayName: 'Footer Centered',
};
