// @ts-nocheck
import { TemplateDefinition } from './types';
import { buildTemplateEditorState } from './build-template-state';

export const wellfood: TemplateDefinition = {
  id: 'wellfood',
  nameKey: 'homepageBuilder.templates.wellfood.name',
  descriptionKey: 'homepageBuilder.templates.wellfood.description',
  thumbnail: '/templates/wellfood.svg',
  category: 'cafe',
  editorState: buildTemplateEditorState({
    background: '#f0fdf4',
    navbar: { component: 'NavbarClassic' },
    hero: {
      title: 'Wellfood',
      subtitle: 'Fresh, wholesome, delicious',
      backgroundColor: '#14532d',
      buttonColor: '#86efac',
      buttonText: 'Explore Menu',
      buttonLink: '/menu',
      textColor: '#ffffff',
    },
    menu: { component: 'MenuMinimal', props: { accentColor: '#16a34a' } },
    about: { component: 'AboutUsMinimal' },
    hours: { component: 'HoursMinimal' },
    reservation: { backgroundColor: '#14532d', accentColor: '#86efac' },
    footer: { component: 'FooterMinimal' },
  }),
};
