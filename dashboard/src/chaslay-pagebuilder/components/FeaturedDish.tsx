// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { FeaturedDishProps } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Textarea } from '@/chaslay-pagebuilder/ui/textarea';
import { TranslatableInput } from './TranslatableInput';

const defaultProps: FeaturedDishProps = {
  title: 'Chef\'s Special',
  subtitle: 'Our signature dish, crafted with passion',
  dishName: 'Truffle Risotto',
  dishDescription: 'Creamy arborio rice with black truffle shavings, parmesan, and fresh herbs. A timeless Italian classic reimagined.',
  dishImage: '',
  dishPrice: '$28.99',
  badgeText: 'Popular',
  backgroundColor: '#1a1a2e',
  textColor: '#ffffff',
  accentColor: '#e94560',
};

export const FeaturedDish: React.FC<FeaturedDishProps> & {
  craft: {
    props: FeaturedDishProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();

  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      className="hb-section hb-section-padding"
      style={{
        backgroundColor: mergedProps.backgroundColor,
        width: '100%',
        boxSizing: 'border-box',
        padding: '64px 20px',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '48px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', position: 'relative' }}>
          {mergedProps.dishImage ? (
            <img
              src={mergedProps.dishImage}
              alt={mergedProps.dishName}
              style={{ width: '100%', borderRadius: '16px', objectFit: 'cover', maxHeight: '400px' }}
            />
          ) : (
            <div style={{
              width: '100%',
              height: '320px',
              borderRadius: '16px',
              background: `linear-gradient(135deg, ${mergedProps.accentColor}33, ${mergedProps.accentColor}11)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '48px',
            }}>
              🍽️
            </div>
          )}
          {mergedProps.badgeText && (
            <div style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              backgroundColor: mergedProps.accentColor,
              color: '#fff',
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 600,
            }}>
              {mergedProps.badgeText}
            </div>
          )}
        </div>
        <div style={{ flex: '1 1 300px' }}>
          {mergedProps.title && (
            <p style={{ color: mergedProps.accentColor, fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>
              {mergedProps.title}
            </p>
          )}
          {mergedProps.dishName && (
            <h3 style={{ color: mergedProps.textColor, fontSize: '36px', fontWeight: 700, marginBottom: '16px', lineHeight: 1.2 }}>
              {mergedProps.dishName}
            </h3>
          )}
          {mergedProps.subtitle && (
            <p style={{ color: mergedProps.textColor, opacity: 0.7, fontSize: '16px', marginBottom: '16px' }}>
              {mergedProps.subtitle}
            </p>
          )}
          {mergedProps.dishDescription && (
            <p style={{ color: mergedProps.textColor, opacity: 0.8, fontSize: '15px', lineHeight: 1.7, marginBottom: '24px' }}>
              {mergedProps.dishDescription}
            </p>
          )}
          {mergedProps.dishPrice && (
            <span style={{ color: mergedProps.accentColor, fontSize: '28px', fontWeight: 700 }}>
              {mergedProps.dishPrice}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const FeaturedDishSettings: React.FC = () => {
  const { actions: { setProp }, ...p } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title ?? defaultProps.title,
    subtitle: node.data.props.subtitle ?? defaultProps.subtitle,
    dishName: node.data.props.dishName ?? defaultProps.dishName,
    dishDescription: node.data.props.dishDescription ?? defaultProps.dishDescription,
    dishImage: node.data.props.dishImage ?? defaultProps.dishImage,
    dishPrice: node.data.props.dishPrice ?? defaultProps.dishPrice,
    badgeText: node.data.props.badgeText ?? defaultProps.badgeText,
    backgroundColor: node.data.props.backgroundColor ?? defaultProps.backgroundColor,
    textColor: node.data.props.textColor ?? defaultProps.textColor,
    accentColor: node.data.props.accentColor ?? defaultProps.accentColor,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput label="Section Title" propKey="title" value={p.title} onChange={(v) => setProp((props: FeaturedDishProps) => (props.title = v))} nodeProps={p.nodeProps} setProp={setProp} />
      <TranslatableInput label="Subtitle" propKey="subtitle" value={p.subtitle} onChange={(v) => setProp((props: FeaturedDishProps) => (props.subtitle = v))} nodeProps={p.nodeProps} setProp={setProp} />
      <TranslatableInput label="Dish Name" propKey="dishName" value={p.dishName} onChange={(v) => setProp((props: FeaturedDishProps) => (props.dishName = v))} nodeProps={p.nodeProps} setProp={setProp} />
      <TranslatableInput label="Description" propKey="dishDescription" value={p.dishDescription} onChange={(v) => setProp((props: FeaturedDishProps) => (props.dishDescription = v))} nodeProps={p.nodeProps} setProp={setProp} multiline rows={3} />
      <div className="space-y-2">
        <Label>Dish Image URL</Label>
        <Input value={p.dishImage} onChange={(e) => setProp((props: FeaturedDishProps) => (props.dishImage = e.target.value))} placeholder="https://..." />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Price</Label>
          <Input value={p.dishPrice} onChange={(e) => setProp((props: FeaturedDishProps) => (props.dishPrice = e.target.value))} />
        </div>
        <TranslatableInput label="Badge Text" propKey="badgeText" value={p.badgeText} onChange={(v) => setProp((props: FeaturedDishProps) => (props.badgeText = v))} nodeProps={p.nodeProps} setProp={setProp} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={p.backgroundColor} onChange={(e) => setProp((props: FeaturedDishProps) => (props.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={p.textColor} onChange={(e) => setProp((props: FeaturedDishProps) => (props.textColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Accent</Label>
          <Input type="color" value={p.accentColor} onChange={(e) => setProp((props: FeaturedDishProps) => (props.accentColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
};

FeaturedDish.craft = {
  props: defaultProps,
  related: { settings: FeaturedDishSettings },
  displayName: 'Featured Dish',
};
