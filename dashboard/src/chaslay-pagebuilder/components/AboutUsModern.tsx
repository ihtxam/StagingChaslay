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

export interface AboutUsModernProps {
  title?: string;
  content?: string;
  image?: string;
  stat1Value?: string;
  stat1Label?: string;
  stat2Value?: string;
  stat2Label?: string;
  stat3Value?: string;
  stat3Label?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
}

const defaultProps: AboutUsModernProps = {
  sectionId: SECTION_ANCHORS.about,
  title: 'Crafting Culinary Excellence Since 2010',
  content: 'Our journey began with a simple idea: to create a space where great food brings people together. Today, we continue that tradition with every dish we serve.',
  image: '',
  stat1Value: '15+',
  stat1Label: 'Years of Excellence',
  stat2Value: '50K+',
  stat2Label: 'Happy Customers',
  stat3Value: '100+',
  stat3Label: 'Signature Dishes',
  backgroundColor: '#1a1a2e',
  textColor: '#ffffff',
  accentColor: '#f59e0b',
};

export const AboutUsModern: React.FC<AboutUsModernProps> & {
  craft: {
    props: AboutUsModernProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();

  const stats = [
    { value: mergedProps.stat1Value, label: mergedProps.stat1Label },
    { value: mergedProps.stat2Value, label: mergedProps.stat2Label },
    { value: mergedProps.stat3Value, label: mergedProps.stat3Label },
  ].filter(s => s.value && s.label);

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
      <div className="hb-split" style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '40px', fontWeight: 700, marginBottom: '24px', lineHeight: 1.2 }}>{mergedProps.title}</h2>
          <p style={{ fontSize: '18px', lineHeight: 1.8, opacity: 0.8, marginBottom: '48px' }}>{mergedProps.content}</p>

          {stats.length > 0 && (
            <div style={{ display: 'flex', gap: '48px' }}>
              {stats.map((stat, i) => (
                <div key={i}>
                  <div style={{ fontSize: '36px', fontWeight: 700, color: mergedProps.accentColor }}>{stat.value}</div>
                  <div style={{ fontSize: '14px', opacity: 0.7 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          {mergedProps.image ? (
            <img src={mergedProps.image} alt="About us" style={{ width: '100%', height: '500px', objectFit: 'cover', borderRadius: '16px' }} />
          ) : (
            <div style={{ width: '100%', height: '500px', backgroundColor: '#374151', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
              Image Placeholder
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const AboutUsModernSettings: React.FC = () => {
  const { actions: { setProp }, ...props } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title,
    content: node.data.props.content,
    image: node.data.props.image,
    stat1Value: node.data.props.stat1Value,
    stat1Label: node.data.props.stat1Label,
    stat2Value: node.data.props.stat2Value,
    stat2Label: node.data.props.stat2Label,
    stat3Value: node.data.props.stat3Value,
    stat3Label: node.data.props.stat3Label,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    accentColor: node.data.props.accentColor,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput label="Title" propKey="title" value={props.title} onChange={(v) => setProp((p: AboutUsModernProps) => (p.title = v))} nodeProps={props.nodeProps} setProp={setProp} />
      <TranslatableInput label="Content" propKey="content" value={props.content} onChange={(v) => setProp((p: AboutUsModernProps) => (p.content = v))} nodeProps={props.nodeProps} setProp={setProp} multiline rows={4} />
      <ImageUpload label="Image" value={props.image} onChange={(v) => setProp((p: AboutUsModernProps) => (p.image = v))} aspectRatio="square" />

      <div className="border-t pt-4">
        <Label className="mb-2 block">Statistics</Label>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <TranslatableInput label="Stat 1 Value" propKey="stat1Value" value={props.stat1Value || ''} onChange={(v) => setProp((p: AboutUsModernProps) => (p.stat1Value = v))} nodeProps={props.nodeProps} setProp={setProp} />
            <TranslatableInput label="Stat 1 Label" propKey="stat1Label" value={props.stat1Label || ''} onChange={(v) => setProp((p: AboutUsModernProps) => (p.stat1Label = v))} nodeProps={props.nodeProps} setProp={setProp} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <TranslatableInput label="Stat 2 Value" propKey="stat2Value" value={props.stat2Value || ''} onChange={(v) => setProp((p: AboutUsModernProps) => (p.stat2Value = v))} nodeProps={props.nodeProps} setProp={setProp} />
            <TranslatableInput label="Stat 2 Label" propKey="stat2Label" value={props.stat2Label || ''} onChange={(v) => setProp((p: AboutUsModernProps) => (p.stat2Label = v))} nodeProps={props.nodeProps} setProp={setProp} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <TranslatableInput label="Stat 3 Value" propKey="stat3Value" value={props.stat3Value || ''} onChange={(v) => setProp((p: AboutUsModernProps) => (p.stat3Value = v))} nodeProps={props.nodeProps} setProp={setProp} />
            <TranslatableInput label="Stat 3 Label" propKey="stat3Label" value={props.stat3Label || ''} onChange={(v) => setProp((p: AboutUsModernProps) => (p.stat3Label = v))} nodeProps={props.nodeProps} setProp={setProp} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={props.backgroundColor} onChange={(e) => setProp((p: AboutUsModernProps) => (p.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={props.textColor} onChange={(e) => setProp((p: AboutUsModernProps) => (p.textColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Accent Color</Label>
        <Input type="color" value={props.accentColor} onChange={(e) => setProp((p: AboutUsModernProps) => (p.accentColor = e.target.value))} className="h-10 w-full" />
      </div>
    </div>
  );
};

AboutUsModern.craft = {
  props: defaultProps,
  related: { settings: AboutUsModernSettings },
  displayName: 'About Us Modern',
};
