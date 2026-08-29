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

const defaultProps: SocialMediaProps = {
  title: '',
  facebook: 'https://facebook.com',
  instagram: 'https://instagram.com',
  twitter: '',
  tiktok: '',
  youtube: '',
  google: '',
  iconSize: 20,
  iconColor: '#ffffff',
  backgroundColor: '#1a1a2e',
  textColor: '#ffffff',
  showLabels: false,
  iconStyle: 'circle',
  gap: 8,
  alignment: 'right',
};

export const SocialMediaFloating: React.FC<SocialMediaProps> & {
  craft: {
    props: SocialMediaProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();

  const activeLinks = socialPlatforms.filter((p) => mergedProps[p.key as keyof SocialMediaProps]);
  const isRight = mergedProps.alignment !== 'left';

  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      className="hb-social-floating"
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '60px',
        boxSizing: 'border-box',
      }}
    >
      {/* Preview indicator in editor */}
      <div style={{
        padding: '16px 20px',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        textAlign: 'center',
        fontSize: '13px',
        color: '#6b7280',
      }}>
        Floating Social Bar — appears fixed on {isRight ? 'right' : 'left'} side when published
      </div>

      {/* Floating sidebar preview */}
      <div style={{
        position: 'absolute',
        top: '8px',
        [isRight ? 'right' : 'left']: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: `${mergedProps.gap}px`,
        backgroundColor: mergedProps.backgroundColor,
        padding: '12px 8px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}>
        {activeLinks.map(({ key, Icon }) => (
          <a
            key={key}
            href={mergedProps[key as keyof SocialMediaProps] as string}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: `${(mergedProps.iconSize || 20) + 12}px`,
              height: `${(mergedProps.iconSize || 20) + 12}px`,
              borderRadius: mergedProps.iconStyle === 'square' ? '6px' : '50%',
              backgroundColor: mergedProps.iconStyle !== 'plain' ? 'rgba(255,255,255,0.15)' : 'transparent',
              transition: 'opacity 0.2s',
            }}
          >
            <Icon size={mergedProps.iconSize} color={mergedProps.iconColor} />
          </a>
        ))}
      </div>
    </div>
  );
};

const SocialMediaFloatingSettings: React.FC = () => {
  const { actions: { setProp }, ...p } = useNode((node) => ({
    facebook: node.data.props.facebook ?? '',
    instagram: node.data.props.instagram ?? '',
    twitter: node.data.props.twitter ?? '',
    tiktok: node.data.props.tiktok ?? '',
    youtube: node.data.props.youtube ?? '',
    google: node.data.props.google ?? '',
    iconSize: node.data.props.iconSize ?? defaultProps.iconSize,
    iconColor: node.data.props.iconColor ?? defaultProps.iconColor,
    backgroundColor: node.data.props.backgroundColor ?? defaultProps.backgroundColor,
    iconStyle: node.data.props.iconStyle ?? defaultProps.iconStyle,
    gap: node.data.props.gap ?? defaultProps.gap,
    alignment: node.data.props.alignment ?? defaultProps.alignment,
  }));

  return (
    <div className="space-y-4">
      <div className="border-b pb-4 space-y-3">
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

      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Position</Label>
          <Select value={p.alignment} onValueChange={(v) => setProp((props: SocialMediaProps) => (props.alignment = v as SocialMediaProps['alignment']))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Icon Size ({p.iconSize}px)</Label>
          <Slider value={[p.iconSize]} onValueChange={([v]) => setProp((props: SocialMediaProps) => (props.iconSize = v))} min={16} max={36} step={2} />
        </div>

        <div className="space-y-2">
          <Label>Icon Color</Label>
          <Input type="color" value={p.iconColor} onChange={(e) => setProp((props: SocialMediaProps) => (props.iconColor = e.target.value))} className="h-10 w-full" />
        </div>

        <div className="space-y-2">
          <Label>Background Color</Label>
          <Input type="color" value={p.backgroundColor} onChange={(e) => setProp((props: SocialMediaProps) => (props.backgroundColor = e.target.value))} className="h-10 w-full" />
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
          <Label>Gap ({p.gap}px)</Label>
          <Slider value={[p.gap]} onValueChange={([v]) => setProp((props: SocialMediaProps) => (props.gap = v))} min={4} max={24} step={2} />
        </div>
      </div>
    </div>
  );
};

SocialMediaFloating.craft = {
  props: defaultProps,
  related: { settings: SocialMediaFloatingSettings },
  displayName: 'Social Media Floating',
};
