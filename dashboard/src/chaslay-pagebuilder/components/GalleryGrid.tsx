// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { useNode } from '@craftjs/core';
import { GalleryProps } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/chaslay-pagebuilder/ui/select';
import { Slider } from '@/chaslay-pagebuilder/ui/slider';
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
  title: 'Our Gallery',
  images: defaultImages,
  columns: 3,
  gap: 16,
  backgroundColor: '#ffffff',
  textColor: '#1a1a2e',
  borderRadius: 8,
  showLightbox: true,
  aspectRatio: 'square',
  maxImages: 12,
};

const aspectRatioMap: Record<string, string> = {
  square: '1 / 1',
  video: '16 / 9',
  auto: 'auto',
};

export const GalleryGrid: React.FC<GalleryProps> & {
  craft: {
    props: GalleryProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const displayImages = (mergedProps.images || []).slice(0, mergedProps.maxImages);

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
      <div
        className="hb-gallery-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${mergedProps.columns}, 1fr)`,
          gap: `${mergedProps.gap}px`,
          maxWidth: '1100px',
          margin: '0 auto',
        }}
      >
        {displayImages.map((src, i) => (
          <div
            key={i}
            onClick={() => mergedProps.showLightbox && setLightboxIndex(i)}
            style={{
              borderRadius: `${mergedProps.borderRadius}px`,
              overflow: 'hidden',
              cursor: mergedProps.showLightbox ? 'pointer' : 'default',
              aspectRatio: aspectRatioMap[mergedProps.aspectRatio || 'square'],
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

const GalleryGridSettings: React.FC = () => {
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
        <Label>Columns</Label>
        <Select value={String(p.columns)} onValueChange={(v) => setProp((props: GalleryProps) => (props.columns = parseInt(v)))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="2">2 Columns</SelectItem>
            <SelectItem value="3">3 Columns</SelectItem>
            <SelectItem value="4">4 Columns</SelectItem>
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
            <SelectItem value="auto">Auto</SelectItem>
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

GalleryGrid.craft = {
  props: defaultProps,
  related: { settings: GalleryGridSettings },
  displayName: 'Gallery Grid',
};
