import { useEffect } from 'react';
import { isPrintAgentAvailable, pairPrintAgentCloudRelay } from '@/lib/print-agent';
import { processPendingEscPosPrintJobs } from '@/lib/webpos-print-relay';

type Opts = {
  enabled: boolean;
  onRemoteKitchen?: () => void;
  onReservation?: () => void;
};

/**
 * Drain server print jobs on this PC (Print Agent) and keep the agent paired
 * so it can poll even if this tab is later minimized.
 */
export function useTillPrintHub({ enabled, onRemoteKitchen, onReservation }: Opts) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const pair = async () => {
      if (cancelled) return;
      if (await isPrintAgentAvailable()) {
        await pairPrintAgentCloudRelay();
      }
    };
    void pair();
    const id = window.setInterval(() => void pair(), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: number | null = null;
    const schedule = (ms: number) => {
      if (cancelled) return;
      timer = window.setTimeout(() => {
        void tick();
      }, ms);
    };
    const tick = async () => {
      if (cancelled) return;
      try {
        if (!(await isPrintAgentAvailable())) {
          schedule(8000);
          return;
        }
        const result = await processPendingEscPosPrintJobs();
        if (result.remoteKitchenDone > 0) onRemoteKitchen?.();
        if (result.reservationDone > 0) onReservation?.();
      } catch {
        /* best-effort */
      } finally {
        schedule(2500);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    void tick();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, onRemoteKitchen, onReservation]);
}
