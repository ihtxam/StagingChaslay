// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { LocationMapProps } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Slider } from '@/chaslay-pagebuilder/ui/slider';
import { TranslatableInput } from './TranslatableInput';
import { sectionAnchorId, SECTION_ANCHORS } from '../utils/section-id';

const defaultProps: LocationMapProps = {
  sectionId: SECTION_ANCHORS.map,
  title: 'Find Us',
  address: '123 Main Street, New York, NY 10001',
  height: 400,
  borderRadius: 0,
  backgroundColor: '#ffffff',
  textColor: '#1a1a2e',
  showTitle: true,
};

export const LocationMap: React.FC<LocationMapProps> & {
  craft: {
    props: LocationMapProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();

  const encodedAddress = encodeURIComponent(mergedProps.address || '');
  const mapSrc = `https://maps.google.com/maps?q=${encodedAddress}&output=embed`;

  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      id={sectionAnchorId(mergedProps.sectionId, 'map')}
      className="hb-section hb-section-padding"
      style={{
        backgroundColor: mergedProps.backgroundColor,
        width: '100%',
        boxSizing: 'border-box',
        padding: '48px 20px',
      }}
    >
      {mergedProps.showTitle && mergedProps.title && (
        <h3 style={{
          color: mergedProps.textColor,
          fontSize: '28px',
          fontWeight: 600,
          textAlign: 'center',
          marginBottom: '32px',
        }}>
          {mergedProps.title}
        </h3>
      )}
      <div style={{
        maxWidth: '1100px',
        margin: '0 auto',
        borderRadius: `${mergedProps.borderRadius}px`,
        overflow: 'hidden',
      }}>
        <iframe
          src={mapSrc}
          width="100%"
          height={mergedProps.height}
          style={{ border: 0, display: 'block' }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={mergedProps.title || 'Location Map'}
        />
      </div>
    </div>
  );
};

const LocationMapSettings: React.FC = () => {
  const { actions: { setProp }, ...p } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title ?? defaultProps.title,
    address: node.data.props.address ?? defaultProps.address,
    height: node.data.props.height ?? defaultProps.height,
    borderRadius: node.data.props.borderRadius ?? defaultProps.borderRadius,
    backgroundColor: node.data.props.backgroundColor ?? defaultProps.backgroundColor,
    textColor: node.data.props.textColor ?? defaultProps.textColor,
    showTitle: node.data.props.showTitle ?? defaultProps.showTitle,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Show Title</Label>
        <input type="checkbox" checked={p.showTitle} onChange={(e) => setProp((props: LocationMapProps) => (props.showTitle = e.target.checked))} className="h-4 w-4" />
      </div>

      {p.showTitle && (
        <TranslatableInput label="Title" propKey="title" value={p.title} onChange={(v) => setProp((props: LocationMapProps) => (props.title = v))} nodeProps={p.nodeProps} setProp={setProp} />
      )}

      <div className="space-y-2">
        <Label>Address</Label>
        <Input value={p.address} onChange={(e) => setProp((props: LocationMapProps) => (props.address = e.target.value))} placeholder="Enter address..." />
        <p className="text-xs text-muted-foreground">Enter the full address to show on the map</p>
      </div>

      <div className="space-y-2">
        <Label>Map Height ({p.height}px)</Label>
        <Slider value={[p.height]} onValueChange={([v]) => setProp((props: LocationMapProps) => (props.height = v))} min={200} max={600} step={25} />
      </div>

      <div className="space-y-2">
        <Label>Border Radius ({p.borderRadius}px)</Label>
        <Slider value={[p.borderRadius]} onValueChange={([v]) => setProp((props: LocationMapProps) => (props.borderRadius = v))} min={0} max={24} step={2} />
      </div>

      <div className="space-y-2">
        <Label>Background Color</Label>
        <Input type="color" value={p.backgroundColor} onChange={(e) => setProp((props: LocationMapProps) => (props.backgroundColor = e.target.value))} className="h-10 w-full" />
      </div>

      <div className="space-y-2">
        <Label>Text Color</Label>
        <Input type="color" value={p.textColor} onChange={(e) => setProp((props: LocationMapProps) => (props.textColor = e.target.value))} className="h-10 w-full" />
      </div>
    </div>
  );
};

LocationMap.craft = {
  props: defaultProps,
  related: { settings: LocationMapSettings },
  displayName: 'Location Map',
};
