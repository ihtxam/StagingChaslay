import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, MapPin, Navigation, QrCode, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth';
import WebPosPinModal from '@/components/WebPosPinModal';
import DeliveryQrScanModal from '@/components/delivery/DeliveryQrScanModal';
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

type CompletedOrder = {
  id: string;
  orderNumber: string;
  total: number;
  completedAt: string | null;
  customerName: string | null;
  shippingAddress: string | null;
};

type WageSummary = {
  date: string;
  payMode: 'hourly' | 'per_order' | 'both';
  hourlyRate: number;
  perOrderFee: number;
  hoursWorked: number;
  deliveryCount: number;
  hourlyPay: number;
  orderPay: number;
  totalPay: number;
};

type Tab = 'active' | 'completed' | 'wage';

export default function DeliveryDriverPage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const claimOrderId = searchParams.get('claim') || '';
  const claimToken = searchParams.get('token') || '';
  const user = useAuthStore((s) => s.user);
  const [pinStaff, setPinStaff] = useState<WebPosStaffSession | null>(() => loadWebPosStaffSession());
  const [pinOpen, setPinOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('active');
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [completed, setCompleted] = useState<CompletedOrder[]>([]);
  const [wage, setWage] = useState<WageSummary | null>(null);
  const [tracking, setTracking] = useState(false);
  const [lastPing, setLastPing] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const staffAccessToken = pinStaff?.accessToken;
  const displayName = pinStaff?.name || user?.name;

  const apiHeaders = useMemo(
    () =>
      staffAccessToken ? { 'X-WebPos-Staff-Access': staffAccessToken } : undefined,
    [staffAccessToken]
  );

  const clockedIn = !!pinStaff || user?.role === 'staff';

  const loadOrders = useCallback(async () => {
    if (!clockedIn) return;
    try {
      const res = await api.get('/merchant/delivery/my-orders', { headers: apiHeaders });
      setOrders(res.data.orders || []);
    } catch {
      /* staff session required */
    }
  }, [clockedIn, apiHeaders]);

  const claimOrder = useCallback(
    async (orderId: string, token: string) => {
      if (!clockedIn) {
        setPinOpen(true);
        return;
      }
      try {
        await api.post(
          `/merchant/delivery/orders/${orderId}/claim`,
          { token },
          { headers: apiHeaders }
        );
        toast.success(t('deliveryClaimSuccess'));
        setSearchParams({}, { replace: true });
        await loadOrders();
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } } };
        toast.error(err.response?.data?.error || t('actionFailed'));
      }
    },
    [clockedIn, apiHeaders, t, setSearchParams, loadOrders]
  );

  useEffect(() => {
    if (claimOrderId && claimToken && clockedIn) {
      void claimOrder(claimOrderId, claimToken);
    }
  }, [claimOrderId, claimToken, clockedIn, claimOrder]);

  const loadCompleted = useCallback(async () => {
    if (!clockedIn) return;
    try {
      const res = await api.get('/merchant/delivery/completed', { headers: apiHeaders });
      setCompleted(res.data.orders || []);
    } catch {
      /* ignore */
    }
  }, [clockedIn, apiHeaders]);

  const loadWage = useCallback(async () => {
    if (!clockedIn) return;
    try {
      const res = await api.get('/merchant/delivery/wage', { headers: apiHeaders });
      setWage(res.data.summary || null);
    } catch {
      /* ignore */
    }
  }, [clockedIn, apiHeaders]);

  const postLocation = useCallback(
    async (latitude: number, longitude: number, accuracyM?: number) => {
      if (!clockedIn) {
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
    [clockedIn, apiHeaders, t]
  );

  const startTracking = () => {
    if (!clockedIn) {
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
        void postLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      () => toast.error(t('deliveryGeoDenied')),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );
  };

  const stopTracking = async () => {
    setTracking(false);
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (clockedIn) {
      try {
        await api.post('/merchant/delivery/shift/end', {}, { headers: apiHeaders });
        void loadWage();
      } catch {
        /* optional */
      }
    }
  };

  const markDelivered = async (orderId: string) => {
    setBusyId(orderId);
    try {
      await api.post(`/merchant/delivery/orders/${orderId}/complete`, {}, { headers: apiHeaders });
      toast.success(t('deliveryMarkedDelivered'));
      await Promise.all([loadOrders(), loadCompleted(), loadWage()]);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('actionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    void loadOrders();
    void loadCompleted();
    void loadWage();
    const id = window.setInterval(() => {
      void loadOrders();
      if (tab === 'completed') void loadCompleted();
      if (tab === 'wage') void loadWage();
    }, 15000);
    return () => {
      window.clearInterval(id);
      void stopTracking();
    };
  }, [loadOrders, loadCompleted, loadWage, tab]);

  const mapsUrl = (address: string) =>
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;

  const money = (n: number) => `CHF ${Number(n || 0).toFixed(2)}`;

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-stone-900">{t('deliveryDriverTitle')}</h1>
        <p className="mt-1 text-sm text-stone-600">
          {displayName
            ? t('deliveryDriverHello').replace('{name}', displayName)
            : t('deliveryDriverHint')}
        </p>
        {!clockedIn ? (
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
        <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
          <QrCode size={18} className="text-teal-600" />
          {t('deliveryScanQrTitle')}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-stone-500">{t('deliveryScanQrHint')}</p>
        <button
          type="button"
          className="mt-3 w-full rounded-lg border-2 border-dashed border-teal-300 bg-teal-50 px-4 py-3 text-sm font-bold text-teal-900 hover:bg-teal-100"
          onClick={() => {
            if (!clockedIn) {
              setPinOpen(true);
              return;
            }
            setScanOpen(true);
          }}
        >
          {t('deliveryScanQrButton')}
        </button>
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
          onClick={() => (tracking ? void stopTracking() : startTracking())}
        >
          {tracking ? t('deliveryStopTracking') : t('deliveryStartTracking')}
        </button>
        <p className="mt-2 text-[11px] leading-snug text-stone-500">{t('deliveryTrackingNote')}</p>
      </div>

      <div className="flex gap-1 rounded-lg bg-stone-100 p-1">
        {(
          [
            ['active', t('deliveryMyOrders')],
            ['completed', t('deliveryCompletedTab')],
            ['wage', t('deliveryWageTab')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${
              tab === id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'active' ? (
        <div className="space-y-2">
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
                <div className="mt-2 flex flex-wrap gap-2">
                  {o.shippingAddress ? (
                    <a
                      href={mapsUrl(o.shippingAddress)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
                    >
                      <Navigation size={14} />
                      {t('deliveryNavigate')}
                    </a>
                  ) : null}
                  <button
                    type="button"
                    disabled={busyId === o.id}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-bold text-white disabled:opacity-50"
                    onClick={() => void markDelivered(o.id)}
                  >
                    <CheckCircle size={14} />
                    {t('deliveryMarkDelivered')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === 'completed' ? (
        <div className="space-y-2">
          {completed.length === 0 ? (
            <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
              {t('deliveryNoCompletedOrders')}
            </p>
          ) : (
            completed.map((o) => (
              <div key={o.id} className="rounded-xl border border-stone-200 bg-white p-3 text-sm shadow-sm">
                <div className="font-bold">#{o.orderNumber}</div>
                <div className="text-stone-600">{o.customerName || '—'}</div>
                <div className="text-xs text-stone-500">{money(o.total)}</div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === 'wage' && wage ? (
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-stone-900">
            <Wallet size={18} className="text-teal-600" />
            {t('deliveryWageToday')}
          </div>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-600">{t('deliveryHoursWorked')}</dt>
              <dd className="font-semibold">{wage.hoursWorked.toFixed(2)} h</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-600">{t('deliveryCompletedCount')}</dt>
              <dd className="font-semibold">{wage.deliveryCount}</dd>
            </div>
            {wage.payMode !== 'per_order' ? (
              <div className="flex justify-between">
                <dt className="text-stone-600">{t('deliveryHourlyPay')}</dt>
                <dd>{money(wage.hourlyPay)}</dd>
              </div>
            ) : null}
            {wage.payMode !== 'hourly' ? (
              <div className="flex justify-between">
                <dt className="text-stone-600">{t('deliveryPerOrderPay')}</dt>
                <dd>{money(wage.orderPay)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-stone-100 pt-2 text-base font-extrabold">
              <dt>{t('deliveryTotalPay')}</dt>
              <dd className="text-teal-700">{money(wage.totalPay)}</dd>
            </div>
          </dl>
        </div>
      ) : null}

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
          void loadWage();
        }}
      />

      <DeliveryQrScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(orderId, token) => void claimOrder(orderId, token)}
      />
    </div>
  );
}
