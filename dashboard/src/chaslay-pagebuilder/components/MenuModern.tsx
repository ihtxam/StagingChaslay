// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Textarea } from '@/chaslay-pagebuilder/ui/textarea';
import { useMenuData } from '../MenuDataContext';
import { TranslatableInput } from './TranslatableInput';
import { FeaturedProductsPicker } from './FeaturedProductsPicker';
import { normalizeLink } from '../utils/normalizeLink';

export interface MenuModernProps {
  title?: string;
  subtitle?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  cardColor?: string;
  buttonText?: string;
  buttonLink?: string;
  featuredProductIds?: string[];
}

const defaultProps: MenuModernProps = {
  title: 'Featured Dishes',
  subtitle: 'Chef\'s special selection crafted with passion',
  backgroundColor: '#1a1a2e',
  textColor: '#ffffff',
  accentColor: '#f59e0b',
  cardColor: '#16213e',
  buttonText: 'Explore Full Menu',
  buttonLink: '/order',
};

export const MenuModern: React.FC<MenuModernProps> & {
  craft: {
    props: MenuModernProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();
  const { categories, products, loading } = useMenuData();

  // Featured-first ordering when picker is non-empty.
  const featuredIds = mergedProps.featuredProductIds ?? [];
  const orderedProducts = featuredIds.length > 0
    ? featuredIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is typeof products[number] => Boolean(p))
    : products;
  const displayProducts = orderedProducts.slice(0, 4);

  // Format price helper
  const formatPrice = (product: any) => {
    const price = product.details?.[0]?.price || 0;
    return `CHF ${Number(price).toFixed(2)}`;
  };

  // Get category name for a product
  const getCategoryName = (product: any) => {
    const category = categories.find((c) => c.id === product.category_id);
    return category?.name || 'Featured';
  };

  return (
    <section
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      className="hb-section-padding"
      style={{
        backgroundColor: mergedProps.backgroundColor,
        color: mergedProps.textColor,
        padding: '80px 40px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '16px' }}>{mergedProps.title}</h2>
          <p style={{ fontSize: '18px', opacity: 0.7, maxWidth: '500px', margin: '0 auto' }}>{mergedProps.subtitle}</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
          </div>
        ) : displayProducts.length > 0 ? (
          <div className="hb-menu-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
            {displayProducts.map((product) => (
              <div key={product.id} style={{ backgroundColor: mergedProps.cardColor, borderRadius: '16px', padding: '32px', display: 'flex', gap: '24px', alignItems: 'center' }}>
                <div
                  style={{
                    width: '120px',
                    height: '120px',
                    backgroundColor: '#374151',
                    borderRadius: '12px',
                    flexShrink: 0,
                    backgroundImage: product.product_image ? `url(${product.product_image})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6b7280'
                  }}
                >
                  {!product.product_image && 'No Image'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, backgroundColor: mergedProps.accentColor, color: '#000', padding: '4px 10px', borderRadius: '20px' }}>{getCategoryName(product)}</span>
                  </div>
                  <h3 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>{product.product_name}</h3>
                  <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '12px' }}>{product.product_description?.substring(0, 60) || ''}{product.product_description && product.product_description.length > 60 ? '...' : ''}</p>
                  <span style={{ fontSize: '24px', fontWeight: 700, color: mergedProps.accentColor }}>{formatPrice(product)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
            No products available. Add products in the Products section.
          </div>
        )}

        {mergedProps.buttonText && (
          <div style={{ textAlign: 'center', marginTop: '48px' }}>
            <a href={mergedProps.buttonLink} style={{ display: 'inline-block', backgroundColor: mergedProps.accentColor, color: '#000', padding: '16px 48px', borderRadius: '50px', textDecoration: 'none', fontSize: '16px', fontWeight: 600 }}>
              {mergedProps.buttonText}
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

const MenuModernSettings: React.FC = () => {
  const { actions: { setProp }, ...props } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title,
    subtitle: node.data.props.subtitle,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    accentColor: node.data.props.accentColor,
    cardColor: node.data.props.cardColor,
    buttonText: node.data.props.buttonText,
    buttonLink: node.data.props.buttonLink,
    featuredProductIds: (node.data.props.featuredProductIds ?? []) as string[],
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput label="Title" propKey="title" value={props.title} onChange={(v) => setProp((p: MenuModernProps) => (p.title = v))} nodeProps={props.nodeProps} setProp={setProp} />
      <TranslatableInput label="Subtitle" propKey="subtitle" value={props.subtitle} onChange={(v) => setProp((p: MenuModernProps) => (p.subtitle = v))} nodeProps={props.nodeProps} setProp={setProp} multiline rows={2} />
      <FeaturedProductsPicker
        value={props.featuredProductIds}
        onChange={(next) => setProp((p: MenuModernProps) => (p.featuredProductIds = next))}
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={props.backgroundColor} onChange={(e) => setProp((p: MenuModernProps) => (p.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={props.textColor} onChange={(e) => setProp((p: MenuModernProps) => (p.textColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Card Color</Label>
          <Input type="color" value={props.cardColor} onChange={(e) => setProp((p: MenuModernProps) => (p.cardColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Accent Color</Label>
          <Input type="color" value={props.accentColor} onChange={(e) => setProp((p: MenuModernProps) => (p.accentColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
      <div className="border-t pt-4">
        <Label className="mb-2 block">View More Button</Label>
        <div className="space-y-2">
          <Input value={props.buttonText} onChange={(e) => setProp((p: MenuModernProps) => (p.buttonText = e.target.value))} placeholder="Button Text" />
          <Input value={props.buttonLink} onChange={(e) => {
                    const val = normalizeLink(e.target.value);
                    setProp((p: MenuModernProps) => (p.buttonLink = val));
                  }} placeholder="/menu, /shop, /about" />
        </div>
      </div>
    </div>
  );
};

MenuModern.craft = {
  props: defaultProps,
  related: { settings: MenuModernSettings },
  displayName: 'Menu Modern',
};
