// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { ImageUpload } from './ImageUpload';
import { TranslatableInput } from './TranslatableInput';

interface SocialLink {
  platform: string;
  url: string;
}

export interface FooterModernProps {
  logoText?: string;
  logoImageUrl?: string;
  socialLinks?: SocialLink[];
  copyrightText?: string;
  gradientFrom?: string;
  gradientTo?: string;
  textColor?: string;
}

const defaultProps: FooterModernProps = {
  logoText: 'resto.',
  logoImageUrl: '',
  socialLinks: [
    { platform: 'facebook', url: '#' },
    { platform: 'instagram', url: '#' },
    { platform: 'twitter', url: '#' },
  ],
  copyrightText: '© 2024 Restaurant. Crafted with love.',
  gradientFrom: '#1e293b',
  gradientTo: '#0f172a',
  textColor: '#ffffff',
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

export const FooterModern: React.FC<FooterModernProps> & {
  craft: {
    props: FooterModernProps;
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
        background: `linear-gradient(to right, ${mergedProps.gradientFrom}, ${mergedProps.gradientTo})`,
        color: mergedProps.textColor,
        padding: '40px 40px 24px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          {/* Logo */}
          {mergedProps.logoImageUrl ? (
            <img src={mergedProps.logoImageUrl} alt={mergedProps.logoText} style={{ height: '36px', objectFit: 'contain' }} />
          ) : (
            <span style={{ fontSize: '28px', fontWeight: 700, fontStyle: 'italic' }}>{mergedProps.logoText}</span>
          )}

          {/* Social Links */}
          <div style={{ display: 'flex', gap: '16px' }}>
            {mergedProps.socialLinks?.map((social, i) => (
              <a key={i} href={social.url} style={{ color: mergedProps.textColor, opacity: 0.8 }}>
                <SocialIcon platform={social.platform} color={mergedProps.textColor || '#ffffff'} />
              </a>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: `${mergedProps.textColor}20`, marginBottom: '20px' }} />

        {/* Copyright */}
        <p style={{ fontSize: '13px', opacity: 0.6, textAlign: 'center' }}>{mergedProps.copyrightText}</p>
      </div>
    </footer>
  );
};

const FooterModernSettings: React.FC = () => {
  const { actions: { setProp }, ...props } = useNode((node) => ({
    nodeProps: node.data.props,
    logoText: node.data.props.logoText,
    logoImageUrl: node.data.props.logoImageUrl,
    copyrightText: node.data.props.copyrightText,
    gradientFrom: node.data.props.gradientFrom,
    gradientTo: node.data.props.gradientTo,
    textColor: node.data.props.textColor,
    socialLinks: node.data.props.socialLinks ?? defaultProps.socialLinks,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput
        label="Logo Text"
        propKey="logoText"
        value={props.logoText || ''}
        onChange={(v) => setProp((p: FooterModernProps) => (p.logoText = v))}
        nodeProps={props.nodeProps as Record<string, any>}
        setProp={setProp}
      />

      <ImageUpload label="Logo Image" value={props.logoImageUrl} onChange={(v) => setProp((p: FooterModernProps) => (p.logoImageUrl = v))} aspectRatio="auto" maxSizeKB={200} />

      <TranslatableInput
        label="Copyright Text"
        propKey="copyrightText"
        value={props.copyrightText || ''}
        onChange={(v) => setProp((p: FooterModernProps) => (p.copyrightText = v))}
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
              onChange={(e) => setProp((p: FooterModernProps) => {
                if (p.socialLinks) p.socialLinks[i].url = e.target.value || '#';
              })}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Gradient From</Label>
          <Input type="color" value={props.gradientFrom} onChange={(e) => setProp((p: FooterModernProps) => (p.gradientFrom = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Gradient To</Label>
          <Input type="color" value={props.gradientTo} onChange={(e) => setProp((p: FooterModernProps) => (p.gradientTo = e.target.value))} className="h-10 w-full" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Text Color</Label>
        <Input type="color" value={props.textColor} onChange={(e) => setProp((p: FooterModernProps) => (p.textColor = e.target.value))} className="h-10 w-full" />
      </div>
    </div>
  );
};

FooterModern.craft = {
  props: defaultProps,
  related: { settings: FooterModernSettings },
  displayName: 'Footer Modern',
};
