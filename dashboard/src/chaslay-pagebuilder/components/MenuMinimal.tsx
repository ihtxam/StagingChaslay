// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { useMenuData } from '../MenuDataContext';
import { TranslatableInput } from './TranslatableInput';
import { FeaturedProductsPicker } from './FeaturedProductsPicker';
import { normalizeLink } from '../utils/normalizeLink';
import { useStorefront } from '../StorefrontContext';
import { formatMenuProductPrice } from '../menu-product-utils';
import { sectionAnchorId, SECTION_ANCHORS } from '../utils/section-id';

export interface MenuMinimalProps {
  title?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  buttonText?: string;
  buttonLink?: string;
  featuredProductIds?: string[];
}

const defaultProps: MenuMinimalProps = {
  sectionId: SECTION_ANCHORS.menu,
  title: 'MENU',
  backgroundColor: '#ffffff',
  textColor: '#1c1917',
  accentColor: '#dc2626',
  buttonText: 'View Full Menu',
  buttonLink: '/order',
};

export const MenuMinimal: React.FC<MenuMinimalProps> & {
  craft: {
    props: MenuMinimalProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();
  const { products, loading } = useMenuData();
  const { shopHref } = useStorefront();

  // Featured-first ordering when picker is non-empty.
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
      id={sectionAnchorId(mergedProps.sectionId, 'menu')}
      className="hb-section-padding"
      style={{
        backgroundColor: mergedProps.backgroundColor,
        color: mergedProps.textColor,
        padding: '100px 40px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 400, letterSpacing: '6px', marginBottom: '60px', opacity: 0.6 }}>{mergedProps.title}</h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto" />
          </div>
        ) : displayProducts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {displayProducts.map((product) => (
              <div key={product.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
                <span style={{ flex: 1, height: '1px', backgroundColor: mergedProps.textColor, opacity: 0.15 }} />
                <span style={{ fontSize: '18px', fontWeight: 500, whiteSpace: 'nowrap' }}>{product.product_name}</span>
                <span style={{ fontSize: '18px', fontWeight: 600, color: mergedProps.accentColor }}>{formatPrice(product)}</span>
                <span style={{ flex: 1, height: '1px', backgroundColor: mergedProps.textColor, opacity: 0.15 }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '40px', opacity: 0.5 }}>
            No products available. Add products in the Products section.
          </div>
        )}

        {mergedProps.buttonText && (
          <div style={{ marginTop: '48px' }}>
            <a href={shopHref(mergedProps.buttonLink)} style={{ color: mergedProps.accentColor, textDecoration: 'none', fontSize: '14px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', borderBottom: `1px solid ${mergedProps.accentColor}`, paddingBottom: '4px' }}>
              {mergedProps.buttonText}
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

const MenuMinimalSettings: React.FC = () => {
  const { actions: { setProp }, ...props } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    accentColor: node.data.props.accentColor,
    buttonText: node.data.props.buttonText,
    buttonLink: node.data.props.buttonLink,
    featuredProductIds: (node.data.props.featuredProductIds ?? []) as string[],
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput label="Title" propKey="title" value={props.title} onChange={(v) => setProp((p: MenuMinimalProps) => (p.title = v))} nodeProps={props.nodeProps} setProp={setProp} />
      <FeaturedProductsPicker
        value={props.featuredProductIds}
        onChange={(next) => setProp((p: MenuMinimalProps) => (p.featuredProductIds = next))}
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={props.backgroundColor} onChange={(e) => setProp((p: MenuMinimalProps) => (p.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={props.textColor} onChange={(e) => setProp((p: MenuMinimalProps) => (p.textColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Price Color</Label>
        <Input type="color" value={props.accentColor} onChange={(e) => setProp((p: MenuMinimalProps) => (p.accentColor = e.target.value))} className="h-10 w-full" />
      </div>
      <div className="border-t pt-4">
        <Label className="mb-2 block">View More Button</Label>
        <div className="space-y-2">
          <Input value={props.buttonText} onChange={(e) => setProp((p: MenuMinimalProps) => (p.buttonText = e.target.value))} placeholder="Button Text" />
          <Input value={props.buttonLink} onChange={(e) => {
                    const val = normalizeLink(e.target.value);
                    setProp((p: MenuMinimalProps) => (p.buttonLink = val));
                  }} placeholder="/menu, /shop, /about" />
        </div>
      </div>
    </div>
  );
};

MenuMinimal.craft = {
  props: defaultProps,
  related: { settings: MenuMinimalSettings },
  displayName: 'Menu Minimal',
};
