// @ts-nocheck
import { TemplateDefinition } from './types';
import { buildTemplateEditorState } from './build-template-state';

export const grandRestaurant: TemplateDefinition = {
  id: 'grand-restaurant',
  nameKey: 'homepageBuilder.templates.grandRestaurant.name',
  descriptionKey: 'homepageBuilder.templates.grandRestaurant.description',
  thumbnail: '/templates/grand-restaurant.svg',
  category: 'restaurant',
  editorState: buildTemplateEditorState({
    background: '#fafafa',
    navbar: { component: 'NavbarCentered' },
    hero: {
      title: 'Grand Restaurant',
      subtitle: 'An evening of elegance',
      backgroundColor: '#1e1b4b',
      buttonColor: '#d4af37',
      buttonText: 'Reserve',
      buttonLink: '/reservations',
      minHeight: 480,
    },
    menu: { component: 'MenuModern', props: { accentColor: '#d4af37' } },
    about: { component: 'AboutUs', props: { variant: 'elegant', title: 'Culinary Excellence' } },
    hours: { component: 'HoursSplit' },
    footer: { component: 'FooterCentered' },
  }),
};
