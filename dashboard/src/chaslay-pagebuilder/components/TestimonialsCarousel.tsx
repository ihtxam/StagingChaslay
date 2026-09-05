// @ts-nocheck
'use client';

import React, { useRef } from 'react';
import { useNode } from '@craftjs/core';
import { TestimonialsProps, TestimonialItem } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Textarea } from '@/chaslay-pagebuilder/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/chaslay-pagebuilder/ui/select';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { StarRating } from './StarRating';
import { TranslatableInput, TranslatableArrayInput } from './TranslatableInput';
import { sectionAnchorId, SECTION_ANCHORS } from '../utils/section-id';

const defaultTestimonials: TestimonialItem[] = [
  { text: 'The food was absolutely amazing! Best dining experience we have had in years.', author: 'Sarah Johnson', rating: 5, role: 'Food Critic', photo: '' },
  { text: 'Wonderful atmosphere and excellent service. The pasta dishes are to die for!', author: 'Michael Chen', rating: 5, role: 'Regular Customer', photo: '' },
  { text: 'A hidden gem! Every dish is crafted with care and the flavors are incredible.', author: 'Emma Williams', rating: 4, role: 'Local Foodie', photo: '' },
  { text: 'We celebrated our anniversary here and it was perfect. Highly recommended!', author: 'James & Lisa Brown', rating: 5, role: '', photo: '' },
];

const defaultProps: TestimonialsProps = {
  sectionId: SECTION_ANCHORS.testimonials,
  title: 'Customer Reviews',
  testimonials: defaultTestimonials,
  backgroundColor: '#f8f9fa',
  textColor: '#1a1a2e',
  accentColor: '#f59e0b',
  showRatings: true,
  showPhotos: true,
  cardBackground: '#ffffff',
};

export const TestimonialsCarousel: React.FC<TestimonialsProps> & {
  craft: {
    props: TestimonialsProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.6;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      id={sectionAnchorId(mergedProps.sectionId, 'testimonials')}
      className="hb-section hb-section-padding"
      style={{
        backgroundColor: mergedProps.backgroundColor,
        width: '100%',
        boxSizing: 'border-box',
        padding: '64px 20px',
      }}
    >
      {mergedProps.title && (
        <h3 style={{
          color: mergedProps.textColor,
          fontSize: '28px',
          fontWeight: 600,
          textAlign: 'center',
          marginBottom: '48px',
        }}>
          {mergedProps.title}
        </h3>
      )}
      <div style={{ position: 'relative', maxWidth: '1100px', margin: '0 auto' }}>
        <button
          onClick={() => scroll('left')}
          style={{
            position: 'absolute', left: '-16px', top: '50%', transform: 'translateY(-50%)', zIndex: 2,
            background: 'rgba(255,255,255,0.9)', border: '1px solid #e5e7eb', borderRadius: '50%',
            width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <ChevronLeft size={20} color="#374151" />
        </button>
        <button
          onClick={() => scroll('right')}
          style={{
            position: 'absolute', right: '-16px', top: '50%', transform: 'translateY(-50%)', zIndex: 2,
            background: 'rgba(255,255,255,0.9)', border: '1px solid #e5e7eb', borderRadius: '50%',
            width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <ChevronRight size={20} color="#374151" />
        </button>

        <div
          ref={scrollRef}
          style={{
            display: 'flex',
            gap: '24px',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            padding: '4px 0',
          }}
        >
          {(mergedProps.testimonials || []).map((t, i) => (
            <div
              key={i}
              style={{
                flexShrink: 0,
                width: '340px',
                backgroundColor: mergedProps.cardBackground,
                borderRadius: '12px',
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                scrollSnapAlign: 'start',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}
            >
              {mergedProps.showRatings && t.rating && (
                <StarRating rating={t.rating} color={mergedProps.accentColor} />
              )}
              <p style={{
                color: mergedProps.textColor,
                fontSize: '15px',
                lineHeight: 1.7,
                fontStyle: 'italic',
                flex: 1,
              }}>
                &ldquo;{t.text}&rdquo;
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                {mergedProps.showPhotos && (
                  t.photo ? (
                    <img src={t.photo} alt={t.author} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '50%', backgroundColor: mergedProps.accentColor,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '16px', fontWeight: 600,
                    }}>
                      {t.author.charAt(0)}
                    </div>
                  )
                )}
                <div>
                  <div style={{ color: mergedProps.textColor, fontWeight: 600, fontSize: '14px' }}>{t.author}</div>
                  {t.role && <div style={{ color: mergedProps.textColor, opacity: 0.6, fontSize: '13px' }}>{t.role}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TestimonialsCarouselSettings: React.FC = () => {
  const { actions: { setProp }, ...p } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title ?? defaultProps.title,
    testimonials: node.data.props.testimonials ?? defaultProps.testimonials,
    backgroundColor: node.data.props.backgroundColor ?? defaultProps.backgroundColor,
    textColor: node.data.props.textColor ?? defaultProps.textColor,
    accentColor: node.data.props.accentColor ?? defaultProps.accentColor,
    showRatings: node.data.props.showRatings ?? defaultProps.showRatings,
    showPhotos: node.data.props.showPhotos ?? defaultProps.showPhotos,
    cardBackground: node.data.props.cardBackground ?? defaultProps.cardBackground,
  }));

  const addTestimonial = () => setProp((props: TestimonialsProps) => {
    props.testimonials = [...(props.testimonials || []), { text: 'New testimonial text...', author: 'Guest Name', rating: 5, role: '', photo: '' }];
  });
  const removeTestimonial = (i: number) => setProp((props: TestimonialsProps) => {
    props.testimonials = (props.testimonials || []).filter((_, idx) => idx !== i);
  });

  return (
    <div className="space-y-4">
      <TranslatableInput label="Title" propKey="title" value={p.title} onChange={(v) => setProp((props: TestimonialsProps) => (props.title = v))} nodeProps={p.nodeProps} setProp={setProp} />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={p.backgroundColor} onChange={(e) => setProp((props: TestimonialsProps) => (props.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={p.textColor} onChange={(e) => setProp((props: TestimonialsProps) => (props.textColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Accent Color</Label>
          <Input type="color" value={p.accentColor} onChange={(e) => setProp((props: TestimonialsProps) => (props.accentColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Card Background</Label>
          <Input type="color" value={p.cardBackground} onChange={(e) => setProp((props: TestimonialsProps) => (props.cardBackground = e.target.value))} className="h-10 w-full" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label>Show Ratings</Label>
        <input type="checkbox" checked={p.showRatings} onChange={(e) => setProp((props: TestimonialsProps) => (props.showRatings = e.target.checked))} className="h-4 w-4" />
      </div>

      <div className="flex items-center justify-between">
        <Label>Show Photos</Label>
        <input type="checkbox" checked={p.showPhotos} onChange={(e) => setProp((props: TestimonialsProps) => (props.showPhotos = e.target.checked))} className="h-4 w-4" />
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <Label>Testimonials</Label>
          <Button variant="outline" size="sm" onClick={addTestimonial}><Plus className="w-4 h-4" /></Button>
        </div>
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {(p.testimonials || []).map((t: TestimonialItem, i: number) => (
            <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
                <Button variant="ghost" size="sm" onClick={() => removeTestimonial(i)} className="h-6 w-6 p-0 text-destructive"><Trash2 className="w-3 h-3" /></Button>
              </div>
              <TranslatableArrayInput propKey="text" arrayPropKey="testimonials" index={i} nodeProps={p.nodeProps} setProp={setProp} value={t.text} onChange={(v) => setProp((props: TestimonialsProps) => { if (props.testimonials) props.testimonials[i].text = v; })} placeholder="Testimonial text" className="text-xs" multiline rows={2} />
              <div className="grid grid-cols-2 gap-2">
                <TranslatableArrayInput propKey="author" arrayPropKey="testimonials" index={i} nodeProps={p.nodeProps} setProp={setProp} value={t.author} onChange={(v) => setProp((props: TestimonialsProps) => { if (props.testimonials) props.testimonials[i].author = v; })} placeholder="Author" className="h-8 text-xs" />
                <TranslatableArrayInput propKey="role" arrayPropKey="testimonials" index={i} nodeProps={p.nodeProps} setProp={setProp} value={t.role || ''} onChange={(v) => setProp((props: TestimonialsProps) => { if (props.testimonials) props.testimonials[i].role = v; })} placeholder="Role" className="h-8 text-xs" />
              </div>
              <Select value={String(t.rating || 5)} onValueChange={(v) => setProp((props: TestimonialsProps) => { if (props.testimonials) props.testimonials[i].rating = parseInt(v); })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n} Star{n > 1 ? 's' : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

TestimonialsCarousel.craft = {
  props: defaultProps,
  related: { settings: TestimonialsCarouselSettings },
  displayName: 'Testimonials Carousel',
};
