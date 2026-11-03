export type TextTarget = HTMLInputElement | HTMLTextAreaElement;

export function isTextTarget(el: Element | null): el is TextTarget {
  if (!el) return false;
  if (el instanceof HTMLInputElement && el.classList.contains('barcode-wedge-capture')) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase();
    return ![
      'button',
      'checkbox',
      'color',
      'file',
      'hidden',
      'image',
      'radio',
      'range',
      'submit',
      'reset',
    ].includes(type);
  }
  return false;
}

export function setNativeValue(el: TextTarget, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

export function insertText(el: TextTarget, text: string) {
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

export function deleteBackward(el: TextTarget) {
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
