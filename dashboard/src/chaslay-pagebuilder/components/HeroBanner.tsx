// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { useNode, useEditor } from '@craftjs/core';
import { HeroBannerProps } from '@/chaslay-pagebuilder/types/homepage-builder';
import { Label } from '@/chaslay-pagebuilder/ui/label';
import { Input } from '@/chaslay-pagebuilder/ui/input';
import { Textarea } from '@/chaslay-pagebuilder/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/chaslay-pagebuilder/ui/select';
import { Slider } from '@/chaslay-pagebuilder/ui/slider';
import { normalizeLink } from '../utils/normalizeLink';
import { Switch } from '@/chaslay-pagebuilder/ui/switch';
import { Button } from '@/chaslay-pagebuilder/ui/button';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { ImageUpload } from './ImageUpload';
import { TextFormatToolbar } from './TextFormatToolbar';
import { TranslatableInput } from './TranslatableInput';
import { useStorefront } from '../StorefrontContext';
import { resolveTranslatedProp } from '../utils/resolve-translated-prop';

const defaultProps: HeroBannerProps = {
  title: 'Welcome to Our Restaurant',
  titleFontSize: 48,
  titleFontWeight: 'bold',
  titleFontStyle: 'normal',
  subtitle: 'Experience the finest cuisine in town',
  subtitleFontSize: 20,
  subtitleFontWeight: 'normal',
  subtitleFontStyle: 'normal',
  backgroundImage: '',
  backgroundColor: '#1a1a2e',
  textColor: '#ffffff',
  buttonText: 'Order Now',
  buttonLink: '/menu',
  buttonColor: '#e94560',
  minHeight: 400,
  overlayOpacity: 50,
  textAlign: 'center',
  enableSlider: false,
  sliderImages: [],
  sliderSpeed: 5,
  sliderTransition: 'fade',
};

const fontWeightMap: Record<string, number> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

export const HeroBanner: React.FC<HeroBannerProps> & {
  craft: {
    props: HeroBannerProps;
    related: { settings: React.FC };
  };
} = (props) => {
  const mergedProps = { ...defaultProps, ...props };
  const {
    connectors: { connect, drag },
  } = useNode();
  const { enabled: editorEnabled } = useEditor((state) => ({
    enabled: state.options.enabled,
  }));
  const { shopHref, locale, defaultLanguage } = useStorefront();

  const title =
    resolveTranslatedProp(mergedProps as Record<string, unknown>, 'title', locale, defaultLanguage) ||
    mergedProps.title;
  const subtitle =
    resolveTranslatedProp(mergedProps as Record<string, unknown>, 'subtitle', locale, defaultLanguage) ||
    mergedProps.subtitle;
  const buttonText =
    resolveTranslatedProp(mergedProps as Record<string, unknown>, 'buttonText', locale, defaultLanguage) ||
    mergedProps.buttonText;

  const enableSlider = mergedProps.enableSlider || false;
  const sliderImages = mergedProps.sliderImages || [];
  const sliderSpeed = mergedProps.sliderSpeed || 5;
  const sliderTransition = mergedProps.sliderTransition || 'fade';

  const [currentSlide, setCurrentSlide] = useState(0);

  // Reset currentSlide if it exceeds array length
  useEffect(() => {
    if (enableSlider && sliderImages.length > 0 && currentSlide >= sliderImages.length) {
      setCurrentSlide(0);
    }
  }, [sliderImages.length, currentSlide, enableSlider]);

  // Auto-rotation timer (live preview only — disabled in editor)
  useEffect(() => {
    if (editorEnabled) return;
    if (!enableSlider || sliderImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % sliderImages.length);
    }, sliderSpeed * 1000);
    return () => clearInterval(interval);
  }, [editorEnabled, enableSlider, sliderImages.length, sliderSpeed]);

  const hasBackground = enableSlider ? sliderImages.length > 0 : !!mergedProps.backgroundImage;

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: `rgba(0, 0, 0, ${(mergedProps.overlayOpacity || 50) / 100})`,
    zIndex: 1,
  };

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref));
      }}
      className="hb-hero"
      style={{
        position: 'relative',
        minHeight: `${mergedProps.minHeight}px`,
        backgroundColor: mergedProps.backgroundColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Background layer */}
      {enableSlider ? (
        sliderImages.map((img, index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `url(${img})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: index === currentSlide ? 1 : 0,
              transform: sliderTransition === 'slide'
                ? (index === currentSlide ? 'translateX(0)' : 'translateX(100%)')
                : undefined,
              transition: sliderTransition === 'fade'
                ? 'opacity 1s ease-in-out'
                : 'transform 0.8s ease-in-out, opacity 0.8s ease-in-out',
              zIndex: 0,
            }}
          />
        ))
      ) : mergedProps.backgroundImage ? (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `url(${mergedProps.backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            zIndex: 0,
          }}
        />
      ) : null}

      {/* Overlay */}
      {hasBackground && <div style={overlayStyle} />}

      {/* Content */}
      <div
        className="hb-hero-content"
        style={{
          position: 'relative',
          zIndex: 2,
          textAlign: mergedProps.textAlign,
          maxWidth: '1100px',
          width: '100%',
          padding: '0 16px',
          boxSizing: 'border-box',
        }}
      >
        <h1
          style={{
            color: mergedProps.textColor,
            fontSize: `${mergedProps.titleFontSize}px`,
            fontWeight: fontWeightMap[mergedProps.titleFontWeight || 'bold'],
            fontStyle: mergedProps.titleFontStyle || 'normal',
            marginBottom: '16px',
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              color: mergedProps.textColor,
              fontSize: `${mergedProps.subtitleFontSize}px`,
              fontWeight: fontWeightMap[mergedProps.subtitleFontWeight || 'normal'],
              fontStyle: mergedProps.subtitleFontStyle || 'normal',
              opacity: 0.9,
              marginBottom: '32px',
            }}
          >
            {subtitle}
          </p>
        )}
        {buttonText && (
          <a
            href={shopHref(mergedProps.buttonLink || '/menu')}
            style={{
              display: 'inline-block',
              backgroundColor: mergedProps.buttonColor,
              color: '#ffffff',
              padding: '14px 32px',
              fontSize: '16px',
              fontWeight: 600,
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              textDecoration: 'none',
              transition: 'opacity 0.2s',
            }}
          >
            {buttonText}
          </a>
        )}
      </div>

      {/* Slider indicator dots */}
      {enableSlider && sliderImages.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '8px',
            zIndex: 2,
          }}
        >
          {sliderImages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.8)',
                backgroundColor: index === currentSlide ? '#ffffff' : 'transparent',
                cursor: 'pointer',
                padding: 0,
                transition: 'background-color 0.3s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const HeroBannerSettings: React.FC = () => {
  const {
    actions: { setProp },
    nodeProps,
    title,
    titleFontSize,
    titleFontWeight,
    titleFontStyle,
    subtitle,
    subtitleFontSize,
    subtitleFontWeight,
    subtitleFontStyle,
    backgroundImage,
    backgroundColor,
    textColor,
    buttonText,
    buttonLink,
    buttonColor,
    minHeight,
    overlayOpacity,
    textAlign,
    enableSlider,
    sliderImages,
    sliderSpeed,
    sliderTransition,
  } = useNode((node) => ({
    nodeProps: node.data.props,
    title: node.data.props.title,
    titleFontSize: node.data.props.titleFontSize ?? defaultProps.titleFontSize,
    titleFontWeight: node.data.props.titleFontWeight ?? defaultProps.titleFontWeight,
    titleFontStyle: node.data.props.titleFontStyle ?? defaultProps.titleFontStyle,
    subtitle: node.data.props.subtitle,
    subtitleFontSize: node.data.props.subtitleFontSize ?? defaultProps.subtitleFontSize,
    subtitleFontWeight: node.data.props.subtitleFontWeight ?? defaultProps.subtitleFontWeight,
    subtitleFontStyle: node.data.props.subtitleFontStyle ?? defaultProps.subtitleFontStyle,
    backgroundImage: node.data.props.backgroundImage,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor,
    buttonText: node.data.props.buttonText,
    buttonLink: node.data.props.buttonLink,
    buttonColor: node.data.props.buttonColor,
    minHeight: node.data.props.minHeight,
    overlayOpacity: node.data.props.overlayOpacity,
    textAlign: node.data.props.textAlign,
    enableSlider: node.data.props.enableSlider ?? defaultProps.enableSlider,
    sliderImages: node.data.props.sliderImages ?? defaultProps.sliderImages,
    sliderSpeed: node.data.props.sliderSpeed ?? defaultProps.sliderSpeed,
    sliderTransition: node.data.props.sliderTransition ?? defaultProps.sliderTransition,
  }));

  return (
    <div className="space-y-4">
      {/* Title Section */}
      <TranslatableInput
        label="Title"
        propKey="title"
        value={title}
        onChange={(v) => setProp((props: HeroBannerProps) => (props.title = v))}
        nodeProps={nodeProps}
        setProp={setProp}
      />

      <TextFormatToolbar
        label="Title Formatting"
        fontSize={titleFontSize}
        fontWeight={titleFontWeight}
        fontStyle={titleFontStyle}
        onFontSizeChange={(size) => setProp((props: HeroBannerProps) => (props.titleFontSize = size))}
        onFontWeightChange={(weight) => setProp((props: HeroBannerProps) => (props.titleFontWeight = weight))}
        onFontStyleChange={(style) => setProp((props: HeroBannerProps) => (props.titleFontStyle = style))}
      />

      {/* Subtitle Section */}
      <TranslatableInput
        label="Subtitle"
        propKey="subtitle"
        value={subtitle}
        onChange={(v) => setProp((props: HeroBannerProps) => (props.subtitle = v))}
        nodeProps={nodeProps}
        setProp={setProp}
        multiline
        rows={2}
      />

      <TextFormatToolbar
        label="Subtitle Formatting"
        fontSize={subtitleFontSize}
        fontWeight={subtitleFontWeight}
        fontStyle={subtitleFontStyle}
        onFontSizeChange={(size) => setProp((props: HeroBannerProps) => (props.subtitleFontSize = size))}
        onFontWeightChange={(weight) => setProp((props: HeroBannerProps) => (props.subtitleFontWeight = weight))}
        onFontStyleChange={(style) => setProp((props: HeroBannerProps) => (props.subtitleFontStyle = style))}
      />

      {/* Image Slider Toggle */}
      <div className="flex items-center justify-between">
        <Label>Enable Image Slider</Label>
        <Switch
          checked={enableSlider}
          onCheckedChange={(checked) =>
            setProp((props: HeroBannerProps) => (props.enableSlider = checked))
          }
        />
      </div>

      {!enableSlider ? (
        <ImageUpload
          label="Background Image"
          value={backgroundImage}
          onChange={(value) => setProp((props: HeroBannerProps) => (props.backgroundImage = value))}
          aspectRatio="wide"
        />
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Slide Duration ({sliderSpeed}s)</Label>
            <Slider
              value={[sliderSpeed]}
              onValueChange={([value]) =>
                setProp((props: HeroBannerProps) => (props.sliderSpeed = value))
              }
              min={2}
              max={15}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <Label>Transition</Label>
            <Select
              value={sliderTransition}
              onValueChange={(value) =>
                setProp(
                  (props: HeroBannerProps) =>
                    (props.sliderTransition = value as 'fade' | 'slide')
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fade">Fade</SelectItem>
                <SelectItem value="slide">Slide</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Slides</Label>
            {sliderImages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No slides added yet. Click + to add images.
              </p>
            )}
            {sliderImages.map((image: string, index: number) => (
              <div key={index} className="space-y-1 rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Slide {index + 1}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === 0}
                      onClick={() =>
                        setProp((props: HeroBannerProps) => {
                          const imgs = [...(props.sliderImages || [])];
                          [imgs[index - 1], imgs[index]] = [imgs[index], imgs[index - 1]];
                          props.sliderImages = imgs;
                        })
                      }
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === sliderImages.length - 1}
                      onClick={() =>
                        setProp((props: HeroBannerProps) => {
                          const imgs = [...(props.sliderImages || [])];
                          [imgs[index], imgs[index + 1]] = [imgs[index + 1], imgs[index]];
                          props.sliderImages = imgs;
                        })
                      }
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() =>
                        setProp((props: HeroBannerProps) => {
                          const imgs = [...(props.sliderImages || [])];
                          imgs.splice(index, 1);
                          props.sliderImages = imgs;
                        })
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <ImageUpload
                  label=""
                  value={image}
                  onChange={(value) =>
                    setProp((props: HeroBannerProps) => {
                      const imgs = [...(props.sliderImages || [])];
                      imgs[index] = value;
                      props.sliderImages = imgs;
                    })
                  }
                  aspectRatio="wide"
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() =>
                setProp((props: HeroBannerProps) => {
                  props.sliderImages = [...(props.sliderImages || []), ''];
                })
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Slide
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Background Color</Label>
        <Input
          type="color"
          value={backgroundColor}
          onChange={(e) => setProp((props: HeroBannerProps) => (props.backgroundColor = e.target.value))}
          className="h-10 w-full"
        />
      </div>

      <div className="space-y-2">
        <Label>Text Color</Label>
        <Input
          type="color"
          value={textColor}
          onChange={(e) => setProp((props: HeroBannerProps) => (props.textColor = e.target.value))}
          className="h-10 w-full"
        />
      </div>

      <div className="space-y-2">
        <Label>Text Alignment</Label>
        <Select
          value={textAlign}
          onValueChange={(value) => setProp((props: HeroBannerProps) => (props.textAlign = value as HeroBannerProps['textAlign']))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <TranslatableInput
        label="Button Text"
        propKey="buttonText"
        value={buttonText}
        onChange={(v) => setProp((props: HeroBannerProps) => (props.buttonText = v))}
        nodeProps={nodeProps}
        setProp={setProp}
      />

      <div className="space-y-2">
        <Label>Button Link</Label>
        <Input
          value={buttonLink}
          placeholder="/menu, /shop, /about"
          onChange={(e) => {
            const val = normalizeLink(e.target.value);
            setProp((props: HeroBannerProps) => (props.buttonLink = val));
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>Button Color</Label>
        <Input
          type="color"
          value={buttonColor}
          onChange={(e) => setProp((props: HeroBannerProps) => (props.buttonColor = e.target.value))}
          className="h-10 w-full"
        />
      </div>

      <div className="space-y-2">
        <Label>Min Height (px)</Label>
        <Input
          type="number"
          value={minHeight}
          onChange={(e) => setProp((props: HeroBannerProps) => (props.minHeight = parseInt(e.target.value) || 400))}
        />
      </div>

      <div className="space-y-2">
        <Label>Overlay Opacity ({overlayOpacity}%)</Label>
        <Slider
          value={[overlayOpacity || 50]}
          onValueChange={([value]) => setProp((props: HeroBannerProps) => (props.overlayOpacity = value))}
          min={0}
          max={100}
          step={5}
        />
      </div>
    </div>
  );
};

HeroBanner.craft = {
  props: defaultProps,
  related: {
    settings: HeroBannerSettings,
  },
};
