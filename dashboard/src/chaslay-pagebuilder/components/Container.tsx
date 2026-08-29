// @ts-nocheck
'use client';

import React from 'react';
import { useNode, Element } from '@craftjs/core';
import { ContainerProps } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/chaslay-pagebuilder/ui/select';

const defaultProps: ContainerProps = {
  background: '#ffffff',
  padding: 20,
  margin: 0,
  flexDirection: 'column',
  alignItems: 'stretch',
  justifyContent: 'flex-start',
  gap: 10,
  minHeight: 100,
};

export const Container: React.FC<ContainerProps> & {
  craft: {
    props: ContainerProps;
    related: { settings: React.FC };
    rules: { canMoveIn: () => boolean };
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const {
    connectors: { connect },
  } = useNode();

  return (
    <div
      ref={(ref) => {
        if (ref) connect(ref);
      }}
      style={{
        background: mergedProps.background,
        padding: `${mergedProps.padding}px`,
        margin: `${mergedProps.margin}px`,
        display: 'flex',
        flexDirection: mergedProps.flexDirection,
        alignItems: mergedProps.alignItems,
        justifyContent: mergedProps.justifyContent,
        gap: `${mergedProps.gap}px`,
        minHeight: `${mergedProps.minHeight}px`,
        width: '100%',
      }}
    >
      {mergedProps.children}
    </div>
  );
};

const ContainerSettings: React.FC = () => {
  const {
    actions: { setProp },
    background,
    padding,
    margin,
    flexDirection,
    alignItems,
    justifyContent,
    gap,
    minHeight,
  } = useNode((node) => ({
    background: node.data.props.background,
    padding: node.data.props.padding,
    margin: node.data.props.margin,
    flexDirection: node.data.props.flexDirection,
    alignItems: node.data.props.alignItems,
    justifyContent: node.data.props.justifyContent,
    gap: node.data.props.gap,
    minHeight: node.data.props.minHeight,
  }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Background Color</Label>
        <Input
          type="color"
          value={background || '#ffffff'}
          onChange={(e) => setProp((props: ContainerProps) => (props.background = e.target.value))}
          className="h-10 w-full"
        />
      </div>

      <div className="space-y-2">
        <Label>Padding (px)</Label>
        <Input
          type="number"
          value={padding}
          onChange={(e) => setProp((props: ContainerProps) => (props.padding = parseInt(e.target.value) || 0))}
        />
      </div>

      <div className="space-y-2">
        <Label>Margin (px)</Label>
        <Input
          type="number"
          value={margin}
          onChange={(e) => setProp((props: ContainerProps) => (props.margin = parseInt(e.target.value) || 0))}
        />
      </div>

      <div className="space-y-2">
        <Label>Direction</Label>
        <Select
          value={flexDirection}
          onValueChange={(value) => setProp((props: ContainerProps) => (props.flexDirection = value as ContainerProps['flexDirection']))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="column">Vertical</SelectItem>
            <SelectItem value="row">Horizontal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Align Items</Label>
        <Select
          value={alignItems}
          onValueChange={(value) => setProp((props: ContainerProps) => (props.alignItems = value as ContainerProps['alignItems']))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="flex-start">Start</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="flex-end">End</SelectItem>
            <SelectItem value="stretch">Stretch</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Justify Content</Label>
        <Select
          value={justifyContent}
          onValueChange={(value) => setProp((props: ContainerProps) => (props.justifyContent = value as ContainerProps['justifyContent']))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="flex-start">Start</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="flex-end">End</SelectItem>
            <SelectItem value="space-between">Space Between</SelectItem>
            <SelectItem value="space-around">Space Around</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Gap (px)</Label>
        <Input
          type="number"
          value={gap}
          onChange={(e) => setProp((props: ContainerProps) => (props.gap = parseInt(e.target.value) || 0))}
        />
      </div>

      <div className="space-y-2">
        <Label>Min Height (px)</Label>
        <Input
          type="number"
          value={minHeight}
          onChange={(e) => setProp((props: ContainerProps) => (props.minHeight = parseInt(e.target.value) || 0))}
        />
      </div>
    </div>
  );
};

Container.craft = {
  props: defaultProps,
  related: {
    settings: ContainerSettings,
  },
  rules: {
    canMoveIn: () => true,
  },
};

// Root container that cannot be deleted or dragged
export const RootContainer: React.FC<ContainerProps> = (props) => {
  const {
    connectors: { connect },
  } = useNode();

  return (
    <div
      ref={(ref) => {
        if (ref) connect(ref);
      }}
      style={{
        width: '100%',
        minHeight: '100vh',
        background: props.background || '#ffffff',
      }}
    >
      {props.children}
    </div>
  );
};

(RootContainer as typeof Container).craft = {
  props: { ...defaultProps, minHeight: 600 },
  related: {
    settings: ContainerSettings,
  },
  rules: {
    canMoveIn: () => true,
  },
};
