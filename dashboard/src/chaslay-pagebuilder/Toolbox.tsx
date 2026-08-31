// @ts-nocheck
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useEditor, Element } from '@craftjs/core';
import {
  Container,
  Text,
  NavbarClassic,
  NavbarCentered,
  NavbarMinimal,
  NavbarModern,
  HeroBanner,
  HeroSplit,
  HeroMinimal,
  HeroGradient,
  MenuGrid,
  MenuList,
  MenuMinimal,
  MenuModern,
  MenuSection,
  AboutUsClassic,
  AboutUsCentered,
  AboutUsMinimal,
  AboutUsModern,
  AboutUs,
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
import { ScrollArea } from '@/chaslay-pagebuilder/ui/scroll-area';
import { useTranslations } from '@/lib/chaslay-pagebuilder/i18n-stub';
import {
  ChevronDown,
  ChevronRight,
  Navigation,
  Sparkles,
  UtensilsCrossed,
  Info,
  Clock,
  Phone,
  LayoutGrid,
  SeparatorHorizontal,
  Share2,
  MapPin,
  Image,
  MessageSquareQuote,
  Wrench,
  Code,
  Star,
  Tag,
  Users,
  Newspaper,
  Heart,
} from 'lucide-react';

interface ComponentVariant {
  nameKey: string;
  descriptionKey: string;
  preview: React.ReactNode;
  component: React.ReactElement;
}

interface Section {
  id: string;
  labelKey: string;
  icon: React.ReactNode;
  variants: ComponentVariant[];
}

// Navbar preview components
const NavbarClassicPreview = () => (
  <div className="w-full h-8 rounded-md overflow-hidden bg-white border flex items-center justify-between px-2">
    <div className="w-12 h-2 bg-slate-800 rounded" />
    <div className="flex items-center gap-1.5">
      <div className="w-5 h-1 bg-slate-400 rounded" />
      <div className="w-5 h-1 bg-slate-400 rounded" />
      <div className="w-5 h-1 bg-slate-400 rounded" />
      <div className="w-8 h-3 bg-rose-500 rounded" />
    </div>
  </div>
);

const NavbarCenteredPreview = () => (
  <div className="w-full h-10 rounded-md overflow-hidden bg-white border flex items-center justify-center px-2 gap-3">
    <div className="flex gap-2">
      <div className="w-4 h-1 bg-slate-400 rounded" />
      <div className="w-4 h-1 bg-slate-400 rounded" />
    </div>
    <div className="text-center">
      <div className="w-10 h-2 bg-slate-800 rounded mx-auto" />
      <div className="w-4 h-0.5 bg-rose-500 rounded mx-auto mt-0.5" />
    </div>
    <div className="flex gap-2">
      <div className="w-4 h-1 bg-slate-400 rounded" />
      <div className="w-4 h-1 bg-slate-400 rounded" />
    </div>
  </div>
);

const NavbarMinimalPreview = () => (
  <div className="w-full h-8 rounded-md overflow-hidden bg-stone-50 border flex items-center justify-between px-2">
    <div className="w-14 h-1.5 bg-slate-700 rounded tracking-widest" />
    <div className="flex gap-3">
      <div className="w-4 h-0.5 bg-slate-400 rounded" />
      <div className="w-4 h-0.5 bg-slate-400 rounded" />
      <div className="w-4 h-0.5 bg-slate-400 rounded" />
    </div>
  </div>
);

const NavbarModernPreview = () => (
  <div className="w-full h-8 rounded-md overflow-hidden bg-slate-900 flex items-center justify-between px-2">
    <div className="w-10 h-2 bg-white rounded italic" />
    <div className="flex gap-2">
      <div className="w-4 h-1 bg-white/60 rounded" />
      <div className="w-4 h-1 bg-white/60 rounded" />
      <div className="w-4 h-1 bg-white/60 rounded" />
    </div>
    <div className="w-10 h-3 bg-white rounded-full" />
  </div>
);

// Hero preview components
const HeroCenteredPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden relative">
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: 'url("https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=80")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    />
    <div className="absolute inset-0 bg-black/50" />
    <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
      <div className="w-14 h-1.5 bg-white rounded mb-1" />
      <div className="w-10 h-1 bg-white/60 rounded mb-2" />
      <div className="w-8 h-2 bg-orange-500 rounded-sm" />
    </div>
  </div>
);

const HeroSplitPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden flex">
    <div className="w-1/2 bg-slate-50 p-2 flex flex-col justify-center">
      <div className="w-10 h-1.5 bg-slate-800 rounded mb-1" />
      <div className="w-8 h-1 bg-slate-400 rounded mb-1.5" />
      <div className="w-6 h-1.5 bg-slate-700 rounded-sm" />
    </div>
    <div
      className="w-1/2"
      style={{
        backgroundImage: 'url("https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    />
  </div>
);

const HeroMinimalPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-stone-50 flex flex-col items-center justify-center p-2">
    <div className="w-14 h-1.5 bg-slate-800 rounded mb-1" />
    <div className="w-6 h-0.5 bg-rose-500 rounded mb-1" />
    <div className="w-10 h-1 bg-slate-400 rounded" />
  </div>
);

const HeroGradientPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex flex-col items-center justify-center p-2">
    <div className="w-12 h-1.5 bg-white rounded mb-1" />
    <div className="w-8 h-1 bg-white/70 rounded mb-2" />
    <div className="w-8 h-2 border border-white rounded-full" />
  </div>
);

// Menu preview components
const MenuGridPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-white border p-2">
    <div className="w-10 h-1.5 bg-slate-800 rounded mx-auto mb-2" />
    <div className="grid grid-cols-3 gap-1">
      <div className="bg-slate-100 rounded p-0.5">
        <div className="w-full h-3 bg-slate-200 rounded mb-0.5" />
        <div className="w-4 h-0.5 bg-slate-400 rounded" />
      </div>
      <div className="bg-slate-100 rounded p-0.5">
        <div className="w-full h-3 bg-slate-200 rounded mb-0.5" />
        <div className="w-4 h-0.5 bg-slate-400 rounded" />
      </div>
      <div className="bg-slate-100 rounded p-0.5">
        <div className="w-full h-3 bg-slate-200 rounded mb-0.5" />
        <div className="w-4 h-0.5 bg-slate-400 rounded" />
      </div>
    </div>
  </div>
);

const MenuListPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-stone-50 border p-2">
    <div className="w-8 h-1.5 bg-slate-800 rounded mx-auto mb-2" />
    <div className="space-y-1.5 px-2">
      <div className="flex justify-between items-center border-b border-stone-200 pb-1">
        <div className="w-12 h-1 bg-slate-600 rounded" />
        <div className="w-4 h-1 bg-rose-500 rounded" />
      </div>
      <div className="flex justify-between items-center border-b border-stone-200 pb-1">
        <div className="w-10 h-1 bg-slate-600 rounded" />
        <div className="w-4 h-1 bg-rose-500 rounded" />
      </div>
      <div className="flex justify-between items-center">
        <div className="w-14 h-1 bg-slate-600 rounded" />
        <div className="w-4 h-1 bg-rose-500 rounded" />
      </div>
    </div>
  </div>
);

const MenuMinimalPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-white border flex flex-col items-center justify-center p-2">
    <div className="w-6 h-0.5 bg-slate-300 rounded mb-2" />
    <div className="w-full space-y-1">
      <div className="flex items-center gap-1">
        <div className="flex-1 h-px bg-slate-200" />
        <div className="w-10 h-1 bg-slate-600 rounded" />
        <div className="w-3 h-1 bg-rose-500 rounded" />
        <div className="flex-1 h-px bg-slate-200" />
      </div>
      <div className="flex items-center gap-1">
        <div className="flex-1 h-px bg-slate-200" />
        <div className="w-8 h-1 bg-slate-600 rounded" />
        <div className="w-3 h-1 bg-rose-500 rounded" />
        <div className="flex-1 h-px bg-slate-200" />
      </div>
    </div>
  </div>
);

const MenuModernPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-slate-900 p-2">
    <div className="w-10 h-1.5 bg-white rounded mx-auto mb-2" />
    <div className="grid grid-cols-2 gap-1">
      <div className="bg-slate-800 rounded p-1 flex gap-1">
        <div className="w-4 h-4 bg-slate-700 rounded" />
        <div className="flex-1">
          <div className="w-6 h-1 bg-amber-500 rounded mb-0.5" />
          <div className="w-8 h-0.5 bg-white/60 rounded" />
        </div>
      </div>
      <div className="bg-slate-800 rounded p-1 flex gap-1">
        <div className="w-4 h-4 bg-slate-700 rounded" />
        <div className="flex-1">
          <div className="w-6 h-1 bg-amber-500 rounded mb-0.5" />
          <div className="w-8 h-0.5 bg-white/60 rounded" />
        </div>
      </div>
    </div>
  </div>
);

// Menu Section preview (carousel with real products)
const MenuSectionCarouselPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-gray-50 border p-2">
    <div className="w-10 h-1.5 bg-slate-800 rounded mx-auto mb-1" />
    <div className="flex gap-1 justify-center mb-1.5">
      <div className="w-6 h-2.5 bg-orange-500 rounded-full" />
      <div className="w-6 h-2.5 bg-slate-200 rounded-full" />
      <div className="w-6 h-2.5 bg-slate-200 rounded-full" />
    </div>
    <div className="flex gap-1 overflow-hidden">
      <div className="w-1/3 flex-shrink-0 bg-white rounded p-0.5 shadow-sm">
        <div className="w-full h-4 bg-slate-200 rounded mb-0.5" />
        <div className="w-6 h-0.5 bg-slate-600 rounded mx-auto" />
      </div>
      <div className="w-1/3 flex-shrink-0 bg-white rounded p-0.5 shadow-sm">
        <div className="w-full h-4 bg-slate-200 rounded mb-0.5" />
        <div className="w-6 h-0.5 bg-slate-600 rounded mx-auto" />
      </div>
      <div className="w-1/3 flex-shrink-0 bg-white rounded p-0.5 shadow-sm">
        <div className="w-full h-4 bg-slate-200 rounded mb-0.5" />
        <div className="w-6 h-0.5 bg-slate-600 rounded mx-auto" />
      </div>
    </div>
  </div>
);

const MenuSectionGridPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-gray-50 border p-2">
    <div className="w-10 h-1.5 bg-slate-800 rounded mx-auto mb-1" style={{ fontFamily: 'serif' }} />
    <div className="flex gap-1 justify-center mb-1.5">
      <div className="w-6 h-2.5 bg-orange-500 rounded" />
      <div className="w-6 h-2.5 border border-slate-300 rounded" />
    </div>
    <div className="grid grid-cols-4 gap-0.5">
      {[1,2,3,4].map(i => (
        <div key={i} className="text-center">
          <div className="w-full aspect-square bg-slate-200 rounded mb-0.5" />
          <div className="flex justify-center gap-px mb-px">
            {[1,2,3].map(s => <div key={s} className="w-1 h-1 bg-orange-400 rounded-full" />)}
          </div>
          <div className="w-4 h-0.5 bg-slate-600 rounded mx-auto" />
        </div>
      ))}
    </div>
  </div>
);

// About Us preview components
const AboutUsElegantPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-white border flex p-2 gap-2">
    <div className="w-1/2 relative">
      <div className="absolute top-0 left-0 w-3/5 h-3/4 bg-slate-200 rounded" />
      <div className="absolute top-1/4 left-1/4 w-3/5 h-3/4 bg-slate-300 rounded shadow" />
    </div>
    <div className="w-1/2 flex flex-col justify-center items-center">
      <div className="w-10 h-1 bg-slate-700 rounded mb-1" />
      <div className="w-full h-0.5 bg-slate-300 rounded mb-0.5 mt-1" />
      <div className="w-3/4 h-0.5 bg-slate-300 rounded" />
    </div>
  </div>
);

const AboutUsClassicPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-white border flex p-2 gap-2">
    <div className="w-1/2 bg-slate-200 rounded" />
    <div className="w-1/2 flex flex-col justify-center">
      <div className="w-10 h-1.5 bg-slate-800 rounded mb-1" />
      <div className="w-full h-1 bg-slate-300 rounded mb-0.5" />
      <div className="w-3/4 h-1 bg-slate-300 rounded" />
    </div>
  </div>
);

const AboutUsCenteredPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-stone-50 border flex flex-col items-center justify-center p-2">
    <div className="w-6 h-0.5 bg-rose-500 rounded mb-1" />
    <div className="w-12 h-1.5 bg-slate-800 rounded mb-1" />
    <div className="w-full h-4 bg-slate-200 rounded mb-1" />
    <div className="w-10 h-1 bg-slate-300 rounded" />
  </div>
);

const AboutUsMinimalPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-white border flex flex-col items-center justify-center p-2">
    <div className="w-8 h-0.5 bg-slate-400 rounded mb-2" />
    <div className="w-14 h-1 bg-slate-600 rounded mb-1" />
    <div className="w-12 h-1 bg-slate-600 rounded mb-2" />
    <div className="w-10 h-0.5 bg-slate-300 rounded mb-0.5" />
    <div className="w-12 h-1 bg-rose-500 rounded italic" />
  </div>
);

const AboutUsModernPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-slate-900 flex p-2 gap-2">
    <div className="w-1/2 flex flex-col justify-center">
      <div className="w-12 h-1.5 bg-white rounded mb-1" />
      <div className="w-10 h-1 bg-white/60 rounded mb-2" />
      <div className="flex gap-2">
        <div className="text-center">
          <div className="w-4 h-1.5 bg-amber-500 rounded mb-0.5" />
          <div className="w-6 h-0.5 bg-white/40 rounded" />
        </div>
        <div className="text-center">
          <div className="w-4 h-1.5 bg-amber-500 rounded mb-0.5" />
          <div className="w-6 h-0.5 bg-white/40 rounded" />
        </div>
      </div>
    </div>
    <div className="w-1/2 bg-slate-700 rounded" />
  </div>
);

// Hours preview components
const HoursClassicPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-white border p-2">
    <div className="flex items-center justify-center gap-1 mb-1">
      <div className="w-2 h-2 bg-slate-600 rounded" />
      <div className="w-10 h-1.5 bg-slate-800 rounded" />
    </div>
    <div className="w-8 h-2 bg-green-500 rounded-full mx-auto mb-1" />
    <div className="bg-slate-100 rounded p-1 space-y-0.5">
      <div className="flex justify-between">
        <div className="w-6 h-0.5 bg-slate-400 rounded" />
        <div className="w-8 h-0.5 bg-slate-600 rounded" />
      </div>
      <div className="flex justify-between">
        <div className="w-5 h-0.5 bg-slate-400 rounded" />
        <div className="w-8 h-0.5 bg-slate-600 rounded" />
      </div>
    </div>
  </div>
);

const HoursMinimalPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-white border flex flex-col items-center justify-center p-2">
    <div className="w-6 h-0.5 bg-slate-300 rounded mb-2" />
    <div className="space-y-1 text-center">
      <div>
        <div className="w-10 h-0.5 bg-slate-600 rounded mx-auto mb-0.5" />
        <div className="w-8 h-1 bg-slate-400 rounded mx-auto" />
      </div>
      <div>
        <div className="w-8 h-0.5 bg-slate-600 rounded mx-auto mb-0.5" />
        <div className="w-6 h-1 bg-rose-500 rounded mx-auto" />
      </div>
    </div>
  </div>
);

const HoursSplitPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-stone-50 border flex">
    <div className="w-1/2 p-2 flex flex-col justify-center">
      <div className="w-10 h-1.5 bg-slate-800 rounded mb-1" />
      <div className="space-y-0.5">
        <div className="flex justify-between">
          <div className="w-5 h-0.5 bg-slate-400 rounded" />
          <div className="w-6 h-0.5 bg-slate-600 rounded" />
        </div>
        <div className="flex justify-between">
          <div className="w-4 h-0.5 bg-slate-400 rounded" />
          <div className="w-6 h-0.5 bg-slate-600 rounded" />
        </div>
      </div>
    </div>
    <div className="w-1/2 bg-slate-200" />
  </div>
);

const HoursModernPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-slate-900 p-2">
    <div className="w-10 h-1.5 bg-white rounded mx-auto mb-2" />
    <div className="grid grid-cols-4 gap-1">
      {['M', 'T', 'W', 'T'].map((d, i) => (
        <div key={i} className="bg-slate-800 rounded p-1 text-center">
          <div className="text-[7px] text-white/60 mb-0.5">{d}</div>
          <div className="w-4 h-0.5 bg-amber-500 rounded mx-auto" />
        </div>
      ))}
    </div>
  </div>
);

const ContactInfoPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-slate-50 border p-2">
    <div className="w-10 h-1.5 bg-slate-800 rounded mx-auto mb-2" />
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 bg-slate-400 rounded-full" />
        <div className="w-12 h-1 bg-slate-400 rounded" />
      </div>
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 bg-slate-400 rounded-full" />
        <div className="w-14 h-1 bg-slate-400 rounded" />
      </div>
    </div>
  </div>
);

// Footer preview components
const FooterClassicPreview = () => (
  <div className="w-full h-12 rounded-md overflow-hidden bg-slate-900 p-2">
    <div className="flex justify-between items-start mb-1">
      <div className="w-8 h-1.5 bg-white rounded" />
      <div className="flex gap-2">
        <div className="space-y-0.5">
          <div className="w-4 h-0.5 bg-white/60 rounded" />
          <div className="w-4 h-0.5 bg-white/60 rounded" />
        </div>
        <div className="space-y-0.5">
          <div className="w-4 h-0.5 bg-white/60 rounded" />
          <div className="w-4 h-0.5 bg-white/60 rounded" />
        </div>
      </div>
    </div>
    <div className="w-16 h-0.5 bg-white/40 rounded mx-auto" />
  </div>
);

const FooterMinimalPreview = () => (
  <div className="w-full h-8 rounded-md overflow-hidden bg-white border flex items-center justify-between px-2">
    <div className="w-10 h-1 bg-slate-400 rounded" />
    <div className="flex gap-1">
      <div className="w-2 h-2 bg-slate-300 rounded-full" />
      <div className="w-2 h-2 bg-slate-300 rounded-full" />
      <div className="w-2 h-2 bg-slate-300 rounded-full" />
    </div>
  </div>
);

const FooterCenteredPreview = () => (
  <div className="w-full h-10 rounded-md overflow-hidden bg-stone-100 border flex flex-col items-center justify-center p-1">
    <div className="w-8 h-1.5 bg-slate-800 rounded mb-1" />
    <div className="flex gap-2 mb-1">
      <div className="w-3 h-0.5 bg-slate-400 rounded" />
      <div className="w-3 h-0.5 bg-slate-400 rounded" />
      <div className="w-3 h-0.5 bg-slate-400 rounded" />
    </div>
    <div className="w-12 h-0.5 bg-slate-300 rounded" />
  </div>
);

const FooterModernPreview = () => (
  <div className="w-full h-12 rounded-md overflow-hidden bg-gradient-to-r from-slate-900 to-slate-800 p-2">
    <div className="flex justify-between items-center mb-1">
      <div className="w-10 h-1.5 bg-white rounded italic" />
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-white/60 rounded-full" />
        <div className="w-2 h-2 bg-white/60 rounded-full" />
        <div className="w-2 h-2 bg-white/60 rounded-full" />
      </div>
    </div>
    <div className="w-full h-px bg-white/20 mb-1" />
    <div className="w-14 h-0.5 bg-white/40 rounded mx-auto" />
  </div>
);

// New component previews
const DividerPreview = () => (
  <div className="w-full h-6 rounded-md overflow-hidden bg-white border flex items-center justify-center px-4">
    <div className="w-full h-px bg-slate-300" />
  </div>
);

const SpacerPreview = () => (
  <div className="w-full h-8 rounded-md overflow-hidden bg-white border flex items-center justify-center">
    <div className="flex flex-col items-center gap-0.5">
      <div className="w-4 h-0.5 bg-slate-300 rounded" />
      <div className="w-6 h-3 border border-dashed border-slate-300 rounded" />
      <div className="w-4 h-0.5 bg-slate-300 rounded" />
    </div>
  </div>
);

const SocialHorizontalPreview = () => (
  <div className="w-full h-8 rounded-md overflow-hidden bg-slate-900 flex items-center justify-center gap-2 px-2">
    <div className="w-3 h-3 bg-white/30 rounded-full" />
    <div className="w-3 h-3 bg-white/30 rounded-full" />
    <div className="w-3 h-3 bg-white/30 rounded-full" />
    <div className="w-3 h-3 bg-white/30 rounded-full" />
  </div>
);

const SocialVerticalPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-slate-50 border flex flex-col items-center justify-center gap-1 p-2">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex items-center gap-1.5">
        <div className="w-3 h-3 bg-slate-700 rounded-full" />
        <div className="w-10 h-1 bg-slate-400 rounded" />
      </div>
    ))}
  </div>
);

const SocialFloatingPreview = () => (
  <div className="w-full h-10 rounded-md overflow-hidden bg-slate-50 border relative">
    <div className="absolute right-2 top-1 flex flex-col gap-0.5 bg-slate-800 rounded-lg p-1">
      <div className="w-2.5 h-2.5 bg-white/30 rounded-full" />
      <div className="w-2.5 h-2.5 bg-white/30 rounded-full" />
      <div className="w-2.5 h-2.5 bg-white/30 rounded-full" />
    </div>
    <div className="flex items-center justify-center h-full">
      <span className="text-[8px] text-slate-400">Floating bar</span>
    </div>
  </div>
);

const LocationMapPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-emerald-50 border flex flex-col items-center justify-center p-2">
    <div className="w-3 h-3 text-emerald-600 mb-1">
      <MapPin className="w-3 h-3" />
    </div>
    <div className="w-full h-4 bg-emerald-100 rounded mb-1" />
    <div className="w-8 h-0.5 bg-emerald-300 rounded" />
  </div>
);

const GalleryGridPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-white border p-2">
    <div className="w-8 h-1 bg-slate-800 rounded mx-auto mb-1.5" />
    <div className="grid grid-cols-3 gap-0.5">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="bg-slate-200 rounded aspect-square" />
      ))}
    </div>
  </div>
);

const GalleryMasonryPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-slate-50 border p-2">
    <div className="w-8 h-1 bg-slate-800 rounded mx-auto mb-1.5" />
    <div className="flex gap-0.5">
      <div className="flex-1 space-y-0.5">
        <div className="bg-slate-200 rounded h-4" />
        <div className="bg-slate-200 rounded h-3" />
      </div>
      <div className="flex-1 space-y-0.5">
        <div className="bg-slate-200 rounded h-3" />
        <div className="bg-slate-200 rounded h-4" />
      </div>
      <div className="flex-1 space-y-0.5">
        <div className="bg-slate-200 rounded h-5" />
        <div className="bg-slate-200 rounded h-2" />
      </div>
    </div>
  </div>
);

const GalleryCarouselPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-white border p-2">
    <div className="w-8 h-1 bg-slate-800 rounded mx-auto mb-1.5" />
    <div className="flex gap-0.5 overflow-hidden">
      <div className="flex-shrink-0 w-1/3 bg-slate-200 rounded aspect-video" />
      <div className="flex-shrink-0 w-1/3 bg-slate-200 rounded aspect-video" />
      <div className="flex-shrink-0 w-1/3 bg-slate-200 rounded aspect-video" />
      <div className="flex-shrink-0 w-1/3 bg-slate-100 rounded aspect-video" />
    </div>
  </div>
);

const TestimonialsGridPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-white border p-2">
    <div className="w-10 h-1 bg-slate-800 rounded mx-auto mb-1.5" />
    <div className="grid grid-cols-3 gap-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-slate-50 rounded p-1">
          <div className="flex gap-0.5 mb-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} className="w-1 h-1 bg-amber-400 rounded-full" />
            ))}
          </div>
          <div className="w-full h-1 bg-slate-200 rounded mb-0.5" />
          <div className="w-4 h-0.5 bg-slate-400 rounded" />
        </div>
      ))}
    </div>
  </div>
);

const TestimonialsCarouselPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-slate-50 border p-2">
    <div className="w-10 h-1 bg-slate-800 rounded mx-auto mb-1.5" />
    <div className="flex gap-1 overflow-hidden">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex-shrink-0 w-2/5 bg-white rounded p-1 shadow-sm">
          <div className="flex gap-0.5 mb-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} className="w-0.5 h-0.5 bg-amber-400 rounded-full" />
            ))}
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded mb-0.5" />
          <div className="w-5 h-0.5 bg-slate-300 rounded" />
        </div>
      ))}
    </div>
  </div>
);

const TestimonialsFeaturedPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-slate-900 flex flex-col items-center justify-center p-2">
    <div className="flex gap-0.5 mb-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <div key={s} className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
      ))}
    </div>
    <div className="w-14 h-1 bg-white/80 rounded mb-1" />
    <div className="w-10 h-0.5 bg-white/40 rounded mb-1" />
    <div className="w-6 h-0.5 bg-white/60 rounded" />
  </div>
);

const CustomHTMLPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-slate-50 border flex flex-col items-center justify-center p-2">
    <div className="text-slate-400 font-mono text-lg font-bold mb-1">&lt;/&gt;</div>
    <div className="w-10 h-1 bg-slate-300 rounded mb-0.5" />
    <div className="w-8 h-1 bg-slate-200 rounded" />
  </div>
);

const ScrollToTopPreview = () => (
  <div className="w-full h-8 rounded-md overflow-hidden bg-slate-50 border relative">
    <div className="absolute bottom-1 right-2 w-4 h-4 bg-slate-800 rounded-full flex items-center justify-center">
      <div className="w-1.5 h-1.5 border-t-2 border-l-2 border-white rotate-45 mt-0.5" />
    </div>
    <div className="flex items-center justify-center h-full">
      <span className="text-[8px] text-slate-400">Scroll to top</span>
    </div>
  </div>
);

// Featured Dish preview
const FeaturedDishPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-slate-900 flex p-2 gap-2">
    <div className="w-1/2 bg-slate-700 rounded relative">
      <div className="absolute top-1 right-1 bg-rose-500 text-[6px] text-white px-1 rounded-full">Popular</div>
    </div>
    <div className="w-1/2 flex flex-col justify-center">
      <div className="w-6 h-0.5 bg-rose-500 rounded mb-1" />
      <div className="w-12 h-1.5 bg-white rounded mb-1" />
      <div className="w-10 h-0.5 bg-white/50 rounded mb-2" />
      <div className="w-6 h-1 bg-rose-500 rounded" />
    </div>
  </div>
);

// Promo Cards preview
const PromoCardsPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-slate-50 border p-2">
    <div className="w-10 h-1 bg-slate-800 rounded mx-auto mb-1.5" />
    <div className="grid grid-cols-3 gap-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded shadow-sm overflow-hidden">
          <div className="h-3 bg-slate-200" />
          <div className="p-0.5">
            <div className="w-5 h-0.5 bg-slate-600 rounded mb-0.5" />
            <div className="w-4 h-0.5 bg-slate-300 rounded" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Chef Team preview
const ChefTeamPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-white border p-2">
    <div className="w-10 h-1 bg-slate-800 rounded mx-auto mb-1.5" />
    <div className="flex justify-center gap-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="text-center">
          <div className="w-5 h-5 bg-slate-200 rounded-full mx-auto mb-0.5" />
          <div className="w-4 h-0.5 bg-slate-600 rounded mx-auto mb-0.5" />
          <div className="w-3 h-0.5 bg-rose-500 rounded mx-auto" />
        </div>
      ))}
    </div>
  </div>
);

// Blog Section preview
const BlogSectionPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-slate-50 border p-2">
    <div className="w-8 h-1 bg-slate-800 rounded mx-auto mb-1.5" />
    <div className="grid grid-cols-3 gap-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded overflow-hidden">
          <div className="h-3 bg-slate-200" />
          <div className="p-0.5">
            <div className="w-3 h-0.5 bg-rose-500 rounded mb-0.5" />
            <div className="w-5 h-0.5 bg-slate-600 rounded" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Reservation Form preview
const ReservationFormPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-slate-900 flex flex-col items-center justify-center p-2">
    <div className="w-10 h-1.5 bg-white rounded mb-1.5" />
    <div className="grid grid-cols-2 gap-0.5 mb-1.5 w-full max-w-[80%]">
      <div className="h-2 bg-white/10 rounded" />
      <div className="h-2 bg-white/10 rounded" />
      <div className="h-2 bg-white/10 rounded" />
      <div className="h-2 bg-white/10 rounded" />
    </div>
    <div className="w-12 h-2 bg-rose-500 rounded" />
  </div>
);

// Newsletter Signup preview
const NewsletterSignupPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-slate-50 border flex flex-col items-center justify-center p-2">
    <div className="w-10 h-1 bg-slate-800 rounded mb-1" />
    <div className="w-8 h-0.5 bg-slate-400 rounded mb-2" />
    <div className="flex gap-1">
      <div className="w-12 h-2.5 bg-white border rounded" />
      <div className="w-6 h-2.5 bg-rose-500 rounded" />
    </div>
  </div>
);

// Stats Counter preview
const StatsCounterPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-slate-900 flex flex-col items-center justify-center p-2">
    <div className="w-10 h-1 bg-white rounded mb-2" />
    <div className="flex gap-3">
      {['15+', '200+', '50K+'].map((n, i) => (
        <div key={i} className="text-center">
          <div className="text-[8px] text-rose-500 font-bold">{n}</div>
          <div className="w-4 h-0.5 bg-white/40 rounded mx-auto" />
        </div>
      ))}
    </div>
  </div>
);

// Process Steps preview
const ProcessStepsPreview = () => (
  <div className="w-full aspect-[16/9] rounded-md overflow-hidden bg-white border flex flex-col items-center justify-center p-2">
    <div className="w-10 h-1 bg-slate-800 rounded mb-2" />
    <div className="flex items-center gap-1">
      {[1, 2, 3].map((n) => (
        <React.Fragment key={n}>
          <div className="text-center">
            <div className="w-4 h-4 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-0.5">
              <span className="text-[6px] text-rose-500 font-bold">{n}</span>
            </div>
            <div className="w-4 h-0.5 bg-slate-600 rounded" />
          </div>
          {n < 3 && <div className="text-[8px] text-slate-300">→</div>}
        </React.Fragment>
      ))}
    </div>
  </div>
);

const sections: Section[] = [
  {
    id: 'layout',
    labelKey: 'sections.layout',
    icon: <SeparatorHorizontal className="w-4 h-4" />,
    variants: [
      { nameKey: 'variants.divider', descriptionKey: 'descriptions.divider', preview: <DividerPreview />, component: <Divider /> },
      { nameKey: 'variants.spacer', descriptionKey: 'descriptions.spacer', preview: <SpacerPreview />, component: <Spacer /> },
    ],
  },
  {
    id: 'navigation',
    labelKey: 'sections.navigation',
    icon: <Navigation className="w-4 h-4" />,
    variants: [
      { nameKey: 'variants.classic', descriptionKey: 'descriptions.navClassic', preview: <NavbarClassicPreview />, component: <NavbarClassic /> },
      { nameKey: 'variants.centered', descriptionKey: 'descriptions.navCentered', preview: <NavbarCenteredPreview />, component: <NavbarCentered /> },
      { nameKey: 'variants.minimal', descriptionKey: 'descriptions.navMinimal', preview: <NavbarMinimalPreview />, component: <NavbarMinimal /> },
      { nameKey: 'variants.modern', descriptionKey: 'descriptions.navModern', preview: <NavbarModernPreview />, component: <NavbarModern /> },
    ],
  },
  {
    id: 'heroes',
    labelKey: 'sections.heroes',
    icon: <Sparkles className="w-4 h-4" />,
    variants: [
      { nameKey: 'variants.centered', descriptionKey: 'descriptions.heroCentered', preview: <HeroCenteredPreview />, component: <HeroBanner /> },
      { nameKey: 'variants.split', descriptionKey: 'descriptions.heroSplit', preview: <HeroSplitPreview />, component: <HeroSplit /> },
      { nameKey: 'variants.minimal', descriptionKey: 'descriptions.heroMinimal', preview: <HeroMinimalPreview />, component: <HeroMinimal /> },
      { nameKey: 'variants.gradient', descriptionKey: 'descriptions.heroGradient', preview: <HeroGradientPreview />, component: <HeroGradient /> },
    ],
  },
  {
    id: 'menu',
    labelKey: 'sections.menu',
    icon: <UtensilsCrossed className="w-4 h-4" />,
    variants: [
      { nameKey: 'variants.grid', descriptionKey: 'descriptions.menuGrid', preview: <MenuGridPreview />, component: <MenuGrid /> },
      { nameKey: 'variants.list', descriptionKey: 'descriptions.menuList', preview: <MenuListPreview />, component: <MenuList /> },
      { nameKey: 'variants.minimal', descriptionKey: 'descriptions.menuMinimal', preview: <MenuMinimalPreview />, component: <MenuMinimal /> },
      { nameKey: 'variants.modern', descriptionKey: 'descriptions.menuModern', preview: <MenuModernPreview />, component: <MenuModern /> },
      { nameKey: 'variants.menuCarousel', descriptionKey: 'descriptions.menuCarousel', preview: <MenuSectionCarouselPreview />, component: <MenuSection /> },
      { nameKey: 'variants.menuDineGrid', descriptionKey: 'descriptions.menuDineGrid', preview: <MenuSectionGridPreview />, component: <MenuSection layout="grid" /> },
    ],
  },
  {
    id: 'about',
    labelKey: 'sections.about',
    icon: <Info className="w-4 h-4" />,
    variants: [
      { nameKey: 'variants.classic', descriptionKey: 'descriptions.aboutClassic', preview: <AboutUsClassicPreview />, component: <AboutUsClassic /> },
      { nameKey: 'variants.centered', descriptionKey: 'descriptions.aboutCentered', preview: <AboutUsCenteredPreview />, component: <AboutUsCentered /> },
      { nameKey: 'variants.minimal', descriptionKey: 'descriptions.aboutMinimal', preview: <AboutUsMinimalPreview />, component: <AboutUsMinimal /> },
      { nameKey: 'variants.modern', descriptionKey: 'descriptions.aboutModern', preview: <AboutUsModernPreview />, component: <AboutUsModern /> },
      { nameKey: 'variants.elegant', descriptionKey: 'descriptions.aboutElegant', preview: <AboutUsElegantPreview />, component: <AboutUs variant="elegant" /> },
    ],
  },
  {
    id: 'gallery',
    labelKey: 'sections.gallery',
    icon: <Image className="w-4 h-4" />,
    variants: [
      { nameKey: 'variants.grid', descriptionKey: 'descriptions.galleryGrid', preview: <GalleryGridPreview />, component: <GalleryGrid /> },
      { nameKey: 'variants.masonry', descriptionKey: 'descriptions.galleryMasonry', preview: <GalleryMasonryPreview />, component: <GalleryMasonry /> },
      { nameKey: 'variants.carousel', descriptionKey: 'descriptions.galleryCarousel', preview: <GalleryCarouselPreview />, component: <GalleryCarousel /> },
    ],
  },
  {
    id: 'testimonials',
    labelKey: 'sections.testimonials',
    icon: <MessageSquareQuote className="w-4 h-4" />,
    variants: [
      { nameKey: 'variants.grid', descriptionKey: 'descriptions.testimonialsGrid', preview: <TestimonialsGridPreview />, component: <TestimonialsGrid /> },
      { nameKey: 'variants.carousel', descriptionKey: 'descriptions.testimonialsCarousel', preview: <TestimonialsCarouselPreview />, component: <TestimonialsCarousel /> },
      { nameKey: 'variants.featured', descriptionKey: 'descriptions.testimonialsFeatured', preview: <TestimonialsFeaturedPreview />, component: <TestimonialsSingle /> },
    ],
  },
  {
    id: 'hours',
    labelKey: 'sections.hours',
    icon: <Clock className="w-4 h-4" />,
    variants: [
      { nameKey: 'variants.classic', descriptionKey: 'descriptions.hoursClassic', preview: <HoursClassicPreview />, component: <HoursClassic /> },
      { nameKey: 'variants.minimal', descriptionKey: 'descriptions.hoursMinimal', preview: <HoursMinimalPreview />, component: <HoursMinimal /> },
      { nameKey: 'variants.split', descriptionKey: 'descriptions.hoursSplit', preview: <HoursSplitPreview />, component: <HoursSplit /> },
      { nameKey: 'variants.modern', descriptionKey: 'descriptions.hoursModern', preview: <HoursModernPreview />, component: <HoursModern /> },
    ],
  },
  {
    id: 'contact',
    labelKey: 'sections.contact',
    icon: <Phone className="w-4 h-4" />,
    variants: [
      { nameKey: 'variants.classic', descriptionKey: 'descriptions.contactDetails', preview: <ContactInfoPreview />, component: <ContactInfo /> },
    ],
  },
  {
    id: 'socialMedia',
    labelKey: 'sections.socialMedia',
    icon: <Share2 className="w-4 h-4" />,
    variants: [
      { nameKey: 'variants.horizontal', descriptionKey: 'descriptions.socialHorizontal', preview: <SocialHorizontalPreview />, component: <SocialMediaHorizontal /> },
      { nameKey: 'variants.vertical', descriptionKey: 'descriptions.socialVertical', preview: <SocialVerticalPreview />, component: <SocialMediaVertical /> },
      { nameKey: 'variants.floating', descriptionKey: 'descriptions.socialFloating', preview: <SocialFloatingPreview />, component: <SocialMediaFloating /> },
    ],
  },
  {
    id: 'map',
    labelKey: 'sections.map',
    icon: <MapPin className="w-4 h-4" />,
    variants: [
      { nameKey: 'variants.locationMap', descriptionKey: 'descriptions.locationMap', preview: <LocationMapPreview />, component: <LocationMap /> },
    ],
  },
  {
    id: 'featured',
    labelKey: 'sections.featured',
    icon: <Star className="w-4 h-4" />,
    variants: [
      { nameKey: 'variants.featuredDish', descriptionKey: 'descriptions.featuredDish', preview: <FeaturedDishPreview />, component: <FeaturedDish /> },
    ],
  },
  {
    id: 'promotions',
    labelKey: 'sections.promotions',
    icon: <Tag className="w-4 h-4" />,
    variants: [
      { nameKey: 'variants.promoCards', descriptionKey: 'descriptions.promoCards', preview: <PromoCardsPreview />, component: <PromoCards /> },
    ],
  },
  {
    id: 'team',
    labelKey: 'sections.team',
    icon: <Users className="w-4 h-4" />,
    variants: [
      { nameKey: 'variants.chefTeam', descriptionKey: 'descriptions.chefTeam', preview: <ChefTeamPreview />, component: <ChefTeam /> },
    ],
  },
  {
    id: 'blog',
    labelKey: 'sections.blog',
    icon: <Newspaper className="w-4 h-4" />,
    variants: [
      { nameKey: 'variants.blogSection', descriptionKey: 'descriptions.blogSection', preview: <BlogSectionPreview />, component: <BlogSection /> },
    ],
  },
  {
    id: 'engagement',
    labelKey: 'sections.engagement',
    icon: <Heart className="w-4 h-4" />,
    variants: [
      { nameKey: 'variants.reservationForm', descriptionKey: 'descriptions.reservationForm', preview: <ReservationFormPreview />, component: <ReservationForm /> },
      { nameKey: 'variants.newsletterSignup', descriptionKey: 'descriptions.newsletterSignup', preview: <NewsletterSignupPreview />, component: <NewsletterSignup /> },
      { nameKey: 'variants.statsCounter', descriptionKey: 'descriptions.statsCounter', preview: <StatsCounterPreview />, component: <StatsCounter /> },
      { nameKey: 'variants.processSteps', descriptionKey: 'descriptions.processSteps', preview: <ProcessStepsPreview />, component: <ProcessSteps /> },
    ],
  },
  {
    id: 'footer',
    labelKey: 'sections.footer',
    icon: <LayoutGrid className="w-4 h-4" />,
    variants: [
      { nameKey: 'variants.classic', descriptionKey: 'descriptions.footerClassic', preview: <FooterClassicPreview />, component: <FooterClassic /> },
      { nameKey: 'variants.minimal', descriptionKey: 'descriptions.footerMinimal', preview: <FooterMinimalPreview />, component: <FooterMinimal /> },
      { nameKey: 'variants.centered', descriptionKey: 'descriptions.footerCentered', preview: <FooterCenteredPreview />, component: <FooterCentered /> },
      { nameKey: 'variants.modern', descriptionKey: 'descriptions.footerModern', preview: <FooterModernPreview />, component: <FooterModern /> },
    ],
  },
  {
    id: 'customCode',
    labelKey: 'sections.customCode',
    icon: <Code className="w-4 h-4" />,
    variants: [
      { nameKey: 'variants.customHTML', descriptionKey: 'descriptions.customHTML', preview: <CustomHTMLPreview />, component: <CustomHTML /> },
    ],
  },
  {
    id: 'utilities',
    labelKey: 'sections.utilities',
    icon: <Wrench className="w-4 h-4" />,
    variants: [
      { nameKey: 'variants.scrollToTop', descriptionKey: 'descriptions.scrollToTop', preview: <ScrollToTopPreview />, component: <ScrollToTop /> },
    ],
  },
];

function ToolboxVariant({
  sectionId,
  nameKey,
  descriptionKey,
  preview,
  component,
  onAdd,
  t,
}: {
  sectionId: string;
  nameKey: string;
  descriptionKey: string;
  preview: React.ReactNode;
  component: React.ReactElement;
  onAdd: () => void;
  t: (key: string) => string;
}) {
  const { connectors } = useEditor();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    connectors.create(ref.current, component);
  }, [connectors, component]);

  return (
    <div
      key={`${sectionId}-${nameKey}`}
      ref={ref}
      onClick={onAdd}
      className="cursor-pointer p-2 bg-muted/50 rounded-lg hover:bg-muted transition-colors group"
    >
      <div className="mb-2">{preview}</div>
      <div className="px-1">
        <span className="text-xs font-medium block truncate">{t(nameKey)}</span>
        <span className="text-[10px] text-muted-foreground block truncate">
          {t(descriptionKey)}
        </span>
      </div>
    </div>
  );
}

export const Toolbox: React.FC = () => {
  const { actions, query } = useEditor();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const t = useTranslations('homepageBuilder');

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handleClickToAdd = (component: React.ReactElement) => {
    const nodeTree = query.parseReactElement(component).toNodeTree();
    actions.addNodeTree(nodeTree, 'ROOT');
  };

  return (
    <div className="w-80 border-r bg-background flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
          {t('components')}
        </h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {sections.map((section) => {
            const isExpanded = expandedSections.includes(section.id);
            return (
              <div key={section.id} className="mb-1">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center gap-2 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <span className="text-muted-foreground">{section.icon}</span>
                  <span className="flex-1 text-sm font-medium">{t(section.labelKey)}</span>
                  {section.variants.length > 1 && (
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {section.variants.length}
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
                {isExpanded && (
                  <div className="ml-2 pl-4 border-l border-muted space-y-2 py-2">
                    {section.variants.map((variant) => (
                      <ToolboxVariant
                        key={`${section.id}-${variant.nameKey}`}
                        sectionId={section.id}
                        nameKey={variant.nameKey}
                        descriptionKey={variant.descriptionKey}
                        preview={variant.preview}
                        component={variant.component}
                        onAdd={() => handleClickToAdd(variant.component)}
                        t={t}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
      <div className="p-4 border-t bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          {t('dragHint')}
        </p>
      </div>
    </div>
  );
};
