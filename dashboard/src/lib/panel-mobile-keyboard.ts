/** iOS Safari: soft keyboard + fixed 100dvh panel shell leaves a gray gap after blur. */

const KEYBOARD_INSET_THRESHOLD_PX = 72;

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
    root.style.removeProperty('--panel-vvh');
    return;
  }
  const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  if (inset >= KEYBOARD_INSET_THRESHOLD_PX) {
    root.style.setProperty('--panel-vvh', `${Math.round(vv.height)}px`);
    return;
  }
  root.style.removeProperty('--panel-vvh');
  window.scrollTo(0, 0);
  root.scrollTop = 0;
  document.body.scrollTop = 0;
  const shell = document.querySelector('.panel-shell');
  if (shell instanceof HTMLElement && shell.scrollTop) shell.scrollTop = 0;
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
    root.style.removeProperty('--panel-vvh');
    window.visualViewport?.removeEventListener('resize', onChange);
    window.visualViewport?.removeEventListener('scroll', onChange);
    window.removeEventListener('resize', onChange);
    document.removeEventListener('focusout', onFocusOut, true);
  };
}
