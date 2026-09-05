// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { ImageUpload } from './ImageUpload';
import { TranslatableInput } from './TranslatableInput';
import { MenuItemsEditor } from './MenuItemsEditor';
import { useStorefront } from '../StorefrontContext';
import { sectionAnchorId, SECTION_ANCHORS } from '../utils/section-id';

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
  sectionId: SECTION_ANCHORS.footer,
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
  const { shopHref } = useStorefront();

  return (
    <footer
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      id={sectionAnchorId(mergedProps.sectionId, 'footer')}
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
            <a key={i} href={shopHref(item.link)} style={{ color: mergedProps.textColor, textDecoration: 'none', fontSize: '14px', opacity: 0.8 }}>
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

      <MenuItemsEditor
        label="Menu Links"
        menuItems={props.menuItems}
        setProp={setProp}
        translatableLabels={false}
      />
    </div>
  );
};

FooterCentered.craft = {
  props: defaultProps,
  related: { settings: FooterCenteredSettings },
  displayName: 'Footer Centered',
};
