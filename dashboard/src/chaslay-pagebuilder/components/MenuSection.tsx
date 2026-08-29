// @ts-nocheck
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useNode } from '@craftjs/core';
import { MenuSectionProps } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Textarea } from '@/chaslay-pagebuilder/ui/textarea';
import { Switch } from '@/chaslay-pagebuilder/ui/switch';
import { Slider } from '@/chaslay-pagebuilder/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/chaslay-pagebuilder/ui/select';
import { useMenuData } from '../MenuDataContext';
import { TranslatableInput } from './TranslatableInput';
import { FeaturedProductsPicker } from './FeaturedProductsPicker';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';

const defaultProps: MenuSectionProps = {
  title: 'Our Menu',
  subtitle: 'Discover our delicious offerings',
  showCategories: true,
  maxProducts: 12,
  backgroundColor: '#f8f9fa',
  textColor: '#1a1a2e',
  accentColor: '#e94560',
  autoScrollSpeed: 4,
  layout: 'carousel',
  showViewMenuButton: true,
  viewMenuText: 'View Full Menu',
  viewMenuLink: '/menu',
  viewMenuBgColor: '#1a1a2e',
  viewMenuTextColor: '#ffffff',
};

// Star rating display
const StarRating: React.FC<{ rating?: number; color: string }> = ({ rating = 0, color }) => (
  <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', marginBottom: '8px' }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} size={14} fill={i <= rating ? color : 'none'} stroke={color} strokeWidth={1.5} />
    ))}
  </div>
);

export const MenuSection: React.FC<MenuSectionProps> & {
  craft: {
    props: MenuSectionProps;
    related: { settings: React.FC };
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();
  const { categories, products, loading } = useMenuData();

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);

  // If featuredProductIds is set, honor that explicit order.
  // Category filter still applies on top.
  const featuredIds = mergedProps.featuredProductIds ?? [];
  const orderedProducts = featuredIds.length > 0
    ? featuredIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is typeof products[number] => Boolean(p))
    : products;

  const filteredProducts = selectedCategory
    ? orderedProducts.filter((p) => p.category_id === selectedCategory)
    : orderedProducts;

  const displayProducts = filteredProducts.slice(0, mergedProps.maxProducts || 12);

  // Auto-scroll effect (carousel only)
  useEffect(() => {
    if (mergedProps.layout === 'grid') return;
    if (!carouselRef.current || isHovered || displayProducts.length === 0) return;

    const scrollSpeed = (mergedProps.autoScrollSpeed || 4) * 1000;
    const cardWidth = 280;
    const maxScroll = carouselRef.current.scrollWidth - carouselRef.current.clientWidth;

    const interval = setInterval(() => {
      if (carouselRef.current) {
        const newPosition = scrollPosition + cardWidth;
        if (newPosition >= maxScroll) {
          carouselRef.current.scrollTo({ left: 0, behavior: 'smooth' });
          setScrollPosition(0);
        } else {
          carouselRef.current.scrollTo({ left: newPosition, behavior: 'smooth' });
          setScrollPosition(newPosition);
        }
      }
    }, scrollSpeed);

    return () => clearInterval(interval);
  }, [isHovered, scrollPosition, displayProducts.length, mergedProps.autoScrollSpeed, mergedProps.layout]);

  const scrollLeft = () => {
    if (carouselRef.current) {
      const newPosition = Math.max(0, scrollPosition - 280);
      carouselRef.current.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  };

  const scrollRight = () => {
    if (carouselRef.current) {
      const maxScroll = carouselRef.current.scrollWidth - carouselRef.current.clientWidth;
      const newPosition = Math.min(maxScroll, scrollPosition + 280);
      carouselRef.current.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  };

  const formatPrice = (product: any) => {
    const price = product.details?.[0]?.price || 0;
    return `CHF ${Number(price).toFixed(2)}`;
  };

  const isGrid = mergedProps.layout === 'grid';

  // Category buttons with border style for grid layout
  const renderCategoryButtons = () => {
    if (!mergedProps.showCategories || categories.length === 0) return null;
    return (
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '40px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedCategory(null)}
          style={{
            padding: isGrid ? '10px 28px' : '10px 24px',
            borderRadius: isGrid ? '4px' : '25px',
            border: isGrid ? (selectedCategory === null ? 'none' : `1px solid ${mergedProps.textColor}33`) : 'none',
            backgroundColor: selectedCategory === null ? mergedProps.accentColor : (isGrid ? 'transparent' : 'transparent'),
            color: selectedCategory === null ? '#fff' : mergedProps.textColor,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: isGrid ? '13px' : '14px',
            textTransform: isGrid ? 'uppercase' : undefined,
            letterSpacing: isGrid ? '1px' : undefined,
            transition: 'all 0.3s ease',
            boxShadow: !isGrid && selectedCategory === null ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
          }}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            style={{
              padding: isGrid ? '10px 28px' : '10px 24px',
              borderRadius: isGrid ? '4px' : '25px',
              border: isGrid ? (selectedCategory === cat.id ? 'none' : `1px solid ${mergedProps.textColor}33`) : 'none',
              backgroundColor: selectedCategory === cat.id ? mergedProps.accentColor : (isGrid ? 'transparent' : 'transparent'),
              color: selectedCategory === cat.id ? '#fff' : mergedProps.textColor,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: isGrid ? '13px' : '14px',
              textTransform: isGrid ? 'uppercase' : undefined,
              letterSpacing: isGrid ? '1px' : undefined,
              transition: 'all 0.3s ease',
              boxShadow: !isGrid && selectedCategory === cat.id ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
            }}
          >
            {cat.name}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      style={{ backgroundColor: mergedProps.backgroundColor, color: mergedProps.textColor, padding: '60px 0', width: '100%', overflow: 'hidden' }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
        {mergedProps.title && (
          <h2 style={{
            fontSize: isGrid ? '40px' : '36px',
            fontWeight: isGrid ? 400 : 700,
            fontFamily: isGrid ? "'Georgia', 'Times New Roman', serif" : undefined,
            textAlign: 'center',
            marginBottom: '12px',
          }}>
            {mergedProps.title}
          </h2>
        )}
        {mergedProps.subtitle && (
          <p style={{ fontSize: isGrid ? '15px' : '18px', textAlign: 'center', opacity: 0.6, marginBottom: '32px', maxWidth: '600px', margin: '0 auto 32px' }}>
            {mergedProps.subtitle}
          </p>
        )}
        {renderCategoryButtons()}
      </div>

      {/* Grid Layout */}
      {isGrid ? (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 mx-auto" />
            </div>
          ) : displayProducts.length > 0 ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
                {displayProducts.map((product) => (
                  <div key={product.id} style={{ textAlign: 'center' }}>
                    <div style={{
                      aspectRatio: '1',
                      backgroundColor: '#f0f0f0',
                      backgroundImage: product.product_image ? `url(${product.product_image})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      borderRadius: '4px',
                      marginBottom: '16px',
                      overflow: 'hidden',
                    }}>
                      {!product.product_image && (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '14px' }}>No Image</div>
                      )}
                    </div>
                    <StarRating rating={Math.floor(Math.random() * 3 + 3)} color={mergedProps.accentColor || '#dd5903'} />
                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px', color: mergedProps.textColor }}>{product.product_name}</h3>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: mergedProps.accentColor }}>{formatPrice(product)}</span>
                  </div>
                ))}
              </div>
              {mergedProps.showViewMenuButton && mergedProps.viewMenuText && (
                <div style={{ textAlign: 'center', marginTop: '40px' }}>
                  <a
                    href={mergedProps.viewMenuLink || '/menu'}
                    style={{
                      display: 'inline-block',
                      padding: '14px 36px',
                      backgroundColor: mergedProps.viewMenuBgColor,
                      color: mergedProps.viewMenuTextColor,
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '2px',
                      borderRadius: '4px',
                    }}
                  >
                    {mergedProps.viewMenuText}
                  </a>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px', opacity: 0.5 }}>
              {selectedCategory ? 'No products in this category' : 'No products available. Add products in the Products section.'}
            </div>
          )}
        </div>
      ) : (
        /* Carousel Layout (default) */
        <div
          style={{ position: 'relative', padding: '0 20px' }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <button onClick={scrollLeft} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', zIndex: 10, backgroundColor: '#fff', border: 'none', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', opacity: isHovered ? 1 : 0, transition: 'opacity 0.3s ease' }}>
            <ChevronLeft size={24} color={mergedProps.textColor} />
          </button>
          <button onClick={scrollRight} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', zIndex: 10, backgroundColor: '#fff', border: 'none', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', opacity: isHovered ? 1 : 0, transition: 'opacity 0.3s ease' }}>
            <ChevronRight size={24} color={mergedProps.textColor} />
          </button>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 mx-auto" />
            </div>
          ) : displayProducts.length > 0 ? (
            <div ref={carouselRef} style={{ display: 'flex', gap: '20px', overflowX: 'auto', scrollBehavior: 'smooth', padding: '20px 40px', scrollbarWidth: 'none', msOverflowStyle: 'none' }} className="hide-scrollbar">
              {displayProducts.map((product) => (
                <div key={product.id} style={{ flex: '0 0 260px', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', transition: 'transform 0.3s ease, box-shadow 0.3s ease', cursor: 'pointer' }} className="menu-card-hover">
                  <div style={{ height: '180px', backgroundColor: '#f0f0f0', backgroundImage: product.product_image ? `url(${product.product_image})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
                    {!product.product_image && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '14px' }}>No Image</div>}
                  </div>
                  <div style={{ padding: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px', color: mergedProps.textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.product_name}</h3>
                    <p style={{ fontSize: '13px', color: mergedProps.textColor, opacity: 0.6, marginBottom: '12px', height: '36px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{product.product_description || ''}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '18px', fontWeight: 700, color: mergedProps.accentColor }}>{formatPrice(product)}</span>
                      <button style={{ backgroundColor: mergedProps.accentColor, color: '#fff', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold' }}>+</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px', opacity: 0.5 }}>
              {selectedCategory ? 'No products in this category' : 'No products available. Add products in the Products section.'}
            </div>
          )}

          {mergedProps.showViewMenuButton && mergedProps.viewMenuText && (
            <div style={{ textAlign: 'center', marginTop: '32px' }}>
              <a
                href={mergedProps.viewMenuLink || '/menu'}
                style={{
                  display: 'inline-block',
                  padding: '14px 32px',
                  backgroundColor: mergedProps.viewMenuBgColor,
                  color: mergedProps.viewMenuTextColor,
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                {mergedProps.viewMenuText}
              </a>
            </div>
          )}
        </div>
      )}

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .menu-card-hover:hover { transform: translateY(-8px); box-shadow: 0 12px 32px rgba(0,0,0,0.12) !important; }
      `}</style>
    </div>
  );
};

const MenuSectionSettings: React.FC = () => {
  const { actions: { setProp }, ...p } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title,
    subtitle: node.data.props.subtitle,
    showCategories: node.data.props.showCategories,
    maxProducts: node.data.props.maxProducts,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    accentColor: node.data.props.accentColor,
    autoScrollSpeed: node.data.props.autoScrollSpeed,
    layout: node.data.props.layout ?? defaultProps.layout,
    showViewMenuButton: node.data.props.showViewMenuButton ?? defaultProps.showViewMenuButton,
    viewMenuText: node.data.props.viewMenuText ?? defaultProps.viewMenuText,
    viewMenuLink: node.data.props.viewMenuLink ?? defaultProps.viewMenuLink,
    viewMenuBgColor: node.data.props.viewMenuBgColor ?? defaultProps.viewMenuBgColor,
    viewMenuTextColor: node.data.props.viewMenuTextColor ?? defaultProps.viewMenuTextColor,
    featuredProductIds: (node.data.props.featuredProductIds ?? []) as string[],
  }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Layout</Label>
        <Select value={p.layout} onValueChange={(v) => setProp((props: MenuSectionProps) => (props.layout = v as 'carousel' | 'grid'))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="carousel">Carousel</SelectItem>
            <SelectItem value="grid">Grid (4 columns)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <TranslatableInput label="Title" propKey="title" value={p.title} onChange={(v) => setProp((props: MenuSectionProps) => (props.title = v))} nodeProps={p.nodeProps} setProp={setProp} />
      <TranslatableInput label="Subtitle" propKey="subtitle" value={p.subtitle} onChange={(v) => setProp((props: MenuSectionProps) => (props.subtitle = v))} nodeProps={p.nodeProps} setProp={setProp} multiline rows={2} />

      <div className="flex items-center justify-between">
        <Label>Show Categories</Label>
        <Switch checked={p.showCategories} onCheckedChange={(c) => setProp((props: MenuSectionProps) => (props.showCategories = c))} />
      </div>

      <div className="space-y-2">
        <Label>Max Products</Label>
        <Input type="number" value={p.maxProducts} onChange={(e) => setProp((props: MenuSectionProps) => (props.maxProducts = parseInt(e.target.value) || 12))} min={4} max={30} />
      </div>

      <FeaturedProductsPicker
        value={p.featuredProductIds}
        onChange={(next) => setProp((props: MenuSectionProps) => (props.featuredProductIds = next))}
      />

      {p.layout !== 'grid' && (
        <div className="space-y-2">
          <Label>Auto-scroll Speed ({p.autoScrollSpeed}s)</Label>
          <Slider value={[p.autoScrollSpeed || 4]} onValueChange={(v) => setProp((props: MenuSectionProps) => (props.autoScrollSpeed = v[0]))} min={2} max={10} step={1} />
        </div>
      )}

      <div className="space-y-2">
        <Label>Background Color</Label>
        <Input type="color" value={p.backgroundColor} onChange={(e) => setProp((props: MenuSectionProps) => (props.backgroundColor = e.target.value))} className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Label>Text Color</Label>
        <Input type="color" value={p.textColor} onChange={(e) => setProp((props: MenuSectionProps) => (props.textColor = e.target.value))} className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Label>Accent Color</Label>
        <Input type="color" value={p.accentColor} onChange={(e) => setProp((props: MenuSectionProps) => (props.accentColor = e.target.value))} className="h-10 w-full" />
      </div>

      <div className="border-t pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label>Show &quot;View Full Menu&quot; Button</Label>
          <Switch
            checked={p.showViewMenuButton}
            onCheckedChange={(c) => setProp((props: MenuSectionProps) => (props.showViewMenuButton = c))}
          />
        </div>

        {p.showViewMenuButton && (
          <>
            <TranslatableInput
              label="Button Text"
              propKey="viewMenuText"
              value={p.viewMenuText || ''}
              onChange={(v) => setProp((props: MenuSectionProps) => (props.viewMenuText = v))}
              nodeProps={p.nodeProps}
              setProp={setProp}
              placeholder="View Full Menu"
            />
            <div className="space-y-2">
              <Label>Button Link</Label>
              <Input
                value={p.viewMenuLink || ''}
                onChange={(e) => setProp((props: MenuSectionProps) => (props.viewMenuLink = e.target.value))}
                placeholder="/menu"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-xs">Background</Label>
                <Input
                  type="color"
                  value={p.viewMenuBgColor}
                  onChange={(e) => setProp((props: MenuSectionProps) => (props.viewMenuBgColor = e.target.value))}
                  className="h-10 w-full"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Text Color</Label>
                <Input
                  type="color"
                  value={p.viewMenuTextColor}
                  onChange={(e) => setProp((props: MenuSectionProps) => (props.viewMenuTextColor = e.target.value))}
                  className="h-10 w-full"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

MenuSection.craft = {
  props: defaultProps,
  related: { settings: MenuSectionSettings },
};
