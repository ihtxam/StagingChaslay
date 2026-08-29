/** Minimal i18n shim for Chaslay homepage-builder strings (EN only for test import). */
const MESSAGES: Record<string, Record<string, string>> = {
  homepageBuilder: {
    save: 'Save',
    preview: 'Preview',
    exitPreview: 'Exit preview',
    desktop: 'Desktop',
    tablet: 'Tablet',
    mobile: 'Mobile',
    layers: 'Layers',
    settings: 'Settings',
    toolbox: 'Blocks',
    undo: 'Undo',
    redo: 'Redo',
    fullPreview: 'Full preview',
    back: 'Back',
    saved: 'Saved',
    saving: 'Saving…',
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
  return lookup(group, key);
}
