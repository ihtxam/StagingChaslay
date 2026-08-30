import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
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
const PANEL_CARD = 'rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-sm';

const driverIcon = L.divIcon({
  className: '',
  html: `<div style="background:#0d9488;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)">🛵</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const timers = [100, 400, 900].map((ms) =>
      window.setTimeout(() => {
        try {
          map.invalidateSize();
        } catch {
          /* ignore */
        }
      }, ms)
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [map]);
  return null;
}

export default function DeliveryTrackingPage({ embedded = false }: { embedded?: boolean }) {
  const { t } = useI18n();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [storeLat, setStoreLat] = useState<number | null>(null);
  const [storeLng, setStoreLng] = useState<number | null>(null);
  const [assignBusy, setAssignBusy] = useState<string | null>(null);
  const [payMode, setPayMode] = useState<'hourly' | 'per_order' | 'both'>('both');
  const [hourlyRate, setHourlyRate] = useState('0');
  const [perOrderFee, setPerOrderFee] = useState('0');
  const [paySaving, setPaySaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [liveRes, settingsRes] = await Promise.all([
        api.get('/merchant/delivery/live'),
        api.get('/merchant/settings').catch(() => ({ data: {} })),
      ]);
      setDrivers(liveRes.data.drivers || []);
      setOrders(liveRes.data.orders || []);
      setStaff(liveRes.data.deliveryStaff || []);
      setLoadError(null);
      const merch = settingsRes.data.settings || settingsRes.data.merchant;
      const lat = merch?.latitude != null ? Number(merch.latitude) : null;
      const lng = merch?.longitude != null ? Number(merch.longitude) : null;
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setStoreLat(lat);
        setStoreLng(lng);
      }
      const mode = String(merch?.deliveryDriverPayMode || 'both');
      if (mode === 'hourly' || mode === 'per_order' || mode === 'both') {
        setPayMode(mode);
      }
      setHourlyRate(String(merch?.deliveryDriverHourlyRate ?? '0'));
      setPerOrderFee(String(merch?.deliveryPerOrderFee ?? '0'));
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { error?: string } } };
      const message =
        err.response?.status === 403
          ? t('deliveryMapPermissionDenied')
          : err.response?.data?.error || t('deliveryMapLoadFailed');
      setLoadError(message);
      toast.error(message);
    }
  }, [t]);

  const savePaySettings = async () => {
    setPaySaving(true);
    try {
      await api.put('/merchant/settings', {
        deliveryDriverPayMode: payMode,
        deliveryDriverHourlyRate: Number(hourlyRate),
        deliveryPerOrderFee: Number(perOrderFee),
      });
      toast.success(t('saved'));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('actionFailed'));
    } finally {
      setPaySaving(false);
    }
  };

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
    <div className={embedded ? 'space-y-4' : 'mx-auto max-w-6xl space-y-4 p-4'}>
      {!embedded ? (
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">{t('deliveryMapTitle')}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{t('deliveryMapHint')}</p>
        </div>
      ) : null}

      {loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {loadError}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className={`overflow-hidden ${PANEL_CARD}`}>
          <MapContainer center={mapCenter} zoom={13} className="delivery-map h-[min(60vh,480px)] w-full" scrollWheelZoom>
            <MapResizeFix />
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
          <section className={`${PANEL_CARD} p-3`}>
            <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
              {t('deliveryMapDrivers')} ({drivers.length})
            </h2>
            <ul className="mt-2 max-h-40 space-y-2 overflow-auto text-sm">
              {drivers.length === 0 ? (
                <li className="text-[var(--text-muted)]">{t('deliveryMapNoDrivers')}</li>
              ) : (
                drivers.map((d) => (
                  <li key={d.staffId} className="rounded-lg bg-[var(--bg-muted)] px-2 py-1.5">
                    <span className="font-semibold text-[var(--text)]">{d.staffName}</span>
                    <span className="ml-2 text-xs text-[var(--text-muted)]">
                      {new Date(d.recordedAt).toLocaleTimeString()}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className={`${PANEL_CARD} p-3`}>
            <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
              {t('deliveryMapOrders')} ({orders.length})
            </h2>
            <ul className="mt-2 max-h-[min(40vh,360px)] space-y-3 overflow-auto text-sm">
              {orders.length === 0 ? (
                <li className="text-[var(--text-muted)]">{t('deliveryMapNoOrders')}</li>
              ) : (
                orders.map((o) => (
                  <li key={o.id} className="rounded-lg border border-[var(--border)] p-2">
                    <div className="font-semibold text-[var(--text)]">#{o.orderNumber}</div>
                    <div className="text-xs text-[var(--text-muted)]">{o.shippingAddress || '—'}</div>
                    <div className="mt-1 text-[11px] uppercase text-[var(--text-muted)]">{o.status}</div>
                    <label className="mt-2 block text-[11px] text-[var(--text-muted)]">
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

      <section className={`${PANEL_CARD} p-4`}>
        <h2 className="text-sm font-bold text-[var(--text)]">{t('deliveryPaySettings')}</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{t('deliveryMapHint')}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            {t('deliveryPayMode')}
            <select
              className="input mt-1 w-full max-w-xs"
              value={payMode}
              onChange={(e) =>
                setPayMode(e.target.value as 'hourly' | 'per_order' | 'both')
              }
            >
              <option value="both">{t('deliveryPayModeBoth')}</option>
              <option value="hourly">{t('deliveryPayModeHourly')}</option>
              <option value="per_order">{t('deliveryPayModePerOrder')}</option>
            </select>
          </label>
          {(payMode === 'hourly' || payMode === 'both') && (
            <label className="block text-sm">
              {t('deliveryHourlyRate')}
              <input
                className="input mt-1"
                type="number"
                min={0}
                step={0.05}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
              />
            </label>
          )}
          {(payMode === 'per_order' || payMode === 'both') && (
            <label className="block text-sm">
              {t('deliveryPerOrderFee')}
              <input
                className="input mt-1"
                type="number"
                min={0}
                step={0.05}
                value={perOrderFee}
                onChange={(e) => setPerOrderFee(e.target.value)}
              />
            </label>
          )}
        </div>
        <button
          type="button"
          className="btn-primary mt-3"
          disabled={paySaving}
          onClick={() => void savePaySettings()}
        >
          {t('save')}
        </button>
      </section>
    </div>
  );
}
