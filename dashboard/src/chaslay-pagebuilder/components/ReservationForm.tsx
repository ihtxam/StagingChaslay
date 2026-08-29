// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { ReservationFormProps } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/chaslay-pagebuilder/ui/select';
import { ImageUpload } from './ImageUpload';
import { TranslatableInput } from './TranslatableInput';

const defaultProps: ReservationFormProps = {
  title: 'Reserve a Table',
  subtitle: 'Book your dining experience with us',
  backgroundColor: '#1a1a2e',
  textColor: '#ffffff',
  accentColor: '#e94560',
  buttonColor: '#e94560',
  buttonText: 'Book Now',
  layout: 'full',
  image: '',
  imagePosition: 'left',
};

export const ReservationForm: React.FC<ReservationFormProps> & {
  craft: {
    props: ReservationFormProps;
    related: { settings: React.FC };
    displayName: string;
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();

  if (mergedProps.layout === 'inline') {
    const borderColor = mergedProps.textColor === '#ffffff' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';
    const inputBg = mergedProps.textColor === '#ffffff' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';

    return (
      <div
        ref={(ref) => { if (ref) connect(drag(ref)); }}
        className="hb-section"
        style={{
          backgroundColor: mergedProps.backgroundColor,
          width: '100%',
          boxSizing: 'border-box',
          padding: '20px 40px',
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={{ color: mergedProps.textColor, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', display: 'block', opacity: 0.7 }}>Number of Guest</label>
            <input
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '4px',
                border: `1px solid ${borderColor}`,
                backgroundColor: inputBg,
                color: mergedProps.textColor,
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
              placeholder="2 guests"
              readOnly
            />
          </div>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={{ color: mergedProps.textColor, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', display: 'block', opacity: 0.7 }}>Select Date</label>
            <input
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '4px',
                border: `1px solid ${borderColor}`,
                backgroundColor: inputBg,
                color: mergedProps.textColor,
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
              placeholder="Select date"
              readOnly
            />
          </div>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={{ color: mergedProps.textColor, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', display: 'block', opacity: 0.7 }}>Select Time</label>
            <input
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '4px',
                border: `1px solid ${borderColor}`,
                backgroundColor: inputBg,
                color: mergedProps.textColor,
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
              placeholder="Select time"
              readOnly
            />
          </div>
          <div style={{ minWidth: '180px' }}>
            <label style={{ fontSize: '11px', marginBottom: '6px', display: 'block', opacity: 0 }}>&#8203;</label>
            <button style={{
              width: '100%',
              padding: '10px 28px',
              backgroundColor: mergedProps.buttonColor,
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              whiteSpace: 'nowrap',
            }}>
              {mergedProps.buttonText}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: mergedProps.textColor,
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none',
  };

  const isImageLeft = mergedProps.imagePosition === 'left';

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
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'center' }}>
        {/* Image side */}
        <div style={{ order: isImageLeft ? 0 : 1, borderRadius: '12px', overflow: 'hidden', height: '100%', minHeight: '400px', backgroundColor: mergedProps.image ? undefined : '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c757d' }}>
          {mergedProps.image ? (
            <img src={mergedProps.image} alt="Reservation" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : 'Image Placeholder'}
        </div>
        {/* Form side */}
        <div style={{ order: isImageLeft ? 1 : 0, textAlign: 'center' }}>
          {mergedProps.title && (
            <h3 style={{ color: mergedProps.textColor, fontSize: '28px', fontWeight: 600, marginBottom: '12px' }}>
              {mergedProps.title}
            </h3>
          )}
          {mergedProps.subtitle && (
            <p style={{ color: mergedProps.textColor, opacity: 0.7, fontSize: '16px', marginBottom: '36px' }}>
              {mergedProps.subtitle}
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', textAlign: 'left' }}>
            <div>
              <label style={{ color: mergedProps.textColor, fontSize: '13px', fontWeight: 500, marginBottom: '6px', display: 'block', opacity: 0.8 }}>Name</label>
              <input style={inputStyle} placeholder="Your name" readOnly />
            </div>
            <div>
              <label style={{ color: mergedProps.textColor, fontSize: '13px', fontWeight: 500, marginBottom: '6px', display: 'block', opacity: 0.8 }}>Email</label>
              <input style={inputStyle} placeholder="your@email.com" readOnly />
            </div>
            <div>
              <label style={{ color: mergedProps.textColor, fontSize: '13px', fontWeight: 500, marginBottom: '6px', display: 'block', opacity: 0.8 }}>Phone</label>
              <input style={inputStyle} placeholder="+1 (555) 000-0000" readOnly />
            </div>
            <div>
              <label style={{ color: mergedProps.textColor, fontSize: '13px', fontWeight: 500, marginBottom: '6px', display: 'block', opacity: 0.8 }}>Guests</label>
              <input style={inputStyle} placeholder="2 guests" readOnly />
            </div>
            <div>
              <label style={{ color: mergedProps.textColor, fontSize: '13px', fontWeight: 500, marginBottom: '6px', display: 'block', opacity: 0.8 }}>Date</label>
              <input style={inputStyle} placeholder="Select date" readOnly />
            </div>
            <div>
              <label style={{ color: mergedProps.textColor, fontSize: '13px', fontWeight: 500, marginBottom: '6px', display: 'block', opacity: 0.8 }}>Time</label>
              <input style={inputStyle} placeholder="Select time" readOnly />
            </div>
          </div>
          <button style={{
            marginTop: '24px',
            width: '100%',
            padding: '14px',
            backgroundColor: mergedProps.buttonColor,
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
          }}>
            {mergedProps.buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};

const ReservationFormSettings: React.FC = () => {
  const { actions: { setProp }, ...p } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title ?? defaultProps.title,
    subtitle: node.data.props.subtitle ?? defaultProps.subtitle,
    backgroundColor: node.data.props.backgroundColor ?? defaultProps.backgroundColor,
    textColor: node.data.props.textColor ?? defaultProps.textColor,
    accentColor: node.data.props.accentColor ?? defaultProps.accentColor,
    buttonColor: node.data.props.buttonColor ?? defaultProps.buttonColor,
    buttonText: node.data.props.buttonText ?? defaultProps.buttonText,
    layout: node.data.props.layout ?? defaultProps.layout,
    image: node.data.props.image ?? defaultProps.image,
    imagePosition: node.data.props.imagePosition ?? defaultProps.imagePosition,
  }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Layout</Label>
        <Select value={p.layout} onValueChange={(v) => setProp((props: ReservationFormProps) => (props.layout = v as 'inline' | 'full'))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full">Full Form</SelectItem>
            <SelectItem value="inline">Inline Bar</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {p.layout !== 'inline' && (
        <>
          <TranslatableInput label="Title" propKey="title" value={p.title} onChange={(v) => setProp((props: ReservationFormProps) => (props.title = v))} nodeProps={p.nodeProps} setProp={setProp} />
          <TranslatableInput label="Subtitle" propKey="subtitle" value={p.subtitle} onChange={(v) => setProp((props: ReservationFormProps) => (props.subtitle = v))} nodeProps={p.nodeProps} setProp={setProp} />
          <ImageUpload label="Image" value={p.image} onChange={(v) => setProp((props: ReservationFormProps) => (props.image = v))} aspectRatio="video" />
          <div className="space-y-2">
            <Label>Image Position</Label>
            <Select value={p.imagePosition} onValueChange={(v) => setProp((props: ReservationFormProps) => (props.imagePosition = v as 'left' | 'right'))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}
      <TranslatableInput label="Button Text" propKey="buttonText" value={p.buttonText} onChange={(v) => setProp((props: ReservationFormProps) => (props.buttonText = v))} nodeProps={p.nodeProps} setProp={setProp} />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={p.backgroundColor} onChange={(e) => setProp((props: ReservationFormProps) => (props.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={p.textColor} onChange={(e) => setProp((props: ReservationFormProps) => (props.textColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Accent</Label>
          <Input type="color" value={p.accentColor} onChange={(e) => setProp((props: ReservationFormProps) => (props.accentColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Button Color</Label>
          <Input type="color" value={p.buttonColor} onChange={(e) => setProp((props: ReservationFormProps) => (props.buttonColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
};

ReservationForm.craft = {
  props: defaultProps,
  related: { settings: ReservationFormSettings },
  displayName: 'Reservation Form',
};
