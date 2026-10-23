import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { OnScreenKeyboardContext } from '@/lib/on-screen-keyboard-context';
import { isTextTarget } from '@/lib/on-screen-keyboard-input';
import { shouldUseWebPosOnScreenKeyboard } from '@/lib/platform';
import { OnScreenKeyboardOverlay } from '@/components/OnScreenKeyboardOverlay';

export function OnScreenKeyboardProvider({
  children,
  autoOpenOnFocus = false,
}: {
  children: ReactNode;
  autoOpenOnFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);
  const openKeyboard = useCallback(() => {
    if (!shouldUseWebPosOnScreenKeyboard()) return;
    setOpen(true);
  }, []);
  const toggle = useCallback(() => {
    if (!shouldUseWebPosOnScreenKeyboard()) return;
    setOpen((v) => !v);
  }, []);

  const value = useMemo(
    () => ({ open, openKeyboard, toggle, close }),
    [open, openKeyboard, toggle, close]
  );

  useEffect(() => {
    if (!autoOpenOnFocus || !shouldUseWebPosOnScreenKeyboard()) return;
    const onFocusIn = (e: FocusEvent) => {
      if (!shouldUseWebPosOnScreenKeyboard()) return;
      const el = e.target instanceof Element ? e.target : null;
      if (isTextTarget(el)) setOpen(true);
    };
    document.addEventListener('focusin', onFocusIn, true);
    return () => document.removeEventListener('focusin', onFocusIn, true);
  }, [autoOpenOnFocus]);

  useEffect(() => {
    if (!shouldUseWebPosOnScreenKeyboard()) setOpen(false);
  }, []);

  useEffect(() => {
    if (!open || !shouldUseWebPosOnScreenKeyboard()) return;
    const prev = document.body.style.paddingBottom;
    document.body.style.paddingBottom = 'min(40dvh, 280px)';
    return () => {
      document.body.style.paddingBottom = prev;
    };
  }, [open]);

  return (
    <OnScreenKeyboardContext.Provider value={value}>
      {children}
      <OnScreenKeyboardOverlay
        open={open && shouldUseWebPosOnScreenKeyboard()}
        onClose={close}
      />
    </OnScreenKeyboardContext.Provider>
  );
}
