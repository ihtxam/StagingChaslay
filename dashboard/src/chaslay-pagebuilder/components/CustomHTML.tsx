// @ts-nocheck
'use client';

import React, { useMemo } from 'react';
import { useNode } from '@craftjs/core';
import { CustomHTMLProps } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Slider } from '@/chaslay-pagebuilder/ui/slider';
import DOMPurify from 'isomorphic-dompurify';

const defaultProps: CustomHTMLProps = {
  htmlContent: '',
  backgroundColor: '#ffffff',
  padding: 16,
  maxWidth: 1350,
};

export const CustomHTML: React.FC<CustomHTMLProps> & {
  craft: {
    props: CustomHTMLProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();

  const sanitizedHTML = useMemo(() => {
    if (!mergedProps.htmlContent) return '';
    return DOMPurify.sanitize(mergedProps.htmlContent, {
      ADD_TAGS: ['style', 'link'],
      ADD_ATTR: ['target', 'rel'],
      WHOLE_DOCUMENT: false,
    });
  }, [mergedProps.htmlContent]);

  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      className="hb-custom-html"
      style={{
        width: '100%',
        backgroundColor: mergedProps.backgroundColor,
        display: 'flex',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: `${mergedProps.maxWidth}px`,
          padding: `${mergedProps.padding}px`,
          boxSizing: 'border-box',
        }}
      >
        {sanitizedHTML ? (
          <div dangerouslySetInnerHTML={{ __html: sanitizedHTML }} />
        ) : (
          <div
            style={{
              border: '2px dashed #d1d5db',
              borderRadius: '8px',
              padding: '32px',
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: '14px',
            }}
          >
            Custom HTML — paste your code in the settings panel
          </div>
        )}
      </div>
    </div>
  );
};

const CustomHTMLSettings: React.FC = () => {
  const { actions: { setProp }, htmlContent, backgroundColor, padding, maxWidth } = useNode((node) => ({
    htmlContent: node.data.props.htmlContent ?? defaultProps.htmlContent,
    backgroundColor: node.data.props.backgroundColor ?? defaultProps.backgroundColor,
    padding: node.data.props.padding ?? defaultProps.padding,
    maxWidth: node.data.props.maxWidth ?? defaultProps.maxWidth,
  }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>HTML Content</Label>
        <textarea
          value={htmlContent}
          onChange={(e) => setProp((p: CustomHTMLProps) => (p.htmlContent = e.target.value))}
          rows={12}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
          placeholder="<div>Your HTML here...</div>"
        />
        <p className="text-[10px] text-muted-foreground">
          Scripts and event handlers are stripped for security. Style tags and inline styles are allowed.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Background Color</Label>
        <Input
          type="color"
          value={backgroundColor}
          onChange={(e) => setProp((p: CustomHTMLProps) => (p.backgroundColor = e.target.value))}
          className="h-10 w-full"
        />
      </div>

      <div className="space-y-2">
        <Label>Padding ({padding}px)</Label>
        <Slider
          value={[padding]}
          onValueChange={([v]) => setProp((p: CustomHTMLProps) => (p.padding = v))}
          min={0}
          max={64}
          step={4}
        />
      </div>

      <div className="space-y-2">
        <Label>Max Width ({maxWidth}px)</Label>
        <Slider
          value={[maxWidth]}
          onValueChange={([v]) => setProp((p: CustomHTMLProps) => (p.maxWidth = v))}
          min={400}
          max={1350}
          step={50}
        />
      </div>
    </div>
  );
};

CustomHTML.craft = {
  props: defaultProps,
  related: { settings: CustomHTMLSettings },
  displayName: 'CustomHTML',
};
