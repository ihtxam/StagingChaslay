import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type Driver = {
  staffId: string;
  staffName: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  activeOrderCount: number;
};

type DeliveryOrder = {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string | null;
  shippingAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  assignedDeliveryStaffId: string | null;
  assignedDriverName: string | null;
  total: number;
};

type StaffOption = { id: string; name: string };

const DEFAULT_CENTER: [number, number] = [47.3769, 8.5417];

const driverIcon = L.divIcon({
  className: '',
  html: `<div style="background:#0d9488;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)">🛵</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export default function DeliveryTrackingPage() {
  const { t } = useI18n();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [storeLat, setStoreLat] = useState<number | null>(null);
  const [storeLng, setStoreLng] = useState<number | null>(null);
  const [assignBusy, setAssignBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [liveRes, settingsRes] = await Promise.all([
        api.get('/merchant/delivery/live'),
        api.get('/merchant/settings').catch(() => ({ data: {} })),
      ]);
      setDrivers(liveRes.data.drivers || []);
      setOrders(liveRes.data.orders || []);
      setStaff(liveRes.data.deliveryStaff || []);
      const merch = settingsRes.data.settings || settingsRes.data.merchant;
      const lat = merch?.latitude != null ? Number(merch.latitude) : null;
      const lng = merch?.longitude != null ? Number(merch.longitude) : null;
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setStoreLat(lat);
        setStoreLng(lng);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('deliveryMapLoadFailed'));
    }
  }, [t]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(id);
  }, [load]);

  const mapCenter = useMemo((): [number, number] => {
    if (storeLat != null && storeLng != null) return [storeLat, storeLng];
    if (drivers[0]) return [drivers[0].latitude, drivers[0].longitude];
    return DEFAULT_CENTER;
  }, [storeLat, storeLng, drivers]);

  const assignDriver = async (orderId: string, staffId: string) => {
    setAssignBusy(orderId);
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
      setAssignBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-stone-900">{t('deliveryMapTitle')}</h1>
        <p className="mt-1 text-sm text-stone-600">{t('deliveryMapHint')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <MapContainer center={mapCenter} zoom={13} className="h-[min(60vh,480px)] w-full" scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
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
                  <strong>{d.staffName}</strong>
                  <br />
                  {t('deliveryMapActiveOrders').replace('{n}', String(d.activeOrderCount))}
                </Popup>
              </Marker>
            ))}
            {orders.map((o) =>
              o.latitude != null && o.longitude != null ? (
                <CircleMarker
                  key={o.id}
                  center={[o.latitude, o.longitude]}
                  radius={8}
                  pathOptions={{ color: '#ea580c', fillColor: '#fb923c', fillOpacity: 0.85 }}
                >
                  <Popup>
                    #{o.orderNumber} — {o.customerName || t('deliveryMapGuest')}
                  </Popup>
                </CircleMarker>
              ) : null
            )}
          </MapContainer>
        </div>

        <div className="space-y-3">
          <section className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wide text-stone-500">
              {t('deliveryMapDrivers')} ({drivers.length})
            </h2>
            <ul className="mt-2 max-h-40 space-y-2 overflow-auto text-sm">
              {drivers.length === 0 ? (
                <li className="text-stone-500">{t('deliveryMapNoDrivers')}</li>
              ) : (
                drivers.map((d) => (
                  <li key={d.staffId} className="rounded-lg bg-stone-50 px-2 py-1.5">
                    <span className="font-semibold text-stone-900">{d.staffName}</span>
                    <span className="ml-2 text-xs text-stone-500">
                      {new Date(d.recordedAt).toLocaleTimeString()}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wide text-stone-500">
              {t('deliveryMapOrders')} ({orders.length})
            </h2>
            <ul className="mt-2 max-h-[min(40vh,360px)] space-y-3 overflow-auto text-sm">
              {orders.length === 0 ? (
                <li className="text-stone-500">{t('deliveryMapNoOrders')}</li>
              ) : (
                orders.map((o) => (
                  <li key={o.id} className="rounded-lg border border-stone-100 p-2">
                    <div className="font-semibold text-stone-900">#{o.orderNumber}</div>
                    <div className="text-xs text-stone-600">{o.shippingAddress || '—'}</div>
                    <div className="mt-1 text-[11px] uppercase text-stone-400">{o.status}</div>
                    <label className="mt-2 block text-[11px] text-stone-500">
                      {t('deliveryAssignDriver')}
                      <select
                        className="input mt-0.5 w-full text-xs"
                        disabled={assignBusy === o.id}
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
                    </label>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
