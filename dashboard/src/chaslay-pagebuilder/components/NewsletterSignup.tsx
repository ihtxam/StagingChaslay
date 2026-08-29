// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { NewsletterProps } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/chaslay-pagebuilder/ui/select';
import { TranslatableInput } from './TranslatableInput';

const defaultProps: NewsletterProps = {
  title: 'Stay Updated',
  subtitle: 'Subscribe to our newsletter for exclusive offers and updates',
  buttonText: 'Subscribe',
  backgroundColor: '#f8f9fa',
  textColor: '#1a1a2e',
  accentColor: '#e94560',
  buttonColor: '#e94560',
  layout: 'horizontal',
};

export const NewsletterSignup: React.FC<NewsletterProps> & {
  craft: {
    props: NewsletterProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();
  const isHorizontal = mergedProps.layout === 'horizontal';

  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      className="hb-section hb-section-padding"
      style={{
        backgroundColor: mergedProps.backgroundColor,
        width: '100%',
        boxSizing: 'border-box',
        padding: '64px 20px',
      }}
    >
      <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
        {mergedProps.title && (
          <h3 style={{ color: mergedProps.textColor, fontSize: '28px', fontWeight: 600, marginBottom: '12px' }}>
            {mergedProps.title}
          </h3>
        )}
        {mergedProps.subtitle && (
          <p style={{ color: mergedProps.textColor, opacity: 0.7, fontSize: '16px', marginBottom: '32px' }}>
            {mergedProps.subtitle}
          </p>
        )}
        <div style={{
          display: 'flex',
          flexDirection: isHorizontal ? 'row' : 'column',
          gap: '12px',
          maxWidth: isHorizontal ? '500px' : '360px',
          margin: '0 auto',
        }}>
          <input
            style={{
              flex: 1,
              padding: '14px 18px',
              borderRadius: '8px',
              border: `1px solid ${mergedProps.accentColor}33`,
              fontSize: '14px',
              outline: 'none',
              backgroundColor: '#fff',
            }}
            placeholder="Enter your email"
            readOnly
          />
          <button style={{
            padding: '14px 28px',
            backgroundColor: mergedProps.buttonColor,
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}>
            {mergedProps.buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};

const NewsletterSignupSettings: React.FC = () => {
  const { actions: { setProp }, ...p } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title ?? defaultProps.title,
    subtitle: node.data.props.subtitle ?? defaultProps.subtitle,
    buttonText: node.data.props.buttonText ?? defaultProps.buttonText,
    backgroundColor: node.data.props.backgroundColor ?? defaultProps.backgroundColor,
    textColor: node.data.props.textColor ?? defaultProps.textColor,
    accentColor: node.data.props.accentColor ?? defaultProps.accentColor,
    buttonColor: node.data.props.buttonColor ?? defaultProps.buttonColor,
    layout: node.data.props.layout ?? defaultProps.layout,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput label="Title" propKey="title" value={p.title} onChange={(v) => setProp((props: NewsletterProps) => (props.title = v))} nodeProps={p.nodeProps} setProp={setProp} />
      <TranslatableInput label="Subtitle" propKey="subtitle" value={p.subtitle} onChange={(v) => setProp((props: NewsletterProps) => (props.subtitle = v))} nodeProps={p.nodeProps} setProp={setProp} />
      <TranslatableInput label="Button Text" propKey="buttonText" value={p.buttonText} onChange={(v) => setProp((props: NewsletterProps) => (props.buttonText = v))} nodeProps={p.nodeProps} setProp={setProp} />
      <div className="space-y-2">
        <Label>Layout</Label>
        <Select value={p.layout} onValueChange={(v) => setProp((props: NewsletterProps) => (props.layout = v as 'horizontal' | 'stacked'))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="horizontal">Horizontal</SelectItem>
            <SelectItem value="stacked">Stacked</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={p.backgroundColor} onChange={(e) => setProp((props: NewsletterProps) => (props.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={p.textColor} onChange={(e) => setProp((props: NewsletterProps) => (props.textColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Accent</Label>
          <Input type="color" value={p.accentColor} onChange={(e) => setProp((props: NewsletterProps) => (props.accentColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Button Color</Label>
          <Input type="color" value={p.buttonColor} onChange={(e) => setProp((props: NewsletterProps) => (props.buttonColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
};

NewsletterSignup.craft = {
  props: defaultProps,
  related: { settings: NewsletterSignupSettings },
  displayName: 'Newsletter Signup',
};
