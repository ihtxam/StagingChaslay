import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const DEFAULT_VIEWPORT =
  'width=device-width, initial-scale=1.0, viewport-fit=cover';
const POS_VIEWPORT =
  'width=device-width, initial-scale=1.0, maximum-scale=1, user-scalable=no, viewport-fit=cover';

function isPosLikePath(pathname: string): boolean {
  return (
    /\/merchant\/(?:pos|waiter)(?:\/|$)/.test(pathname) ||
    /^\/kds(?:\/|$)/.test(pathname)
  );
}

/** Lock zoom on POS / waiter / KDS routes to prevent iOS input auto-zoom. */
export default function PosViewportManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    meta.setAttribute('content', isPosLikePath(pathname) ? POS_VIEWPORT : DEFAULT_VIEWPORT);
    return () => meta.setAttribute('content', DEFAULT_VIEWPORT);
  }, [pathname]);

  return null;
}
