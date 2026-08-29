// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { TranslatableInput } from './TranslatableInput';

export interface HoursMinimalProps {
  title?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
}

const defaultProps: HoursMinimalProps = {
  title: 'HOURS',
  backgroundColor: '#ffffff',
  textColor: '#1c1917',
  accentColor: '#dc2626',
};

const hours = [
  { days: 'Monday - Thursday', time: '11am - 10pm' },
  { days: 'Friday - Saturday', time: '11am - 11pm' },
  { days: 'Sunday', time: 'Closed' },
];

export const HoursMinimal: React.FC<HoursMinimalProps> & {
  craft: {
    props: HoursMinimalProps;
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
        padding: '80px 40px',
        width: '100%',
        textAlign: 'center',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 400, letterSpacing: '4px', marginBottom: '40px', opacity: 0.6 }}>{mergedProps.title}</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {hours.map((item, i) => (
            <div key={i}>
              <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>{item.days}</div>
              <div style={{ fontSize: '24px', fontWeight: 300, color: item.time === 'Closed' ? mergedProps.accentColor : mergedProps.textColor }}>{item.time}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const HoursMinimalSettings: React.FC = () => {
  const { actions: { setProp }, ...props } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    accentColor: node.data.props.accentColor,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput label="Title" propKey="title" value={props.title} onChange={(v) => setProp((p: HoursMinimalProps) => (p.title = v))} nodeProps={props.nodeProps} setProp={setProp} />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={props.backgroundColor} onChange={(e) => setProp((p: HoursMinimalProps) => (p.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={props.textColor} onChange={(e) => setProp((p: HoursMinimalProps) => (p.textColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Accent Color</Label>
        <Input type="color" value={props.accentColor} onChange={(e) => setProp((p: HoursMinimalProps) => (p.accentColor = e.target.value))} className="h-10 w-full" />
      </div>
    </div>
  );
};

HoursMinimal.craft = {
  props: defaultProps,
  related: { settings: HoursMinimalSettings },
  displayName: 'Hours Minimal',
};
