// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { StatsCounterProps, StatItem } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { TranslatableInput, TranslatableArrayInput } from './TranslatableInput';

const defaultStats: StatItem[] = [
  { value: 15, label: 'Years of Experience', suffix: '+' },
  { value: 200, label: 'Dishes on Menu', suffix: '+' },
  { value: 50000, label: 'Happy Customers', suffix: '+' },
  { value: 12, label: 'Expert Chefs', suffix: '' },
];

const defaultProps: StatsCounterProps = {
  title: 'Our Numbers Speak',
  stats: defaultStats,
  backgroundColor: '#1a1a2e',
  textColor: '#ffffff',
  accentColor: '#e94560',
};

export const StatsCounter: React.FC<StatsCounterProps> & {
  craft: {
    props: StatsCounterProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();

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
      {mergedProps.title && (
        <h3 style={{ color: mergedProps.textColor, fontSize: '28px', fontWeight: 600, textAlign: 'center', marginBottom: '48px' }}>
          {mergedProps.title}
        </h3>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min((mergedProps.stats || []).length, 5)}, 1fr)`,
        gap: '32px',
        maxWidth: '1000px',
        margin: '0 auto',
        textAlign: 'center',
      }}>
        {(mergedProps.stats || []).map((stat, i) => (
          <div key={i}>
            <div style={{ color: mergedProps.accentColor, fontSize: '42px', fontWeight: 700, marginBottom: '8px' }}>
              {stat.prefix || ''}{stat.value.toLocaleString()}{stat.suffix || ''}
            </div>
            <div style={{ color: mergedProps.textColor, opacity: 0.7, fontSize: '14px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1px' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const StatsCounterSettings: React.FC = () => {
  const { actions: { setProp }, ...p } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title ?? defaultProps.title,
    stats: node.data.props.stats ?? defaultProps.stats,
    backgroundColor: node.data.props.backgroundColor ?? defaultProps.backgroundColor,
    textColor: node.data.props.textColor ?? defaultProps.textColor,
    accentColor: node.data.props.accentColor ?? defaultProps.accentColor,
  }));

  const addStat = () => setProp((props: StatsCounterProps) => {
    props.stats = [...(props.stats || []), { value: 0, label: 'New Stat', suffix: '' }];
  });
  const removeStat = (i: number) => setProp((props: StatsCounterProps) => {
    props.stats = (props.stats || []).filter((_, idx) => idx !== i);
  });

  return (
    <div className="space-y-4">
      <TranslatableInput label="Title" propKey="title" value={p.title} onChange={(v) => setProp((props: StatsCounterProps) => (props.title = v))} nodeProps={p.nodeProps} setProp={setProp} />
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={p.backgroundColor} onChange={(e) => setProp((props: StatsCounterProps) => (props.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={p.textColor} onChange={(e) => setProp((props: StatsCounterProps) => (props.textColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Accent</Label>
          <Input type="color" value={p.accentColor} onChange={(e) => setProp((props: StatsCounterProps) => (props.accentColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <Label>Stats</Label>
          <Button variant="outline" size="sm" onClick={addStat}><Plus className="w-4 h-4" /></Button>
        </div>
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {(p.stats || []).map((stat: StatItem, i: number) => (
            <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
                <Button variant="ghost" size="sm" onClick={() => removeStat(i)} className="h-6 w-6 p-0 text-destructive"><Trash2 className="w-3 h-3" /></Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  type="number"
                  value={stat.value}
                  onChange={(e) => setProp((props: StatsCounterProps) => { if (props.stats) props.stats[i].value = parseInt(e.target.value) || 0; })}
                  placeholder="Value"
                  className="h-8 text-xs"
                />
                <Input
                  value={stat.prefix || ''}
                  onChange={(e) => setProp((props: StatsCounterProps) => { if (props.stats) props.stats[i].prefix = e.target.value; })}
                  placeholder="Prefix"
                  className="h-8 text-xs"
                />
                <Input
                  value={stat.suffix || ''}
                  onChange={(e) => setProp((props: StatsCounterProps) => { if (props.stats) props.stats[i].suffix = e.target.value; })}
                  placeholder="Suffix"
                  className="h-8 text-xs"
                />
              </div>
              <TranslatableArrayInput propKey="label" arrayPropKey="stats" index={i} nodeProps={p.nodeProps} setProp={setProp} value={stat.label} onChange={(v) => setProp((props: StatsCounterProps) => { if (props.stats) props.stats[i].label = v; })} placeholder="Label" className="h-8 text-xs" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

StatsCounter.craft = {
  props: defaultProps,
  related: { settings: StatsCounterSettings },
  displayName: 'Stats Counter',
};
