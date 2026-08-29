// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { TranslatableInput } from './TranslatableInput';

interface SocialLink {
  platform: string;
  url: string;
}

export interface FooterMinimalProps {
  copyrightText?: string;
  socialLinks?: SocialLink[];
  backgroundColor?: string;
  textColor?: string;
}

const defaultProps: FooterMinimalProps = {
  copyrightText: '© 2024 Restaurant Name',
  socialLinks: [
    { platform: 'facebook', url: '#' },
    { platform: 'instagram', url: '#' },
    { platform: 'twitter', url: '#' },
  ],
  backgroundColor: '#ffffff',
  textColor: '#374151',
};

const SocialIcon: React.FC<{ platform: string; color: string }> = ({ platform, color }) => {
  const icons: Record<string, React.ReactNode> = {
    facebook: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={color}>
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    instagram: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={color}>
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
    twitter: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={color}>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  };
  return <>{icons[platform] || null}</>;
};

export const FooterMinimal: React.FC<FooterMinimalProps> & {
  craft: {
    props: FooterMinimalProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();

  return (
    <footer
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      className="hb-footer"
      style={{
        backgroundColor: mergedProps.backgroundColor,
        color: mergedProps.textColor,
        padding: '24px 40px',
        width: '100%',
        borderTop: '1px solid #e5e7eb',
        boxSizing: 'border-box',
      }}
    >
      <div className="hb-footer-minimal" style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: '14px', opacity: 0.8 }}>{mergedProps.copyrightText}</p>
        <div style={{ display: 'flex', gap: '16px' }}>
          {mergedProps.socialLinks?.map((social, i) => (
            <a key={i} href={social.url} style={{ color: mergedProps.textColor, opacity: 0.6 }}>
              <SocialIcon platform={social.platform} color={mergedProps.textColor || '#374151'} />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
};

const FooterMinimalSettings: React.FC = () => {
  const { actions: { setProp }, ...props } = useNode((node) => ({
    nodeProps: node.data.props,
    copyrightText: node.data.props.copyrightText,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    socialLinks: node.data.props.socialLinks ?? defaultProps.socialLinks,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput
        label="Copyright Text"
        propKey="copyrightText"
        value={props.copyrightText || ''}
        onChange={(v) => setProp((p: FooterMinimalProps) => (p.copyrightText = v))}
        nodeProps={props.nodeProps as Record<string, any>}
        setProp={setProp}
      />

      <div className="border-t pt-4 space-y-3">
        <Label className="font-semibold">Social Links</Label>
        {(props.socialLinks as SocialLink[])?.map((social, i) => (
          <div key={i} className="space-y-1">
            <Label className="text-xs capitalize">{social.platform}</Label>
            <Input
              value={social.url === '#' ? '' : social.url}
              placeholder={`https://${social.platform}.com/...`}
              onChange={(e) => setProp((p: FooterMinimalProps) => {
                if (p.socialLinks) p.socialLinks[i].url = e.target.value || '#';
              })}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={props.backgroundColor} onChange={(e) => setProp((p: FooterMinimalProps) => (p.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={props.textColor} onChange={(e) => setProp((p: FooterMinimalProps) => (p.textColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
};

FooterMinimal.craft = {
  props: defaultProps,
  related: { settings: FooterMinimalSettings },
  displayName: 'Footer Minimal',
};
