import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const REBORN_RESA_SESSION_AUTO_OPEN = 'reborn_resa_scroll_auto_open_done';
export const REBORN_RESA_SESSION_DISMISSED = 'reborn_resa_scroll_dismissed';

export const DEFAULT_RESERVATION_SCROLL_THRESHOLD_PX = 320;
/** Reveal peek/FAB after ~20% of scrollable page (Zhen Chef–style). */
export const DEFAULT_RESERVATION_SCROLL_RATIO = 0.2;
/** @deprecated Full-modal auto-open replaced by half-peek bar; kept for embed opt-in. */
export const DEFAULT_RESERVATION_AUTO_OPEN_DELAY_MS = 2200;

export function resolveReservationScrollThresholdPx(
  scrollThresholdPx: number,
  scrollRatio: number,
  viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0,
  scrollHeight = typeof document !== 'undefined' ? document.documentElement.scrollHeight : 0,
): number {
  const maxScroll = Math.max(0, scrollHeight - viewportHeight);
  const ratioPx = Math.floor(maxScroll * scrollRatio);
  return Math.max(scrollThresholdPx, ratioPx);
}

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
  scrollRatio?: number;
  /** When true, scroll reveal also triggers `onPeekReveal` (half booking bar). */
  allowAutoPeek?: boolean;
  onPeekReveal?: () => void;
  /** Legacy: auto-open full modal after delay (embed script only; off in shop FAB). */
  autoOpenDelayMs?: number;
  allowAutoOpen?: boolean;
  onAutoOpen?: () => void;
};

export function useReservationScrollReveal({
  enabled,
  scrollThresholdPx,
  scrollRatio = DEFAULT_RESERVATION_SCROLL_RATIO,
  allowAutoPeek = true,
  onPeekReveal,
  autoOpenDelayMs = DEFAULT_RESERVATION_AUTO_OPEN_DELAY_MS,
  allowAutoOpen = false,
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
    if (!allowAutoOpen || !onAutoOpen || reducedMotion) return;
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
      const threshold = resolveReservationScrollThresholdPx(
        scrollThresholdPx,
        scrollRatio,
        window.innerHeight,
        document.documentElement.scrollHeight,
      );
      if (y < threshold) return;
      revealedRef.current = true;
      setRevealed(true);
      if (!reducedMotion) {
        setPulse(true);
        window.setTimeout(() => setPulse(false), 2400);
      }
      if (allowAutoPeek && onPeekReveal) {
        if (!readSessionFlag(REBORN_RESA_SESSION_DISMISSED)) {
          onPeekReveal();
        }
      }
      scheduleAutoOpen();
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearAutoOpenTimer();
    };
  }, [
    allowAutoPeek,
    clearAutoOpenTimer,
    enabled,
    onPeekReveal,
    reducedMotion,
    scheduleAutoOpen,
    scrollRatio,
    scrollThresholdPx,
  ]);

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
