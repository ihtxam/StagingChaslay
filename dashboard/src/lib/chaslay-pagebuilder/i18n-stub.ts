/** i18n shim for Chaslay homepage builder (EN). */
const MESSAGES: Record<string, Record<string, string>> = {
  homepageBuilder: {
    save: 'Save',
    preview: 'Preview',
    exitPreview: 'Exit preview',
    fullPagePreview: 'Full page preview',
    pressEscToExit: 'Press Esc to exit',
    desktop: 'Desktop',
    tablet: 'Tablet',
    mobile: 'Mobile',
    layers: 'Layers',
    settings: 'Settings',
    toolbox: 'Blocks',
    components: 'Components',
    dragHint: 'Drag a block onto the page',
    undo: 'Undo',
    redo: 'Redo',
    fullPreview: 'Full preview',
    back: 'Back',
    saved: 'Saved',
    saving: 'Saving…',
    'sections.layout': 'Layout',
    'sections.navigation': 'Navigation',
    'sections.heroes': 'Hero banners',
    'sections.menu': 'Menu',
    'sections.about': 'About us',
    'sections.gallery': 'Gallery',
    'sections.testimonials': 'Testimonials',
    'sections.hours': 'Opening hours',
    'sections.contact': 'Contact',
    'sections.socialMedia': 'Social media',
    'sections.map': 'Map',
    'sections.featured': 'Featured',
    'sections.promotions': 'Promotions',
    'sections.team': 'Team',
    'sections.blog': 'Blog',
    'sections.engagement': 'Reservations & engagement',
    'sections.footer': 'Footer',
    'sections.customCode': 'Custom code',
    'sections.utilities': 'Utilities',
    'variants.divider': 'Divider',
    'variants.spacer': 'Spacer',
    'variants.classic': 'Classic',
    'variants.centered': 'Centered',
    'variants.minimal': 'Minimal',
    'variants.modern': 'Modern',
    'variants.gradient': 'Gradient',
    'variants.split': 'Split',
    'variants.grid': 'Grid',
    'variants.list': 'List',
    'variants.carousel': 'Carousel',
    'variants.masonry': 'Masonry',
    'variants.horizontal': 'Horizontal',
    'variants.vertical': 'Vertical',
    'variants.floating': 'Floating',
    'variants.elegant': 'Elegant',
    'variants.featured': 'Featured quote',
    'variants.locationMap': 'Location map',
    'variants.featuredDish': 'Featured dish',
    'variants.promoCards': 'Promo cards',
    'variants.chefTeam': 'Chef team',
    'variants.blogSection': 'Blog section',
    'variants.reservationForm': 'Reservations',
    'variants.newsletterSignup': 'Newsletter signup',
    'variants.statsCounter': 'Stats counter',
    'variants.processSteps': 'Process steps',
    'variants.customHTML': 'Custom HTML',
    'variants.scrollToTop': 'Scroll to top',
    'variants.menuCarousel': 'Menu carousel',
    'variants.menuDineGrid': 'Menu grid',
    'descriptions.divider': 'Horizontal line separator',
    'descriptions.spacer': 'Vertical spacing block',
    'descriptions.navClassic': 'Logo left, links right',
    'descriptions.navCentered': 'Centered logo with side links',
    'descriptions.navMinimal': 'Compact top bar',
    'descriptions.navModern': 'Bold modern navigation',
    'descriptions.heroCentered': 'Full-width centered hero',
    'descriptions.heroSplit': 'Image and text side by side',
    'descriptions.heroMinimal': 'Simple headline hero',
    'descriptions.heroGradient': 'Gradient background hero',
    'descriptions.menuGrid': 'Product cards in a grid',
    'descriptions.menuList': 'Menu items in a list',
    'descriptions.menuMinimal': 'Clean minimal menu',
    'descriptions.menuModern': 'Modern menu layout',
    'descriptions.menuCarousel': 'Scrolling menu highlights',
    'descriptions.menuDineGrid': 'Dine-in menu grid',
    'descriptions.aboutClassic': 'Image with story text',
    'descriptions.aboutCentered': 'Centered about section',
    'descriptions.aboutMinimal': 'Short about blurb',
    'descriptions.aboutModern': 'Modern about layout',
    'descriptions.aboutElegant': 'Elegant fine-dining style',
    'descriptions.galleryGrid': 'Photo grid gallery',
    'descriptions.galleryMasonry': 'Masonry photo layout',
    'descriptions.galleryCarousel': 'Sliding image gallery',
    'descriptions.testimonialsGrid': 'Guest reviews grid',
    'descriptions.testimonialsCarousel': 'Rotating testimonials',
    'descriptions.testimonialsFeatured': 'Single featured review',
    'descriptions.hoursClassic': 'Weekly hours list',
    'descriptions.hoursMinimal': 'Compact hours display',
    'descriptions.hoursSplit': 'Hours with status badge',
    'descriptions.hoursModern': 'Modern hours cards',
    'descriptions.contactDetails': 'Phone, email and address',
    'descriptions.socialHorizontal': 'Social icons in a row',
    'descriptions.socialVertical': 'Stacked social links',
    'descriptions.socialFloating': 'Floating social bar',
    'descriptions.locationMap': 'Embedded map block',
    'descriptions.featuredDish': 'Spotlight one dish',
    'descriptions.promoCards': 'Offer and promo cards',
    'descriptions.chefTeam': 'Meet the team',
    'descriptions.blogSection': 'Latest news or posts',
    'descriptions.reservationForm': 'Table booking form',
    'descriptions.newsletterSignup': 'Email signup form',
    'descriptions.statsCounter': 'Animated statistics',
    'descriptions.processSteps': 'How it works steps',
    'descriptions.footerClassic': 'Multi-column footer',
    'descriptions.footerMinimal': 'Simple footer bar',
    'descriptions.footerCentered': 'Centered footer links',
    'descriptions.footerModern': 'Modern footer layout',
    'descriptions.customHTML': 'Paste your own HTML',
    'descriptions.scrollToTop': 'Back-to-top button',
  },
  'homepageBuilder.templates': {
    title: 'Choose a template',
    subtitle: 'Pick a starting layout or begin with a blank canvas.',
    startFromScratch: 'Start from scratch',
    startFromScratchDesc: 'Empty canvas with a droppable page container',
    enterName: 'Name your homepage',
    enterNameDesc: 'Give this layout a name you will recognize in the list.',
    homepageName: 'Homepage name',
    namePlaceholder: 'e.g. Summer promo',
    backToTemplates: 'Back to templates',
    createAndEdit: 'Create & edit',
    blank: 'Start blank',
    useTemplate: 'Use template',
    nameTitle: 'Name your homepage',
    create: 'Create',
    back: 'Back',
    'categories.restaurant': 'Restaurant',
    'categories.cafe': 'Café',
    'categories.retail': 'Retail',
    'dinenos.name': 'Dinenos',
    'dinenos.description': 'Warm bistro layout with hero, menu, and reservations.',
    'grandRestaurant.name': 'Grand Restaurant',
    'grandRestaurant.description': 'Elegant fine-dining homepage with gallery and hours.',
    'grillino.name': 'Grillino',
    'grillino.description': 'Bold grill-house theme with featured dishes and promos.',
    'royate.name': 'Royate',
    'royate.description': 'Modern royal dining style with testimonials and chef team.',
    'wellfood.name': 'Wellfood',
    'wellfood.description': 'Clean health-focused layout with newsletter signup.',
  },
};

function lookup(path: string, key: string): string {
  const group = MESSAGES[path];
  if (group?.[key]) return group[key];
  if (path === 'homepageBuilder' && key.includes('.')) {
    return group?.[key] ?? key.split('.').pop() ?? key;
  }
  return group?.[key] ?? key;
}

export function useTranslations(path: string) {
  return (key: string) => lookup(path, key);
}

/** Resolve a full dotted message path such as `homepageBuilder.templates.dinenos.name`. */
export function translateMessage(fullPath: string): string {
  const templatesPrefix = 'homepageBuilder.templates.';
  if (fullPath.startsWith(templatesPrefix)) {
    return lookup('homepageBuilder.templates', fullPath.slice(templatesPrefix.length));
  }
  const lastDot = fullPath.lastIndexOf('.');
  if (lastDot === -1) return fullPath;
  const group = fullPath.slice(0, lastDot);
  const key = fullPath.slice(lastDot + 1);
  const nested = lookup(group, key);
  if (nested !== key) return nested;
  const groupMessages = MESSAGES[group];
  if (groupMessages) {
    const shortKey = fullPath.slice(group.length + 1);
    if (groupMessages[shortKey]) return groupMessages[shortKey];
  }
  return key;
}
