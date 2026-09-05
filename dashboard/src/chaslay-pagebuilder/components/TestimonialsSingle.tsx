// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { TestimonialsProps, TestimonialItem } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Textarea } from '@/chaslay-pagebuilder/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/chaslay-pagebuilder/ui/select';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { StarRating } from './StarRating';
import { TranslatableInput, TranslatableArrayInput } from './TranslatableInput';
import { sectionAnchorId, SECTION_ANCHORS } from '../utils/section-id';

const defaultTestimonials: TestimonialItem[] = [
  { text: 'An extraordinary culinary journey. Every visit reveals new flavors and the attention to detail is simply unmatched. This restaurant has become our family tradition for special occasions.', author: 'Robert & Maria Garcia', rating: 5, role: 'Loyal Patrons since 2019', photo: '' },
];

const defaultProps: TestimonialsProps = {
  sectionId: SECTION_ANCHORS.testimonials,
  title: 'Featured Review',
  testimonials: defaultTestimonials,
  backgroundColor: '#1a1a2e',
  textColor: '#ffffff',
  accentColor: '#f59e0b',
  showRatings: true,
  showPhotos: true,
  cardBackground: 'transparent',
};

export const TestimonialsSingle: React.FC<TestimonialsProps> & {
  craft: {
    props: TestimonialsProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();

  const testimonial = (mergedProps.testimonials || [])[0];
  if (!testimonial) return null;

  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      id={sectionAnchorId(mergedProps.sectionId, 'testimonials')}
      className="hb-section hb-section-padding"
      style={{
        backgroundColor: mergedProps.backgroundColor,
        width: '100%',
        boxSizing: 'border-box',
        padding: '80px 20px',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        {mergedProps.title && (
          <h3 style={{
            color: mergedProps.textColor,
            fontSize: '14px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '2px',
            marginBottom: '32px',
            opacity: 0.7,
          }}>
            {mergedProps.title}
          </h3>
        )}

        {mergedProps.showRatings && testimonial.rating && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <StarRating rating={testimonial.rating} size={24} color={mergedProps.accentColor} />
          </div>
        )}

        <p style={{
          color: mergedProps.textColor,
          fontSize: '22px',
          lineHeight: 1.8,
          fontStyle: 'italic',
          marginBottom: '32px',
        }}>
          &ldquo;{testimonial.text}&rdquo;
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
          {mergedProps.showPhotos && (
            testimonial.photo ? (
              <img src={testimonial.photo} alt={testimonial.author} style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%', backgroundColor: mergedProps.accentColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '22px', fontWeight: 600,
              }}>
                {testimonial.author.charAt(0)}
              </div>
            )
          )}
          <div style={{ textAlign: 'left' }}>
            <div style={{ color: mergedProps.textColor, fontWeight: 600, fontSize: '16px' }}>{testimonial.author}</div>
            {testimonial.role && <div style={{ color: mergedProps.textColor, opacity: 0.6, fontSize: '14px' }}>{testimonial.role}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

const TestimonialsSingleSettings: React.FC = () => {
  const { actions: { setProp }, ...p } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title ?? defaultProps.title,
    testimonials: node.data.props.testimonials ?? defaultProps.testimonials,
    backgroundColor: node.data.props.backgroundColor ?? defaultProps.backgroundColor,
    textColor: node.data.props.textColor ?? defaultProps.textColor,
    accentColor: node.data.props.accentColor ?? defaultProps.accentColor,
    showRatings: node.data.props.showRatings ?? defaultProps.showRatings,
    showPhotos: node.data.props.showPhotos ?? defaultProps.showPhotos,
  }));

  const testimonial = (p.testimonials || [])[0] || { text: '', author: '', rating: 5, role: '', photo: '' };

  // Ensure at least one testimonial exists
  const ensureTestimonial = () => {
    if ((p.testimonials || []).length === 0) {
      setProp((props: TestimonialsProps) => {
        props.testimonials = [{ text: '', author: '', rating: 5, role: '', photo: '' }];
      });
    }
  };

  return (
    <div className="space-y-4" onClick={ensureTestimonial}>
      <TranslatableInput label="Section Label" propKey="title" value={p.title} onChange={(v) => setProp((props: TestimonialsProps) => (props.title = v))} nodeProps={p.nodeProps} setProp={setProp} />

      <div className="border-t pt-4 space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Testimonial</Label>
        <TranslatableArrayInput propKey="text" arrayPropKey="testimonials" index={0} nodeProps={p.nodeProps} setProp={setProp} value={testimonial.text} onChange={(v) => setProp((props: TestimonialsProps) => { if (props.testimonials?.[0]) props.testimonials[0].text = v; })} placeholder="Testimonial text" multiline rows={4} />
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Author</Label>
            <TranslatableArrayInput propKey="author" arrayPropKey="testimonials" index={0} nodeProps={p.nodeProps} setProp={setProp} value={testimonial.author} onChange={(v) => setProp((props: TestimonialsProps) => { if (props.testimonials?.[0]) props.testimonials[0].author = v; })} className="h-8" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Role</Label>
            <TranslatableArrayInput propKey="role" arrayPropKey="testimonials" index={0} nodeProps={p.nodeProps} setProp={setProp} value={testimonial.role || ''} onChange={(v) => setProp((props: TestimonialsProps) => { if (props.testimonials?.[0]) props.testimonials[0].role = v; })} className="h-8" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Rating</Label>
          <Select value={String(testimonial.rating || 5)} onValueChange={(v) => setProp((props: TestimonialsProps) => { if (props.testimonials?.[0]) props.testimonials[0].rating = parseInt(v); })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n} Star{n > 1 ? 's' : ''}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Photo URL</Label>
          <Input
            value={testimonial.photo || ''}
            onChange={(e) => setProp((props: TestimonialsProps) => { if (props.testimonials?.[0]) props.testimonials[0].photo = e.target.value; })}
            placeholder="Optional photo URL"
            className="h-8"
          />
        </div>
      </div>

      <div className="border-t pt-4 space-y-3">
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
        <div className="space-y-2">
          <Label>Accent Color</Label>
          <Input type="color" value={p.accentColor} onChange={(e) => setProp((props: TestimonialsProps) => (props.accentColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="flex items-center justify-between">
          <Label>Show Rating</Label>
          <input type="checkbox" checked={p.showRatings} onChange={(e) => setProp((props: TestimonialsProps) => (props.showRatings = e.target.checked))} className="h-4 w-4" />
        </div>
        <div className="flex items-center justify-between">
          <Label>Show Photo</Label>
          <input type="checkbox" checked={p.showPhotos} onChange={(e) => setProp((props: TestimonialsProps) => (props.showPhotos = e.target.checked))} className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
};

TestimonialsSingle.craft = {
  props: defaultProps,
  related: { settings: TestimonialsSingleSettings },
  displayName: 'Testimonial Featured',
};
