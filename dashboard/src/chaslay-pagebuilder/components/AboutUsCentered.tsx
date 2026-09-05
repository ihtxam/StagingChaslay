// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Textarea } from '@/chaslay-pagebuilder/ui/textarea';
import { ImageUpload } from './ImageUpload';
import { TranslatableInput } from './TranslatableInput';
import { sectionAnchorId, SECTION_ANCHORS } from '../utils/section-id';

export interface AboutUsCenteredProps {
  title?: string;
  subtitle?: string;
  content?: string;
  image?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
}

const defaultProps: AboutUsCenteredProps = {
  sectionId: SECTION_ANCHORS.about,
  title: 'About Our Restaurant',
  subtitle: 'A Culinary Journey',
  content: 'Founded in 2010, we have dedicated ourselves to bringing you the finest culinary experience. Our chefs use only the freshest ingredients, sourced locally whenever possible, to create dishes that delight and inspire.',
  image: '',
  backgroundColor: '#faf9f6',
  textColor: '#1c1917',
  accentColor: '#dc2626',
};

export const AboutUsCentered: React.FC<AboutUsCenteredProps> & {
  craft: {
    props: AboutUsCenteredProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();

  return (
    <section
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      id={sectionAnchorId(mergedProps.sectionId, 'about')}
      className="hb-section-padding"
      style={{
        backgroundColor: mergedProps.backgroundColor,
        color: mergedProps.textColor,
        padding: '80px 40px',
        width: '100%',
        textAlign: 'center',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {mergedProps.subtitle && (
          <p style={{ fontSize: '14px', fontWeight: 600, color: mergedProps.accentColor, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '12px' }}>
            {mergedProps.subtitle}
          </p>
        )}
        <h2 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '32px', lineHeight: 1.2 }}>{mergedProps.title}</h2>

        {mergedProps.image ? (
          <img src={mergedProps.image} alt="About us" style={{ width: '100%', height: '400px', objectFit: 'cover', borderRadius: '16px', marginBottom: '32px' }} />
        ) : (
          <div style={{ width: '100%', height: '400px', backgroundColor: '#e9ecef', borderRadius: '16px', marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c757d' }}>
            Image Placeholder
          </div>
        )}

        <p style={{ fontSize: '18px', lineHeight: 1.9, opacity: 0.85 }}>{mergedProps.content}</p>
      </div>
    </section>
  );
};

const AboutUsCenteredSettings: React.FC = () => {
  const { actions: { setProp }, ...props } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title,
    subtitle: node.data.props.subtitle,
    content: node.data.props.content,
    image: node.data.props.image,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    accentColor: node.data.props.accentColor,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput label="Subtitle" propKey="subtitle" value={props.subtitle} onChange={(v) => setProp((p: AboutUsCenteredProps) => (p.subtitle = v))} nodeProps={props.nodeProps} setProp={setProp} />
      <TranslatableInput label="Title" propKey="title" value={props.title} onChange={(v) => setProp((p: AboutUsCenteredProps) => (p.title = v))} nodeProps={props.nodeProps} setProp={setProp} />
      <TranslatableInput label="Content" propKey="content" value={props.content} onChange={(v) => setProp((p: AboutUsCenteredProps) => (p.content = v))} nodeProps={props.nodeProps} setProp={setProp} multiline rows={5} />
      <ImageUpload label="Image" value={props.image} onChange={(v) => setProp((p: AboutUsCenteredProps) => (p.image = v))} aspectRatio="wide" />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={props.backgroundColor} onChange={(e) => setProp((p: AboutUsCenteredProps) => (p.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={props.textColor} onChange={(e) => setProp((p: AboutUsCenteredProps) => (p.textColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Accent Color</Label>
        <Input type="color" value={props.accentColor} onChange={(e) => setProp((p: AboutUsCenteredProps) => (p.accentColor = e.target.value))} className="h-10 w-full" />
      </div>
    </div>
  );
};

AboutUsCentered.craft = {
  props: defaultProps,
  related: { settings: AboutUsCenteredSettings },
  displayName: 'About Us Centered',
};
