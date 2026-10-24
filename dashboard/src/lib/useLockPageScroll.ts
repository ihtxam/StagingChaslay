import { type RefObject, useEffect } from 'react';
import { PAGE_SCROLL_SELECTOR } from './scroll-to-top';

type SavedScroller = {
  el: HTMLElement;
  overflow: string;
  overscrollBehavior: string;
};

/** Lock window + nested merchant page scrollports while a modal is open. */
export function lockPageScroll(): () => void {
  if (typeof document === 'undefined') return () => {};

  const html = document.documentElement;
  const body = document.body;
  const scrollRoots = Array.from(document.querySelectorAll<HTMLElement>(PAGE_SCROLL_SELECTOR));

  const savedHtmlOverflow = html.style.overflow;
  const savedBodyOverflow = body.style.overflow;
  const savedScrollers: SavedScroller[] = scrollRoots.map((el) => ({
    el,
    overflow: el.style.overflow,
    overscrollBehavior: el.style.overscrollBehavior,
  }));

  html.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
  for (const el of scrollRoots) {
    el.style.overflow = 'hidden';
    el.style.overscrollBehavior = 'none';
  }

  return () => {
    html.style.overflow = savedHtmlOverflow;
    body.style.overflow = savedBodyOverflow;
    for (const { el, overflow, overscrollBehavior } of savedScrollers) {
      el.style.overflow = overflow;
      el.style.overscrollBehavior = overscrollBehavior;
    }
  };
}

function isNodeInside(el: HTMLElement | null, target: EventTarget | null): boolean {
  if (!el || !target || !(target instanceof Node)) return false;
  return el === target || el.contains(target);
}

/**
 * Prevents iOS from scrolling the page behind a modal. Pass a ref to the modal's
 * scrollable body so touch scrolling still works inside the sheet.
 */
export function useLockPageScroll(
  locked: boolean,
  allowTouchScrollRef?: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') return;

    const unlock = lockPageScroll();

    const onTouchMove = (e: TouchEvent) => {
      if (isNodeInside(allowTouchScrollRef?.current ?? null, e.target)) return;
      e.preventDefault();
    };

    document.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      document.removeEventListener('touchmove', onTouchMove);
      unlock();
    };
  }, [locked, allowTouchScrollRef]);
}
