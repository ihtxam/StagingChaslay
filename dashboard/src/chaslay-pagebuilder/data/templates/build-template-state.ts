/** Build minimal Craft.js editor state for starter templates. */
import { SECTION_ANCHORS } from '../../utils/section-id';

type CraftNode = Record<string, unknown>;

function node(
  id: string,
  resolvedName: string,
  props: Record<string, unknown>,
  parent: string,
  childIds: string[] = [],
  isCanvas = false
): CraftNode {
  return {
    [id]: {
      type: { resolvedName },
      isCanvas,
      props,
      displayName: resolvedName,
      custom: {},
      hidden: false,
      nodes: childIds,
      linkedNodes: {},
      parent,
    },
  };
}

function root(childIds: string[], background = '#ffffff'): string {
  const state: CraftNode = {
    ROOT: {
      type: { resolvedName: 'RootContainer' },
      isCanvas: true,
      props: { background, minHeight: 600 },
      displayName: 'RootContainer',
      custom: {},
      hidden: false,
      nodes: childIds,
      linkedNodes: {},
    },
  };
  return state;
}

export type TemplatePreset = {
  hero?: Record<string, unknown>;
  menu?: { component: string; props?: Record<string, unknown> };
  about?: { component: string; props?: Record<string, unknown> };
  hours?: { component: string; props?: Record<string, unknown> };
  reservation?: Record<string, unknown>;
  footer?: { component: string; props?: Record<string, unknown> };
  navbar?: { component: string; props?: Record<string, unknown> };
  background?: string;
};

export function buildTemplateEditorState(preset: TemplatePreset): string {
  const ids: string[] = [];
  const parts: CraftNode[] = [];
  let i = 0;
  const nextId = () => `tpl-${++i}`;

  const add = (resolvedName: string, props: Record<string, unknown> = {}) => {
    const id = nextId();
    ids.push(id);
    parts.push(node(id, resolvedName, props, 'ROOT'));
    return id;
  };

  if (preset.navbar) {
    add(preset.navbar.component, preset.navbar.props ?? {});
  } else {
    add('NavbarClassic');
  }

  add('HeroBanner', {
    sectionId: SECTION_ANCHORS.home,
    title: 'Welcome to Our Restaurant',
    subtitle: 'Fresh ingredients, unforgettable flavours',
    backgroundColor: '#1a1a2e',
    textColor: '#ffffff',
    buttonText: 'View Menu',
    buttonLink: '/menu',
    buttonColor: '#e94560',
    minHeight: 420,
    overlayOpacity: 55,
    textAlign: 'center',
    ...preset.hero,
  });

  add(preset.menu?.component ?? 'MenuGrid', {
    sectionId: SECTION_ANCHORS.menu,
    title: 'Our Menu',
    subtitle: 'Chef specials and guest favourites',
    backgroundColor: '#fafaf9',
    textColor: '#1a1a2e',
    accentColor: '#e94560',
    buttonText: 'Order Online',
    buttonLink: '/menu',
    ...preset.menu?.props,
  });

  add(preset.about?.component ?? 'AboutUsClassic', {
    sectionId: SECTION_ANCHORS.about,
    title: 'Our Story',
    subtitle: 'Passion on every plate',
    ...preset.about?.props,
  });

  add('ReservationForm', {
    sectionId: SECTION_ANCHORS.reservations,
    title: 'Reserve a Table',
    subtitle: 'Book your dining experience with us',
    backgroundColor: '#1a1a2e',
    textColor: '#ffffff',
    accentColor: '#e94560',
    buttonColor: '#e94560',
    buttonText: 'Book Now',
    layout: 'full',
    ...preset.reservation,
  });

  add(preset.hours?.component ?? 'HoursClassic', {
    sectionId: SECTION_ANCHORS.openingHours,
    title: 'Opening Hours',
    showStatus: true,
    ...preset.hours?.props,
  });

  add(preset.footer?.component ?? 'FooterClassic', {
    sectionId: SECTION_ANCHORS.footer,
    logoText: 'Restaurant',
    copyrightText: `© ${new Date().getFullYear()} All rights reserved.`,
    ...preset.footer?.props,
  });

  const state = { ...root(ids, preset.background ?? '#ffffff') };
  for (const part of parts) Object.assign(state, part);
  return JSON.stringify(state);
}
