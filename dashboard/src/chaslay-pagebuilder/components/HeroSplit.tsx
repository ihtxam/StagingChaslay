// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Textarea } from '@/chaslay-pagebuilder/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/chaslay-pagebuilder/ui/select';
import { ImageUpload } from './ImageUpload';
import { TextFormatToolbar } from './TextFormatToolbar';
import { normalizeLink } from '../utils/normalizeLink';
import { TranslatableInput } from './TranslatableInput';

export interface HeroSplitProps {
  title?: string;
  titleFontSize?: number;
  titleFontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  titleFontStyle?: 'normal' | 'italic';
  subtitle?: string;
  description?: string;
  descriptionFontSize?: number;
  image?: string;
  imagePosition?: 'left' | 'right';
  backgroundColor?: string;
  textColor?: string;
  buttonText?: string;
  buttonLink?: string;
  buttonColor?: string;
  minHeight?: number;
}

const defaultProps: HeroSplitProps = {
  title: 'Delicious Food Delivered',
  titleFontSize: 42,
  titleFontWeight: 'bold',
  titleFontStyle: 'normal',
  subtitle: 'Fresh & Fast',
  description: 'Order your favorite meals from the comfort of your home. We deliver hot and fresh food right to your doorstep.',
  descriptionFontSize: 18,
  image: '',
  imagePosition: 'right',
  backgroundColor: '#ffffff',
  textColor: '#1a1a2e',
  buttonText: 'Order Now',
  buttonLink: '/menu',
  buttonColor: '#e94560',
  minHeight: 500,
};

const fontWeightMap: Record<string, number> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

export const HeroSplit: React.FC<HeroSplitProps> & {
  craft: {
    props: HeroSplitProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const {
    connectors: { connect, drag },
  } = useNode();

  const isImageLeft = mergedProps.imagePosition === 'left';

  return (
    <>
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref));
      }}
      className="hb-hero-split"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        minHeight: `${mergedProps.minHeight}px`,
        backgroundColor: mergedProps.backgroundColor,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Image Side */}
      {isImageLeft && (
        <div
          style={{
            backgroundColor: '#e9ecef',
            backgroundImage: mergedProps.image ? `url(${mergedProps.image})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6c757d',
            fontSize: '18px',
          }}
        >
          {!mergedProps.image && 'Image Placeholder'}
        </div>
      )}

      {/* Text Side */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '60px',
          color: mergedProps.textColor,
        }}
      >
        {mergedProps.subtitle && (
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '2px',
              color: mergedProps.buttonColor,
              marginBottom: '12px',
            }}
          >
            {mergedProps.subtitle}
          </span>
        )}
        <h1
          style={{
            fontSize: `${mergedProps.titleFontSize}px`,
            fontWeight: fontWeightMap[mergedProps.titleFontWeight || 'bold'],
            fontStyle: mergedProps.titleFontStyle || 'normal',
            lineHeight: 1.2,
            marginBottom: '20px',
          }}
        >
          {mergedProps.title}
        </h1>
        {mergedProps.description && (
          <p
            style={{
              fontSize: `${mergedProps.descriptionFontSize}px`,
              lineHeight: 1.7,
              opacity: 0.8,
              marginBottom: '32px',
            }}
          >
            {mergedProps.description}
          </p>
        )}
        {mergedProps.buttonText && (
          <div>
            <button
              style={{
                backgroundColor: mergedProps.buttonColor,
                color: '#ffffff',
                padding: '14px 32px',
                fontSize: '16px',
                fontWeight: 600,
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              {mergedProps.buttonText}
            </button>
          </div>
        )}
      </div>

      {/* Image Side (Right) */}
      {!isImageLeft && (
        <div
          style={{
            backgroundColor: '#e9ecef',
            backgroundImage: mergedProps.image ? `url(${mergedProps.image})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6c757d',
            fontSize: '18px',
          }}
        >
          {!mergedProps.image && 'Image Placeholder'}
        </div>
      )}
    </div>
    <style>{`
      @container (max-width: 768px) {
        .hb-hero-split {
          grid-template-columns: 1fr !important;
        }
        .hb-hero-split > div:first-child {
          min-height: 300px;
        }
      }
    `}</style>
    </>
  );
};

const HeroSplitSettings: React.FC = () => {
  const {
    actions: { setProp },
    nodeProps,
    title,
    titleFontSize,
    titleFontWeight,
    titleFontStyle,
    subtitle,
    description,
    descriptionFontSize,
    image,
    imagePosition,
    backgroundColor,
    textColor,
    buttonText,
    buttonLink,
    buttonColor,
    minHeight,
  } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title,
    titleFontSize: node.data.props.titleFontSize ?? defaultProps.titleFontSize,
    titleFontWeight: node.data.props.titleFontWeight ?? defaultProps.titleFontWeight,
    titleFontStyle: node.data.props.titleFontStyle ?? defaultProps.titleFontStyle,
    subtitle: node.data.props.subtitle,
    description: node.data.props.description,
    descriptionFontSize: node.data.props.descriptionFontSize ?? defaultProps.descriptionFontSize,
    image: node.data.props.image,
    imagePosition: node.data.props.imagePosition,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    buttonText: node.data.props.buttonText,
    buttonLink: node.data.props.buttonLink,
    buttonColor: node.data.props.buttonColor,
    minHeight: node.data.props.minHeight,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput
        label="Subtitle (Tag)"
        propKey="subtitle"
        value={subtitle}
        onChange={(v) => setProp((props: HeroSplitProps) => (props.subtitle = v))}
        nodeProps={nodeProps}
        setProp={setProp}
        placeholder="Fresh & Fast"
      />

      <TranslatableInput
        label="Title"
        propKey="title"
        value={title}
        onChange={(v) => setProp((props: HeroSplitProps) => (props.title = v))}
        nodeProps={nodeProps}
        setProp={setProp}
      />

      <TextFormatToolbar
        label="Title Formatting"
        fontSize={titleFontSize}
        fontWeight={titleFontWeight}
        fontStyle={titleFontStyle}
        onFontSizeChange={(size) => setProp((props: HeroSplitProps) => (props.titleFontSize = size))}
        onFontWeightChange={(weight) => setProp((props: HeroSplitProps) => (props.titleFontWeight = weight))}
        onFontStyleChange={(style) => setProp((props: HeroSplitProps) => (props.titleFontStyle = style))}
      />

      <TranslatableInput
        label="Description"
        propKey="description"
        value={description}
        onChange={(v) => setProp((props: HeroSplitProps) => (props.description = v))}
        nodeProps={nodeProps}
        setProp={setProp}
        multiline
        rows={3}
      />

      <div className="space-y-2">
        <Label>Description Font Size</Label>
        <Input
          type="number"
          value={descriptionFontSize}
          onChange={(e) => setProp((props: HeroSplitProps) => (props.descriptionFontSize = parseInt(e.target.value) || 18))}
        />
      </div>

      <ImageUpload
        label="Image"
        value={image}
        onChange={(value) => setProp((props: HeroSplitProps) => (props.image = value))}
        aspectRatio="square"
      />

      <div className="space-y-2">
        <Label>Image Position</Label>
        <Select
          value={imagePosition}
          onValueChange={(value) => setProp((props: HeroSplitProps) => (props.imagePosition = value as 'left' | 'right'))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Background Color</Label>
        <Input
          type="color"
          value={backgroundColor}
          onChange={(e) => setProp((props: HeroSplitProps) => (props.backgroundColor = e.target.value))}
          className="h-10 w-full"
        />
      </div>

      <div className="space-y-2">
        <Label>Text Color</Label>
        <Input
          type="color"
          value={textColor}
          onChange={(e) => setProp((props: HeroSplitProps) => (props.textColor = e.target.value))}
          className="h-10 w-full"
        />
      </div>

      <TranslatableInput
        label="Button Text"
        propKey="buttonText"
        value={buttonText}
        onChange={(v) => setProp((props: HeroSplitProps) => (props.buttonText = v))}
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
            setProp((props: HeroSplitProps) => (props.buttonLink = val));
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>Button Color</Label>
        <Input
          type="color"
          value={buttonColor}
          onChange={(e) => setProp((props: HeroSplitProps) => (props.buttonColor = e.target.value))}
          className="h-10 w-full"
        />
      </div>

      <div className="space-y-2">
        <Label>Min Height (px)</Label>
        <Input
          type="number"
          value={minHeight}
          onChange={(e) => setProp((props: HeroSplitProps) => (props.minHeight = parseInt(e.target.value) || 500))}
        />
      </div>
    </div>
  );
};

HeroSplit.craft = {
  props: defaultProps,
  related: {
    settings: HeroSplitSettings,
  },
  displayName: 'Hero Split',
};
