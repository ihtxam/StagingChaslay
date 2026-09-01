// @ts-nocheck
import { TemplateDefinition } from './types';
import { buildTemplateEditorState } from './build-template-state';

export const dinenos: TemplateDefinition = {
  id: 'dinenos',
  nameKey: 'homepageBuilder.templates.dinenos.name',
  descriptionKey: 'homepageBuilder.templates.dinenos.description',
  thumbnail: '/templates/dinenos.svg',
  category: 'restaurant',
  editorState: buildTemplateEditorState({
    background: '#fffaf5',
    hero: {
      title: 'Dinenos Bistro',
      subtitle: 'Seasonal plates & warm hospitality',
      backgroundColor: '#0f766e',
      buttonColor: '#fbbf24',
      buttonText: 'Book a Table',
      buttonLink: '/reservations',
    },
    menu: { component: 'MenuGrid', props: { accentColor: '#0f766e' } },
    reservation: { accentColor: '#fbbf24', backgroundColor: '#134e4a' },
  }),
};
