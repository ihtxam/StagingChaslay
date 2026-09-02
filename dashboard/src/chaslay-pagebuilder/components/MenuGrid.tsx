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
import { useStorefront } from '../StorefrontContext';
import { formatMenuProductPrice } from '../menu-product-utils';
import { useStorefrontCart } from '../useStorefrontCart';

export interface MenuGridProps {
  title?: string;
  subtitle?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  buttonText?: string;
  buttonLink?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  featuredProductIds?: string[];
}

const defaultProps: MenuGridProps = {
  title: 'Our Menu',
  subtitle: 'Discover our delicious offerings',
  backgroundColor: '#ffffff',
  textColor: '#1a1a2e',
  accentColor: '#e94560',
  buttonText: 'View Full Menu',
  buttonLink: '/order',
  buttonColor: '#1a1a2e',
  buttonTextColor: '#ffffff',
};

export const MenuGrid: React.FC<MenuGridProps> & {
  craft: {
    props: MenuGridProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();
  const { products, loading } = useMenuData();
  const { shopHref, isStorefront } = useStorefront();
  const { addProduct } = useStorefrontCart();

  // If featured products are picked, honor that order; otherwise default newest-first slice.
  const featuredIds = mergedProps.featuredProductIds ?? [];
  const orderedProducts = featuredIds.length > 0
    ? featuredIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is typeof products[number] => Boolean(p))
    : products;
  const displayProducts = orderedProducts.slice(0, 6);

  const formatPrice = (product: (typeof products)[number]) => formatMenuProductPrice(product);

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
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '16px' }}>{mergedProps.title}</h2>
          <p style={{ fontSize: '18px', opacity: 0.7 }}>{mergedProps.subtitle}</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto" />
          </div>
        ) : displayProducts.length > 0 ? (
          <div className="hb-menu-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
            {displayProducts.map((product) => (
              <div key={product.id} style={{ backgroundColor: '#f8f9fa', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                <div
                  style={{
                    height: '180px',
                    backgroundColor: '#e9ecef',
                    backgroundImage: product.product_image ? `url(${product.product_image})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6c757d'
                  }}
                >
                  {!product.product_image && 'No Image'}
                </div>
                <div style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: mergedProps.textColor }}>{product.product_name}</h3>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: mergedProps.accentColor }}>{formatPrice(product)}</span>
                  </div>
                  <p style={{ fontSize: '14px', opacity: 0.7 }}>{product.product_description?.substring(0, 60) || ''}{product.product_description && product.product_description.length > 60 ? '...' : ''}</p>
                  {isStorefront ? (
                    <button
                      type="button"
                      onClick={() => addProduct(product)}
                      style={{
                        marginTop: '12px',
                        backgroundColor: mergedProps.accentColor,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 14px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Add to cart
                    </button>
                  ) : null}
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
            <a href={shopHref(mergedProps.buttonLink)} style={{ display: 'inline-block', backgroundColor: mergedProps.buttonColor, color: mergedProps.buttonTextColor, padding: '16px 40px', borderRadius: '8px', textDecoration: 'none', fontSize: '16px', fontWeight: 600, transition: 'opacity 0.2s' }}>
              {mergedProps.buttonText}
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

const MenuGridSettings: React.FC = () => {
  const { actions: { setProp }, ...props } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title,
    subtitle: node.data.props.subtitle,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    accentColor: node.data.props.accentColor,
    buttonText: node.data.props.buttonText,
    buttonLink: node.data.props.buttonLink,
    buttonColor: node.data.props.buttonColor,
    buttonTextColor: node.data.props.buttonTextColor,
    featuredProductIds: (node.data.props.featuredProductIds ?? []) as string[],
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput label="Title" propKey="title" value={props.title} onChange={(v) => setProp((p: MenuGridProps) => (p.title = v))} nodeProps={props.nodeProps} setProp={setProp} />
      <TranslatableInput label="Subtitle" propKey="subtitle" value={props.subtitle} onChange={(v) => setProp((p: MenuGridProps) => (p.subtitle = v))} nodeProps={props.nodeProps} setProp={setProp} multiline rows={2} />
      <FeaturedProductsPicker
        value={props.featuredProductIds}
        onChange={(next) => setProp((p: MenuGridProps) => (p.featuredProductIds = next))}
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={props.backgroundColor} onChange={(e) => setProp((p: MenuGridProps) => (p.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={props.textColor} onChange={(e) => setProp((p: MenuGridProps) => (p.textColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Price Color</Label>
        <Input type="color" value={props.accentColor} onChange={(e) => setProp((p: MenuGridProps) => (p.accentColor = e.target.value))} className="h-10 w-full" />
      </div>
      <div className="border-t pt-4">
        <Label className="mb-2 block">View More Button</Label>
        <div className="space-y-2">
          <Input value={props.buttonText} onChange={(e) => setProp((p: MenuGridProps) => (p.buttonText = e.target.value))} placeholder="Button Text" />
          <Input value={props.buttonLink} onChange={(e) => {
                    const val = normalizeLink(e.target.value);
                    setProp((p: MenuGridProps) => (p.buttonLink = val));
                  }} placeholder="/menu, /shop, /about" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Button Color</Label>
              <Input type="color" value={props.buttonColor} onChange={(e) => setProp((p: MenuGridProps) => (p.buttonColor = e.target.value))} className="h-10 w-full" />
            </div>
            <div>
              <Label className="text-xs">Text Color</Label>
              <Input type="color" value={props.buttonTextColor} onChange={(e) => setProp((p: MenuGridProps) => (p.buttonTextColor = e.target.value))} className="h-10 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

MenuGrid.craft = {
  props: defaultProps,
  related: { settings: MenuGridSettings },
  displayName: 'Menu Grid',
};
