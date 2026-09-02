import { useEffect } from 'react';
import { isPrintAgentAvailable, pairPrintAgentCloudRelay } from '@/lib/print-agent';
import { processPendingEscPosPrintJobs } from '@/lib/webpos-print-relay';

type Opts = {
  enabled: boolean;
  onRemoteKitchen?: () => void;
  onReservation?: () => void;
};

const POLL_MS_AGENT_OK = 2500;
const POLL_MS_AGENT_OFFLINE = 8000;
const CLOUD_RELAY_PAIR_INTERVAL_MS = 30_000;

function hasMerchantAuthToken(): boolean {
  try {
    return !!String(localStorage.getItem('token') || '').trim();
  } catch {
    return false;
  }
}

/**
 * Drain server print jobs on this PC (Print Agent) and keep the agent paired
 * so it can poll even if this tab is later minimized.
 */
export function useTillPrintHub({ enabled, onRemoteKitchen, onReservation }: Opts) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const pair = async () => {
      if (cancelled || !hasMerchantAuthToken()) return;
      if (await isPrintAgentAvailable()) {
        await pairPrintAgentCloudRelay();
      }
    };
    void pair();
    const id = window.setInterval(() => void pair(), CLOUD_RELAY_PAIR_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: number | null = null;
    let inFlight = false;

    const clearTimer = () => {
      if (timer != null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const schedule = (ms: number) => {
      if (cancelled) return;
      clearTimer();
      timer = window.setTimeout(() => {
        void tick();
      }, ms);
    };

    const tick = async () => {
      if (cancelled || inFlight) return;
      clearTimer();
      inFlight = true;
      let nextMs = POLL_MS_AGENT_OFFLINE;
      try {
        if (!hasMerchantAuthToken() || !(await isPrintAgentAvailable())) {
          return;
        }
        const result = await processPendingEscPosPrintJobs();
        if (result.remoteKitchenDone > 0) onRemoteKitchen?.();
        if (result.reservationDone > 0) onReservation?.();
        nextMs = POLL_MS_AGENT_OK;
      } catch {
        /* best-effort */
      } finally {
        inFlight = false;
        schedule(nextMs);
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    void tick();
    return () => {
      cancelled = true;
      inFlight = false;
      clearTimer();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, onRemoteKitchen, onReservation]);
}
