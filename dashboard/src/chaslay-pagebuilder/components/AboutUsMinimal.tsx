// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Textarea } from '@/chaslay-pagebuilder/ui/textarea';
import { TranslatableInput } from './TranslatableInput';

export interface AboutUsMinimalProps {
  title?: string;
  content?: string;
  quote?: string;
  quoteAuthor?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
}

const defaultProps: AboutUsMinimalProps = {
  title: 'Our Philosophy',
  content: 'We believe in the power of simple, honest food. Every dish we create is a celebration of fresh ingredients, time-honored techniques, and the joy of sharing a meal together.',
  quote: 'Good food is the foundation of genuine happiness.',
  quoteAuthor: 'Auguste Escoffier',
  backgroundColor: '#ffffff',
  textColor: '#1c1917',
  accentColor: '#b91c1c',
};

export const AboutUsMinimal: React.FC<AboutUsMinimalProps> & {
  craft: {
    props: AboutUsMinimalProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();

  return (
    <section
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      className="hb-section-padding"
      style={{
        backgroundColor: mergedProps.backgroundColor,
        color: mergedProps.textColor,
        padding: '100px 40px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '4px', marginBottom: '40px', opacity: 0.6 }}>{mergedProps.title}</h2>

        <p style={{ fontSize: '24px', lineHeight: 1.8, marginBottom: '48px', fontWeight: 300 }}>{mergedProps.content}</p>

        {mergedProps.quote && (
          <div style={{ borderTop: `1px solid ${mergedProps.textColor}20`, paddingTop: '40px' }}>
            <p style={{ fontSize: '20px', fontStyle: 'italic', marginBottom: '16px', color: mergedProps.accentColor }}>"{mergedProps.quote}"</p>
            {mergedProps.quoteAuthor && (
              <p style={{ fontSize: '14px', opacity: 0.6 }}>— {mergedProps.quoteAuthor}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

const AboutUsMinimalSettings: React.FC = () => {
  const { actions: { setProp }, ...props } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title,
    content: node.data.props.content,
    quote: node.data.props.quote,
    quoteAuthor: node.data.props.quoteAuthor,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    accentColor: node.data.props.accentColor,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput label="Title" propKey="title" value={props.title} onChange={(v) => setProp((p: AboutUsMinimalProps) => (p.title = v))} nodeProps={props.nodeProps} setProp={setProp} />
      <TranslatableInput label="Content" propKey="content" value={props.content} onChange={(v) => setProp((p: AboutUsMinimalProps) => (p.content = v))} nodeProps={props.nodeProps} setProp={setProp} multiline rows={4} />
      <TranslatableInput label="Quote" propKey="quote" value={props.quote || ''} onChange={(v) => setProp((p: AboutUsMinimalProps) => (p.quote = v))} nodeProps={props.nodeProps} setProp={setProp} multiline rows={2} />
      <TranslatableInput label="Quote Author" propKey="quoteAuthor" value={props.quoteAuthor || ''} onChange={(v) => setProp((p: AboutUsMinimalProps) => (p.quoteAuthor = v))} nodeProps={props.nodeProps} setProp={setProp} />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={props.backgroundColor} onChange={(e) => setProp((p: AboutUsMinimalProps) => (p.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={props.textColor} onChange={(e) => setProp((p: AboutUsMinimalProps) => (p.textColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Accent Color</Label>
        <Input type="color" value={props.accentColor} onChange={(e) => setProp((p: AboutUsMinimalProps) => (p.accentColor = e.target.value))} className="h-10 w-full" />
      </div>
    </div>
  );
};

AboutUsMinimal.craft = {
  props: defaultProps,
  related: { settings: AboutUsMinimalSettings },
  displayName: 'About Us Minimal',
};
