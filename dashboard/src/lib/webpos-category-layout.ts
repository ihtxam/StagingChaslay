/** Category strip layout on register — persisted per device. */
export type WebPosCategoryLayoutMode = 'scroll' | 'rows-2' | 'rows-3' | 'wrap';

export const WEBPOS_CATEGORY_LAYOUT_KEY = 'webpos.grid.categoryLayout';

export const CATEGORY_LAYOUT_MODES: WebPosCategoryLayoutMode[] = [
  'scroll',
  'rows-2',
  'rows-3',
  'wrap',
];

export function readStoredCategoryLayout(): WebPosCategoryLayoutMode {
  try {
    const v = localStorage.getItem(WEBPOS_CATEGORY_LAYOUT_KEY);
    if (v && CATEGORY_LAYOUT_MODES.includes(v as WebPosCategoryLayoutMode)) {
      return v as WebPosCategoryLayoutMode;
    }
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

export function cycleCategoryLayout(
  current: WebPosCategoryLayoutMode
): WebPosCategoryLayoutMode {
  const idx = CATEGORY_LAYOUT_MODES.indexOf(current);
  const next = (idx + 1) % CATEGORY_LAYOUT_MODES.length;
  return CATEGORY_LAYOUT_MODES[next];
}

/** Estimate wrapped rows for the category strip (phone grid columns). */
export function estimateCategoryRows(itemCount: number, columns: 2 | 3): number {
  if (itemCount <= 0) return 0;
  return Math.ceil(itemCount / columns);
}

export function shouldShowCategoryLayoutPicker(
  itemCount: number,
  columns: 2 | 3,
  thresholdRows = 3
): boolean {
  return estimateCategoryRows(itemCount, columns) > thresholdRows;
}
