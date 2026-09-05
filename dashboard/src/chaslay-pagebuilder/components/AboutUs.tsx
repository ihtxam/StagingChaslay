// @ts-nocheck
'use client';

import React from 'react';
import { useNode } from '@craftjs/core';
import { AboutUsProps } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Textarea } from '@/chaslay-pagebuilder/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/chaslay-pagebuilder/ui/select';
import { ImageUpload } from './ImageUpload';
import { TranslatableInput } from './TranslatableInput';
import { normalizeLink } from '../utils/normalizeLink';
import { useStorefront } from '../StorefrontContext';
import { sectionAnchorId, SECTION_ANCHORS } from '../utils/section-id';

const defaultProps: AboutUsProps = {
  sectionId: SECTION_ANCHORS.about,
  title: 'About Us',
  content: 'Welcome to our restaurant! We have been serving delicious food to our community for over 20 years. Our passion for quality ingredients and exceptional service has made us a local favorite. Come visit us and experience the difference.',
  image: '',
  image2: '',
  imagePosition: 'right',
  backgroundColor: '#ffffff',
  textColor: '#1a1a2e',
  buttonText: '',
  buttonLink: '',
  buttonColor: '#e94560',
  variant: 'simple',
  accentColor: '#dd5903',
};


export const AboutUs: React.FC<AboutUsProps> & {
  craft: {
    props: AboutUsProps;
    related: { settings: React.FC };
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const { connectors: { connect, drag } } = useNode();
  const { shopHref } = useStorefront();
  const isImageLeft = mergedProps.imagePosition === 'left';
  const isElegant = mergedProps.variant === 'elegant';
  const accent = mergedProps.accentColor || '#dd5903';

  if (isElegant) {
    return (
      <div
        ref={(ref) => { if (ref) connect(drag(ref)); }}
      id={sectionAnchorId(mergedProps.sectionId, 'about')}
        id={sectionAnchorId(mergedProps.sectionId, 'about')}
        style={{ backgroundColor: mergedProps.backgroundColor, color: mergedProps.textColor, padding: '80px 20px', width: '100%' }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center' }}>
          {/* Image side with overlapping images */}
          <div style={{ position: 'relative', height: '500px', paddingLeft: '40px', paddingTop: '20px' }}>
            {/* Back image */}
            <div style={{
              position: 'absolute',
              top: '0',
              left: '0',
              width: '55%',
              height: '70%',
              borderRadius: '8px',
              overflow: 'hidden',
              zIndex: 1,
              boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
            }}>
              {mergedProps.image ? (
                <img src={mergedProps.image} alt="About 1" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', backgroundColor: '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c757d', fontSize: '14px' }}>Image 1</div>
              )}
            </div>

            {/* Front image (overlapping) */}
            <div style={{
              position: 'absolute',
              top: '25%',
              left: '30%',
              width: '60%',
              height: '70%',
              borderRadius: '8px',
              overflow: 'hidden',
              zIndex: 2,
              boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
            }}>
              {mergedProps.image2 ? (
                <img src={mergedProps.image2} alt="About 2" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : mergedProps.image ? (
                <img src={mergedProps.image} alt="About 2" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', backgroundColor: '#d9dde1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c757d', fontSize: '14px' }}>Image 2</div>
              )}
            </div>
          </div>

          {/* Text side */}
          <div>
            {mergedProps.title && (
              <h2 style={{
                fontSize: '40px',
                fontWeight: 400,
                fontFamily: "'Georgia', 'Times New Roman', serif",
                marginBottom: '0',
                lineHeight: 1.3,
              }}>
                {mergedProps.title}
              </h2>
            )}
            <p style={{ fontSize: '16px', lineHeight: 1.8, opacity: 0.65, textAlign: 'center', maxWidth: '420px', marginTop: '24px' }}>
              {mergedProps.content}
            </p>
            {mergedProps.buttonText && (
              <div style={{ marginTop: '28px' }}>
                <a
                  href={shopHref(mergedProps.buttonLink || '#')}
                  style={{
                    display: 'inline-block',
                    padding: '14px 36px',
                    backgroundColor: 'transparent',
                    color: mergedProps.textColor,
                    border: `2px solid ${mergedProps.textColor}`,
                    textDecoration: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                  }}
                >
                  {mergedProps.buttonText}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Simple variant (default - existing layout)
  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      id={sectionAnchorId(mergedProps.sectionId, 'about')}
      style={{ backgroundColor: mergedProps.backgroundColor, color: mergedProps.textColor, padding: '60px 20px', width: '100%' }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: mergedProps.image ? '1fr 1fr' : '1fr', gap: '40px', alignItems: 'center' }}>
        {isImageLeft && (
          <div style={{ borderRadius: '12px', overflow: 'hidden', height: '400px', backgroundColor: mergedProps.image ? undefined : '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c757d' }}>
            {mergedProps.image ? <img src={mergedProps.image} alt="About us" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'Image Placeholder'}
          </div>
        )}
        <div>
          {mergedProps.title && <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '24px' }}>{mergedProps.title}</h2>}
          <p style={{ fontSize: '18px', lineHeight: 1.8, opacity: 0.85 }}>{mergedProps.content}</p>
          {mergedProps.buttonText && (
            <a href={shopHref(mergedProps.buttonLink || '#')} style={{ display: 'inline-block', marginTop: '24px', padding: '12px 32px', backgroundColor: mergedProps.buttonColor || '#e94560', color: '#fff', textDecoration: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
              {mergedProps.buttonText}
            </a>
          )}
        </div>
        {!isImageLeft && (
          <div style={{ borderRadius: '12px', overflow: 'hidden', height: '400px', backgroundColor: mergedProps.image ? undefined : '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c757d' }}>
            {mergedProps.image ? <img src={mergedProps.image} alt="About us" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'Image Placeholder'}
          </div>
        )}
      </div>
    </div>
  );
};

const AboutUsSettings: React.FC = () => {
  const { actions: { setProp }, ...p } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title,
    content: node.data.props.content,
    image: node.data.props.image,
    image2: node.data.props.image2 ?? '',
    imagePosition: node.data.props.imagePosition,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    buttonText: node.data.props.buttonText ?? '',
    buttonLink: node.data.props.buttonLink ?? '',
    buttonColor: node.data.props.buttonColor ?? defaultProps.buttonColor,
    variant: node.data.props.variant ?? defaultProps.variant,
    accentColor: node.data.props.accentColor ?? defaultProps.accentColor,
  }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Variant</Label>
        <Select value={p.variant} onValueChange={(v) => setProp((props: AboutUsProps) => { props.variant = v as 'simple' | 'elegant'; })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="simple">Simple</SelectItem>
            <SelectItem value="elegant">Elegant (Overlapping Images)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <TranslatableInput
        label="Title"
        propKey="title"
        value={p.title}
        onChange={(v) => setProp((props: AboutUsProps) => (props.title = v))}
        nodeProps={p.nodeProps}
        setProp={setProp}
      />

      <TranslatableInput
        label="Content"
        propKey="content"
        value={p.content}
        onChange={(v) => setProp((props: AboutUsProps) => (props.content = v))}
        nodeProps={p.nodeProps}
        setProp={setProp}
        multiline
        rows={5}
      />

      <ImageUpload label="Image" value={p.image} onChange={(v) => setProp((props: AboutUsProps) => (props.image = v))} aspectRatio="square" />

      {p.variant === 'elegant' && (
        <ImageUpload label="Second Image (Overlapping)" value={p.image2} onChange={(v) => setProp((props: AboutUsProps) => (props.image2 = v))} aspectRatio="square" />
      )}

      {p.variant === 'simple' && (
        <div className="space-y-2">
          <Label>Image Position</Label>
          <Select value={p.imagePosition} onValueChange={(v) => setProp((props: AboutUsProps) => { props.imagePosition = v as 'left' | 'right'; })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="border-t pt-4 space-y-2">
        <TranslatableInput
          label="Button Text"
          propKey="buttonText"
          value={p.buttonText}
          onChange={(v) => setProp((props: AboutUsProps) => (props.buttonText = v))}
          nodeProps={p.nodeProps}
          setProp={setProp}
          placeholder="Leave empty to hide button"
        />
        {p.buttonText && p.variant === 'simple' && (
          <>
            <Input value={p.buttonLink} placeholder="/menu, /shop, /about" onChange={(e) => {
              const val = normalizeLink(e.target.value);
              setProp((props: AboutUsProps) => (props.buttonLink = val));
            }} />
            <Input type="color" value={p.buttonColor} onChange={(e) => setProp((props: AboutUsProps) => (props.buttonColor = e.target.value))} className="h-10 w-full" />
          </>
        )}
        {p.buttonText && p.variant === 'elegant' && (
          <Input value={p.buttonLink} placeholder="/menu, /shop, /about" onChange={(e) => {
            const val = normalizeLink(e.target.value);
            setProp((props: AboutUsProps) => (props.buttonLink = val));
          }} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Background</Label>
          <Input type="color" value={p.backgroundColor} onChange={(e) => setProp((props: AboutUsProps) => (props.backgroundColor = e.target.value))} className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Input type="color" value={p.textColor} onChange={(e) => setProp((props: AboutUsProps) => (props.textColor = e.target.value))} className="h-10 w-full" />
        </div>
      </div>

      {p.variant === 'elegant' && (
        <div className="space-y-2">
          <Label>Accent Color</Label>
          <Input type="color" value={p.accentColor} onChange={(e) => setProp((props: AboutUsProps) => (props.accentColor = e.target.value))} className="h-10 w-full" />
        </div>
      )}
    </div>
  );
};

AboutUs.craft = {
  props: defaultProps,
  related: { settings: AboutUsSettings },
  displayName: 'About Us',
};
