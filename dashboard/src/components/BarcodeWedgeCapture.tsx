import { useEffect, useRef } from 'react';
import {
  BARCODE_WEDGE_INPUT_CLASS,
  shouldYieldBarcodeFocus,
} from '@/lib/barcode-wedge';

type Props = {
  active: boolean;
  onInput: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

function tryFocusWedge(input: HTMLInputElement | null, active: boolean) {
  if (!active || !input) return;
  if (shouldYieldBarcodeFocus(document.activeElement, input)) return;
  input.focus();
}

/**
 * Hidden input that keeps USB HID barcode scanners working even when
 * another field briefly stole focus. Scanners type into the focused element.
 */
export default function BarcodeWedgeCapture({ active, onInput, onKeyDown }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!active) {
      inputRef.current?.blur();
      return;
    }
    const id = window.setTimeout(() => tryFocusWedge(inputRef.current, active), 150);
    return () => window.clearTimeout(id);
  }, [active]);

  if (!active) return null;

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="none"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      aria-hidden
      tabIndex={-1}
      className={`${BARCODE_WEDGE_INPUT_CLASS} pointer-events-none fixed -left-[9999px] top-0 h-px w-px opacity-0`}
      onChange={(e) => onInput(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => {
        window.setTimeout(() => tryFocusWedge(inputRef.current, active), 800);
      }}
    />
  );
}
