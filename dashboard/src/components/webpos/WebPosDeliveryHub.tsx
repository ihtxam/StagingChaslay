import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import toast from 'react-hot-toast';
import {
  Bell,
  BellOff,
  Car,
  ExternalLink,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  Truck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  isAwaitingApproval,
  isPaidOrder,
  orderPlatformBadgeClass,
  orderPlatformLabel,
  orderSourceLabel,
} from '@/lib/order-management';
import { printDeliverySlipForOrder } from '@/lib/print-delivery-slip';
import {
  extractZipFromAddress,
  isDeliveryHubSpeechEnabled,
  newOrderSpeechLine,
  setDeliveryHubSpeechEnabled,
  speakDeliveryAlert,
} from '@/lib/delivery-hub-alerts';
import { startOrderAlertLoop, stopOrderAlertLoop } from '@/lib/order-alert';
import DeliveryPrintedSlipModal, {
  type DeliverySlipAckOrder,
} from '@/components/webpos/DeliveryPrintedSlipModal';
import type { PosPrintSettingsClient } from '@/lib/webpos-receipt';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type HubTab = 'active' | 'completed' | 'drivers';

type DeliveryRow = {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string | null;
  customerPhone: string | null;
  shippingAddress: string | null;
  assignedDeliveryStaffId: string | null;
  assignedDriverName: string | null;
  total: number;
  createdAt: string | null;
  orderSource: string | null;
  paymentStatus: string | null;
  paymentMethod: string | null;
  printCount: number;
  latitude?: number | null;
  longitude?: number | null;
  channel?: string | null;
  fulfillmentChannel?: string | null;
};

type DriverRow = {
  staffId: string;
  staffName: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  activeOrderCount: number;
};

type Props = {
  merchant: {
    name?: string;
    address?: string;
    city?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  printSettings?: PosPrintSettingsClient | null;
  onClose?: () => void;
  standalone?: boolean;
};

const DEFAULT_CENTER: [number, number] = [47.3769, 8.5417];

const driverIcon = L.divIcon({
  className: '',
  html: `<div style="background:#0d9488;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)">🛵</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function elapsedMinutes(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function rowColorClass(order: DeliveryRow): string {
  const mins = elapsedMinutes(order.createdAt);
  if (order.status === 'pending_approval') return 'border-l-emerald-500 bg-emerald-50/80';
  if (!order.assignedDeliveryStaffId && mins >= 10) return 'border-l-red-500 bg-red-50/80';
  if (order.status === 'out_for_delivery') return 'border-l-sky-500 bg-sky-50/60';
  if (mins < 5) return 'border-l-emerald-400 bg-white';
  return 'border-l-amber-400 bg-white';
}

export default function WebPosDeliveryHub({ merchant, printSettings, onClose, standalone }: Props) {
  const { t, formatTime, locale } = useI18n();
  const [tab, setTab] = useState<HubTab>('active');
  const [orders, setOrders] = useState<DeliveryRow[]>([]);
  const [completed, setCompleted] = useState<DeliveryRow[]>([]);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [staff, setStaff] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [speechOn, setSpeechOn] = useState(() => isDeliveryHubSpeechEnabled());
  const [autoAccept, setAutoAccept] = useState(false);
  const [pickupEta, setPickupEta] = useState(25);
  const [deliveryEta, setDeliveryEta] = useState(45);
  const [storeLat, setStoreLat] = useState<number | null>(null);
  const [storeLng, setStoreLng] = useState<number | null>(null);
  const alertedPendingRef = useRef<Set<string>>(new Set());
  const staleAlertedRef = useRef<Set<string>>(new Set());
  const ticketAckedRef = useRef<Set<string>>(new Set());
  const [ticketAckQueue, setTicketAckQueue] = useState<DeliverySlipAckOrder[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [liveRes, settingsRes, completedRes] = await Promise.all([
        api.get('/merchant/delivery/live'),
        api.get('/merchant/settings'),
        api.get(`/merchant/pos/orders?limit=80&status=completed&from=${new Date().toISOString().slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}`),
      ]);
      setOrders(liveRes.data.orders || []);
      setDrivers(liveRes.data.drivers || []);
      setStaff(liveRes.data.deliveryStaff || []);
      const allCompleted = (completedRes.data.orders || []) as DeliveryRow[];
      setCompleted(
        allCompleted.filter(
          (o) => o.channel === 'delivery' || o.fulfillmentChannel === 'delivery'
        )
      );
      const s = settingsRes.data?.settings || settingsRes.data || {};
      setPickupEta(Number(s.pickupEtaMinutes) || 25);
      setDeliveryEta(Number(s.deliveryEtaMinutes) || 45);
      const lat = s.latitude != null ? Number(s.latitude) : merchant?.latitude;
      const lng = s.longitude != null ? Number(s.longitude) : merchant?.longitude;
      setStoreLat(Number.isFinite(lat) ? lat : null);
      setStoreLng(Number.isFinite(lng) ? lng : null);
      const dp = s.deliveryPlatformSettings || {};
      setAutoAccept(!!dp.justEat?.autoAccept || !!dp.uberEats?.autoAccept);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('deliveryMapLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [merchant?.latitude, merchant?.longitude, t]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(id);
  }, [load]);

  const pendingApproval = useMemo(
    () => orders.filter((o) => isAwaitingApproval(o.status)),
    [orders]
  );

  const enqueueTicketAck = useCallback((order: DeliveryRow, itemCount?: number | null) => {
    if (ticketAckedRef.current.has(order.id)) return;
    const entry: DeliverySlipAckOrder = {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      shippingAddress: order.shippingAddress,
      total: order.total,
      orderSource: order.orderSource,
      itemCount: itemCount ?? null,
    };
    setTicketAckQueue((prev) => (prev.some((o) => o.id === order.id) ? prev : [...prev, entry]));
  }, []);

  const acknowledgeTicket = useCallback((orderId: string) => {
    ticketAckedRef.current.add(orderId);
    alertedPendingRef.current.delete(orderId);
    setTicketAckQueue((prev) => prev.filter((o) => o.id !== orderId));
  }, []);

  const activeSlipModal = ticketAckQueue[0] ?? null;

  useEffect(() => {
    if (!speechOn) return;
    for (const o of pendingApproval) {
      if (alertedPendingRef.current.has(o.id)) continue;
      alertedPendingRef.current.add(o.id);
      const zip = extractZipFromAddress(o.shippingAddress);
      speakDeliveryAlert(newOrderSpeechLine(o.orderSource, zip));
    }
  }, [pendingApproval, speechOn]);

  const needsAlertRing = pendingApproval.length > 0 || ticketAckQueue.length > 0;

  useEffect(() => {
    if (needsAlertRing) {
      startOrderAlertLoop(4500);
    } else {
      stopOrderAlertLoop();
    }
    return () => stopOrderAlertLoop();
  }, [needsAlertRing]);

  useEffect(() => {
    if (!speechOn) return;
    for (const o of orders) {
      if (o.status === 'pending_approval') continue;
      if (o.assignedDeliveryStaffId) continue;
      if (elapsedMinutes(o.createdAt) < 10) continue;
      if (staleAlertedRef.current.has(o.id)) continue;
      staleAlertedRef.current.add(o.id);
      speakDeliveryAlert(t('deliveryHubStaleSpeech'));
    }
  }, [orders, speechOn, t]);

  const saveEta = async (patch: { pickupEtaMinutes?: number; deliveryEtaMinutes?: number }) => {
    try {
      await api.put('/merchant/settings', patch);
    } catch {
      toast.error(t('actionFailed'));
    }
  };

  const toggleAutoAccept = async () => {
    const next = !autoAccept;
    try {
      const settingsRes = await api.get('/merchant/settings');
      const s = settingsRes.data?.settings || settingsRes.data || {};
      const dp = s.deliveryPlatformSettings || {};
      await api.put('/merchant/settings', {
        deliveryPlatformSettings: {
          ...dp,
          justEat: { ...(dp.justEat || {}), autoAccept: next },
          uberEats: { ...(dp.uberEats || {}), autoAccept: next },
        },
      });
      setAutoAccept(next);
      toast.success(t('updated'));
    } catch {
      toast.error(t('actionFailed'));
    }
  };

  const runAction = async (orderId: string, action: string) => {
    const orderRow = orders.find((o) => o.id === orderId);
    setBusyId(orderId);
    try {
      await api.post(`/merchant/orders/${orderId}/action`, { action });
      if (action === 'accept') {
        try {
          await printDeliverySlipForOrder(orderId, {
            merchant: merchant || {},
            printSettings,
            locale,
            fallbackPrinterName: localStorage.getItem('manupos_webpos_printer') || '',
          });
          if (orderRow) {
            let itemCount: number | null = null;
            try {
              const detail = await api.get(`/merchant/orders/${orderId}`);
              const items = (detail.data?.order || detail.data)?.items;
              itemCount = Array.isArray(items) ? items.length : null;
            } catch {
              /* optional */
            }
            enqueueTicketAck(orderRow, itemCount);
          }
        } catch {
          /* print optional */
        }
      }
      if (action === 'reject') {
        acknowledgeTicket(orderId);
      }
      toast.success(t('updated'));
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('actionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const assignDriver = async (orderId: string, staffId: string) => {
    setBusyId(orderId);
    try {
      await api.post(`/merchant/delivery/orders/${orderId}/assign`, {
        staffId: staffId || null,
      });
      toast.success(t('deliveryAssignSaved'));
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('deliveryAssignFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const printSlip = async (order: DeliveryRow) => {
    setBusyId(order.id);
    try {
      await printDeliverySlipForOrder(order.id, {
        merchant: merchant || {},
        printSettings,
        locale,
        fallbackPrinterName: localStorage.getItem('manupos_webpos_printer') || '',
      });
      let itemCount: number | null = null;
      try {
        const detail = await api.get(`/merchant/orders/${order.id}`);
        const items = (detail.data?.order || detail.data)?.items;
        itemCount = Array.isArray(items) ? items.length : null;
      } catch {
        /* optional */
      }
      enqueueTicketAck(order, itemCount);
      toast.success(t('deliveryHubSlipPrinted'));
      await load();
    } catch {
      toast.error(t('webPosPrintFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const mapCenter = useMemo((): [number, number] => {
    if (storeLat != null && storeLng != null) return [storeLat, storeLng];
    if (drivers[0]) return [drivers[0].latitude, drivers[0].longitude];
    return DEFAULT_CENTER;
  }, [storeLat, storeLng, drivers]);

  const openStandalone = () => {
    window.open('/merchant/pos?delivery=1', '_blank', 'noopener,noreferrer');
  };

  const renderOrderRow = (o: DeliveryRow) => {
    const zip = extractZipFromAddress(o.shippingAddress);
    const mins = elapsedMinutes(o.createdAt);
    const platform = orderPlatformLabel(o as Parameters<typeof orderPlatformLabel>[0], t);
    const busy = busyId === o.id;

    return (
      <article
        key={o.id}
        className={`border-l-4 border border-stone-200 rounded-lg p-3 shadow-sm ${rowColorClass(o)}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${orderPlatformBadgeClass(o as Parameters<typeof orderPlatformBadgeClass>[0])}`}>
                {orderSourceLabel(o.orderSource) || platform}
              </span>
              <span className="text-xs font-semibold text-stone-600">
                {o.createdAt ? formatTime(o.createdAt) : '—'} · {mins}m
              </span>
              {o.assignedDriverName ? (
                <span className="text-xs font-bold text-teal-800">🛵 {o.assignedDriverName}</span>
              ) : null}
              {o.status === 'out_for_delivery' ? (
                <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-900">
                  <Car size={12} /> {t('deliveryHubOnDelivery')}
                </span>
              ) : null}
            </div>
            <p className="mt-1 font-bold text-stone-900">{o.customerName || t('deliveryMapGuest')}</p>
            <p className="text-xs text-stone-600">{o.shippingAddress || '—'}</p>
            {o.customerPhone ? <p className="text-xs text-stone-500">{o.customerPhone}</p> : null}
          </div>
          <div className="flex flex-col items-end gap-1">
            {zip ? (
              <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-900">
                {zip}
              </span>
            ) : null}
            <span className="text-sm font-extrabold tabular-nums">CHF {Number(o.total || 0).toFixed(2)}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                isPaidOrder(o as Parameters<typeof isPaidOrder>[0])
                  ? 'bg-emerald-100 text-emerald-900'
                  : 'bg-amber-100 text-amber-900'
              }`}
            >
              {isPaidOrder(o as Parameters<typeof isPaidOrder>[0]) ? t('deliveryHubPaid') : t('deliveryHubUnpaid')}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 hover:text-stone-900"
              disabled={busy}
              onClick={() => void printSlip(o)}
            >
              <Printer size={14} />
              {o.printCount > 0 ? o.printCount : ''}
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {isAwaitingApproval(o.status) ? (
            <button
              type="button"
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
              onClick={() => void runAction(o.id, 'accept')}
            >
              {t('webPosWorkflowAccept')}
            </button>
          ) : null}
          {o.status === 'preparing' || o.status === 'accepted' ? (
            <button
              type="button"
              disabled={busy}
              className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-bold text-white"
              onClick={() => void runAction(o.id, 'mark_ready')}
            >
              {t('webPosMarkReady')}
            </button>
          ) : null}
          {o.status === 'ready' ? (
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-bold"
              onClick={() => void runAction(o.id, 'out_for_delivery')}
            >
              {t('ordersActionSendDelivery')}
            </button>
          ) : null}
          {staff.length > 0 ? (
            <select
              className="input max-w-[10rem] py-1 text-xs"
              disabled={busy}
              value={o.assignedDeliveryStaffId || ''}
              onChange={(e) => void assignDriver(o.id, e.target.value)}
            >
              <option value="">{t('deliveryUnassigned')}</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </article>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-stone-100">
      <header className="shrink-0 border-b border-stone-200 bg-white px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Truck className="text-teal-700" size={20} />
            <h1 className="text-sm font-bold text-stone-900">{t('deliveryHubTitle')}</h1>
            {!standalone && onClose ? (
              <button type="button" className="text-xs text-stone-500 underline" onClick={onClose}>
                {t('back')}
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`rounded-lg border px-2 py-1 text-xs font-semibold ${autoAccept ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-stone-200'}`}
              onClick={() => void toggleAutoAccept()}
            >
              {t('deliveryHubAutoAccept')}: {autoAccept ? t('yes') : t('no')}
            </button>
            <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-xs">
              <span className="font-semibold">{t('pickup')}</span>
              <button type="button" className="p-0.5" onClick={() => { const n = Math.max(5, pickupEta - 5); setPickupEta(n); void saveEta({ pickupEtaMinutes: n }); }}>
                <Minus size={12} />
              </button>
              <span className="w-6 text-center font-bold tabular-nums">{pickupEta}</span>
              <button type="button" className="p-0.5" onClick={() => { const n = Math.min(180, pickupEta + 5); setPickupEta(n); void saveEta({ pickupEtaMinutes: n }); }}>
                <Plus size={12} />
              </button>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-xs">
              <span className="font-semibold">{t('delivery')}</span>
              <button type="button" className="p-0.5" onClick={() => { const n = Math.max(5, deliveryEta - 5); setDeliveryEta(n); void saveEta({ deliveryEtaMinutes: n }); }}>
                <Minus size={12} />
              </button>
              <span className="w-6 text-center font-bold tabular-nums">{deliveryEta}</span>
              <button type="button" className="p-0.5" onClick={() => { const n = Math.min(180, deliveryEta + 5); setDeliveryEta(n); void saveEta({ deliveryEtaMinutes: n }); }}>
                <Plus size={12} />
              </button>
            </div>
            <button
              type="button"
              className="rounded-lg border border-stone-200 p-1.5"
              title={speechOn ? t('deliveryHubSoundOff') : t('deliveryHubSoundOn')}
              onClick={() => {
                const next = !speechOn;
                setSpeechOn(next);
                setDeliveryHubSpeechEnabled(next);
              }}
            >
              {speechOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            {pendingApproval.length > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800 animate-pulse">
                <Bell size={12} /> {pendingApproval.length}
              </span>
            ) : (
              <BellOff size={16} className="text-stone-300" />
            )}
            <button type="button" className="rounded-lg border border-stone-200 p-1.5" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            {!standalone ? (
              <button type="button" className="rounded-lg border border-stone-200 p-1.5" onClick={openStandalone} title={t('deliveryHubOpenWindow')}>
                <ExternalLink size={16} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-2 flex gap-1">
          {(
            [
              ['active', t('deliveryHubTabActive'), orders.length],
              ['completed', t('deliveryHubTabCompleted'), completed.length],
              ['drivers', t('deliveryHubTabDrivers'), drivers.length],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                tab === id ? 'bg-teal-700 text-white' : 'bg-stone-200 text-stone-700'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {tab === 'drivers' ? (
          <div className="h-[min(70vh,720px)] overflow-hidden rounded-xl border border-stone-200 bg-white">
            <MapContainer center={mapCenter} zoom={13} className="h-full w-full" scrollWheelZoom>
              <TileLayer
                attribution='&copy; OSM'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {storeLat != null && storeLng != null ? (
                <Marker position={[storeLat, storeLng]}>
                  <Popup>{t('deliveryMapStore')}</Popup>
                </Marker>
              ) : null}
              {drivers.map((d) => (
                <Marker key={d.staffId} position={[d.latitude, d.longitude]} icon={driverIcon}>
                  <Popup>
                    {d.staffName}
                    <br />
                    {t('deliveryMapActiveOrders').replace('{n}', String(d.activeOrderCount))}
                  </Popup>
                </Marker>
              ))}
              {orders.map((o) =>
                o.latitude != null && o.longitude != null ? (
                  <CircleMarker
                    key={`dest-${o.id}`}
                    center={[o.latitude, o.longitude]}
                    radius={8}
                    pathOptions={{ color: '#dc2626', fillColor: '#ef4444', fillOpacity: 0.7 }}
                  >
                    <Popup>
                      #{o.orderNumber} — {o.customerName || ''}
                    </Popup>
                  </CircleMarker>
                ) : null
              )}
            </MapContainer>
          </div>
        ) : tab === 'completed' ? (
          <div className="space-y-2">{completed.map(renderOrderRow)}</div>
        ) : (
          <div className="space-y-2">{orders.map(renderOrderRow)}</div>
        )}
      </div>

      <DeliveryPrintedSlipModal
        order={activeSlipModal}
        queueCount={ticketAckQueue.length}
        onAcknowledge={(o) => acknowledgeTicket(o.id)}
      />
    </div>
  );
}
