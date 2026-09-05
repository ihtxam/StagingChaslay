// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Clock } from 'lucide-react';
import { TranslatableInput } from './TranslatableInput';
import { sectionAnchorId, SECTION_ANCHORS } from '../utils/section-id';

export interface HoursModernProps {
  title?: string;
  subtitle?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  cardColor?: string;
}

const defaultProps: HoursModernProps = {
  sectionId: SECTION_ANCHORS.openingHours,
  title: 'When to Visit',
  subtitle: 'Find the perfect time for your dining experience',
  backgroundColor: '#1a1a2e',
  textColor: '#ffffff',
  accentColor: '#f59e0b',
  cardColor: '#16213e',
};

const schedules = [
  { label: 'Lunch', days: 'Mon - Sun', time: '11:00 AM - 3:00 PM', icon: '☀️' },
  { label: 'Dinner', days: 'Mon - Thu', time: '5:00 PM - 10:00 PM', icon: '🌙' },
  { label: 'Late Night', days: 'Fri - Sat', time: '5:00 PM - 11:00 PM', icon: '✨' },
  { label: 'Brunch', days: 'Sat - Sun', time: '10:00 AM - 2:00 PM', icon: '🍳' },
];

export const HoursModern: React.FC<HoursModernProps> & {
  craft: {
    props: HoursModernProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();

  return (
    <section
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      id={sectionAnchorId(mergedProps.sectionId, 'openingHours')}
      className="hb-section-padding"
      style={{
        backgroundColor: mergedProps.backgroundColor,
        color: mergedProps.textColor,
        padding: '80px 40px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '16px' }}>{mergedProps.title}</h2>
          <p style={{ fontSize: '18px', opacity: 0.7 }}>{mergedProps.subtitle}</p>
        </div>

        <div className="hb-hours-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
          {schedules.map((item, i) => (
            <div key={i} style={{ backgroundColor: mergedProps.cardColor, borderRadius: '16px', padding: '28px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '16px' }}>{item.icon}</div>
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: mergedProps.accentColor }}>{item.label}</h3>
              <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '12px' }}>{item.days}</p>
              <p style={{ fontSize: '16px', fontWeight: 600 }}>{item.time}</p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '40px', padding: '20px', backgroundColor: mergedProps.cardColor, borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '12px', margin: '40px auto 0', left: '50%', position: 'relative', transform: 'translateX(-50%)' }}>
          <Clock size={20} style={{ color: mergedProps.accentColor }} />
          <span style={{ opacity: 0.8 }}>Reservations recommended for dinner service</span>
        </div>
      </div>
    </section>
  );
};

const HoursModernSettings: React.FC = () => {
  const { actions: { setProp }, ...props } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title,
    subtitle: node.data.props.subtitle,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    accentColor: node.data.props.accentColor,
    cardColor: node.data.props.cardColor,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput label="Title" propKey="title" value={props.title} onChange={(v) => setProp((p: HoursModernProps) => (p.title = v))} nodeProps={props.nodeProps} setProp={setProp} />
      <TranslatableInput label="Subtitle" propKey="subtitle" value={props.subtitle || ''} onChange={(v) => setProp((p: HoursModernProps) => (p.subtitle = v))} nodeProps={props.nodeProps} setProp={setProp} />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={props.backgroundColor} onChange={(e) => setProp((p: HoursModernProps) => (p.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={props.textColor} onChange={(e) => setProp((p: HoursModernProps) => (p.textColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Card Color</Label>
          <Input type="color" value={props.cardColor} onChange={(e) => setProp((p: HoursModernProps) => (p.cardColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Accent Color</Label>
          <Input type="color" value={props.accentColor} onChange={(e) => setProp((p: HoursModernProps) => (p.accentColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
};

HoursModern.craft = {
  props: defaultProps,
  related: { settings: HoursModernSettings },
  displayName: 'Hours Modern',
};
