// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { ContactInfoProps } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Switch } from '@/chaslay-pagebuilder/ui/switch';
import { Phone, Mail, MapPin, Map, Clock } from 'lucide-react';
import { ImageUpload } from './ImageUpload';
import { TranslatableInput } from './TranslatableInput';
import { useStorefront } from '../StorefrontContext';
import { resolveSectionId } from '../utils/section-id';

const defaultProps: ContactInfoProps = {
  title: 'Contact Us',
  showPhone: true,
  showEmail: true,
  showAddress: true,
  showMap: false,
  showHours: false,
  image: '',
  backgroundColor: '#1a1a2e',
  textColor: '#ffffff',
  accentColor: '#e94560',
};

// Placeholder contact info for preview
const placeholderContact = {
  phone: '+1 (555) 123-4567',
  fax: '+1 (555) 123-4568',
  email: 'hello@restaurant.com',
  address: '123 Main Street, City, State 12345',
};

const placeholderHours = [
  { days: 'Mon – Fri', time: '9:00am – 10:00pm' },
  { days: 'Saturday', time: '10:00am – 11:00pm' },
  { days: 'Sunday', time: '11:00am – 9:00pm' },
];

function formatAddress(contact: { address?: string | null; city?: string | null; country?: string | null }) {
  return [contact.address, contact.city, contact.country].filter(Boolean).join(', ');
}

function useContactDetails() {
  const { isStorefront, contact } = useStorefront();
  if (isStorefront && contact) {
    const address = formatAddress(contact);
    return {
      phone: contact.phone?.trim() || '',
      email: contact.email?.trim() || '',
      address,
    };
  }
  return placeholderContact;
}

export const ContactInfo: React.FC<ContactInfoProps> & {
  craft: {
    props: ContactInfoProps;
    related: { settings: React.FC };
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const {
    connectors: { connect, drag },
  } = useNode();
  const { locale, defaultLanguage } = useStorefront();
  const contactDetails = useContactDetails();
  const title =
    resolveTranslatedProp(mergedProps as Record<string, unknown>, 'title', locale, defaultLanguage) ||
    mergedProps.title;

  // 2-column layout with image
  if (mergedProps.image) {
    return (
      <div
        ref={(ref) => { if (ref) connect(drag(ref)); }}
        id={resolveSectionId(mergedProps.sectionId, 'contact')}
        className="hb-section-padding"
        style={{
          backgroundColor: mergedProps.backgroundColor,
          color: mergedProps.textColor,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div style={{
          maxWidth: '1350px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          minHeight: '500px',
        }}>
          {/* Left: Contact Details */}
          <div style={{ padding: '60px 40px' }}>
            {title && (
              <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '32px' }}>
                {title}
              </h2>
            )}
            <div style={{ width: '60px', height: '3px', backgroundColor: mergedProps.accentColor || '#e94560', marginBottom: '32px' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
              {mergedProps.showAddress && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <MapPin size={18} style={{ marginTop: '3px', opacity: 0.7, flexShrink: 0 }} />
                  <span style={{ fontSize: '15px', lineHeight: 1.6, opacity: 0.85 }}>{contactDetails.address}</span>
                </div>
              )}
              {mergedProps.showPhone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Phone size={18} style={{ opacity: 0.7, flexShrink: 0 }} />
                  <span style={{ fontSize: '15px', opacity: 0.85 }}>{contactDetails.phone}</span>
                </div>
              )}
              {mergedProps.showEmail && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Mail size={18} style={{ opacity: 0.7, flexShrink: 0 }} />
                  <span style={{ fontSize: '15px', opacity: 0.85 }}>{contactDetails.email}</span>
                </div>
              )}
            </div>

            {mergedProps.showHours && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <Clock size={18} style={{ opacity: 0.7 }} />
                  <span style={{ fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.7 }}>Hours</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {placeholderHours.map((h, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '300px', fontSize: '14px', opacity: 0.8 }}>
                      <span>{h.days}</span>
                      <span>{h.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Image */}
          <div style={{ overflow: 'hidden' }}>
            <img
              src={mergedProps.image}
              alt="Restaurant"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Default centered layout (no image)
  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      id={resolveSectionId(mergedProps.sectionId, 'contact')}
      className="hb-section-padding"
      style={{
        backgroundColor: mergedProps.backgroundColor,
        color: mergedProps.textColor,
        padding: '60px 20px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        {title && (
          <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '40px' }}>
            {title}
          </h2>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '32px',
        }}>
          {mergedProps.showPhone && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Phone size={28} />
              </div>
              <div>
                <h3 style={{ fontSize: '14px', textTransform: 'uppercase', opacity: 0.7, marginBottom: '4px' }}>Phone</h3>
                <p style={{ fontSize: '18px', fontWeight: 500 }}>{contactDetails.phone}</p>
              </div>
            </div>
          )}

          {mergedProps.showEmail && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={28} />
              </div>
              <div>
                <h3 style={{ fontSize: '14px', textTransform: 'uppercase', opacity: 0.7, marginBottom: '4px' }}>Email</h3>
                <p style={{ fontSize: '18px', fontWeight: 500 }}>{contactDetails.email}</p>
              </div>
            </div>
          )}

          {mergedProps.showAddress && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={28} />
              </div>
              <div>
                <h3 style={{ fontSize: '14px', textTransform: 'uppercase', opacity: 0.7, marginBottom: '4px' }}>Address</h3>
                <p style={{ fontSize: '18px', fontWeight: 500 }}>{contactDetails.address}</p>
              </div>
            </div>
          )}
        </div>

        {mergedProps.showMap && (
          <div style={{ marginTop: '40px', height: '300px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c757d' }}>
            <div style={{ textAlign: 'center' }}>
              <Map size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <p>Map will be displayed here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ContactInfoSettings: React.FC = () => {
  const {
    actions: { setProp },
    nodeProps,
    title,
    showPhone,
    showEmail,
    showAddress,
    showMap,
    showHours,
    image,
    backgroundColor,
    textColor,
    accentColor,
  } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title ?? defaultProps.title,
    showPhone: node.data.props.showPhone ?? defaultProps.showPhone,
    showEmail: node.data.props.showEmail ?? defaultProps.showEmail,
    showAddress: node.data.props.showAddress ?? defaultProps.showAddress,
    showMap: node.data.props.showMap ?? defaultProps.showMap,
    showHours: node.data.props.showHours ?? defaultProps.showHours,
    image: node.data.props.image ?? defaultProps.image,
    backgroundColor: node.data.props.backgroundColor ?? defaultProps.backgroundColor,
    textColor: node.data.props.textColor ?? defaultProps.textColor,
    accentColor: node.data.props.accentColor ?? defaultProps.accentColor,
  }));

  return (
    <div className="space-y-4">
      <TranslatableInput
        label="Title"
        propKey="title"
        value={title}
        onChange={(v) => setProp((props: ContactInfoProps) => (props.title = v))}
        nodeProps={nodeProps}
        setProp={setProp}
      />

      <ImageUpload
        label="Side Image"
        value={image}
        onChange={(v) => setProp((props: ContactInfoProps) => (props.image = v))}
        aspectRatio="auto"
      />
      <p className="text-[10px] text-muted-foreground -mt-2">
        Adding an image switches to a 2-column layout (details left, image right).
      </p>

      <div className="flex items-center justify-between">
        <Label>Show Phone</Label>
        <Switch checked={showPhone} onCheckedChange={(checked) => setProp((props: ContactInfoProps) => (props.showPhone = checked))} />
      </div>
      <div className="flex items-center justify-between">
        <Label>Show Email</Label>
        <Switch checked={showEmail} onCheckedChange={(checked) => setProp((props: ContactInfoProps) => (props.showEmail = checked))} />
      </div>
      <div className="flex items-center justify-between">
        <Label>Show Address</Label>
        <Switch checked={showAddress} onCheckedChange={(checked) => setProp((props: ContactInfoProps) => (props.showAddress = checked))} />
      </div>
      <div className="flex items-center justify-between">
        <Label>Show Hours</Label>
        <Switch checked={showHours} onCheckedChange={(checked) => setProp((props: ContactInfoProps) => (props.showHours = checked))} />
      </div>
      {!image && (
        <div className="flex items-center justify-between">
          <Label>Show Map</Label>
          <Switch checked={showMap} onCheckedChange={(checked) => setProp((props: ContactInfoProps) => (props.showMap = checked))} />
        </div>
      )}

      <div className="space-y-2">
        <Label>Background Color</Label>
        <Input type="color" value={backgroundColor} onChange={(e) => setProp((props: ContactInfoProps) => (props.backgroundColor = e.target.value))} className="h-10 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={textColor} onChange={(e) => setProp((props: ContactInfoProps) => (props.textColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Accent</Label>
          <Input type="color" value={accentColor} onChange={(e) => setProp((props: ContactInfoProps) => (props.accentColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>

      <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
        Note: Contact information will be automatically loaded from your business settings when displayed on the storefront.
      </div>
    </div>
  );
};

ContactInfo.craft = {
  props: defaultProps,
  related: {
    settings: ContactInfoSettings,
  },
};
