// @ts-nocheck
import { TemplateDefinition } from './types';
import { buildTemplateEditorState } from './build-template-state';

export const grillino: TemplateDefinition = {
  id: 'grillino',
  nameKey: 'homepageBuilder.templates.grillino.name',
  descriptionKey: 'homepageBuilder.templates.grillino.description',
  thumbnail: '/templates/grillino.svg',
  category: 'restaurant',
  editorState: buildTemplateEditorState({
    background: '#fff7ed',
    navbar: { component: 'NavbarModern' },
    hero: {
      title: 'Grillino',
      subtitle: 'Fire-grilled favourites',
      backgroundColor: '#7f1d1d',
      buttonColor: '#f97316',
      buttonText: 'Order Now',
      buttonLink: '/menu',
    },
    menu: { component: 'MenuList', props: { accentColor: '#f97316' } },
    about: { component: 'AboutUsModern' },
    reservation: { backgroundColor: '#450a0a', accentColor: '#f97316' },
    footer: { component: 'FooterModern' },
  }),
};
