import { useCallback, useEffect, useState, type CSSProperties } from 'react';

const SOFT_KEYBOARD_THRESHOLD_PX = 72;

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

  const keyboardOpen = layout.inset > 0;

  const pageStyle: CSSProperties = keyboardOpen
    ? {
        position: 'fixed',
        left: 0,
        right: 0,
        top: layout.top,
        height: layout.height,
        overflowY: 'auto',
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
        const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
        const rect = el.getBoundingClientRect();
        if (rect.bottom > visibleBottom - 20 || rect.top < visibleTop + 12) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      });
    },
    []
  );

  return { keyboardOpen, pageStyle, scrollFieldIntoView };
}
