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
import { normalizeLink } from '../utils/normalizeLink';
import { useStorefront } from '../StorefrontContext';
import { resolveTranslatedProp } from '../utils/resolve-translated-prop';
import { sectionAnchorId, SECTION_ANCHORS } from '../utils/section-id';

export interface HeroGradientProps {
  title?: string;
  titleFontSize?: number;
  titleFontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  titleFontStyle?: 'normal' | 'italic';
  subtitle?: string;
  subtitleFontSize?: number;
  gradientFrom?: string;
  gradientTo?: string;
  gradientDirection?: 'to-r' | 'to-l' | 'to-b' | 'to-t' | 'to-br' | 'to-bl';
  textColor?: string;
  buttonText?: string;
  buttonLink?: string;
  buttonStyle?: 'solid' | 'outline';
  minHeight?: number;
  textAlign?: 'left' | 'center' | 'right';
}

const defaultProps: HeroGradientProps = {
  sectionId: SECTION_ANCHORS.home,
  title: 'Taste the Difference',
  titleFontSize: 52,
  titleFontWeight: 'bold',
  titleFontStyle: 'normal',
  subtitle: 'Fresh ingredients, authentic recipes, unforgettable flavors. Order now and experience culinary excellence.',
  subtitleFontSize: 20,
  gradientFrom: '#667eea',
  gradientTo: '#764ba2',
  gradientDirection: 'to-br',
  textColor: '#ffffff',
  buttonText: 'View Menu',
  buttonLink: '/menu',
  buttonStyle: 'outline',
  minHeight: 450,
  textAlign: 'center',
};

const fontWeightMap: Record<string, number> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

const gradientDirections: Record<string, string> = {
  'to-r': 'to right',
  'to-l': 'to left',
  'to-b': 'to bottom',
  'to-t': 'to top',
  'to-br': 'to bottom right',
  'to-bl': 'to bottom left',
};

export const HeroGradient: React.FC<HeroGradientProps> & {
  craft: {
    props: HeroGradientProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const {
    connectors: { connect, drag },
  } = useNode();
  const { shopHref, locale, defaultLanguage } = useStorefront();
  const title =
    resolveTranslatedProp(mergedProps as Record<string, unknown>, 'title', locale, defaultLanguage) ||
    mergedProps.title;
  const subtitle =
    resolveTranslatedProp(mergedProps as Record<string, unknown>, 'subtitle', locale, defaultLanguage) ||
    mergedProps.subtitle;
  const buttonText =
    resolveTranslatedProp(mergedProps as Record<string, unknown>, 'buttonText', locale, defaultLanguage) ||
    mergedProps.buttonText;

  const gradientStyle = `linear-gradient(${gradientDirections[mergedProps.gradientDirection || 'to-br']}, ${mergedProps.gradientFrom}, ${mergedProps.gradientTo})`;

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref));
      }}
      id={sectionAnchorId(mergedProps.sectionId, 'home')}
      className="hb-hero"
      style={{
        background: gradientStyle,
        minHeight: `${mergedProps.minHeight}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          maxWidth: '700px',
          textAlign: mergedProps.textAlign,
        }}
      >
        <h1
          style={{
            fontSize: `${mergedProps.titleFontSize}px`,
            fontWeight: fontWeightMap[mergedProps.titleFontWeight || 'bold'],
            fontStyle: mergedProps.titleFontStyle || 'normal',
            color: mergedProps.textColor,
            lineHeight: 1.15,
            marginBottom: '24px',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: `${mergedProps.subtitleFontSize}px`,
              color: mergedProps.textColor,
              opacity: 0.9,
              lineHeight: 1.7,
              marginBottom: '36px',
            }}
          >
            {subtitle}
          </p>
        )}
        {buttonText && (
          <a
            href={shopHref(mergedProps.buttonLink || '/menu')}
            style={{
              display: 'inline-block',
              backgroundColor: mergedProps.buttonStyle === 'solid' ? mergedProps.textColor : 'transparent',
              color: mergedProps.buttonStyle === 'solid' ? mergedProps.gradientFrom : mergedProps.textColor,
              padding: '16px 40px',
              fontSize: '16px',
              fontWeight: 600,
              border: mergedProps.buttonStyle === 'outline' ? `2px solid ${mergedProps.textColor}` : 'none',
              borderRadius: '50px',
              cursor: 'pointer',
              textDecoration: 'none',
              transition: 'all 0.3s',
            }}
          >
            {buttonText}
          </a>
        )}
      </div>
    </div>
  );
};

const HeroGradientSettings: React.FC = () => {
  const {
    actions: { setProp },
    nodeProps,
    title,
    titleFontSize,
    titleFontWeight,
    titleFontStyle,
    subtitle,
    subtitleFontSize,
    gradientFrom,
    gradientTo,
    gradientDirection,
    textColor,
    buttonText,
    buttonLink,
    buttonStyle,
    minHeight,
    textAlign,
  } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title,
    titleFontSize: node.data.props.titleFontSize ?? defaultProps.titleFontSize,
    titleFontWeight: node.data.props.titleFontWeight ?? defaultProps.titleFontWeight,
    titleFontStyle: node.data.props.titleFontStyle ?? defaultProps.titleFontStyle,
    subtitle: node.data.props.subtitle,
    subtitleFontSize: node.data.props.subtitleFontSize ?? defaultProps.subtitleFontSize,
    gradientFrom: node.data.props.gradientFrom,
    gradientTo: node.data.props.gradientTo,
    gradientDirection: node.data.props.gradientDirection,
    textColor: node.data.props.textColor,
    buttonText: node.data.props.buttonText,
    buttonLink: node.data.props.buttonLink,
    buttonStyle: node.data.props.buttonStyle,
    minHeight: node.data.props.minHeight,
    textAlign: node.data.props.textAlign,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput
        label="Title"
        propKey="title"
        value={title}
        onChange={(v) => setProp((props: HeroGradientProps) => (props.title = v))}
        nodeProps={nodeProps}
        setProp={setProp}
      />

      <TextFormatToolbar
        label="Title Formatting"
        fontSize={titleFontSize}
        fontWeight={titleFontWeight}
        fontStyle={titleFontStyle}
        onFontSizeChange={(size) => setProp((props: HeroGradientProps) => (props.titleFontSize = size))}
        onFontWeightChange={(weight) => setProp((props: HeroGradientProps) => (props.titleFontWeight = weight))}
        onFontStyleChange={(style) => setProp((props: HeroGradientProps) => (props.titleFontStyle = style))}
      />

      <TranslatableInput
        label="Subtitle"
        propKey="subtitle"
        value={subtitle}
        onChange={(v) => setProp((props: HeroGradientProps) => (props.subtitle = v))}
        nodeProps={nodeProps}
        setProp={setProp}
        multiline
        rows={3}
      />

      <div className="space-y-2">
        <Label>Subtitle Font Size</Label>
        <Input
          type="number"
          value={subtitleFontSize}
          onChange={(e) => setProp((props: HeroGradientProps) => (props.subtitleFontSize = parseInt(e.target.value) || 20))}
        />
      </div>

      <div className="space-y-2">
        <Label>Gradient Start Color</Label>
        <Input
          type="color"
          value={gradientFrom}
          onChange={(e) => setProp((props: HeroGradientProps) => (props.gradientFrom = e.target.value))}
          className="h-10 w-full"
        />
      </div>

      <div className="space-y-2">
        <Label>Gradient End Color</Label>
        <Input
          type="color"
          value={gradientTo}
          onChange={(e) => setProp((props: HeroGradientProps) => (props.gradientTo = e.target.value))}
          className="h-10 w-full"
        />
      </div>

      <div className="space-y-2">
        <Label>Gradient Direction</Label>
        <Select
          value={gradientDirection}
          onValueChange={(value) => setProp((props: HeroGradientProps) => (props.gradientDirection = value as HeroGradientProps['gradientDirection']))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="to-r">Left to Right</SelectItem>
            <SelectItem value="to-l">Right to Left</SelectItem>
            <SelectItem value="to-b">Top to Bottom</SelectItem>
            <SelectItem value="to-t">Bottom to Top</SelectItem>
            <SelectItem value="to-br">Top-Left to Bottom-Right</SelectItem>
            <SelectItem value="to-bl">Top-Right to Bottom-Left</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Text Color</Label>
        <Input
          type="color"
          value={textColor}
          onChange={(e) => setProp((props: HeroGradientProps) => (props.textColor = e.target.value))}
          className="h-10 w-full"
        />
      </div>

      <div className="space-y-2">
        <Label>Text Alignment</Label>
        <Select
          value={textAlign}
          onValueChange={(value) => setProp((props: HeroGradientProps) => (props.textAlign = value as 'left' | 'center' | 'right'))}
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

      <TranslatableInput
        label="Button Text"
        propKey="buttonText"
        value={buttonText}
        onChange={(v) => setProp((props: HeroGradientProps) => (props.buttonText = v))}
        nodeProps={nodeProps}
        setProp={setProp}
      />

      <div className="space-y-2">
        <Label>Button Link</Label>
        <Input
          value={buttonLink}
          placeholder="/menu, /shop, /about"
          onChange={(e) => {
            const val = normalizeLink(e.target.value);
            setProp((props: HeroGradientProps) => (props.buttonLink = val));
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>Button Style</Label>
        <Select
          value={buttonStyle}
          onValueChange={(value) => setProp((props: HeroGradientProps) => (props.buttonStyle = value as 'solid' | 'outline'))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="solid">Solid</SelectItem>
            <SelectItem value="outline">Outline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Min Height (px)</Label>
        <Input
          type="number"
          value={minHeight}
          onChange={(e) => setProp((props: HeroGradientProps) => (props.minHeight = parseInt(e.target.value) || 450))}
        />
      </div>
    </div>
  );
};

HeroGradient.craft = {
  props: defaultProps,
  related: {
    settings: HeroGradientSettings,
  },
  displayName: 'Hero Gradient',
};
