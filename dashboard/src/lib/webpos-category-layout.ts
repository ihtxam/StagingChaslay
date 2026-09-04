/** Category strip row count — persisted per device. */
export type WebPosCategoryLayoutMode = 'rows-2' | 'rows-3';

/** Category chip size — separate from row count (like product tile size). */
export type WebPosCategoryChipSize = 'sm' | 'md' | 'lg';

export const WEBPOS_CATEGORY_LAYOUT_KEY = 'webpos.grid.categoryLayout';
export const WEBPOS_CATEGORY_CHIP_SIZE_KEY = 'webpos.grid.categoryChipSize';

/** ~9" portrait tablets (e.g. iPad mini) are ≤768px wide at typical DPI. */
export const WEBPOS_BELOW_9IN_MIN_WIDTH_PX = 768;

export const WEBPOS_BELOW_9IN_MEDIA_QUERY = `(max-width: ${WEBPOS_BELOW_9IN_MIN_WIDTH_PX - 1}px)`;

export const CATEGORY_LAYOUT_MODES: WebPosCategoryLayoutMode[] = ['rows-2', 'rows-3'];

function normalizeCategoryLayout(value: string | null): WebPosCategoryLayoutMode | null {
  if (value === 'rows-2' || value === 'rows-3') return value;
  // Migrate legacy modes from earlier builds.
  if (value === 'scroll' || value === 'wrap') return 'rows-3';
  return null;
}

export function readStoredCategoryLayout(): WebPosCategoryLayoutMode {
  try {
    const v = localStorage.getItem(WEBPOS_CATEGORY_LAYOUT_KEY);
    const normalized = normalizeCategoryLayout(v);
    if (normalized) return normalized;
  } catch {
    /* ignore */
  }
  return 'rows-3';
}

export function persistCategoryLayout(mode: WebPosCategoryLayoutMode) {
  try {
    localStorage.setItem(WEBPOS_CATEGORY_LAYOUT_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function readStoredCategoryChipSize(): WebPosCategoryChipSize {
  try {
    const v = localStorage.getItem(WEBPOS_CATEGORY_CHIP_SIZE_KEY);
    if (v === 'sm' || v === 'md' || v === 'lg') return v;
  } catch {
    /* ignore */
  }
  return 'md';
}

export function persistCategoryChipSize(size: WebPosCategoryChipSize) {
  try {
    localStorage.setItem(WEBPOS_CATEGORY_CHIP_SIZE_KEY, size);
  } catch {
    /* ignore */
  }
}

export function cycleCategoryLayout(mode: WebPosCategoryLayoutMode): WebPosCategoryLayoutMode {
  return mode === 'rows-2' ? 'rows-3' : 'rows-2';
}

export function cycleCategoryChipSize(size: WebPosCategoryChipSize): WebPosCategoryChipSize {
  if (size === 'sm') return 'md';
  if (size === 'md') return 'lg';
  return 'sm';
}

export function isBelow9InchViewport(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia(WEBPOS_BELOW_9IN_MEDIA_QUERY).matches;
}
