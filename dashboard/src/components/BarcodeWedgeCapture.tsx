import { useEffect, useRef } from 'react';
import {
  BARCODE_WEDGE_INPUT_CLASS,
  BARCODE_WEDGE_REFOCUS_MS,
  shouldYieldBarcodeFocus,
} from '@/lib/barcode-wedge';

type Props = {
  active: boolean;
  onInput: (text: string, clearInput?: () => void) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

function tryFocusWedge(input: HTMLInputElement | null, active: boolean) {
  if (!active || !input) return;
  if (shouldYieldBarcodeFocus(document.activeElement, input)) return;
  input.focus({ preventScroll: true });
}

/**
 * Hidden input that keeps USB HID barcode scanners working even when
 * another field briefly stole focus. Scanners type into the focused element.
 */
export default function BarcodeWedgeCapture({ active, onInput, onKeyDown }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const refocusTimerRef = useRef<number | null>(null);

  const scheduleRefocus = () => {
    if (refocusTimerRef.current != null) {
      window.clearTimeout(refocusTimerRef.current);
    }
    refocusTimerRef.current = window.setTimeout(() => {
      refocusTimerRef.current = null;
      tryFocusWedge(inputRef.current, active);
    }, BARCODE_WEDGE_REFOCUS_MS);
  };

  useEffect(() => {
    if (!active) {
      inputRef.current?.blur();
      if (refocusTimerRef.current != null) {
        window.clearTimeout(refocusTimerRef.current);
        refocusTimerRef.current = null;
      }
      return;
    }

    scheduleRefocus();

    const onFocusIn = () => {
      if (shouldYieldBarcodeFocus(document.activeElement, inputRef.current)) return;
      scheduleRefocus();
    };

    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      if (refocusTimerRef.current != null) {
        window.clearTimeout(refocusTimerRef.current);
        refocusTimerRef.current = null;
      }
    };
  }, [active]);

  if (!active) return null;

  return (
    <input
      ref={inputRef}
      type="text"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      aria-hidden
      tabIndex={-1}
      className={`${BARCODE_WEDGE_INPUT_CLASS} pointer-events-none fixed -left-[9999px] top-0 h-px w-px opacity-0`}
      onInput={(e) => {
        const el = e.currentTarget;
        onInput(el.value, () => {
          el.value = '';
        });
      }}
      onKeyDown={onKeyDown}
      onBlur={scheduleRefocus}
    />
  );
}
