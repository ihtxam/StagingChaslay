// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { ImageUpload } from './ImageUpload';
import { TranslatableInput } from './TranslatableInput';

export interface HoursSplitProps {
  title?: string;
  subtitle?: string;
  image?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
}

const defaultProps: HoursSplitProps = {
  title: 'Visit Us',
  subtitle: 'We look forward to serving you',
  image: '',
  backgroundColor: '#faf9f6',
  textColor: '#1c1917',
  accentColor: '#b91c1c',
};

const hours = [
  { days: 'Mon - Thu', time: '11:00 AM - 10:00 PM' },
  { days: 'Fri - Sat', time: '11:00 AM - 11:00 PM' },
  { days: 'Sunday', time: 'Closed' },
];

export const HoursSplit: React.FC<HoursSplitProps> & {
  craft: {
    props: HoursSplitProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();

  return (
    <section
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      style={{
        backgroundColor: mergedProps.backgroundColor,
        color: mergedProps.textColor,
        width: '100%',
      }}
    >
      <div className="hb-split" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '500px' }}>
        <div style={{ padding: '80px 60px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h2 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '12px' }}>{mergedProps.title}</h2>
          <p style={{ fontSize: '18px', opacity: 0.7, marginBottom: '40px' }}>{mergedProps.subtitle}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {hours.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '20px', borderBottom: i < hours.length - 1 ? `1px solid ${mergedProps.textColor}20` : 'none' }}>
                <span style={{ fontWeight: 600 }}>{item.days}</span>
                <span style={{ color: item.time === 'Closed' ? mergedProps.accentColor : mergedProps.textColor }}>{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ backgroundColor: '#e9ecef' }}>
          {mergedProps.image ? (
            <img src={mergedProps.image} alt="Restaurant" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c757d' }}>Image Placeholder</div>
          )}
        </div>
      </div>
    </section>
  );
};

const HoursSplitSettings: React.FC = () => {
  const { actions: { setProp }, ...props } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title,
    subtitle: node.data.props.subtitle,
    image: node.data.props.image,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    accentColor: node.data.props.accentColor,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput label="Title" propKey="title" value={props.title} onChange={(v) => setProp((p: HoursSplitProps) => (p.title = v))} nodeProps={props.nodeProps} setProp={setProp} />
      <TranslatableInput label="Subtitle" propKey="subtitle" value={props.subtitle || ''} onChange={(v) => setProp((p: HoursSplitProps) => (p.subtitle = v))} nodeProps={props.nodeProps} setProp={setProp} />
      <ImageUpload label="Image" value={props.image} onChange={(v) => setProp((p: HoursSplitProps) => (p.image = v))} aspectRatio="square" />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={props.backgroundColor} onChange={(e) => setProp((p: HoursSplitProps) => (p.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={props.textColor} onChange={(e) => setProp((p: HoursSplitProps) => (p.textColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Accent Color</Label>
        <Input type="color" value={props.accentColor} onChange={(e) => setProp((p: HoursSplitProps) => (p.accentColor = e.target.value))} className="h-10 w-full" />
      </div>
    </div>
  );
};

HoursSplit.craft = {
  props: defaultProps,
  related: { settings: HoursSplitSettings },
  displayName: 'Hours Split',
};
