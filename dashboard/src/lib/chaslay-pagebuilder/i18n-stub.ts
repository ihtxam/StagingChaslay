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
    blank: 'Start blank',
    useTemplate: 'Use template',
    nameTitle: 'Name your homepage',
    namePlaceholder: 'e.g. Summer promo',
    create: 'Create',
    back: 'Back',
  },
};

function lookup(path: string, key: string): string {
  const group = MESSAGES[path];
  return group?.[key] ?? key;
}

export function useTranslations(path: string) {
  return (key: string) => lookup(path, key);
}
