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

export interface AboutUsClassicProps {
  title?: string;
  content?: string;
  image?: string;
  backgroundColor?: string;
  textColor?: string;
}

const defaultProps: AboutUsClassicProps = {
  sectionId: SECTION_ANCHORS.about,
  title: 'Our Story',
  content: 'Welcome to our restaurant! We have been serving delicious food to our community for over 20 years. Our passion for quality ingredients and exceptional service has made us a local favorite. Come visit us and experience the difference.',
  image: '',
  backgroundColor: '#ffffff',
  textColor: '#1a1a2e',
};

export const AboutUsClassic: React.FC<AboutUsClassicProps> & {
  craft: {
    props: AboutUsClassicProps;
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
        boxSizing: 'border-box',
      }}
    >
      <div className="hb-split" style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
        <div>
          {mergedProps.image ? (
            <img src={mergedProps.image} alt="About us" style={{ width: '100%', height: '450px', objectFit: 'cover', borderRadius: '12px' }} />
          ) : (
            <div style={{ width: '100%', height: '450px', backgroundColor: '#e9ecef', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c757d' }}>
              Image Placeholder
            </div>
          )}
        </div>
        <div>
          <h2 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '24px', lineHeight: 1.2 }}>{mergedProps.title}</h2>
          <p style={{ fontSize: '18px', lineHeight: 1.8, opacity: 0.85 }}>{mergedProps.content}</p>
        </div>
      </div>
    </section>
  );
};

const AboutUsClassicSettings: React.FC = () => {
  const { actions: { setProp }, ...props } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title,
    content: node.data.props.content,
    image: node.data.props.image,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput
        label="Title"
        propKey="title"
        value={props.title}
        onChange={(v) => setProp((p: AboutUsClassicProps) => (p.title = v))}
        nodeProps={props.nodeProps}
        setProp={setProp}
      />
      <TranslatableInput
        label="Content"
        propKey="content"
        value={props.content}
        onChange={(v) => setProp((p: AboutUsClassicProps) => (p.content = v))}
        nodeProps={props.nodeProps}
        setProp={setProp}
        multiline
        rows={5}
      />
      <ImageUpload label="Image" value={props.image} onChange={(v) => setProp((p: AboutUsClassicProps) => (p.image = v))} aspectRatio="square" />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={props.backgroundColor} onChange={(e) => setProp((p: AboutUsClassicProps) => (p.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={props.textColor} onChange={(e) => setProp((p: AboutUsClassicProps) => (p.textColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
};

AboutUsClassic.craft = {
  props: defaultProps,
  related: { settings: AboutUsClassicSettings },
  displayName: 'About Us Classic',
};
