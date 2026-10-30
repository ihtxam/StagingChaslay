/** iOS Safari: soft keyboard + fixed 100dvh panel shell leaves a gray gap after blur. */

const KEYBOARD_INSET_THRESHOLD_PX = 72;

/**
 * Android Chrome/WebView already moves fixed elements with the visual viewport.
 * Pinning `top`/`left` there leaves a gap on the left and top that survives
 * navigation from Settings into POS. Only iOS needs the pin.
 */
export function isIosVisualViewportPin(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

export function isTextEntryElement(el: EventTarget | null): boolean {
  if (!el || typeof el !== 'object') return false;
  const node = el as { tagName?: string; isContentEditable?: boolean };
  const tag = String(node.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return node.isContentEditable === true;
}

export function shouldPinPanelToVisualViewport(opts: {
  ios: boolean;
  focusedTextEntry: boolean;
  insetPx: number;
}): boolean {
  return opts.ios && opts.focusedTextEntry && opts.insetPx >= KEYBOARD_INSET_THRESHOLD_PX;
}

export function resetPanelViewportScroll(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  window.scrollTo(0, 0);
  const root = document.documentElement;
  root.scrollTop = 0;
  root.scrollLeft = 0;
  document.body.scrollTop = 0;
  document.body.scrollLeft = 0;
  const shell = document.querySelector('.panel-shell');
  if (shell instanceof HTMLElement) {
    shell.scrollTop = 0;
    shell.scrollLeft = 0;
  }
}

function clearKeyboardPin(root: HTMLElement): void {
  root.classList.remove('panel-kb-open');
  root.style.removeProperty('--panel-vvh');
  root.style.removeProperty('--panel-vv-top');
  root.style.removeProperty('--panel-vv-left');
  root.style.removeProperty('--panel-vvw');
  document.body.style.removeProperty('overflow');
}

export function isPanelMobileViewportPath(pathname: string): boolean {
  const p = pathname || '';
  if (!/^\/(merchant|reseller|superadmin)(\/|$)/.test(p)) return false;
  if (/\/merchant\/(?:pos|waiter)(?:\/|$)/.test(p)) return false;
  return true;
}

export function syncPanelVisualViewportHeight(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const root = document.documentElement;
  const vv = window.visualViewport;
  if (!vv) {
    clearKeyboardPin(root);
    return;
  }
  const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  const pin = shouldPinPanelToVisualViewport({
    ios: isIosVisualViewportPin(),
    focusedTextEntry: isTextEntryElement(document.activeElement),
    insetPx: inset,
  });
  if (pin) {
    root.classList.add('panel-kb-open');
    root.style.setProperty('--panel-vvh', `${Math.round(vv.height)}px`);
    root.style.setProperty('--panel-vv-top', `${Math.round(vv.offsetTop)}px`);
    root.style.setProperty('--panel-vv-left', `${Math.round(vv.offsetLeft)}px`);
    root.style.setProperty('--panel-vvw', `${Math.round(vv.width)}px`);
    document.body.style.overflow = 'hidden';
    return;
  }
  const wasPinned = root.classList.contains('panel-kb-open');
  clearKeyboardPin(root);
  // A focused field on Settings can scroll the layout viewport. That offset
  // stays after opening POS and looks like padding on the left and top.
  if (wasPinned || window.scrollX > 1 || window.scrollY > 1) {
    resetPanelViewportScroll();
  }
}

export function bindPanelMobileViewport(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  const root = document.documentElement;
  root.classList.add('panel-vv-sync');

  const onChange = () => syncPanelVisualViewportHeight();
  onChange();

  window.visualViewport?.addEventListener('resize', onChange);
  window.visualViewport?.addEventListener('scroll', onChange);
  window.addEventListener('resize', onChange);

  const onFocusOut = () => {
    requestAnimationFrame(onChange);
    window.setTimeout(onChange, 120);
    window.setTimeout(onChange, 400);
  };
  document.addEventListener('focusout', onFocusOut, true);

  return () => {
    root.classList.remove('panel-vv-sync');
    clearKeyboardPin(root);
    resetPanelViewportScroll();
    window.visualViewport?.removeEventListener('resize', onChange);
    window.visualViewport?.removeEventListener('scroll', onChange);
    window.removeEventListener('resize', onChange);
    document.removeEventListener('focusout', onFocusOut, true);
  };
}
