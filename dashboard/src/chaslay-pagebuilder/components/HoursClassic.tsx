// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Switch } from '@/chaslay-pagebuilder/ui/switch';
import { Clock } from 'lucide-react';
import { TranslatableInput } from './TranslatableInput';

export interface HoursClassicProps {
  title?: string;
  showStatus?: boolean;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
}

const defaultProps: HoursClassicProps = {
  title: 'Opening Hours',
  showStatus: true,
  backgroundColor: '#ffffff',
  textColor: '#1a1a2e',
  accentColor: '#3b82f6',
};

const hours = [
  { day: 'Monday', time: '11:00 AM - 10:00 PM', open: true },
  { day: 'Tuesday', time: '11:00 AM - 10:00 PM', open: true },
  { day: 'Wednesday', time: '11:00 AM - 10:00 PM', open: true },
  { day: 'Thursday', time: '11:00 AM - 10:00 PM', open: true },
  { day: 'Friday', time: '11:00 AM - 11:00 PM', open: true },
  { day: 'Saturday', time: '10:00 AM - 11:00 PM', open: true },
  { day: 'Sunday', time: 'Closed', open: false },
];

export const HoursClassic: React.FC<HoursClassicProps> & {
  craft: {
    props: HoursClassicProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();
  const today = new Date().getDay();
  const todayIndex = today === 0 ? 6 : today - 1;

  return (
    <section
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      className="hb-section-padding"
      style={{
        backgroundColor: mergedProps.backgroundColor,
        color: mergedProps.textColor,
        padding: '80px 40px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
            <Clock size={32} />
            <h2 style={{ fontSize: '36px', fontWeight: 700 }}>{mergedProps.title}</h2>
          </div>
          {mergedProps.showStatus && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 20px', borderRadius: '24px', backgroundColor: hours[todayIndex].open ? '#22c55e' : '#ef4444', color: '#fff', fontWeight: 600 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#fff' }} />
              {hours[todayIndex].open ? 'Open Now' : 'Closed'}
            </span>
          )}
        </div>

        <div style={{ backgroundColor: '#f8f9fa', borderRadius: '16px', overflow: 'hidden' }}>
          {hours.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 24px', borderBottom: i < hours.length - 1 ? '1px solid #e9ecef' : 'none', backgroundColor: i === todayIndex ? `${mergedProps.accentColor}15` : 'transparent' }}>
              <span style={{ fontWeight: i === todayIndex ? 700 : 500 }}>
                {item.day}
                {i === todayIndex && <span style={{ marginLeft: '10px', fontSize: '12px', backgroundColor: mergedProps.accentColor, color: '#fff', padding: '2px 10px', borderRadius: '12px' }}>Today</span>}
              </span>
              <span style={{ color: item.open ? mergedProps.textColor : '#ef4444', fontWeight: item.open ? 400 : 600 }}>{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const HoursClassicSettings: React.FC = () => {
  const { actions: { setProp }, ...props } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title,
    showStatus: node.data.props.showStatus,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    accentColor: node.data.props.accentColor,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput label="Title" propKey="title" value={props.title} onChange={(v) => setProp((p: HoursClassicProps) => (p.title = v))} nodeProps={props.nodeProps} setProp={setProp} />
      <div className="flex items-center justify-between">
        <Label>Show Status Badge</Label>
        <Switch checked={props.showStatus} onCheckedChange={(v) => setProp((p: HoursClassicProps) => (p.showStatus = v))} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={props.backgroundColor} onChange={(e) => setProp((p: HoursClassicProps) => (p.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={props.textColor} onChange={(e) => setProp((p: HoursClassicProps) => (p.textColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Accent Color</Label>
        <Input type="color" value={props.accentColor} onChange={(e) => setProp((p: HoursClassicProps) => (p.accentColor = e.target.value))} className="h-10 w-full" />
      </div>
    </div>
  );
};

HoursClassic.craft = {
  props: defaultProps,
  related: { settings: HoursClassicSettings },
  displayName: 'Hours Classic',
};
