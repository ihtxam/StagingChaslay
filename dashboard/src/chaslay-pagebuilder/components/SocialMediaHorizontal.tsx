// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { SocialMediaProps } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/chaslay-pagebuilder/ui/select';
import { Slider } from '@/chaslay-pagebuilder/ui/slider';
import { socialPlatforms } from './social-icons';
import { TranslatableInput } from './TranslatableInput';

const defaultProps: SocialMediaProps = {
  title: 'Follow Us',
  facebook: 'https://facebook.com',
  instagram: 'https://instagram.com',
  twitter: '',
  tiktok: '',
  youtube: '',
  google: '',
  iconSize: 24,
  iconColor: '#ffffff',
  backgroundColor: '#1a1a2e',
  textColor: '#ffffff',
  showLabels: false,
  iconStyle: 'circle',
  gap: 16,
  alignment: 'center',
};

export const SocialMediaHorizontal: React.FC<SocialMediaProps> & {
  craft: {
    props: SocialMediaProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();

  const activeLinks = socialPlatforms.filter((p) => mergedProps[p.key as keyof SocialMediaProps]);

  const getIconContainerStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: `${(mergedProps.iconSize || 24) + 16}px`,
      height: `${(mergedProps.iconSize || 24) + 16}px`,
      transition: 'opacity 0.2s',
      cursor: 'pointer',
    };
    if (mergedProps.iconStyle === 'circle') {
      base.borderRadius = '50%';
      base.backgroundColor = 'rgba(255,255,255,0.15)';
    } else if (mergedProps.iconStyle === 'square') {
      base.borderRadius = '8px';
      base.backgroundColor = 'rgba(255,255,255,0.15)';
    }
    return base;
  };

  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      className="hb-section"
      style={{
        backgroundColor: mergedProps.backgroundColor,
        padding: '40px 20px',
        width: '100%',
        boxSizing: 'border-box',
        textAlign: mergedProps.alignment,
      }}
    >
      {mergedProps.title && (
        <h3 style={{ color: mergedProps.textColor, fontSize: '24px', fontWeight: 600, marginBottom: '24px' }}>
          {mergedProps.title}
        </h3>
      )}
      <div style={{ display: 'flex', gap: `${mergedProps.gap}px`, justifyContent: mergedProps.alignment, flexWrap: 'wrap', alignItems: 'center' }}>
        {activeLinks.map(({ key, label, Icon }) => (
          <a
            key={key}
            href={mergedProps[key as keyof SocialMediaProps] as string}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <div style={getIconContainerStyle()}>
              <Icon size={mergedProps.iconSize} color={mergedProps.iconColor} />
            </div>
            {mergedProps.showLabels && (
              <span style={{ color: mergedProps.textColor, fontSize: '14px' }}>{label}</span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
};

const SocialMediaHorizontalSettings: React.FC = () => {
  const { actions: { setProp }, ...p } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title ?? defaultProps.title,
    facebook: node.data.props.facebook ?? '',
    instagram: node.data.props.instagram ?? '',
    twitter: node.data.props.twitter ?? '',
    tiktok: node.data.props.tiktok ?? '',
    youtube: node.data.props.youtube ?? '',
    google: node.data.props.google ?? '',
    iconSize: node.data.props.iconSize ?? defaultProps.iconSize,
    iconColor: node.data.props.iconColor ?? defaultProps.iconColor,
    backgroundColor: node.data.props.backgroundColor ?? defaultProps.backgroundColor,
    textColor: node.data.props.textColor ?? defaultProps.textColor,
    showLabels: node.data.props.showLabels ?? defaultProps.showLabels,
    iconStyle: node.data.props.iconStyle ?? defaultProps.iconStyle,
    gap: node.data.props.gap ?? defaultProps.gap,
    alignment: node.data.props.alignment ?? defaultProps.alignment,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput label="Title" propKey="title" value={p.title} onChange={(v) => setProp((props: SocialMediaProps) => (props.title = v))} nodeProps={p.nodeProps} setProp={setProp} />

      <div className="border-t pt-4 space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Social Links</Label>
        {socialPlatforms.map(({ key, label }) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs">{label}</Label>
            <Input
              value={(p as unknown as Record<string, string>)[key] || ''}
              onChange={(e) => setProp((props: SocialMediaProps) => { (props as unknown as Record<string, string>)[key] = e.target.value; })}
              placeholder={`${label} URL`}
            />
          </div>
        ))}
      </div>

      <div className="border-t pt-4 space-y-3">
        <div className="space-y-2">
          <Label>Icon Size ({p.iconSize}px)</Label>
          <Slider value={[p.iconSize]} onValueChange={([v]) => setProp((props: SocialMediaProps) => (props.iconSize = v))} min={16} max={48} step={2} />
        </div>

        <div className="space-y-2">
          <Label>Icon Color</Label>
          <Input type="color" value={p.iconColor} onChange={(e) => setProp((props: SocialMediaProps) => (props.iconColor = e.target.value))} className="h-10 w-full" />
        </div>

        <div className="space-y-2">
          <Label>Icon Style</Label>
          <Select value={p.iconStyle} onValueChange={(v) => setProp((props: SocialMediaProps) => (props.iconStyle = v as SocialMediaProps['iconStyle']))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="circle">Circle</SelectItem>
              <SelectItem value="square">Square</SelectItem>
              <SelectItem value="plain">Plain</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Background Color</Label>
          <Input type="color" value={p.backgroundColor} onChange={(e) => setProp((props: SocialMediaProps) => (props.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>

        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={p.textColor} onChange={(e) => setProp((props: SocialMediaProps) => (props.textColor = e.target.value))} className="h-10 w-full" />
        </div>

        <div className="space-y-2">
          <Label>Alignment</Label>
          <Select value={p.alignment} onValueChange={(v) => setProp((props: SocialMediaProps) => (props.alignment = v as SocialMediaProps['alignment']))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Gap ({p.gap}px)</Label>
          <Slider value={[p.gap]} onValueChange={([v]) => setProp((props: SocialMediaProps) => (props.gap = v))} min={8} max={48} step={4} />
        </div>

        <div className="flex items-center justify-between">
          <Label>Show Labels</Label>
          <input type="checkbox" checked={p.showLabels} onChange={(e) => setProp((props: SocialMediaProps) => (props.showLabels = e.target.checked))} className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
};

SocialMediaHorizontal.craft = {
  props: defaultProps,
  related: { settings: SocialMediaHorizontalSettings },
  displayName: 'Social Media Horizontal',
};
