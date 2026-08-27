export type WebPosActionButtonSize = 'sm' | 'md' | 'lg';

export function normalizeActionButtonSize(raw: unknown): WebPosActionButtonSize {
  if (raw === 'sm' || raw === 'lg') return raw;
  return 'md';
}

export function actionButtonIconSize(size: WebPosActionButtonSize): number {
  if (size === 'sm') return 16;
  if (size === 'lg') return 22;
  return 18;
}

export function expressCheckoutButtonClass(size: WebPosActionButtonSize): string {
  const heights =
    size === 'sm'
      ? 'py-2 text-xs'
      : size === 'lg'
        ? 'py-5 text-base'
        : 'py-3.5 text-sm';
  return `inline-flex items-center justify-center gap-2 rounded-xl font-bold text-white disabled:opacity-40 ${heights}`;
}

export function expressCheckoutArrowClass(size: WebPosActionButtonSize): string {
  const widths = size === 'sm' ? 'w-12' : size === 'lg' ? 'w-20' : 'w-16';
  const heights =
    size === 'sm'
      ? 'min-h-[2.25rem]'
      : size === 'lg'
        ? 'min-h-[3.5rem]'
        : 'min-h-[2.75rem]';
  return `inline-flex shrink-0 items-center justify-center rounded-xl border-2 border-stone-300 bg-stone-50 text-stone-800 hover:bg-stone-100 disabled:opacity-40 ${widths} ${heights}`;
}

export function expressCheckoutArrowIconSize(size: WebPosActionButtonSize): number {
  if (size === 'sm') return 22;
  if (size === 'lg') return 32;
  return 28;
}

export function cartActionButtonClass(size: WebPosActionButtonSize, extra = ''): string {
  const sizes =
    size === 'sm'
      ? 'py-2 text-xs min-h-[2.25rem]'
      : size === 'lg'
        ? 'py-4 text-base min-h-[3.5rem]'
        : 'py-3 text-sm min-h-[2.75rem]';
  return `rounded-lg font-bold disabled:opacity-40 ${sizes} ${extra}`.trim();
}
