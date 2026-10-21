import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const REBORN_RESA_SESSION_AUTO_OPEN = 'reborn_resa_scroll_auto_open_done';
export const REBORN_RESA_SESSION_DISMISSED = 'reborn_resa_scroll_dismissed';

export const DEFAULT_RESERVATION_SCROLL_THRESHOLD_PX = 320;
export const DEFAULT_RESERVATION_AUTO_OPEN_DELAY_MS = 2200;

/** Homepage / CMS surfaces where a one-time gentle auto-open is appropriate. */
export function isReservationScrollAutoOpenSurface(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (/\/reservations$/.test(path)) return false;
  if (/\/(menu|checkout|order|account|register|forgot-password|catering|gift-cards|table)\b/.test(path)) {
    return false;
  }
  if (/\/shop\/[^/]+$/.test(path)) return true;
  if (/\/shop\/[^/]+\/l\/[^/]+$/.test(path)) return true;
  if (/\/pages\/[^/]+$/.test(path)) return true;
  return false;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function readSessionFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function markReservationScrollDismissed(): void {
  try {
    sessionStorage.setItem(REBORN_RESA_SESSION_DISMISSED, '1');
    sessionStorage.setItem(REBORN_RESA_SESSION_AUTO_OPEN, '1');
  } catch {
    /* ignore */
  }
}

export function markReservationScrollAutoOpenDone(): void {
  try {
    sessionStorage.setItem(REBORN_RESA_SESSION_AUTO_OPEN, '1');
  } catch {
    /* ignore */
  }
}

type ScrollRevealConfig = {
  enabled: boolean;
  scrollThresholdPx: number;
  autoOpenDelayMs: number;
  allowAutoOpen: boolean;
  onAutoOpen: () => void;
};

export function useReservationScrollReveal({
  enabled,
  scrollThresholdPx,
  autoOpenDelayMs,
  allowAutoOpen,
  onAutoOpen,
}: ScrollRevealConfig) {
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const [revealed, setRevealed] = useState(!enabled || reducedMotion);
  const [pulse, setPulse] = useState(false);
  const revealedRef = useRef(revealed);
  const autoOpenTimerRef = useRef<number | null>(null);

  const clearAutoOpenTimer = useCallback(() => {
    if (autoOpenTimerRef.current != null) {
      window.clearTimeout(autoOpenTimerRef.current);
      autoOpenTimerRef.current = null;
    }
  }, []);

  const scheduleAutoOpen = useCallback(() => {
    if (!allowAutoOpen || reducedMotion) return;
    if (readSessionFlag(REBORN_RESA_SESSION_AUTO_OPEN) || readSessionFlag(REBORN_RESA_SESSION_DISMISSED)) {
      return;
    }
    clearAutoOpenTimer();
    autoOpenTimerRef.current = window.setTimeout(() => {
      autoOpenTimerRef.current = null;
      if (readSessionFlag(REBORN_RESA_SESSION_AUTO_OPEN) || readSessionFlag(REBORN_RESA_SESSION_DISMISSED)) {
        return;
      }
      markReservationScrollAutoOpenDone();
      onAutoOpen();
    }, autoOpenDelayMs);
  }, [allowAutoOpen, autoOpenDelayMs, clearAutoOpenTimer, onAutoOpen, reducedMotion]);

  useEffect(() => {
    revealedRef.current = revealed;
  }, [revealed]);

  useEffect(() => {
    if (!enabled || reducedMotion) {
      setRevealed(true);
      return;
    }

    const onScroll = () => {
      if (revealedRef.current) return;
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      if (y < scrollThresholdPx) return;
      revealedRef.current = true;
      setRevealed(true);
      if (!reducedMotion) {
        setPulse(true);
        window.setTimeout(() => setPulse(false), 2400);
      }
      scheduleAutoOpen();
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearAutoOpenTimer();
    };
  }, [clearAutoOpenTimer, enabled, reducedMotion, scheduleAutoOpen, scrollThresholdPx]);

  const onUserOpened = useCallback(() => {
    markReservationScrollAutoOpenDone();
    clearAutoOpenTimer();
  }, [clearAutoOpenTimer]);

  const onUserClosed = useCallback(() => {
    markReservationScrollDismissed();
    clearAutoOpenTimer();
  }, [clearAutoOpenTimer]);

  return { revealed, pulse, reducedMotion, onUserOpened, onUserClosed };
}
