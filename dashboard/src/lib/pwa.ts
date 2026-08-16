/** True when the dashboard is running as an installed PWA (not a browser tab). */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone) return true;
  return ['fullscreen', 'standalone', 'minimal-ui'].some((mode) =>
    window.matchMedia(`(display-mode: ${mode})`).matches
  );
}
