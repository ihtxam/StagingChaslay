import { useCallback, useEffect, useRef } from 'react';
import { roundWeightKg } from '@/lib/money';
import { stripScannerControlChars, looksLikeRetailBarcodeInput } from '@/lib/product-scan-codes';
import {
  BARCODE_WEDGE_BUFFER_CLEAR_MS,
  BARCODE_WEDGE_IDLE_MS,
  BARCODE_WEDGE_REFOCUS_MS,
  isCoarsePointerDevice,
  shouldYieldBarcodeFocus,
} from '@/lib/barcode-wedge';

export {
  BARCODE_WEDGE_IDLE_MS as SCALE_WEDGE_IDLE_MS,
  BARCODE_WEDGE_REFOCUS_MS as SCALE_WEDGE_REFOCUS_MS,
};

export const SCALE_WEDGE_INPUT_CLASS = 'scale-wedge-capture';
export const SCALE_WEDGE_MIN_LENGTH = 1;

export type ScaleWedgeParseResult = {
  weightKg: number;
  /** Suggested display unit for the weight modal buffer. */
  displayUnit: 'kg' | 'g';
};

function normalizeUnitsToken(raw: string): 'kg' | 'g' | 'lb' | 'oz' | null {
  const u = raw.toLowerCase();
  if (u === 'kg' || u === 'k') return 'kg';
  if (u === 'g' || u.startsWith('gr')) return 'g';
  if (u.startsWith('lb')) return 'lb';
  if (u.startsWith('oz')) return 'oz';
  return null;
}

function toKg(value: number, unit: 'kg' | 'g' | 'lb' | 'oz'): number {
  switch (unit) {
    case 'g':
      return roundWeightKg(value / 1000);
    case 'lb':
      return roundWeightKg(value * 0.45359237);
    case 'oz':
      return roundWeightKg(value * 0.0283495231);
    default:
      return roundWeightKg(value);
  }
}

/**
 * Parse HID keyboard-wedge scale payloads (digits + Enter, optional prefix/suffix/unit).
 * Returns null when the string looks like a barcode or is not a plausible weight.
 */
export function parseScaleWedgePayload(
  raw: string,
  opts?: { preferredDisplayUnit?: 'kg' | 'g' }
): ScaleWedgeParseResult | null {
  let s = stripScannerControlChars(raw).trim();
  if (!s) return null;
  if (looksLikeRetailBarcodeInput(s)) return null;

  s = s.replace(/^[\s*#=+]+/, '');
  s = s.replace(/^(ST|GS|WT|W|S)[\s,:;-]*/i, '');

  let explicitUnit: 'kg' | 'g' | 'lb' | 'oz' | null = null;
  const unitMatch = s.match(/\s*(kg|g|gr|gram|grams|lb|lbs|oz)\s*$/i);
  if (unitMatch) {
    explicitUnit = normalizeUnitsToken(unitMatch[1]);
    s = s.slice(0, unitMatch.index).trim();
  }

  if (s.includes(',') && !/^\d+[.,]\d+$/.test(s)) {
    const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
    const lastNumeric = [...parts]
      .reverse()
      .find((p) => /^-?\d+[.,]?\d*$/.test(p.replace(/,/g, '.')));
    if (lastNumeric) s = lastNumeric;
  }

  s = s.replace(/,/g, '.').replace(/\s+/g, '');
  if (!/^-?\d+\.?\d*$/.test(s)) return null;

  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;

  if (explicitUnit) {
    return {
      weightKg: toKg(n, explicitUnit),
      displayUnit: explicitUnit === 'g' ? 'g' : 'kg',
    };
  }

  if (s.includes('.')) {
    return { weightKg: roundWeightKg(n), displayUnit: 'kg' };
  }

  const preferred = opts?.preferredDisplayUnit ?? 'kg';

  if (n >= 100 && n <= 99999) {
    const asKgFromGrams = roundWeightKg(n / 1000);
    if (asKgFromGrams > 0 && asKgFromGrams <= 50) {
      return { weightKg: asKgFromGrams, displayUnit: 'g' };
    }
  }

  if (n <= 99) {
    return {
      weightKg: roundWeightKg(n),
      displayUnit: preferred === 'g' ? 'g' : 'kg',
    };
  }

  return { weightKg: roundWeightKg(n / 1000), displayUnit: 'g' };
}

export function looksLikeScaleWedgePayload(raw: string): boolean {
  return parseScaleWedgePayload(raw) != null;
}

export function isScaleWedgeInput(el: Element | null): boolean {
  return el instanceof HTMLInputElement && el.classList.contains(SCALE_WEDGE_INPUT_CLASS);
}

export function shouldYieldScaleFocus(
  activeEl: Element | null,
  wedgeInput: HTMLInputElement | null
): boolean {
  if (!activeEl || activeEl === wedgeInput) return false;
  if (isScaleWedgeInput(activeEl)) return false;
  return shouldYieldBarcodeFocus(activeEl, wedgeInput);
}

export function shouldMaintainScaleWedgeCaptureFocus(): boolean {
  return true;
}

const TERMINATOR_KEYS = new Set(['Enter', 'Tab']);

function isTerminatorKey(key: string): boolean {
  return TERMINATOR_KEYS.has(key);
}

export type ScaleWedgeOptions = {
  enabled: boolean;
  preferredDisplayUnit?: 'kg' | 'g';
  /** Called when a complete wedge string parses to a weight. */
  onWeight: (reading: ScaleWedgeParseResult) => void;
  /** When set, Enter-terminated reads also invoke this (e.g. confirm weighed line). */
  onConfirmWeight?: (reading: ScaleWedgeParseResult) => void;
  minLength?: number;
};

/**
 * Keyboard-wedge HID scale handler (USB/BT scales in "keyboard" mode).
 * Mirrors barcode wedge idle + hidden-input patterns for Android Chrome PWA.
 */
export function useScaleWedge({
  enabled,
  preferredDisplayUnit = 'kg',
  onWeight,
  onConfirmWeight,
  minLength = SCALE_WEDGE_MIN_LENGTH,
}: ScaleWedgeOptions): {
  onCaptureInput: (text: string, clearInput?: () => void) => void;
  onCaptureKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
} {
  const bufferRef = useRef('');
  const idleTimerRef = useRef<number | null>(null);
  const clearTimerRef = useRef<number | null>(null);
  const onWeightRef = useRef(onWeight);
  const onConfirmRef = useRef(onConfirmWeight);
  const unitRef = useRef(preferredDisplayUnit);
  onWeightRef.current = onWeight;
  onConfirmRef.current = onConfirmWeight;
  unitRef.current = preferredDisplayUnit;

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

  const deliver = useCallback(
    (raw: string, fromTerminator: boolean) => {
      const parsed = parseScaleWedgePayload(raw, {
        preferredDisplayUnit: unitRef.current,
      });
      bufferRef.current = '';
      clearTimers();
      if (!parsed) return;
      onWeightRef.current(parsed);
      if (fromTerminator) onConfirmRef.current?.(parsed);
    },
    [clearTimers]
  );

  const submit = useCallback(
    (raw: string, fromTerminator: boolean) => {
      const cleaned = raw.replace(/[\x00-\x1F\x7F]/g, '').trim();
      if (cleaned.length < minLength) {
        bufferRef.current = '';
        clearTimers();
        return;
      }
      deliver(cleaned, fromTerminator);
    },
    [clearTimers, deliver, minLength]
  );

  const appendChar = useCallback(
    (ch: string) => {
      bufferRef.current += ch;
      if (idleTimerRef.current != null) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        idleTimerRef.current = null;
        submit(bufferRef.current, false);
      }, BARCODE_WEDGE_IDLE_MS);

      if (clearTimerRef.current != null) window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = window.setTimeout(() => {
        bufferRef.current = '';
        clearTimerRef.current = null;
      }, BARCODE_WEDGE_BUFFER_CLEAR_MS);
    },
    [submit]
  );

  const onCaptureInput = useCallback(
    (text: string, clearInput?: () => void) => {
      if (!enabled || !text) return;
      const termIdx = text.search(/[\r\n\t]/);
      if (termIdx >= 0) {
        submit(text.slice(0, termIdx), true);
        clearInput?.();
        return;
      }
      bufferRef.current = text;
      if (idleTimerRef.current != null) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        idleTimerRef.current = null;
        submit(bufferRef.current, false);
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
        submit(bufferRef.current || e.currentTarget.value, true);
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

      if (isScaleWedgeInput(target) || isScaleWedgeInput(active)) return;
      if (shouldYieldScaleFocus(active, null) || shouldYieldScaleFocus(target, null)) return;

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (isTerminatorKey(e.key)) {
        const pending = bufferRef.current.trim();
        bufferRef.current = '';
        clearTimers();
        if (pending.length >= minLength) {
          e.preventDefault();
          e.stopPropagation();
          submit(pending, true);
        }
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        bufferRef.current = bufferRef.current.slice(0, -1);
        return;
      }

      if (e.key.length === 1) {
        e.preventDefault();
        e.stopPropagation();
        appendChar(e.key);
      }
    };

    const useCapture = isCoarsePointerDevice();
    window.addEventListener('keydown', onKeyDown, useCapture);
    return () => {
      window.removeEventListener('keydown', onKeyDown, useCapture);
      bufferRef.current = '';
      clearTimers();
    };
  }, [enabled, minLength, appendChar, clearTimers, submit]);

  return { onCaptureInput, onCaptureKeyDown };
}
