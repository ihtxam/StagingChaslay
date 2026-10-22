import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useOnScreenKeyboard } from '@/lib/on-screen-keyboard-context';

const SOFT_KEYBOARD_THRESHOLD_PX = 72;

/** Reserve space above the fixed WebPOS / desktop on-screen keyboard (matches modal scroll). */
export const ON_SCREEN_KEYBOARD_BOTTOM_RESERVE = 'min(42dvh, 300px)';

function onScreenKeyboardReservePx(): number {
  if (typeof window === 'undefined') return 0;
  return Math.min(Math.round(window.innerHeight * 0.42), 300);
}

function readViewportLayout() {
  if (typeof window === 'undefined') {
    return { top: 0, height: 800, inset: 0 };
  }
  const vv = window.visualViewport;
  if (!vv) {
    return { top: 0, height: window.innerHeight, inset: 0 };
  }
  const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  return {
    top: vv.offsetTop,
    height: vv.height,
    inset: inset >= SOFT_KEYBOARD_THRESHOLD_PX ? Math.ceil(inset) : 0,
  };
}

/**
 * Full-page forms on Android tablets (Chrome / WebView): pin layout to visualViewport
 * so the soft keyboard does not cover submit buttons.
 */
export function useSoftKeyboardLayout() {
  const { open: onScreenKeyboardOpen } = useOnScreenKeyboard();
  const [layout, setLayout] = useState(readViewportLayout);

  useEffect(() => {
    const update = () => setLayout(readViewportLayout());
    update();
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const softKeyboardOpen = layout.inset > 0;
  const keyboardOpen = softKeyboardOpen || onScreenKeyboardOpen;

  const pageStyle: CSSProperties = softKeyboardOpen
    ? {
        position: 'fixed',
        left: 0,
        right: 0,
        top: layout.top,
        height: layout.height,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }
    : onScreenKeyboardOpen
      ? {
          minHeight: '100dvh',
          maxHeight: '100dvh',
          overflowY: 'auto',
          paddingBottom: ON_SCREEN_KEYBOARD_BOTTOM_RESERVE,
          WebkitOverflowScrolling: 'touch',
        }
      : {
          minHeight: '100dvh',
        };

  const scrollFieldIntoView = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      window.requestAnimationFrame(() => {
        const vv = window.visualViewport;
        const visibleTop = vv?.offsetTop ?? 0;
        let visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
        if (onScreenKeyboardOpen) {
          visibleBottom -= onScreenKeyboardReservePx();
        }
        const rect = el.getBoundingClientRect();
        if (rect.bottom > visibleBottom - 20 || rect.top < visibleTop + 12) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      });
    },
    [onScreenKeyboardOpen]
  );

  useEffect(() => {
    if (!onScreenKeyboardOpen) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      scrollFieldIntoView(active);
    }
  }, [onScreenKeyboardOpen, scrollFieldIntoView]);

  return { keyboardOpen, pageStyle, scrollFieldIntoView, onScreenKeyboardOpen };
}
