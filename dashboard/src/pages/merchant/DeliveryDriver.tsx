import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth';
import WebPosPinModal from '@/components/WebPosPinModal';
import {
  loadWebPosStaffSession,
  saveWebPosStaffSession,
  type WebPosStaffSession,
} from '@/lib/permissions';

type DeliveryOrder = {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string | null;
  shippingAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  total: number;
};

export default function DeliveryDriverPage() {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const [pinStaff, setPinStaff] = useState<WebPosStaffSession | null>(() => loadWebPosStaffSession());
  const [pinOpen, setPinOpen] = useState(false);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [tracking, setTracking] = useState(false);
  const [lastPing, setLastPing] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const staffAccessToken = pinStaff?.accessToken;
  const displayName = pinStaff?.name || user?.name;

  const apiHeaders = useMemo(
    () =>
      staffAccessToken ? { 'X-WebPos-Staff-Access': staffAccessToken } : undefined,
    [staffAccessToken]
  );

  const loadOrders = useCallback(async () => {
    if (!staffAccessToken && user?.role !== 'staff') return;
    try {
      const res = await api.get('/merchant/delivery/my-orders', { headers: apiHeaders });
      setOrders(res.data.orders || []);
    } catch {
      /* staff session required */
    }
  }, [staffAccessToken, user?.role, apiHeaders]);

  const postLocation = useCallback(
    async (latitude: number, longitude: number, accuracyM?: number) => {
      if (!staffAccessToken && user?.role !== 'staff') {
        toast.error(t('deliveryPinRequired'));
        return;
      }
      try {
        await api.post(
          '/merchant/delivery/location',
          { latitude, longitude, accuracyM },
          { headers: apiHeaders }
        );
        setLastPing(new Date().toLocaleTimeString());
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } } };
        toast.error(err.response?.data?.error || t('deliveryLocationFailed'));
      }
    },
    [staffAccessToken, user?.role, apiHeaders, t]
  );

  const startTracking = () => {
    if (!pinStaff && user?.role !== 'staff') {
      setPinOpen(true);
      return;
    }
    if (!navigator.geolocation) {
      toast.error(t('deliveryGeoUnsupported'));
      return;
    }
    setTracking(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        void postLocation(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.accuracy
        );
      },
      () => toast.error(t('deliveryGeoDenied')),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );
  };

  const stopTracking = () => {
    setTracking(false);
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  useEffect(() => {
    void loadOrders();
    const id = window.setInterval(() => void loadOrders(), 15000);
    return () => {
      window.clearInterval(id);
      stopTracking();
    };
  }, [loadOrders]);

  const mapsUrl = (address: string) =>
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-stone-900">{t('deliveryDriverTitle')}</h1>
        <p className="mt-1 text-sm text-stone-600">
          {displayName
            ? t('deliveryDriverHello').replace('{name}', displayName)
            : t('deliveryDriverHint')}
        </p>
        {!pinStaff && user?.role !== 'staff' ? (
          <button
            type="button"
            className="mt-2 text-sm font-semibold text-teal-700 hover:underline"
            onClick={() => setPinOpen(true)}
          >
            {t('deliveryClockInPin')}
          </button>
        ) : null}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
            <MapPin size={18} className="text-teal-600" />
            {tracking ? t('deliveryTrackingOn') : t('deliveryTrackingOff')}
          </div>
          {lastPing ? (
            <span className="text-[11px] text-stone-500">
              {t('deliveryLastPing').replace('{time}', lastPing)}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className={`mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-bold text-white ${
            tracking ? 'bg-stone-600 hover:bg-stone-700' : 'bg-teal-600 hover:bg-teal-700'
          }`}
          onClick={() => (tracking ? stopTracking() : startTracking())}
        >
          {tracking ? t('deliveryStopTracking') : t('deliveryStartTracking')}
        </button>
        <p className="mt-2 text-[11px] leading-snug text-stone-500">{t('deliveryTrackingNote')}</p>
      </div>

      <div className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-stone-500">
          {t('deliveryMyOrders')} ({orders.length})
        </h2>
        {orders.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
            {t('deliveryNoAssignedOrders')}
          </p>
        ) : (
          orders.map((o) => (
            <div key={o.id} className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
              <div className="font-bold text-stone-900">#{o.orderNumber}</div>
              <div className="text-sm text-stone-700">{o.customerName || t('deliveryMapGuest')}</div>
              <div className="mt-1 text-xs text-stone-500">{o.shippingAddress || '—'}</div>
              {o.shippingAddress ? (
                <a
                  href={mapsUrl(o.shippingAddress)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
                >
                  <Navigation size={14} />
                  {t('deliveryNavigate')}
                </a>
              ) : null}
            </div>
          ))
        )}
      </div>

      <WebPosPinModal
        open={pinOpen}
        mode="gate"
        onClose={() => setPinOpen(false)}
        onSuccess={(staff) => {
          const session: WebPosStaffSession = {
            id: staff.id,
            name: staff.name,
            roleId: staff.roleId,
            roleName: staff.roleName,
            permissions: staff.permissions as WebPosStaffSession['permissions'],
            accessToken: staff.accessToken,
          };
          saveWebPosStaffSession(session);
          setPinStaff(session);
          setPinOpen(false);
          toast.success(t('webPosSignedInAs').replace('{name}', staff.name));
          void loadOrders();
        }}
      />
    </div>
  );
}
