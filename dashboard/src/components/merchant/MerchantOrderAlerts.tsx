import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { playOrderAlertOnce, startOrderAlertLoop, stopOrderAlertLoop } from '@/lib/order-alert';
import {
  extractZipFromAddress,
  onlineShopOrderSpeechLine,
  speakDeliveryAlert,
} from '@/lib/delivery-hub-alerts';
import WebPosNewOrderAlertModal from '@/components/webpos/WebPosNewOrderAlertModal';
import type { OnlineOrder } from '@/components/WebPosOnlineOrdersPanel';
import { formatOrderNumberDisplay } from '@/lib/order-number';
import { isAwaitingApproval, isOnlineShopOrder } from '@/lib/order-management';
import { readDeliveryAutoAccept, onlineOrderAlertStatuses } from '@/lib/delivery-auto-accept';

type Props = {
  enabled: boolean;
};

function speechLocale(locale: string): string {
  if (locale === 'fr') return 'fr-FR';
  if (locale === 'de') return 'de-DE';
  return 'en-US';
}

function showBrowserNotification(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, tag: 'chaslay-new-order' });
  } catch {
    /* ignore */
  }
}

export default function MerchantOrderAlerts({ enabled }: Props) {
  const { t, locale } = useI18n();
  const [queue, setQueue] = useState<OnlineOrder[]>([]);
  const [busy, setBusy] = useState(false);
  const [autoAccept, setAutoAccept] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const knownIdsRef = useRef<Set<string> | null>(null);
  const unactionedRef = useRef<Set<string>>(new Set());
  const audioUnlockedRef = useRef(false);
  const autoAcceptRef = useRef(autoAccept);

  useEffect(() => {
    document.documentElement.lang = speechLocale(locale);
  }, [locale]);

  useEffect(() => {
    if (!enabled) return;
    const unlock = () => {
      audioUnlockedRef.current = true;
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setSettingsReady(false);
      return;
    }
    setSettingsReady(false);
    void api
      .get('/merchant/settings')
      .then((res) => {
        const s = res.data?.settings || res.data || {};
        setAutoAccept(readDeliveryAutoAccept(s));
      })
      .catch(() => {})
      .finally(() => setSettingsReady(true));
  }, [enabled]);

  /** Re-seed known IDs when auto-accept loads/changes — avoids false beeps for existing preparing orders. */
  useEffect(() => {
    if (!settingsReady) return;
    if (autoAcceptRef.current !== autoAccept) {
      autoAcceptRef.current = autoAccept;
      knownIdsRef.current = null;
    }
  }, [autoAccept, settingsReady]);

  const markActioned = useCallback((orderId: string) => {
    unactionedRef.current.delete(orderId);
    setQueue((prev) => prev.filter((o) => o.id !== orderId));
    if (unactionedRef.current.size === 0) stopOrderAlertLoop();
  }, []);

  const poll = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await api.get('/merchant/orders', { params: { limit: 80 } });
      const online = ((res.data.orders || []) as OnlineOrder[]).filter((o) =>
        isOnlineShopOrder(o)
      );
      const alertStatuses = onlineOrderAlertStatuses(autoAccept);
      const pending = online.filter((o) => alertStatuses.has(String(o.status || '').toLowerCase()));
      const pendingIds = pending.map((o) => o.id);

      if (knownIdsRef.current == null) {
        knownIdsRef.current = new Set(pendingIds);
        for (const o of pending) {
          unactionedRef.current.add(o.id);
        }
        return;
      }

      const fresh = pending.filter((o) => !knownIdsRef.current!.has(o.id));
      for (const id of pendingIds) knownIdsRef.current.add(id);

      if (fresh.length > 0) {
        const forAlert: OnlineOrder[] = [];
        if (autoAccept) {
          for (const o of fresh) {
            if (isAwaitingApproval(o.status)) {
              try {
                const actionRes = await api.post(`/merchant/orders/${o.id}/action`, { action: 'accept' });
                const updated =
                  (actionRes.data?.order as OnlineOrder | undefined) || { ...o, status: 'preparing' };
                forAlert.push(updated);
              } catch {
                forAlert.push(o);
              }
            } else {
              forAlert.push(o);
            }
          }
        } else {
          forAlert.push(...fresh);
        }

        if (forAlert.length > 0) {
          for (const o of forAlert) {
            unactionedRef.current.add(o.id);
            const zip = extractZipFromAddress(o.shippingAddress);
            speakDeliveryAlert(onlineShopOrderSpeechLine(t, zip));
            showBrowserNotification(
              t('panelNewOrderNotificationTitle'),
              t('panelNewOrderNotificationBody').replace(
                '{number}',
                formatOrderNumberDisplay(o.orderNumber)
              )
            );
          }
          setQueue((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            return [...prev, ...forAlert.filter((o) => !seen.has(o.id))];
          });
          playOrderAlertOnce();
          startOrderAlertLoop(5000);
          if (document.hidden) {
            document.title = `🔔 ${t('webPosNewOrderAlert')} — Reborn`;
          }
        }
      }

      setQueue((prev) => prev.filter((o) => unactionedRef.current.has(o.id)));
    } catch {
      /* ignore poll errors */
    }
  }, [autoAccept, enabled, t]);

  useEffect(() => {
    if (!enabled || !settingsReady) {
      stopOrderAlertLoop();
      if (!enabled) {
        knownIdsRef.current = null;
        unactionedRef.current.clear();
        setQueue([]);
      }
      return;
    }
    void poll();
    const id = window.setInterval(() => void poll(), 8000);
    return () => {
      clearInterval(id);
      stopOrderAlertLoop();
    };
  }, [enabled, settingsReady, poll]);

  useEffect(() => {
    if (!document.hidden && queue.length === 0) {
      document.title = 'Reborn';
    }
  }, [queue.length]);

  const acknowledgeOrder = useCallback(
    (order: OnlineOrder) => {
      markActioned(order.id);
    },
    [markActioned]
  );

  const acceptOrder = useCallback(
    async (order: OnlineOrder) => {
      setBusy(true);
      try {
        await api.post(`/merchant/orders/${order.id}/action`, { action: 'accept' });
        markActioned(order.id);
      } finally {
        setBusy(false);
      }
    },
    [markActioned]
  );

  const rejectOrder = useCallback(
    async (order: OnlineOrder) => {
      setBusy(true);
      try {
        await api.post(`/merchant/orders/${order.id}/action`, { action: 'reject' });
        markActioned(order.id);
      } finally {
        setBusy(false);
      }
    },
    [markActioned]
  );

  if (!enabled) return null;

  const current = queue[0] ?? null;
  const acknowledgeOnly = autoAccept && !!current && !isAwaitingApproval(current.status);

  return (
    <WebPosNewOrderAlertModal
      order={current}
      queueCount={queue.length}
      busy={busy}
      acknowledgeOnly={acknowledgeOnly}
      onAcknowledge={acknowledgeOrder}
      onAccept={acknowledgeOnly ? undefined : (o) => void acceptOrder(o)}
      onReject={acknowledgeOnly ? undefined : (o) => void rejectOrder(o)}
    />
  );
}
