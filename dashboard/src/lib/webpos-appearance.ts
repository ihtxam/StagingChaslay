/** Shared WebPOS appearance tokens (avoid importing WebPosTopBar in settings pages). */
export type WebPosColorTheme = 'teal' | 'green' | 'blue' | 'violet' | 'mono';
export type WebPosTextSize = 'sm' | 'md' | 'lg' | 'xl';
export type WebPosAppearance = 'light' | 'night';

export const WEBPOS_COLOR_THEMES: WebPosColorTheme[] = [
  'teal',
  'green',
  'blue',
  'violet',
  'mono',
];
export const WEBPOS_TEXT_SIZES: WebPosTextSize[] = ['sm', 'md', 'lg', 'xl'];
