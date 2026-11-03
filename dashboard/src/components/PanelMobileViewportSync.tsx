import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  bindPanelMobileViewport,
  isPanelMobileViewportPath,
  releasePanelViewportOffset,
} from '@/lib/panel-mobile-keyboard';

/** Keep merchant / reseller / superadmin panel height aligned with iOS visual viewport. */
export default function PanelMobileViewportSync() {
  const { pathname } = useLocation();
  const active = isPanelMobileViewportPath(pathname);

  useEffect(() => {
    if (!active) {
      releasePanelViewportOffset();
      return;
    }
    return bindPanelMobileViewport();
  }, [active]);

  return null;
}
