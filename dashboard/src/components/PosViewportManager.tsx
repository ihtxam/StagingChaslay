import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const DEFAULT_VIEWPORT =
  'width=device-width, initial-scale=1.0, viewport-fit=cover';
const POS_VIEWPORT =
  'width=device-width, initial-scale=1.0, maximum-scale=1, user-scalable=no, viewport-fit=cover';

function isPosLikePath(pathname: string): boolean {
  return (
    /\/merchant\/(?:pos|waiter)(?:\/|$)/.test(pathname) ||
    /^\/kds(?:\/|$)/.test(pathname) ||
    /^\/tv(?:\/|$)/.test(pathname)
  );
}

function applyPosViewport(lock: boolean) {
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta) meta.setAttribute('content', lock ? POS_VIEWPORT : DEFAULT_VIEWPORT);
  document.documentElement.classList.toggle('webpos-lock', lock);
}

/** Fit POS / waiter / KDS to the phone screen — no pinch-zoom required. */
export default function PosViewportManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const lock = isPosLikePath(pathname);
    applyPosViewport(lock);
    return () => applyPosViewport(false);
  }, [pathname]);

  return null;
}
