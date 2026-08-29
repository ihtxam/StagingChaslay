// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { ScrollToTopProps } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/chaslay-pagebuilder/ui/select';
import { ArrowUp } from 'lucide-react';

const defaultProps: ScrollToTopProps = {
  backgroundColor: '#1a1a2e',
  iconColor: '#ffffff',
  position: 'right',
};

export const ScrollToTop: React.FC<ScrollToTopProps> & {
  craft: {
    props: ScrollToTopProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();

  const isRight = mergedProps.position !== 'left';

  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      className="hb-scroll-to-top"
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '60px',
        boxSizing: 'border-box',
      }}
    >
      {/* Editor preview indicator */}
      <div style={{
        padding: '16px 20px',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        textAlign: 'center',
        fontSize: '13px',
        color: '#6b7280',
      }}>
        Scroll-to-Top Button — appears fixed at bottom-{isRight ? 'right' : 'left'} when published
      </div>

      {/* Button preview */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        [isRight ? 'right' : 'left']: '8px',
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        backgroundColor: mergedProps.backgroundColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        cursor: 'pointer',
      }}>
        <ArrowUp size={20} color={mergedProps.iconColor} />
      </div>
    </div>
  );
};

const ScrollToTopSettings: React.FC = () => {
  const { actions: { setProp }, backgroundColor, iconColor, position } = useNode((node) => ({
    backgroundColor: node.data.props.backgroundColor ?? defaultProps.backgroundColor,
    iconColor: node.data.props.iconColor ?? defaultProps.iconColor,
    position: node.data.props.position ?? defaultProps.position,
  }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Position</Label>
        <Select value={position} onValueChange={(v) => setProp((p: ScrollToTopProps) => (p.position = v as ScrollToTopProps['position']))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Bottom Left</SelectItem>
            <SelectItem value="right">Bottom Right</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Button Color</Label>
        <Input type="color" value={backgroundColor} onChange={(e) => setProp((p: ScrollToTopProps) => (p.backgroundColor = e.target.value))} className="h-10 w-full" />
      </div>

      <div className="space-y-2">
        <Label>Icon Color</Label>
        <Input type="color" value={iconColor} onChange={(e) => setProp((p: ScrollToTopProps) => (p.iconColor = e.target.value))} className="h-10 w-full" />
      </div>
    </div>
  );
};

ScrollToTop.craft = {
  props: defaultProps,
  related: { settings: ScrollToTopSettings },
  displayName: 'Scroll to Top',
};
