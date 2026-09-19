import { useCallback, useEffect, useState } from 'react';
import { useOnScreenKeyboard } from '@/components/OnScreenKeyboard';

/** Minimum visualViewport shrink (px) before treating it as the soft keyboard. */
const SOFT_KEYBOARD_THRESHOLD_PX = 80;

/**
 * Keeps focused inputs visible in POS modals on Android WebView (visualViewport)
 * and when the WebPOS on-screen keyboard is open.
 */
export function useModalKeyboardScroll() {
  const { open: onScreenKeyboardOpen } = useOnScreenKeyboard();
  const [viewportInset, setViewportInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setViewportInset(inset >= SOFT_KEYBOARD_THRESHOLD_PX ? Math.ceil(inset) : 0);
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  const keyboardActive = onScreenKeyboardOpen || viewportInset > 0;

  const overlayPaddingBottom = onScreenKeyboardOpen
    ? 'min(42dvh, 300px)'
    : viewportInset > 0
      ? `${viewportInset}px`
      : undefined;

  const scrollFieldIntoView = useCallback(
    (el: HTMLElement) => {
      if (!keyboardActive) return;
      window.requestAnimationFrame(() => {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    },
    [keyboardActive]
  );

  const overlayClassName = keyboardActive
    ? 'items-start pt-[max(0.75rem,env(safe-area-inset-top))]'
    : 'items-center';

  const overlayStyle =
    overlayPaddingBottom != null ? { paddingBottom: overlayPaddingBottom } : undefined;

  return {
    keyboardActive,
    overlayClassName,
    overlayStyle,
    scrollFieldIntoView,
  };
}
