import { useCallback, useEffect, useRef } from 'react';

/** Idle flush for scanners that omit Enter/Tab suffix (common on USB 2D). */
export const BARCODE_WEDGE_IDLE_MS = 350;
/** Clear partial manual typing after this gap. */
export const BARCODE_WEDGE_BUFFER_CLEAR_MS = 500;
export const BARCODE_WEDGE_MIN_LENGTH = 3;
/** Delay before reclaiming wedge focus after blur (avoid fighting user field clicks). */
export const BARCODE_WEDGE_REFOCUS_MS = 400;

export const BARCODE_WEDGE_INPUT_CLASS = 'barcode-wedge-capture';
/** Visible barcode fields in merchant forms — wedge must never steal focus from these. */
export const BARCODE_FIELD_INPUT_CLASS = 'barcode-field-input';

const TERMINATOR_KEYS = new Set(['Enter', 'Tab']);

function isTerminatorKey(key: string): boolean {
  return TERMINATOR_KEYS.has(key);
}

function isEditableField(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  );
}

export function isBarcodeWedgeInput(el: Element | null): boolean {
  return el instanceof HTMLInputElement && el.classList.contains(BARCODE_WEDGE_INPUT_CLASS);
}

export function isBarcodeFieldInput(el: Element | null): boolean {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
  if (el.classList.contains(BARCODE_FIELD_INPUT_CLASS)) return true;
  return el.dataset.barcodeInput === '1';
}

/** Keep wedge focus from overriding product search and other visible POS inputs. */
export function shouldYieldBarcodeFocus(
  activeEl: Element | null,
  wedgeInput: HTMLInputElement | null
): boolean {
  if (!activeEl || activeEl === wedgeInput) return false;
  if (isBarcodeFieldInput(activeEl)) return true;
  if (!isEditableField(activeEl)) return false;
  return !isBarcodeWedgeInput(activeEl);
}

function shouldCaptureBarcodeWedgeKeyboard(activeEl: Element | null): boolean {
  return !shouldYieldBarcodeFocus(activeEl, null);
}

export type BarcodeWedgeOptions = {
  enabled: boolean;
  onScan: (code: string) => void;
  minLength?: number;
  /** When true, also listen on a hidden capture input (USB wedge when another field has focus). */
  useHiddenCapture?: boolean;
};

/**
 * Keyboard-wedge USB barcode scanner handler.
 * Accepts Enter/Tab terminators and idle auto-submit for long 2D payloads.
 */
export function useBarcodeWedge({
  enabled,
  onScan,
  minLength = BARCODE_WEDGE_MIN_LENGTH,
}: BarcodeWedgeOptions): {
  onCaptureInput: (text: string, clearInput?: () => void) => void;
  onCaptureKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
} {
  const bufferRef = useRef('');
  const idleTimerRef = useRef<number | null>(null);
  const clearTimerRef = useRef<number | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current != null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (clearTimerRef.current != null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
  }, []);

  const submit = useCallback(
    (raw: string) => {
      const code = raw.replace(/[\x00-\x1F\x7F]/g, '').trim();
      bufferRef.current = '';
      clearTimers();
      if (code.length >= minLength) {
        onScanRef.current(code);
      }
    },
    [clearTimers, minLength]
  );

  const appendChar = useCallback(
    (ch: string) => {
      bufferRef.current += ch;
      if (idleTimerRef.current != null) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        idleTimerRef.current = null;
        const pending = bufferRef.current;
        if (pending.length >= minLength) submit(pending);
        else bufferRef.current = '';
      }, BARCODE_WEDGE_IDLE_MS);

      if (clearTimerRef.current != null) window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = window.setTimeout(() => {
        bufferRef.current = '';
        clearTimerRef.current = null;
      }, BARCODE_WEDGE_BUFFER_CLEAR_MS);
    },
    [minLength, submit, clearTimers]
  );

  const onCaptureInput = useCallback(
    (text: string, clearInput?: () => void) => {
      if (!enabled || !text) return;
      const termIdx = text.search(/[\r\n\t]/);
      if (termIdx >= 0) {
        submit(text.slice(0, termIdx));
        clearInput?.();
        return;
      }
      bufferRef.current = text;
      if (idleTimerRef.current != null) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        idleTimerRef.current = null;
        submit(bufferRef.current);
        clearInput?.();
      }, BARCODE_WEDGE_IDLE_MS);
    },
    [enabled, submit]
  );

  const onCaptureKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!enabled) return;
      if (isTerminatorKey(e.key)) {
        e.preventDefault();
        submit(bufferRef.current || e.currentTarget.value);
        e.currentTarget.value = '';
      }
    },
    [enabled, submit]
  );

  useEffect(() => {
    if (!enabled) {
      bufferRef.current = '';
      clearTimers();
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement instanceof Element ? document.activeElement : null;
      const target = e.target instanceof Element ? e.target : null;

      // Hidden capture input handles its own key stream — never double-buffer.
      if (isBarcodeWedgeInput(target) || isBarcodeWedgeInput(active)) {
        return;
      }

      // User is typing in a visible field — let the browser deliver keystrokes normally.
      if (shouldYieldBarcodeFocus(active, null) || shouldYieldBarcodeFocus(target, null)) {
        return;
      }

      if (!shouldCaptureBarcodeWedgeKeyboard(active)) {
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (isTerminatorKey(e.key)) {
        const code = bufferRef.current.trim();
        bufferRef.current = '';
        clearTimers();
        if (code.length >= minLength) {
          e.preventDefault();
          onScanRef.current(code);
        }
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        bufferRef.current = bufferRef.current.slice(0, -1);
        return;
      }

      if (e.key.length === 1) {
        e.preventDefault();
        appendChar(e.key);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      bufferRef.current = '';
      clearTimers();
    };
  }, [enabled, minLength, appendChar, clearTimers]);

  return { onCaptureInput, onCaptureKeyDown };
}
