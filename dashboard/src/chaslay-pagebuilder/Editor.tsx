// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { Editor as CraftEditor, Frame, Element } from '@craftjs/core';
import { MenuDataProvider } from './MenuDataContext';
import { BuilderLanguageProvider } from './BuilderLanguageContext';
import {
  Container,
  RootContainer,
  Text,
  NavbarClassic,
  NavbarCentered,
  NavbarMinimal,
  NavbarModern,
  HeroBanner,
  HeroSplit,
  HeroMinimal,
  HeroGradient,
  MenuSection,
  MenuGrid,
  MenuList,
  MenuMinimal,
  MenuModern,
  AboutUs,
  AboutUsClassic,
  AboutUsCentered,
  AboutUsMinimal,
  AboutUsModern,
  BusinessHours,
  HoursClassic,
  HoursMinimal,
  HoursSplit,
  HoursModern,
  ContactInfo,
  FooterClassic,
  FooterMinimal,
  FooterCentered,
  FooterModern,
  Divider,
  Spacer,
  SocialMediaHorizontal,
  SocialMediaVertical,
  SocialMediaFloating,
  LocationMap,
  GalleryGrid,
  GalleryMasonry,
  GalleryCarousel,
  TestimonialsGrid,
  TestimonialsCarousel,
  TestimonialsSingle,
  ScrollToTop,
  CustomHTML,
  FeaturedDish,
  PromoCards,
  ChefTeam,
  BlogSection,
  ReservationForm,
  NewsletterSignup,
  StatsCounter,
  ProcessSteps,
} from './components';
import { RenderNode } from './RenderNode';
import { Viewport } from './Viewport';
import { Toolbox } from './Toolbox';
import { SettingsPanel } from './SettingsPanel';
import { TopBar } from './TopBar';
import { FullPagePreview } from './FullPagePreview';
import { PageManager } from './PageManager';
import { PageContextProvider } from './PageContext';
import { HOMEPAGE_BUILDER_STORAGE_KEY } from '@/chaslay-pagebuilder/types/homepage-builder';

interface EditorProps {
  initialState?: string | null;
  onSave?: (state: string) => void | Promise<void>;
  homepageName?: string;
  builderId?: number;
  onPageChange?: (pageId: number | null) => void;
}

export const HomepageEditor: React.FC<EditorProps> = ({ initialState, onSave, homepageName, builderId, onPageChange }) => {
  const [isFullPreview, setIsFullPreview] = useState(false);

  const resolver = {
    Container,
    RootContainer,
    Text,
    NavbarClassic,
    NavbarCentered,
    NavbarMinimal,
    NavbarModern,
    HeroBanner,
    HeroSplit,
    HeroMinimal,
    HeroGradient,
    MenuSection,
    MenuGrid,
    MenuList,
    MenuMinimal,
    MenuModern,
    AboutUs,
    AboutUsClassic,
    AboutUsCentered,
    AboutUsMinimal,
    AboutUsModern,
    BusinessHours,
    HoursClassic,
    HoursMinimal,
    HoursSplit,
    HoursModern,
    ContactInfo,
    FooterClassic,
    FooterMinimal,
    FooterCentered,
    FooterModern,
    Divider,
    Spacer,
    SocialMediaHorizontal,
    SocialMediaVertical,
    SocialMediaFloating,
    LocationMap,
    GalleryGrid,
    GalleryMasonry,
    GalleryCarousel,
    TestimonialsGrid,
    TestimonialsCarousel,
    TestimonialsSingle,
    ScrollToTop,
    CustomHTML,
    FeaturedDish,
    PromoCards,
    ChefTeam,
    BlogSection,
    ReservationForm,
    NewsletterSignup,
    StatsCounter,
    ProcessSteps,
  };

  // Default content when no saved state exists
  const defaultContent = (
    <Element is={RootContainer} canvas>
      <HeroBanner />
      <MenuSection />
      <AboutUsClassic />
      <BusinessHours />
      <ContactInfo />
    </Element>
  );

  return (
    <BuilderLanguageProvider>
    <MenuDataProvider>
      <PageContextProvider builderId={builderId} initialEditorState={initialState} onPageChange={onPageChange}>
        <div className="h-screen flex flex-col bg-background">
          <CraftEditor
            resolver={resolver}
            onRender={RenderNode}
          >
            {isFullPreview ? (
              <FullPagePreview onExit={() => setIsFullPreview(false)} />
            ) : (
              <EditorContent
                initialState={initialState}
                onSave={onSave}
                defaultContent={defaultContent}
                onFullPreview={() => setIsFullPreview(true)}
                homepageName={homepageName}
              />
            )}
          </CraftEditor>
        </div>
      </PageContextProvider>
    </MenuDataProvider>
    </BuilderLanguageProvider>
  );
};

interface EditorContentProps {
  initialState?: string | null;
  onSave?: (state: string) => void | Promise<void>;
  defaultContent: React.ReactElement;
  onFullPreview: () => void;
  homepageName?: string;
}

const EditorContent: React.FC<EditorContentProps> = ({
  initialState,
  onSave,
  defaultContent,
  onFullPreview,
  homepageName,
}) => {
  return (
    <>
      <TopBar onSave={onSave} onFullPreview={onFullPreview} homepageName={homepageName} />
      <PageManager />
      <div className="flex flex-1 overflow-hidden">
        <Toolbox />
        <Viewport initialState={initialState} defaultContent={defaultContent} />
        <SettingsPanel onSave={onSave} />
      </div>
    </>
  );
};
