// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { SpacerProps } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Slider } from '@/chaslay-pagebuilder/ui/slider';

const defaultProps: SpacerProps = {
  height: 40,
  backgroundColor: 'transparent',
};

export const Spacer: React.FC<SpacerProps> & {
  craft: {
    props: SpacerProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();

  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      className="hb-spacer"
      style={{
        width: '100%',
        height: `${mergedProps.height}px`,
        backgroundColor: mergedProps.backgroundColor,
        boxSizing: 'border-box',
      }}
    />
  );
};

const SpacerSettings: React.FC = () => {
  const { actions: { setProp }, height, backgroundColor } = useNode((node) => ({
    height: node.data.props.height ?? defaultProps.height,
    backgroundColor: node.data.props.backgroundColor ?? defaultProps.backgroundColor,
  }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Height ({height}px)</Label>
        <Slider value={[height]} onValueChange={([v]) => setProp((p: SpacerProps) => (p.height = v))} min={10} max={200} step={5} />
      </div>

      <div className="space-y-2">
        <Label>Background Color</Label>
        <div className="flex gap-2">
          <Input type="color" value={backgroundColor === 'transparent' ? '#ffffff' : backgroundColor} onChange={(e) => setProp((p: SpacerProps) => (p.backgroundColor = e.target.value))} className="h-10 flex-1" />
          <button
            onClick={() => setProp((p: SpacerProps) => (p.backgroundColor = 'transparent'))}
            className="px-3 text-xs border rounded hover:bg-muted transition-colors"
          >
            Transparent
          </button>
        </div>
      </div>
    </div>
  );
};

Spacer.craft = {
  props: defaultProps,
  related: { settings: SpacerSettings },
  displayName: 'Spacer',
};
