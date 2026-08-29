// @ts-nocheck
import type { TemplateDefinition } from './types';
export type { TemplateDefinition } from './types';

import { dinenos } from './template-dinenos';
import { grandRestaurant } from './template-grand-restaurant';
import { grillino } from './template-grillino';
import { royate } from './template-royate';
import { wellfood } from './template-wellfood';

export const templates: TemplateDefinition[] = [
  dinenos,
  grandRestaurant,
  grillino,
  royate,
  wellfood,
];
