/** Page-level nested scrollports (not dropdowns / sidebars / dialogs). */
export const PAGE_SCROLL_SELECTOR = [
  '.panel-main',
  '[data-settings-scroll-root]',
  '[data-page-scroll]',
].join(', ');

export type NavigationKind = 'PUSH' | 'POP' | 'REPLACE';

export type ScrollNavAction = 'top' | 'restore' | 'hash' | 'skip';

export type SavedContainerScroll = {
  selector: string;
  index: number;
  top: number;
  left: number;
};

export type SavedPageScroll = {
  windowX: number;
  windowY: number;
  containers: SavedContainerScroll[];
};

/** POS / KDS / CDS / kiosk / storekeeper stay fullscreen — do not move their scroll. */
export function isFullscreenAppRoute(pathname: string): boolean {
  const p = pathname || '';
  return (
    /\/merchant\/(?:pos|waiter|storekeeper|order-center)(?:\/|$)/.test(p) ||
    /^\/kds(?:\/|$)/.test(p) ||
    /^\/tv(?:\/|$)/.test(p) ||
    /^\/cds(?:\/|$)/.test(p) ||
    /(?:^|\/)kiosk(?:\/|$)/.test(p) ||
    /^\/signage(?:\/|$)/.test(p) ||
    /^\/pos-embed(?:\/|$)/.test(p)
  );
}

export function locationKey(pathname: string, search = ''): string {
  return `${pathname}${search || ''}`;
}

export function hasLocationHash(hash: string | undefined | null): boolean {
  return String(hash || '').replace(/^#/, '').trim().length > 0;
}

/**
 * Decide what to do after an in-app location change.
 * PUSH/REPLACE to a new pathname → top. Hash → leave for the hash target.
 * POP → restore. Fullscreen apps and same-path query updates → skip.
 */
export function resolveScrollNavAction(opts: {
  pathname: string;
  prevPathname: string;
  hash?: string;
  navigationType: NavigationKind;
}): ScrollNavAction {
  if (isFullscreenAppRoute(opts.pathname)) return 'skip';
  if (hasLocationHash(opts.hash)) return 'hash';
  if (opts.pathname === opts.prevPathname) return 'skip';
  if (opts.navigationType === 'POP') return 'restore';
  return 'top';
}

export function resetWindowScroll(win: Window = window): void {
  try {
    win.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  } catch {
    try {
      win.scrollTo(0, 0);
    } catch {
      /* ignore */
    }
  }
  const doc = win.document;
  if (doc?.documentElement) doc.documentElement.scrollTop = 0;
  if (doc?.body) doc.body.scrollTop = 0;
}

export function resetNestedPageScrollers(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>(PAGE_SCROLL_SELECTOR).forEach((el) => {
    el.scrollTop = 0;
    el.scrollLeft = 0;
  });
}

export function scrollNewPageToTop(win: Window = window): void {
  resetWindowScroll(win);
  if (win.document) resetNestedPageScrollers(win.document);
}

function collectContainerScroll(root: ParentNode): SavedContainerScroll[] {
  const out: SavedContainerScroll[] = [];
  for (const selector of PAGE_SCROLL_SELECTOR.split(',').map((s) => s.trim())) {
    root.querySelectorAll<HTMLElement>(selector).forEach((el, index) => {
      if (el.scrollTop || el.scrollLeft) {
        out.push({ selector, index, top: el.scrollTop, left: el.scrollLeft });
      }
    });
  }
  return out;
}

export function capturePageScroll(win: Window = window): SavedPageScroll {
  return {
    windowX: win.scrollX || 0,
    windowY: win.scrollY || 0,
    containers: win.document ? collectContainerScroll(win.document) : [],
  };
}

export function restorePageScroll(saved: SavedPageScroll, win: Window = window): void {
  try {
    win.scrollTo({ top: saved.windowY, left: saved.windowX, behavior: 'auto' });
  } catch {
    try {
      win.scrollTo(saved.windowX, saved.windowY);
    } catch {
      /* ignore */
    }
  }
  const doc = win.document;
  if (!doc) return;
  for (const item of saved.containers) {
    const el = doc.querySelectorAll<HTMLElement>(item.selector)[item.index];
    if (!el) continue;
    el.scrollTop = item.top;
    el.scrollLeft = item.left;
  }
}
