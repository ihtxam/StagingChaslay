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

export interface MenuListProps {
  title?: string;
  subtitle?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  dividerColor?: string;
  buttonText?: string;
  buttonLink?: string;
  featuredProductIds?: string[];
}

const defaultProps: MenuListProps = {
  title: 'Menu',
  subtitle: 'Fresh ingredients, made with love',
  backgroundColor: '#faf9f6',
  textColor: '#1c1917',
  accentColor: '#b91c1c',
  dividerColor: '#e7e5e4',
  buttonText: 'Order Online',
  buttonLink: '/order',
};

export const MenuList: React.FC<MenuListProps> & {
  craft: {
    props: MenuListProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();
  const { categories, products, loading } = useMenuData();

  // Format price helper
  const formatPrice = (product: any) => {
    const price = product.details?.[0]?.price || 0;
    return `CHF ${Number(price).toFixed(2)}`;
  };

  // When featured picker is non-empty, group those products by their category
  // and preserve the picker order within each group. Otherwise default behavior:
  // first 2 categories, 3 products each.
  const featuredIds = mergedProps.featuredProductIds ?? [];
  const productsByCategory = featuredIds.length > 0
    ? (() => {
        const featured = featuredIds
          .map((id) => products.find((p) => p.id === id))
          .filter((p): p is typeof products[number] => Boolean(p));
        const categoryOrder: number[] = [];
        const byCat = new Map<number, typeof products>();
        featured.forEach((p) => {
          if (!byCat.has(p.category_id)) {
            byCat.set(p.category_id, []);
            categoryOrder.push(p.category_id);
          }
          byCat.get(p.category_id)!.push(p);
        });
        return categoryOrder.map((catId) => ({
          name: categories.find((c) => c.id === catId)?.name ?? 'Featured',
          items: byCat.get(catId) ?? [],
        }));
      })()
    : categories.map((cat) => ({
        name: cat.name,
        items: products.filter((p) => p.category_id === cat.id).slice(0, 3),
      })).filter((cat) => cat.items.length > 0).slice(0, 2);

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
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '3px', color: mergedProps.accentColor, marginBottom: '16px' }}>{mergedProps.subtitle}</h2>
          <h3 style={{ fontSize: '48px', fontWeight: 700 }}>{mergedProps.title}</h3>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto" />
          </div>
        ) : productsByCategory.length > 0 ? (
          productsByCategory.map((category, ci) => (
            <div key={ci} style={{ marginBottom: '48px' }}>
              <h4 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px', paddingBottom: '12px', borderBottom: `2px solid ${mergedProps.accentColor}`, display: 'inline-block' }}>
                {category.name}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {category.items.map((product) => (
                  <div key={product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '20px', borderBottom: `1px solid ${mergedProps.dividerColor}` }}>
                    <div style={{ flex: 1 }}>
                      <h5 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>{product.product_name}</h5>
                      <p style={{ fontSize: '14px', opacity: 0.7 }}>{product.product_description?.substring(0, 80) || ''}</p>
                    </div>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: mergedProps.accentColor, marginLeft: '24px' }}>{formatPrice(product)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
            No products available. Add products in the Products section.
          </div>
        )}

        {mergedProps.buttonText && (
          <div style={{ textAlign: 'center', marginTop: '48px' }}>
            <a href={mergedProps.buttonLink} style={{ display: 'inline-block', backgroundColor: mergedProps.accentColor, color: '#fff', padding: '16px 40px', borderRadius: '4px', textDecoration: 'none', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
              {mergedProps.buttonText}
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

const MenuListSettings: React.FC = () => {
  const { actions: { setProp }, ...props } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title,
    subtitle: node.data.props.subtitle,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    accentColor: node.data.props.accentColor,
    buttonText: node.data.props.buttonText,
    buttonLink: node.data.props.buttonLink,
    featuredProductIds: (node.data.props.featuredProductIds ?? []) as string[],
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput label="Title" propKey="title" value={props.title} onChange={(v) => setProp((p: MenuListProps) => (p.title = v))} nodeProps={props.nodeProps} setProp={setProp} />
      <TranslatableInput label="Subtitle" propKey="subtitle" value={props.subtitle} onChange={(v) => setProp((p: MenuListProps) => (p.subtitle = v))} nodeProps={props.nodeProps} setProp={setProp} />
      <FeaturedProductsPicker
        value={props.featuredProductIds}
        onChange={(next) => setProp((p: MenuListProps) => (p.featuredProductIds = next))}
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={props.backgroundColor} onChange={(e) => setProp((p: MenuListProps) => (p.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={props.textColor} onChange={(e) => setProp((p: MenuListProps) => (p.textColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Accent Color</Label>
        <Input type="color" value={props.accentColor} onChange={(e) => setProp((p: MenuListProps) => (p.accentColor = e.target.value))} className="h-10 w-full" />
      </div>
      <div className="border-t pt-4">
        <Label className="mb-2 block">View More Button</Label>
        <div className="space-y-2">
          <Input value={props.buttonText} onChange={(e) => setProp((p: MenuListProps) => (p.buttonText = e.target.value))} placeholder="Button Text" />
          <Input value={props.buttonLink} onChange={(e) => {
                    const val = normalizeLink(e.target.value);
                    setProp((p: MenuListProps) => (p.buttonLink = val));
                  }} placeholder="/menu, /shop, /about" />
        </div>
      </div>
    </div>
  );
};

MenuList.craft = {
  props: defaultProps,
  related: { settings: MenuListSettings },
  displayName: 'Menu List',
};
