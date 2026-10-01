import { useEffect, useRef } from 'react';
import {
  BARCODE_WEDGE_INPUT_CLASS,
  BARCODE_WEDGE_REFOCUS_MS,
  shouldMaintainBarcodeWedgeCaptureFocus,
  shouldYieldBarcodeFocus,
} from '@/lib/barcode-wedge';

type Props = {
  active: boolean;
  onInput: (text: string, clearInput?: () => void) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Defaults to barcode wedge capture class. */
  inputClassName?: string;
  shouldYieldFocus?: (
    activeEl: Element | null,
    wedgeInput: HTMLInputElement | null
  ) => boolean;
  shouldMaintainFocus?: () => boolean;
};

function tryFocusWedge(
  input: HTMLInputElement | null,
  active: boolean,
  shouldMaintainFocus: () => boolean,
  shouldYieldFocus: Props['shouldYieldFocus']
) {
  if (!active || !input || !shouldMaintainFocus()) return;
  if (shouldYieldFocus?.(document.activeElement, input)) return;
  input.focus({ preventScroll: true });
}

/**
 * Hidden input that keeps USB HID barcode scanners working even when
 * another field briefly stole focus. Scanners type into the focused element.
 */
export default function BarcodeWedgeCapture({
  active,
  onInput,
  onKeyDown,
  inputClassName = BARCODE_WEDGE_INPUT_CLASS,
  shouldYieldFocus = shouldYieldBarcodeFocus,
  shouldMaintainFocus = shouldMaintainBarcodeWedgeCaptureFocus,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const refocusTimerRef = useRef<number | null>(null);

  const scheduleRefocus = () => {
    if (!shouldMaintainFocus()) return;
    if (refocusTimerRef.current != null) {
      window.clearTimeout(refocusTimerRef.current);
    }
    refocusTimerRef.current = window.setTimeout(() => {
      refocusTimerRef.current = null;
      tryFocusWedge(inputRef.current, active, shouldMaintainFocus, shouldYieldFocus);
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
      if (!active) return;
      if (shouldYieldFocus(document.activeElement, inputRef.current)) return;
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
      readOnly
      inputMode="none"
      enterKeyHint="done"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      aria-hidden
      tabIndex={-1}
      className={`${inputClassName} pointer-events-none fixed -left-[9999px] top-0 h-px w-px opacity-0`}
      onInput={(e) => {
        const el = e.currentTarget;
        onInput(el.value, () => {
          el.value = '';
        });
      }}
      onKeyDown={onKeyDown}
      onBlur={() => {
        if (active) scheduleRefocus();
      }}
    />
  );
}
