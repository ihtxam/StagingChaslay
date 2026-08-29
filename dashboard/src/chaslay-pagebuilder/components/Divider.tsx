// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { DividerProps } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/chaslay-pagebuilder/ui/select';
import { Slider } from '@/chaslay-pagebuilder/ui/slider';

const defaultProps: DividerProps = {
  color: '#e5e7eb',
  thickness: 1,
  style: 'solid',
  width: '100%',
  marginTop: 20,
  marginBottom: 20,
};

export const Divider: React.FC<DividerProps> & {
  craft: {
    props: DividerProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();

  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      className="hb-divider"
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        paddingTop: `${mergedProps.marginTop}px`,
        paddingBottom: `${mergedProps.marginBottom}px`,
        boxSizing: 'border-box',
      }}
    >
      <hr
        style={{
          width: mergedProps.width,
          border: 'none',
          borderTop: `${mergedProps.thickness}px ${mergedProps.style} ${mergedProps.color}`,
          margin: 0,
        }}
      />
    </div>
  );
};

const DividerSettings: React.FC = () => {
  const { actions: { setProp }, color, thickness, style, width, marginTop, marginBottom } = useNode((node) => ({
    color: node.data.props.color ?? defaultProps.color,
    thickness: node.data.props.thickness ?? defaultProps.thickness,
    style: node.data.props.style ?? defaultProps.style,
    width: node.data.props.width ?? defaultProps.width,
    marginTop: node.data.props.marginTop ?? defaultProps.marginTop,
    marginBottom: node.data.props.marginBottom ?? defaultProps.marginBottom,
  }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Color</Label>
        <Input type="color" value={color} onChange={(e) => setProp((p: DividerProps) => (p.color = e.target.value))} className="h-10 w-full" />
      </div>

      <div className="space-y-2">
        <Label>Thickness ({thickness}px)</Label>
        <Slider value={[thickness]} onValueChange={([v]) => setProp((p: DividerProps) => (p.thickness = v))} min={1} max={10} step={1} />
      </div>

      <div className="space-y-2">
        <Label>Style</Label>
        <Select value={style} onValueChange={(v) => setProp((p: DividerProps) => (p.style = v as DividerProps['style']))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="solid">Solid</SelectItem>
            <SelectItem value="dashed">Dashed</SelectItem>
            <SelectItem value="dotted">Dotted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Width</Label>
        <Select value={width} onValueChange={(v) => setProp((p: DividerProps) => (p.width = v as DividerProps['width']))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="25%">25%</SelectItem>
            <SelectItem value="50%">50%</SelectItem>
            <SelectItem value="75%">75%</SelectItem>
            <SelectItem value="100%">100%</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Margin Top ({marginTop}px)</Label>
        <Slider value={[marginTop]} onValueChange={([v]) => setProp((p: DividerProps) => (p.marginTop = v))} min={0} max={100} step={5} />
      </div>

      <div className="space-y-2">
        <Label>Margin Bottom ({marginBottom}px)</Label>
        <Slider value={[marginBottom]} onValueChange={([v]) => setProp((p: DividerProps) => (p.marginBottom = v))} min={0} max={100} step={5} />
      </div>
    </div>
  );
};

Divider.craft = {
  props: defaultProps,
  related: { settings: DividerSettings },
  displayName: 'Divider',
};
