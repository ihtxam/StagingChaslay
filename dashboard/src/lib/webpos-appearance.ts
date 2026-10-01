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

export const WEBPOS_TEXT_SIZE_KEY = 'webpos_text_size';

/** Fired when till text size changes (same tab or after localStorage write). */
export const WEBPOS_TEXT_SIZE_EVENT = 'webpos:text-size';

const TEXT_SIZE_PERCENT: Record<WebPosTextSize, number> = {
  sm: 90,
  md: 100,
  lg: 112,
  xl: 120,
};

export function webPosTextSizeRootPercent(size: WebPosTextSize): number {
  return TEXT_SIZE_PERCENT[size] ?? 100;
}

export function readWebPosTextSize(): WebPosTextSize {
  try {
    const v = localStorage.getItem(WEBPOS_TEXT_SIZE_KEY);
    if (v && (WEBPOS_TEXT_SIZES as string[]).includes(v)) return v as WebPosTextSize;
  } catch {
    /* ignore */
  }
  return 'md';
}

export function cycleWebPosTextSize(size: WebPosTextSize, dir: -1 | 1): WebPosTextSize {
  const idx = WEBPOS_TEXT_SIZES.indexOf(size);
  if (idx < 0) return 'md';
  const nextIdx = Math.max(0, Math.min(WEBPOS_TEXT_SIZES.length - 1, idx + dir));
  return WEBPOS_TEXT_SIZES[nextIdx] ?? size;
}

export function persistWebPosTextSize(size: WebPosTextSize) {
  try {
    localStorage.setItem(WEBPOS_TEXT_SIZE_KEY, size);
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WEBPOS_TEXT_SIZE_EVENT, { detail: size }));
  }
}
