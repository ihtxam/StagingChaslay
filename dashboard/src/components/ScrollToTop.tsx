import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { scrollToAnchorWhenReady } from '@/chaslay-pagebuilder/utils/anchor-scroll';
import {
  capturePageScroll,
  isFullscreenAppRoute,
  locationKey,
  resolveScrollNavAction,
  restorePageScroll,
  scrollNewPageToTop,
  type SavedPageScroll,
} from '@/lib/scroll-to-top';

const savedPositions = new Map<string, SavedPageScroll>();

function applyScrollAction(action: ReturnType<typeof resolveScrollNavAction>, key: string, hash: string) {
  if (action === 'skip') return;
  if (action === 'hash') {
    if (document.documentElement.classList.contains('shop-shell')) {
      scrollToAnchorWhenReady(hash);
    }
    return;
  }
  if (action === 'restore') {
    const saved = savedPositions.get(key);
    if (saved) restorePageScroll(saved);
    return;
  }
  scrollNewPageToTop();
}

/** Reset (or restore) page scroll when React Router changes the location. */
export default function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const prev = useRef(location);

  useEffect(() => {
    const prevLoc = prev.current;
    const prevKey = locationKey(prevLoc.pathname, prevLoc.search);
    const nextKey = locationKey(location.pathname, location.search);

    if (!isFullscreenAppRoute(prevLoc.pathname) && prevKey !== nextKey) {
      savedPositions.set(prevKey, capturePageScroll());
    }

    const action = resolveScrollNavAction({
      pathname: location.pathname,
      prevPathname: prevLoc.pathname,
      hash: location.hash,
      navigationType,
    });

    prev.current = location;

    applyScrollAction(action, nextKey, location.hash);

    if (action !== 'top' && action !== 'restore') return;
    const frame = window.requestAnimationFrame(() => {
      applyScrollAction(action, nextKey, location.hash);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location, navigationType]);

  return null;
}
