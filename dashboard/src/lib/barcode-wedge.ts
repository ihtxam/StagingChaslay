import { useCallback, useEffect, useRef } from 'react';

/** Idle flush for scanners that omit Enter/Tab suffix (common on USB 2D). */
export const BARCODE_WEDGE_IDLE_MS = 350;
/** Clear partial manual typing after this gap. */
export const BARCODE_WEDGE_BUFFER_CLEAR_MS = 500;
export const BARCODE_WEDGE_MIN_LENGTH = 3;

const TERMINATOR_KEYS = new Set(['Enter', 'Tab']);

function isTerminatorKey(key: string): boolean {
  return TERMINATOR_KEYS.has(key);
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
  onCaptureInput: (text: string) => void;
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
      const code = raw.trim();
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
    (text: string) => {
      if (!enabled || !text) return;
      const termIdx = text.search(/[\r\n\t]/);
      if (termIdx >= 0) {
        submit(text.slice(0, termIdx));
        return;
      }
      bufferRef.current = text;
      if (idleTimerRef.current != null) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        idleTimerRef.current = null;
        submit(bufferRef.current);
      }, BARCODE_WEDGE_IDLE_MS);
    },
    [enabled, submit]
  );

  const onCaptureKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!enabled) return;
      if (isTerminatorKey(e.key)) {
        e.preventDefault();
        submit(bufferRef.current);
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
        bufferRef.current = bufferRef.current.slice(0, -1);
        return;
      }

      if (e.key.length === 1) {
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
