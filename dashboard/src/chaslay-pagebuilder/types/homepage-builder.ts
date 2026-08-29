// @ts-nocheck
// ==========================================
// Homepage Builder Types
// ==========================================

// Component Props Types
export interface ContainerProps {
  background?: string;
  padding?: number;
  margin?: number;
  flexDirection?: 'row' | 'column';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  gap?: number;
  minHeight?: number;
  children?: React.ReactNode;
}

export interface TextProps {
  text: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  marginBottom?: number;
  lineHeight?: number;
  letterSpacing?: number;
}

export interface HeroBannerProps {
  title?: string;
  titleFontSize?: number;
  titleFontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  titleFontStyle?: 'normal' | 'italic';
  subtitle?: string;
  subtitleFontSize?: number;
  subtitleFontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  subtitleFontStyle?: 'normal' | 'italic';
  backgroundImage?: string;
  backgroundColor?: string;
  textColor?: string;
  buttonText?: string;
  buttonLink?: string;
  buttonColor?: string;
  minHeight?: number;
  overlayOpacity?: number;
  textAlign?: 'left' | 'center' | 'right';
  enableSlider?: boolean;
  sliderImages?: string[];
  sliderSpeed?: number;
  sliderTransition?: 'fade' | 'slide';
}

export interface MenuSectionProps {
  title?: string;
  subtitle?: string;
  showCategories?: boolean;
  maxProducts?: number;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  autoScrollSpeed?: number; // seconds per scroll
  layout?: 'carousel' | 'grid';
  showViewMenuButton?: boolean;
  viewMenuText?: string;
  viewMenuLink?: string;
  viewMenuBgColor?: string;
  viewMenuTextColor?: string;
  // Manual product ordering. When non-empty, these products are shown
  // in the order listed (instead of the newest-first default). Any IDs
  // that no longer exist are skipped.
  featuredProductIds?: string[];
}

export interface AboutUsProps {
  title?: string;
  content?: string;
  image?: string;
  image2?: string;
  imagePosition?: 'left' | 'right';
  backgroundColor?: string;
  textColor?: string;
  buttonText?: string;
  buttonLink?: string;
  buttonColor?: string;
  variant?: 'simple' | 'elegant';
  accentColor?: string;
}

export interface BusinessHoursProps {
  title?: string;
  showCurrentStatus?: boolean;
  backgroundColor?: string;
  textColor?: string;
  highlightToday?: boolean;
}

export interface ContactInfoProps {
  title?: string;
  showPhone?: boolean;
  showEmail?: boolean;
  showAddress?: boolean;
  showMap?: boolean;
  showHours?: boolean;
  image?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
}

// Feature 1: Divider/Spacer
export interface DividerProps {
  color?: string;
  thickness?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  width?: '25%' | '50%' | '75%' | '100%';
  marginTop?: number;
  marginBottom?: number;
}

export interface SpacerProps {
  height?: number;
  backgroundColor?: string;
}

// Feature 2: Social Media Links
export interface SocialMediaProps {
  title?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  tiktok?: string;
  youtube?: string;
  google?: string;
  iconSize?: number;
  iconColor?: string;
  backgroundColor?: string;
  textColor?: string;
  showLabels?: boolean;
  iconStyle?: 'circle' | 'square' | 'plain';
  gap?: number;
  alignment?: 'left' | 'center' | 'right';
}

// Feature 3: Google Maps Embed
export interface LocationMapProps {
  title?: string;
  address?: string;
  height?: number;
  borderRadius?: number;
  backgroundColor?: string;
  textColor?: string;
  showTitle?: boolean;
}

// Feature 4: Image Gallery/Carousel
export interface GalleryProps {
  title?: string;
  images?: string[];
  columns?: number;
  gap?: number;
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: number;
  showLightbox?: boolean;
  aspectRatio?: 'square' | 'video' | 'auto';
  maxImages?: number;
}

// Feature 5: Testimonials/Reviews
export interface TestimonialItem {
  text: string;
  author: string;
  rating?: number;
  photo?: string;
  role?: string;
}

export interface TestimonialsProps {
  title?: string;
  testimonials?: TestimonialItem[];
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  showRatings?: boolean;
  showPhotos?: boolean;
  cardBackground?: string;
}

// Feature 7: Custom HTML
export interface CustomHTMLProps {
  htmlContent?: string;
  backgroundColor?: string;
  padding?: number;
  maxWidth?: number;
}

// Feature 6: Scroll to Top
export interface ScrollToTopProps {
  backgroundColor?: string;
  iconColor?: string;
  position?: 'left' | 'right';
}

// Feature 8: Featured Dish
export interface FeaturedDishProps {
  title?: string;
  subtitle?: string;
  dishName?: string;
  dishDescription?: string;
  dishImage?: string;
  dishPrice?: string;
  badgeText?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
}

// Feature 9: Promo Cards
export interface PromoItem {
  title: string;
  description: string;
  image?: string;
  badge?: string;
  buttonText?: string;
  buttonLink?: string;
}

export interface PromoCardProps {
  title?: string;
  cards?: PromoItem[];
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
}

// Feature 10: Chef/Team
export interface TeamMember {
  name: string;
  role: string;
  photo?: string;
  bio?: string;
}

export interface ChefTeamProps {
  title?: string;
  subtitle?: string;
  members?: TeamMember[];
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  columns?: number;
}

// Feature 11: Blog Section
export interface BlogPost {
  title: string;
  excerpt: string;
  image?: string;
  date?: string;
  author?: string;
  link?: string;
}

export interface BlogSectionProps {
  title?: string;
  subtitle?: string;
  posts?: BlogPost[];
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
}

// Feature 12: Reservation Form
export interface ReservationFormProps {
  title?: string;
  subtitle?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  buttonColor?: string;
  buttonText?: string;
  layout?: 'inline' | 'full';
  image?: string;
  imagePosition?: 'left' | 'right';
}

// Feature 13: Newsletter Signup
export interface NewsletterProps {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  buttonColor?: string;
  layout?: 'horizontal' | 'stacked';
}

// Feature 14: Stats Counter
export interface StatItem {
  value: number;
  label: string;
  suffix?: string;
  prefix?: string;
}

export interface StatsCounterProps {
  title?: string;
  stats?: StatItem[];
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
}

// Feature 15: Process Steps
export interface ProcessStep {
  title: string;
  description: string;
  icon?: string;
  stepNumber?: number;
}

export interface ProcessStepsProps {
  title?: string;
  subtitle?: string;
  steps?: ProcessStep[];
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
}

// Multi-page Support
export interface HomepageBuilderPage {
  id?: number;
  homepage_builder_id: number;
  title: string;
  slug: string;
  editor_state: string | null;
  sort_order: number;
  is_homepage: boolean;
}

// Homepage Builder Data for API
export interface HomepageBuilderData {
  id?: number;
  editor_state: string; // JSON serialized Craft.js state
  created_at?: string;
  updated_at?: string;
}

// Viewport sizes for responsive preview
export type ViewportSize = 'desktop' | 'tablet' | 'mobile';

export interface ViewportDimensions {
  width: number;
  label: string;
}

export const VIEWPORT_SIZES: Record<ViewportSize, ViewportDimensions> = {
  desktop: { width: 1350, label: 'Desktop' },
  tablet: { width: 768, label: 'Tablet' },
  mobile: { width: 375, label: 'Mobile' },
};

// Max width for the storefront website
export const STOREFRONT_MAX_WIDTH = 1350;

// Local storage key
export const HOMEPAGE_BUILDER_STORAGE_KEY = 'homepage-builder-state';
