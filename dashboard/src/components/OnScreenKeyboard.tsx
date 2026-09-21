import { Delete, Keyboard, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useI18n } from '@/lib/i18n';

type TextTarget = HTMLInputElement | HTMLTextAreaElement;

function isTextTarget(el: Element | null): el is TextTarget {
  if (!el) return false;
  if (el instanceof HTMLInputElement && el.classList.contains('barcode-wedge-capture')) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase();
    return !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'submit', 'reset'].includes(type);
  }
  return false;
}

function setNativeValue(el: TextTarget, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

function insertText(el: TextTarget, text: string) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const next = el.value.slice(0, start) + text + el.value.slice(end);
  setNativeValue(el, next);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  const caret = start + text.length;
  try {
    el.setSelectionRange(caret, caret);
  } catch {
    /* some input types disallow selection */
  }
}

function deleteBackward(el: TextTarget) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  if (start !== end) {
    const next = el.value.slice(0, start) + el.value.slice(end);
    setNativeValue(el, next);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    try {
      el.setSelectionRange(start, start);
    } catch {
      /* ignore */
    }
    return;
  }
  if (start <= 0) return;
  const next = el.value.slice(0, start - 1) + el.value.slice(start);
  setNativeValue(el, next);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  const caret = start - 1;
  try {
    el.setSelectionRange(caret, caret);
  } catch {
    /* ignore */
  }
}

type OnScreenKeyboardContextValue = {
  open: boolean;
  toggle: () => void;
  close: () => void;
};

const OnScreenKeyboardContext = createContext<OnScreenKeyboardContextValue | null>(null);

export function useOnScreenKeyboard(): OnScreenKeyboardContextValue {
  const ctx = useContext(OnScreenKeyboardContext);
  if (!ctx) {
    return {
      open: false,
      toggle: () => {},
      close: () => {},
    };
  }
  return ctx;
}

const ROWS: string[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

const EXTRA_KEYS = ['@', '.', '-', '_'];

function OnScreenKeyboardOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [shift, setShift] = useState(false);
  const targetRef = useRef<TextTarget | null>(null);

  useEffect(() => {
    if (!open) return;
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (isTextTarget(el)) targetRef.current = el;
    };
    document.addEventListener('focusin', onFocusIn, true);
    const active = document.activeElement;
    if (isTextTarget(active)) targetRef.current = active;
    return () => document.removeEventListener('focusin', onFocusIn, true);
  }, [open]);

  const focusTarget = useCallback(() => {
    const el = targetRef.current;
    if (el && document.contains(el)) {
      el.focus({ preventScroll: true });
      return el;
    }
    return null;
  }, []);

  const typeChar = useCallback(
    (ch: string) => {
      const el = focusTarget();
      if (!el) return;
      insertText(el, shift ? ch.toUpperCase() : ch);
      if (shift) setShift(false);
    },
    [focusTarget, shift]
  );

  const onBackspace = useCallback(() => {
    const el = focusTarget();
    if (!el) return;
    deleteBackward(el);
  }, [focusTarget]);

  const onSpace = useCallback(() => {
    const el = focusTarget();
    if (!el) return;
    insertText(el, ' ');
  }, [focusTarget]);

  const onEnter = useCallback(() => {
    const el = focusTarget();
    if (!el) return;
    if (el instanceof HTMLTextAreaElement) {
      insertText(el, '\n');
      return;
    }
    el.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true })
    );
    el.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true })
    );
  }, [focusTarget]);

  const preventBlur = (e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault();
  };

  if (!open) return null;

  return (
    <div
      className="onscreen-keyboard fixed inset-x-0 bottom-0 z-[200] border-t border-stone-300 bg-stone-100 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] dark:border-stone-600 dark:bg-stone-900"
      role="dialog"
      aria-label={t('webPosOnScreenKeyboard')}
    >
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-2 py-1 dark:border-stone-700">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
          {t('webPosOnScreenKeyboard')}
        </span>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-stone-200 dark:hover:bg-stone-800"
          onMouseDown={preventBlur}
          onClick={onClose}
          aria-label={t('webPosOnScreenKeyboardHide')}
          title={t('webPosOnScreenKeyboardHide')}
        >
          <X size={16} />
        </button>
      </div>
      <div className="max-h-[40dvh] overflow-y-auto p-1.5 sm:p-2">
        {ROWS.map((row, rowIdx) => (
          <div key={rowIdx} className="mb-1 flex justify-center gap-1">
            {row.map((key) => (
              <button
                key={key}
                type="button"
                className="onscreen-keyboard__key min-h-[2.75rem] min-w-[2rem] flex-1 max-w-[2.75rem] rounded-md border border-stone-300 bg-white text-base font-semibold text-stone-800 shadow-sm active:bg-stone-200 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:active:bg-stone-700"
                onMouseDown={preventBlur}
                onClick={() => typeChar(key)}
              >
                {shift ? key.toUpperCase() : key}
              </button>
            ))}
          </div>
        ))}
        <div className="mb-1 flex justify-center gap-1">
          {EXTRA_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className="onscreen-keyboard__key min-h-[2.75rem] min-w-[2.25rem] flex-1 max-w-[3rem] rounded-md border border-stone-300 bg-white text-sm font-semibold text-stone-800 shadow-sm active:bg-stone-200 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
              onMouseDown={preventBlur}
              onClick={() => typeChar(key)}
            >
              {key}
            </button>
          ))}
        </div>
        <div className="flex justify-center gap-1">
          <button
            type="button"
            className={`onscreen-keyboard__key min-h-[2.75rem] w-14 rounded-md border text-xs font-bold uppercase ${
              shift
                ? 'border-teal-600 bg-teal-600 text-white'
                : 'border-stone-300 bg-white text-stone-700 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100'
            }`}
            onMouseDown={preventBlur}
            onClick={() => setShift((s) => !s)}
            aria-pressed={shift}
          >
            {t('webPosOnScreenKeyboardShift')}
          </button>
          <button
            type="button"
            className="onscreen-keyboard__key min-h-[2.75rem] flex-[3] max-w-[14rem] rounded-md border border-stone-300 bg-white text-sm font-semibold text-stone-700 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
            onMouseDown={preventBlur}
            onClick={onSpace}
          >
            {t('webPosOnScreenKeyboardSpace')}
          </button>
          <button
            type="button"
            className="onscreen-keyboard__key min-h-[2.75rem] w-14 rounded-md border border-stone-300 bg-white text-stone-700 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
            onMouseDown={preventBlur}
            onClick={onBackspace}
            aria-label={t('webPosOnScreenKeyboardBackspace')}
            title={t('webPosOnScreenKeyboardBackspace')}
          >
            <Delete size={18} className="mx-auto" />
          </button>
          <button
            type="button"
            className="onscreen-keyboard__key min-h-[2.75rem] w-14 rounded-md border border-stone-300 bg-white text-xs font-bold text-stone-700 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
            onMouseDown={preventBlur}
            onClick={onEnter}
          >
            ↵
          </button>
        </div>
      </div>
    </div>
  );
}

export function OnScreenKeyboardProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(
    () => ({ open, toggle, close }),
    [open, toggle, close]
  );

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.paddingBottom;
    document.body.style.paddingBottom = 'min(40dvh, 280px)';
    return () => {
      document.body.style.paddingBottom = prev;
    };
  }, [open]);

  return (
    <OnScreenKeyboardContext.Provider value={value}>
      {children}
      <OnScreenKeyboardOverlay open={open} onClose={close} />
    </OnScreenKeyboardContext.Provider>
  );
}

type ToggleProps = {
  className?: string;
  iconSize?: number;
};

/** Top-bar icon button — only render when fullscreen is active (caller checks). */
export function OnScreenKeyboardToggle({ className, iconSize = 17 }: ToggleProps) {
  const { t } = useI18n();
  const { open, toggle } = useOnScreenKeyboard();

  return (
    <button
      type="button"
      className={
        className ||
        'inline-flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 hover:bg-stone-50 lg:h-9 lg:w-9'
      }
      onClick={toggle}
      aria-pressed={open}
      aria-label={open ? t('webPosOnScreenKeyboardHide') : t('webPosOnScreenKeyboard')}
      title={open ? t('webPosOnScreenKeyboardHide') : t('webPosOnScreenKeyboard')}
    >
      <Keyboard size={iconSize} className={open ? 'text-teal-700' : undefined} />
    </button>
  );
}
