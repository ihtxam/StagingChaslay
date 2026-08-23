import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { playOrderAlertOnce, startOrderAlertLoop, stopOrderAlertLoop } from '@/lib/order-alert';
import {
  extractZipFromAddress,
  newOrderSpeechLine,
  speakDeliveryAlert,
} from '@/lib/delivery-hub-alerts';
import WebPosNewOrderAlertModal from '@/components/webpos/WebPosNewOrderAlertModal';
import type { OnlineOrder } from '@/components/WebPosOnlineOrdersPanel';
import { formatOrderNumberDisplay } from '@/lib/order-number';

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
  const knownIdsRef = useRef<Set<string> | null>(null);
  const unactionedRef = useRef<Set<string>>(new Set());
  const audioUnlockedRef = useRef(false);

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
    if (!enabled) return;
    void api.get('/merchant/settings').then((res) => {
      const dp = res.data?.settings?.deliveryPlatformSettings || res.data?.deliveryPlatformSettings || {};
      setAutoAccept(!!dp.justEat?.autoAccept || !!dp.uberEats?.autoAccept || !!dp.onlineShopAutoAccept);
    }).catch(() => {});
  }, [enabled]);

  const markActioned = useCallback((orderId: string) => {
    unactionedRef.current.delete(orderId);
    setQueue((prev) => prev.filter((o) => o.id !== orderId));
    if (unactionedRef.current.size === 0) stopOrderAlertLoop();
  }, []);

  const poll = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await api.get('/merchant/orders', { params: { limit: 80 } });
      const online = ((res.data.orders || []) as OnlineOrder[]).filter((o) => o.orderType === 'web_shop');
      const pending = online.filter((o) => o.status === 'pending' || o.status === 'pending_approval');
      const pendingIds = pending.map((o) => o.id);

      if (knownIdsRef.current == null) {
        knownIdsRef.current = new Set(pendingIds);
        return;
      }

      const fresh = pending.filter((o) => !knownIdsRef.current!.has(o.id));
      for (const id of pendingIds) knownIdsRef.current.add(id);

      if (fresh.length > 0) {
        const needsManual: OnlineOrder[] = [];
        if (autoAccept) {
          for (const o of fresh) {
            try {
              await api.post(`/merchant/orders/${o.id}/action`, { action: 'accept' });
            } catch {
              needsManual.push(o);
            }
          }
        } else {
          needsManual.push(...fresh);
        }

        if (needsManual.length > 0) {
          for (const o of needsManual) {
            unactionedRef.current.add(o.id);
            const zip = extractZipFromAddress(o.shippingAddress);
            speakDeliveryAlert(newOrderSpeechLine(t, o.orderSource, zip));
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
            return [...prev, ...needsManual.filter((o) => !seen.has(o.id))];
          });
          playOrderAlertOnce();
          startOrderAlertLoop(5000);
          if (document.hidden) {
            document.title = `🔔 ${t('webPosNewOrderAlert')} — ChaslayReborn`;
          }
        }
      }

      setQueue((prev) =>
        prev.filter((o) => {
          const row = online.find((x) => x.id === o.id);
          return !!row && (row.status === 'pending' || row.status === 'pending_approval');
        })
      );
    } catch {
      /* ignore poll errors */
    }
  }, [autoAccept, enabled, markActioned, t]);

  useEffect(() => {
    if (!enabled) {
      stopOrderAlertLoop();
      knownIdsRef.current = null;
      unactionedRef.current.clear();
      setQueue([]);
      return;
    }
    void poll();
    const id = window.setInterval(() => void poll(), 8000);
    return () => {
      window.clearInterval(id);
      stopOrderAlertLoop();
    };
  }, [enabled, poll]);

  useEffect(() => {
    if (!document.hidden && queue.length === 0) {
      document.title = 'ChaslayReborn';
    }
  }, [queue.length]);

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

  return (
    <WebPosNewOrderAlertModal
      order={queue[0] ?? null}
      queueCount={queue.length}
      busy={busy}
      onAccept={(o) => void acceptOrder(o)}
      onReject={(o) => void rejectOrder(o)}
    />
  );
}
