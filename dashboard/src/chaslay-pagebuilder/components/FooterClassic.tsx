// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { ImageUpload } from './ImageUpload';
import { BuilderImage } from './BuilderImage';
import { TranslatableInput } from './TranslatableInput';
import { useSectionTranslations } from '../utils/use-section-translations';
import { FooterColumnsEditor } from './FooterColumnsEditor';
import { useStorefront } from '../StorefrontContext';
import { sectionAnchorId, SECTION_ANCHORS } from '../utils/section-id';

interface LinkItem {
  label: string;
  link: string;
}

interface LinkColumn {
  title: string;
  links: LinkItem[];
}

export interface FooterClassicProps {
  logoText?: string;
  logoImageUrl?: string;
  description?: string;
  columns?: LinkColumn[];
  backgroundColor?: string;
  textColor?: string;
  copyrightText?: string;
}

const defaultProps: FooterClassicProps = {
  sectionId: SECTION_ANCHORS.footer,
  logoText: 'Restaurant Name',
  logoImageUrl: '',
  description: 'Serving delicious food since 2020. Visit us for an unforgettable dining experience.',
  columns: [
    {
      title: 'Quick Links',
      links: [
        { label: 'Home', link: '/' },
        { label: 'Menu', link: '/menu' },
        { label: 'About', link: '/about' },
        { label: 'Contact', link: '/contact' },
      ],
    },
    {
      title: 'Hours',
      links: [
        { label: 'Mon-Fri: 11am-10pm', link: '#' },
        { label: 'Sat-Sun: 10am-11pm', link: '#' },
      ],
    },
  ],
  backgroundColor: '#1a1a2e',
  textColor: '#ffffff',
  copyrightText: '© 2024 Restaurant Name. All rights reserved.',
};

export const FooterClassic: React.FC<FooterClassicProps> & {
  craft: {
    props: FooterClassicProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { tr, trText, trList } = useSectionTranslations(mergedProps as Record<string, unknown>);
  const { connectors: { connect, drag } } = useNode();
  const { isStorefront, shopHref } = useStorefront();

  return (
    <>
    <footer
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      id={sectionAnchorId(mergedProps.sectionId, 'footer')}
      style={{
        backgroundColor: mergedProps.backgroundColor,
        color: mergedProps.textColor,
        padding: '60px 40px 30px',
        width: '100%',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div className="footer-classic-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '40px', marginBottom: '40px' }}>
          {/* Logo & Description */}
          <div>
            {mergedProps.logoImageUrl ? (
              <BuilderImage src={mergedProps.logoImageUrl} alt={tr('logoText')} style={{ height: '40px', objectFit: 'contain', marginBottom: '16px' }} />
            ) : (
              <div style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>{tr('logoText')}</div>
            )}
            <p style={{ fontSize: '14px', opacity: 0.8, lineHeight: 1.6, maxWidth: '300px' }}>{tr('description')}</p>
          </div>

          {/* Link Columns */}
          {mergedProps.columns?.map((column, i) => (
            <div key={i}>
              <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>{trText(column.title)}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {column.links.map((link, j) => (
                  <a key={j} href={shopHref(link.link)} style={{ color: mergedProps.textColor, textDecoration: 'none', fontSize: '14px', opacity: 0.8 }}>
                    {trText(link.label)}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Copyright */}
        <div style={{ borderTop: `1px solid ${mergedProps.textColor}20`, paddingTop: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', opacity: 0.6 }}>{tr('copyrightText')}</p>
          {isStorefront ? (
            <p style={{ fontSize: '11px', opacity: 0.45, marginTop: '10px' }}>Powered by rebornPOS</p>
          ) : null}
        </div>
      </div>
    </footer>
    <style>{`
      @container (max-width: 768px) {
        .footer-classic-grid {
          grid-template-columns: 1fr !important;
          gap: 32px !important;
        }
      }
    `}</style>
    </>
  );
};

const FooterClassicSettings: React.FC = () => {
  const { actions: { setProp }, ...props } = useNode((node) => ({
    nodeProps: node.data.props,
    logoText: node.data.props.logoText,
    logoImageUrl: node.data.props.logoImageUrl,
    description: node.data.props.description,
    columns: node.data.props.columns || defaultProps.columns,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    copyrightText: node.data.props.copyrightText,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput
        label="Logo Text"
        propKey="logoText"
        value={props.logoText || ''}
        onChange={(v) => setProp((p: FooterClassicProps) => (p.logoText = v))}
        nodeProps={props.nodeProps as Record<string, any>}
        setProp={setProp}
      />

      <ImageUpload label="Logo Image" value={props.logoImageUrl} onChange={(v) => setProp((p: FooterClassicProps) => (p.logoImageUrl = v))} aspectRatio="auto" maxSizeKB={200} />

      <TranslatableInput
        label="Description"
        propKey="description"
        value={props.description || ''}
        onChange={(v) => setProp((p: FooterClassicProps) => (p.description = v))}
        nodeProps={props.nodeProps as Record<string, any>}
        setProp={setProp}
        multiline
        rows={2}
      />

      <TranslatableInput
        label="Copyright Text"
        propKey="copyrightText"
        value={props.copyrightText || ''}
        onChange={(v) => setProp((p: FooterClassicProps) => (p.copyrightText = v))}
        nodeProps={props.nodeProps as Record<string, any>}
        setProp={setProp}
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={props.backgroundColor} onChange={(e) => setProp((p: FooterClassicProps) => (p.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={props.textColor} onChange={(e) => setProp((p: FooterClassicProps) => (p.textColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>

      <FooterColumnsEditor columns={props.columns} setProp={setProp} />
    </div>
  );
};

FooterClassic.craft = {
  props: defaultProps,
  related: { settings: FooterClassicSettings },
  displayName: 'Footer Classic',
};
