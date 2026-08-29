// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Textarea } from '@/chaslay-pagebuilder/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/chaslay-pagebuilder/ui/select';
import { TextFormatToolbar } from './TextFormatToolbar';
import { TranslatableInput } from './TranslatableInput';

export interface HeroMinimalProps {
  title?: string;
  titleFontSize?: number;
  titleFontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  titleFontStyle?: 'normal' | 'italic';
  subtitle?: string;
  subtitleFontSize?: number;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  paddingY?: number;
  showDivider?: boolean;
}

const defaultProps: HeroMinimalProps = {
  title: 'Welcome to Our Restaurant',
  titleFontSize: 56,
  titleFontWeight: 'normal',
  titleFontStyle: 'normal',
  subtitle: 'Serving delicious food since 1990',
  subtitleFontSize: 20,
  backgroundColor: '#faf9f6',
  textColor: '#1a1a2e',
  accentColor: '#e94560',
  textAlign: 'center',
  paddingY: 80,
  showDivider: true,
};

const fontWeightMap: Record<string, number> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

export const HeroMinimal: React.FC<HeroMinimalProps> & {
  craft: {
    props: HeroMinimalProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const {
    connectors: { connect, drag },
  } = useNode();

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref));
      }}
      className="hb-hero hb-section-padding"
      style={{
        backgroundColor: mergedProps.backgroundColor,
        padding: `${mergedProps.paddingY}px 20px`,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="hb-hero-content"
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          textAlign: mergedProps.textAlign,
          padding: '0 16px',
          boxSizing: 'border-box',
        }}
      >
        <h1
          style={{
            fontSize: `${mergedProps.titleFontSize}px`,
            fontWeight: fontWeightMap[mergedProps.titleFontWeight || 'normal'],
            fontStyle: mergedProps.titleFontStyle || 'normal',
            color: mergedProps.textColor,
            lineHeight: 1.2,
            marginBottom: '24px',
            letterSpacing: '-1px',
          }}
        >
          {mergedProps.title}
        </h1>

        {mergedProps.showDivider && (
          <div
            style={{
              width: '60px',
              height: '3px',
              backgroundColor: mergedProps.accentColor,
              margin: mergedProps.textAlign === 'center' ? '0 auto 24px' : '0 0 24px',
              marginLeft: mergedProps.textAlign === 'right' ? 'auto' : undefined,
            }}
          />
        )}

        {mergedProps.subtitle && (
          <p
            style={{
              fontSize: `${mergedProps.subtitleFontSize}px`,
              color: mergedProps.textColor,
              opacity: 0.7,
              fontWeight: 400,
              lineHeight: 1.6,
            }}
          >
            {mergedProps.subtitle}
          </p>
        )}
      </div>
    </div>
  );
};

const HeroMinimalSettings: React.FC = () => {
  const {
    actions: { setProp },
    nodeProps,
    title,
    titleFontSize,
    titleFontWeight,
    titleFontStyle,
    subtitle,
    subtitleFontSize,
    backgroundColor,
    textColor,
    accentColor,
    textAlign,
    paddingY,
    showDivider,
  } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title,
    titleFontSize: node.data.props.titleFontSize ?? defaultProps.titleFontSize,
    titleFontWeight: node.data.props.titleFontWeight ?? defaultProps.titleFontWeight,
    titleFontStyle: node.data.props.titleFontStyle ?? defaultProps.titleFontStyle,
    subtitle: node.data.props.subtitle,
    subtitleFontSize: node.data.props.subtitleFontSize ?? defaultProps.subtitleFontSize,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    accentColor: node.data.props.accentColor,
    textAlign: node.data.props.textAlign,
    paddingY: node.data.props.paddingY,
    showDivider: node.data.props.showDivider,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput
        label="Title"
        propKey="title"
        value={title}
        onChange={(v) => setProp((props: HeroMinimalProps) => (props.title = v))}
        nodeProps={nodeProps}
        setProp={setProp}
      />

      <TextFormatToolbar
        label="Title Formatting"
        fontSize={titleFontSize}
        fontWeight={titleFontWeight}
        fontStyle={titleFontStyle}
        onFontSizeChange={(size) => setProp((props: HeroMinimalProps) => (props.titleFontSize = size))}
        onFontWeightChange={(weight) => setProp((props: HeroMinimalProps) => (props.titleFontWeight = weight))}
        onFontStyleChange={(style) => setProp((props: HeroMinimalProps) => (props.titleFontStyle = style))}
      />

      <TranslatableInput
        label="Subtitle"
        propKey="subtitle"
        value={subtitle}
        onChange={(v) => setProp((props: HeroMinimalProps) => (props.subtitle = v))}
        nodeProps={nodeProps}
        setProp={setProp}
        multiline
        rows={2}
      />

      <div className="space-y-2">
        <Label>Subtitle Font Size</Label>
        <Input
          type="number"
          value={subtitleFontSize}
          onChange={(e) => setProp((props: HeroMinimalProps) => (props.subtitleFontSize = parseInt(e.target.value) || 20))}
        />
      </div>

      <div className="space-y-2">
        <Label>Text Alignment</Label>
        <Select
          value={textAlign}
          onValueChange={(value) => setProp((props: HeroMinimalProps) => (props.textAlign = value as 'left' | 'center' | 'right'))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Background Color</Label>
        <Input
          type="color"
          value={backgroundColor}
          onChange={(e) => setProp((props: HeroMinimalProps) => (props.backgroundColor = e.target.value))}
          className="h-10 w-full"
        />
      </div>

      <div className="space-y-2">
        <Label>Text Color</Label>
        <Input
          type="color"
          value={textColor}
          onChange={(e) => setProp((props: HeroMinimalProps) => (props.textColor = e.target.value))}
          className="h-10 w-full"
        />
      </div>

      <div className="space-y-2">
        <Label>Accent Color (Divider)</Label>
        <Input
          type="color"
          value={accentColor}
          onChange={(e) => setProp((props: HeroMinimalProps) => (props.accentColor = e.target.value))}
          className="h-10 w-full"
        />
      </div>

      <div className="space-y-2">
        <Label>Vertical Padding (px)</Label>
        <Input
          type="number"
          value={paddingY}
          onChange={(e) => setProp((props: HeroMinimalProps) => (props.paddingY = parseInt(e.target.value) || 80))}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>Show Divider</Label>
        <input
          type="checkbox"
          checked={showDivider}
          onChange={(e) => setProp((props: HeroMinimalProps) => (props.showDivider = e.target.checked))}
          className="h-4 w-4"
        />
      </div>
    </div>
  );
};

HeroMinimal.craft = {
  props: defaultProps,
  related: {
    settings: HeroMinimalSettings,
  },
  displayName: 'Hero Minimal',
};
