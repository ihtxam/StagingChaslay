// @ts-nocheck
'use client';

import React, { useState, useRef } from 'react';
import { useNode } from '@craftjs/core';
import { GalleryProps } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/chaslay-pagebuilder/ui/select';
import { Slider } from '@/chaslay-pagebuilder/ui/slider';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Lightbox } from './Lightbox';
import { TranslatableInput } from './TranslatableInput';
import { MultiImageUpload } from './MultiImageUpload';

const defaultImages = [
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80',
  'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&q=80',
  'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=600&q=80',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600&q=80',
];

const defaultProps: GalleryProps = {
  title: 'Gallery',
  images: defaultImages,
  columns: 3,
  gap: 16,
  backgroundColor: '#ffffff',
  textColor: '#1a1a2e',
  borderRadius: 12,
  showLightbox: true,
  aspectRatio: 'video',
  maxImages: 12,
};

const aspectRatioMap: Record<string, string> = {
  square: '1 / 1',
  video: '16 / 9',
  auto: '4 / 3',
};

export const GalleryCarousel: React.FC<GalleryProps> & {
  craft: {
    props: GalleryProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const displayImages = (mergedProps.images || []).slice(0, mergedProps.maxImages);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.7;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      className="hb-section hb-section-padding"
      style={{
        backgroundColor: mergedProps.backgroundColor,
        width: '100%',
        boxSizing: 'border-box',
        padding: '48px 20px',
      }}
    >
      {mergedProps.title && (
        <h3 style={{
          color: mergedProps.textColor,
          fontSize: '28px',
          fontWeight: 600,
          textAlign: 'center',
          marginBottom: '32px',
        }}>
          {mergedProps.title}
        </h3>
      )}
      <div style={{ position: 'relative', maxWidth: '1100px', margin: '0 auto' }}>
        {/* Nav arrows */}
        <button
          onClick={() => scroll('left')}
          style={{
            position: 'absolute',
            left: '-16px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 2,
            background: 'rgba(255,255,255,0.9)',
            border: '1px solid #e5e7eb',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <ChevronLeft size={20} color="#374151" />
        </button>
        <button
          onClick={() => scroll('right')}
          style={{
            position: 'absolute',
            right: '-16px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 2,
            background: 'rgba(255,255,255,0.9)',
            border: '1px solid #e5e7eb',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <ChevronRight size={20} color="#374151" />
        </button>

        {/* Scrollable container */}
        <div
          ref={scrollRef}
          className="hb-gallery-carousel"
          style={{
            display: 'flex',
            gap: `${mergedProps.gap}px`,
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            padding: '4px 0',
          }}
        >
          {displayImages.map((src, i) => (
            <div
              key={i}
              onClick={() => mergedProps.showLightbox && setLightboxIndex(i)}
              style={{
                flexShrink: 0,
                width: `calc(${100 / (mergedProps.columns || 3)}% - ${((mergedProps.columns || 3) - 1) * (mergedProps.gap || 16) / (mergedProps.columns || 3)}px)`,
                borderRadius: `${mergedProps.borderRadius}px`,
                overflow: 'hidden',
                scrollSnapAlign: 'start',
                cursor: mergedProps.showLightbox ? 'pointer' : 'default',
                aspectRatio: aspectRatioMap[mergedProps.aspectRatio || 'video'],
              }}
            >
              <img
                src={src}
                alt={`Gallery ${i + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  transition: 'transform 0.3s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              />
            </div>
          ))}
        </div>
      </div>

      {lightboxIndex !== null && mergedProps.showLightbox && (
        <Lightbox
          images={displayImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((lightboxIndex - 1 + displayImages.length) % displayImages.length)}
          onNext={() => setLightboxIndex((lightboxIndex + 1) % displayImages.length)}
        />
      )}
    </div>
  );
};

const GalleryCarouselSettings: React.FC = () => {
  const { actions: { setProp }, ...p } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title ?? defaultProps.title,
    images: node.data.props.images ?? defaultProps.images,
    columns: node.data.props.columns ?? defaultProps.columns,
    gap: node.data.props.gap ?? defaultProps.gap,
    backgroundColor: node.data.props.backgroundColor ?? defaultProps.backgroundColor,
    textColor: node.data.props.textColor ?? defaultProps.textColor,
    borderRadius: node.data.props.borderRadius ?? defaultProps.borderRadius,
    showLightbox: node.data.props.showLightbox ?? defaultProps.showLightbox,
    aspectRatio: node.data.props.aspectRatio ?? defaultProps.aspectRatio,
    maxImages: node.data.props.maxImages ?? defaultProps.maxImages,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput label="Title" propKey="title" value={p.title} onChange={(v) => setProp((props: GalleryProps) => (props.title = v))} nodeProps={p.nodeProps} setProp={setProp} />

      <div className="space-y-2">
        <Label>Visible Slides</Label>
        <Select value={String(p.columns)} onValueChange={(v) => setProp((props: GalleryProps) => (props.columns = parseInt(v)))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 Slide</SelectItem>
            <SelectItem value="2">2 Slides</SelectItem>
            <SelectItem value="3">3 Slides</SelectItem>
            <SelectItem value="4">4 Slides</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Aspect Ratio</Label>
        <Select value={p.aspectRatio} onValueChange={(v) => setProp((props: GalleryProps) => (props.aspectRatio = v as GalleryProps['aspectRatio']))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="square">Square (1:1)</SelectItem>
            <SelectItem value="video">Video (16:9)</SelectItem>
            <SelectItem value="auto">Auto (4:3)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Gap ({p.gap}px)</Label>
        <Slider value={[p.gap]} onValueChange={([v]) => setProp((props: GalleryProps) => (props.gap = v))} min={0} max={32} step={4} />
      </div>

      <div className="space-y-2">
        <Label>Border Radius ({p.borderRadius}px)</Label>
        <Slider value={[p.borderRadius]} onValueChange={([v]) => setProp((props: GalleryProps) => (props.borderRadius = v))} min={0} max={24} step={2} />
      </div>

      <div className="flex items-center justify-between">
        <Label>Enable Lightbox</Label>
        <input type="checkbox" checked={p.showLightbox} onChange={(e) => setProp((props: GalleryProps) => (props.showLightbox = e.target.checked))} className="h-4 w-4" />
      </div>

      <div className="space-y-2">
        <Label>Background Color</Label>
        <Input type="color" value={p.backgroundColor} onChange={(e) => setProp((props: GalleryProps) => (props.backgroundColor = e.target.value))} className="h-10 w-full" />
      </div>

      <div className="space-y-2">
        <Label>Text Color</Label>
        <Input type="color" value={p.textColor} onChange={(e) => setProp((props: GalleryProps) => (props.textColor = e.target.value))} className="h-10 w-full" />
      </div>

      <div className="border-t pt-4">
        <MultiImageUpload
          label="Images"
          images={p.images}
          onChange={(next) => setProp((props: GalleryProps) => (props.images = next))}
          maxPerUpload={3}
        />
      </div>
    </div>
  );
};

GalleryCarousel.craft = {
  props: defaultProps,
  related: { settings: GalleryCarouselSettings },
  displayName: 'Gallery Carousel',
};
