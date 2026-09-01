// @ts-nocheck
import { TemplateDefinition } from './types';
import { buildTemplateEditorState } from './build-template-state';

export const royate: TemplateDefinition = {
  id: 'royate',
  nameKey: 'homepageBuilder.templates.royate.name',
  descriptionKey: 'homepageBuilder.templates.royate.description',
  thumbnail: '/templates/royate.svg',
  category: 'restaurant',
  editorState: buildTemplateEditorState({
    background: '#faf5ff',
    navbar: { component: 'NavbarMinimal' },
    hero: {
      title: 'Royate',
      subtitle: 'Modern royal dining',
      backgroundColor: '#4c1d95',
      buttonColor: '#c4b5fd',
      buttonText: 'View Menu',
      buttonLink: '/menu',
    },
    menu: { component: 'MenuSection', props: { accentColor: '#7c3aed' } },
    about: { component: 'AboutUsCentered' },
    hours: { component: 'HoursModern' },
    footer: { component: 'FooterClassic' },
  }),
};
