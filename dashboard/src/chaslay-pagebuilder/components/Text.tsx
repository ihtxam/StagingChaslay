// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { TextProps } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Textarea } from '@/chaslay-pagebuilder/ui/textarea';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/chaslay-pagebuilder/ui/select';
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/chaslay-pagebuilder/utils';
import { TranslatableInput } from './TranslatableInput';

const defaultProps: TextProps = {
  text: 'Edit this text',
  fontSize: 16,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textAlign: 'left',
  color: '#000000',
  marginBottom: 0,
  lineHeight: 1.5,
  letterSpacing: 0,
};

const fontSizePresets = [
  { label: 'Small', value: 14 },
  { label: 'Normal', value: 16 },
  { label: 'Medium', value: 18 },
  { label: 'Large', value: 24 },
  { label: 'XL', value: 32 },
  { label: '2XL', value: 40 },
  { label: '3XL', value: 48 },
];

export const Text: React.FC<TextProps> & {
  craft: {
    props: TextProps;
    related: { settings: React.FC };
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const {
    connectors: { connect, drag },
    isActive,
  } = useNode((state) => ({
    isActive: state.events.selected,
  }));

  const fontWeightMap = {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  };

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref));
      }}
      style={{
        fontSize: `${mergedProps.fontSize}px`,
        fontWeight: fontWeightMap[mergedProps.fontWeight || 'normal'],
        fontStyle: mergedProps.fontStyle || 'normal',
        textAlign: mergedProps.textAlign,
        color: mergedProps.color,
        marginBottom: `${mergedProps.marginBottom}px`,
        lineHeight: mergedProps.lineHeight,
        letterSpacing: `${mergedProps.letterSpacing}px`,
        cursor: 'pointer',
        outline: isActive ? '2px solid #3b82f6' : 'none',
        outlineOffset: '2px',
      }}
    >
      {mergedProps.text}
    </div>
  );
};

const TextSettings: React.FC = () => {
  const {
    actions: { setProp },
    nodeProps,
    text,
    fontSize,
    fontWeight,
    fontStyle,
    textAlign,
    color,
    marginBottom,
    lineHeight,
    letterSpacing,
  } = useNode((node) => ({
    nodeProps: node.data.props,
    text: node.data.props.text,
    fontSize: node.data.props.fontSize ?? defaultProps.fontSize,
    fontWeight: node.data.props.fontWeight ?? defaultProps.fontWeight,
    fontStyle: node.data.props.fontStyle ?? defaultProps.fontStyle,
    textAlign: node.data.props.textAlign ?? defaultProps.textAlign,
    color: node.data.props.color ?? defaultProps.color,
    marginBottom: node.data.props.marginBottom ?? defaultProps.marginBottom,
    lineHeight: node.data.props.lineHeight ?? defaultProps.lineHeight,
    letterSpacing: node.data.props.letterSpacing ?? defaultProps.letterSpacing,
  }));

  const adjustFontSize = (delta: number) => {
    setProp((props: TextProps) => {
      props.fontSize = Math.max(10, Math.min(96, (props.fontSize || 16) + delta));
    });
  };

  return (
    <div className="space-y-4">
      <TranslatableInput
        label="Text Content"
        propKey="text"
        value={text}
        onChange={(v) => setProp((props: TextProps) => (props.text = v))}
        nodeProps={nodeProps}
        setProp={setProp}
        multiline
        rows={4}
      />

      {/* Formatting Toolbar */}
      <div className="space-y-2">
        <Label>Formatting</Label>
        <div className="flex items-center gap-1 p-1 bg-muted rounded-md">
          {/* Bold Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-8 w-8 p-0', fontWeight === 'bold' && 'bg-background shadow-sm')}
            onClick={() =>
              setProp((props: TextProps) => {
                props.fontWeight = props.fontWeight === 'bold' ? 'normal' : 'bold';
              })
            }
          >
            <Bold className="h-4 w-4" />
          </Button>

          {/* Italic Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-8 w-8 p-0', fontStyle === 'italic' && 'bg-background shadow-sm')}
            onClick={() =>
              setProp((props: TextProps) => {
                props.fontStyle = props.fontStyle === 'italic' ? 'normal' : 'italic';
              })
            }
          >
            <Italic className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Text Alignment */}
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-8 w-8 p-0', textAlign === 'left' && 'bg-background shadow-sm')}
            onClick={() => setProp((props: TextProps) => (props.textAlign = 'left'))}
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-8 w-8 p-0', textAlign === 'center' && 'bg-background shadow-sm')}
            onClick={() => setProp((props: TextProps) => (props.textAlign = 'center'))}
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-8 w-8 p-0', textAlign === 'right' && 'bg-background shadow-sm')}
            onClick={() => setProp((props: TextProps) => (props.textAlign = 'right'))}
          >
            <AlignRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Font Size */}
      <div className="space-y-2">
        <Label>Font Size</Label>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => adjustFontSize(-2)}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Input
            type="number"
            value={fontSize}
            onChange={(e) => setProp((props: TextProps) => (props.fontSize = parseInt(e.target.value) || 16))}
            className="h-8 w-16 text-center"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => adjustFontSize(2)}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <span className="text-xs text-muted-foreground">px</span>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {fontSizePresets.map((preset) => (
            <Button
              key={preset.value}
              variant="outline"
              size="sm"
              className={cn('h-7 text-xs', fontSize === preset.value && 'bg-primary text-primary-foreground')}
              onClick={() => setProp((props: TextProps) => (props.fontSize = preset.value))}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Font Weight */}
      <div className="space-y-2">
        <Label>Font Weight</Label>
        <Select
          value={fontWeight}
          onValueChange={(value) => setProp((props: TextProps) => (props.fontWeight = value as TextProps['fontWeight']))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Normal (400)</SelectItem>
            <SelectItem value="medium">Medium (500)</SelectItem>
            <SelectItem value="semibold">Semibold (600)</SelectItem>
            <SelectItem value="bold">Bold (700)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Text Color */}
      <div className="space-y-2">
        <Label>Text Color</Label>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            value={color}
            onChange={(e) => setProp((props: TextProps) => (props.color = e.target.value))}
            className="h-10 w-14 p-1 cursor-pointer"
          />
          <Input
            type="text"
            value={color}
            onChange={(e) => setProp((props: TextProps) => (props.color = e.target.value))}
            className="flex-1 h-10 font-mono text-sm"
            placeholder="#000000"
          />
        </div>
      </div>

      {/* Line Height */}
      <div className="space-y-2">
        <Label>Line Height</Label>
        <Select
          value={String(lineHeight)}
          onValueChange={(value) => setProp((props: TextProps) => (props.lineHeight = parseFloat(value)))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Tight (1.0)</SelectItem>
            <SelectItem value="1.25">Snug (1.25)</SelectItem>
            <SelectItem value="1.5">Normal (1.5)</SelectItem>
            <SelectItem value="1.75">Relaxed (1.75)</SelectItem>
            <SelectItem value="2">Loose (2.0)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Letter Spacing */}
      <div className="space-y-2">
        <Label>Letter Spacing (px)</Label>
        <Input
          type="number"
          step="0.5"
          value={letterSpacing}
          onChange={(e) => setProp((props: TextProps) => (props.letterSpacing = parseFloat(e.target.value) || 0))}
        />
      </div>

      {/* Margin Bottom */}
      <div className="space-y-2">
        <Label>Margin Bottom (px)</Label>
        <Input
          type="number"
          value={marginBottom}
          onChange={(e) => setProp((props: TextProps) => (props.marginBottom = parseInt(e.target.value) || 0))}
        />
      </div>
    </div>
  );
};

Text.craft = {
  props: defaultProps,
  related: {
    settings: TextSettings,
  },
};
