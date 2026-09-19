import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type FocusEvent,
} from 'react';
import { useOnScreenKeyboard } from '@/components/OnScreenKeyboard';

/** Minimum visualViewport shrink (px) before treating it as the soft keyboard. */
const SOFT_KEYBOARD_THRESHOLD_PX = 80;

function readViewportRect() {
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
 * Keeps focused inputs visible in POS modals on Android WebView (visualViewport)
 * and when the WebPOS on-screen keyboard is open.
 */
export function useModalKeyboardScroll() {
  const { open: onScreenKeyboardOpen } = useOnScreenKeyboard();
  const [viewportInset, setViewportInset] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  const [viewportRect, setViewportRect] = useState(() => ({
    top: 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));

  useEffect(() => {
    const update = () => {
      const next = readViewportRect();
      setViewportInset(next.inset);
      setViewportRect({ top: next.top, height: next.height });
    };

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

  const keyboardActive = onScreenKeyboardOpen || viewportInset > 0 || inputFocused;

  const overlayStyle: CSSProperties = keyboardActive
    ? {
        top: viewportRect.top,
        height: viewportRect.height,
        bottom: 'auto',
        paddingBottom: onScreenKeyboardOpen ? 'min(42dvh, 300px)' : '0.5rem',
      }
    : {};

  const overlayClassName = keyboardActive
    ? 'items-start pt-[max(0.25rem,env(safe-area-inset-top))]'
    : 'items-center';

  const modalStyle: CSSProperties = {
    maxHeight: keyboardActive
      ? `calc(${viewportRect.height}px - 1rem)`
      : 'min(90dvh, calc(100dvh - 1.5rem))',
  };

  const scrollFieldIntoView = useCallback(
    (el: HTMLElement) => {
      if (!keyboardActive) return;
      window.requestAnimationFrame(() => {
        const vv = window.visualViewport;
        const visibleTop = vv?.offsetTop ?? 0;
        const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
        const rect = el.getBoundingClientRect();
        if (rect.bottom > visibleBottom - 24 || rect.top < visibleTop + 8) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      });
    },
    [keyboardActive]
  );

  const overlayFocusHandlers = {
    onFocusCapture: () => setInputFocused(true),
    onBlurCapture: (e: FocusEvent<HTMLElement>) => {
      const next = e.relatedTarget;
      if (next instanceof Node && e.currentTarget.contains(next)) return;
      window.setTimeout(() => {
        const active = document.activeElement;
        if (active instanceof HTMLElement && e.currentTarget.contains(active)) return;
        setInputFocused(false);
      }, 0);
    },
  };

  return {
    keyboardActive,
    overlayClassName,
    overlayStyle,
    modalStyle,
    scrollFieldIntoView,
    overlayFocusHandlers,
  };
}
