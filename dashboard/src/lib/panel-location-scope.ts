/** Fired when admin panel HQ ↔ branch scope changes (location switcher). */
export const PANEL_LOCATION_SCOPE_EVENT = 'manupos:panel-location-scope-changed';

export function notifyPanelLocationScopeChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PANEL_LOCATION_SCOPE_EVENT));
}
