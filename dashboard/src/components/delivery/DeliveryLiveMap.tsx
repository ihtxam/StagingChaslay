import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const driverIcon = L.divIcon({
  className: '',
  html: `<div style="background:#0d9488;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)">🛵</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const destIcon = L.divIcon({
  className: '',
  html: `<div style="background:#dc2626;color:white;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)">📍</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

type Point = { latitude: number; longitude: number };

type Props = {
  store?: Point | null;
  destination?: Point | null;
  driver?: (Point & { name?: string; stale?: boolean }) | null;
  heightClass?: string;
};

const DEFAULT_CENTER: [number, number] = [47.3769, 8.5417];

export default function DeliveryLiveMap({
  store,
  destination,
  driver,
  heightClass = 'h-56',
}: Props) {
  const center = useMemo((): [number, number] => {
    if (driver && Number.isFinite(driver.latitude)) return [driver.latitude, driver.longitude];
    if (destination && Number.isFinite(destination.latitude))
      return [destination.latitude, destination.longitude];
    if (store && Number.isFinite(store.latitude)) return [store.latitude, store.longitude];
    return DEFAULT_CENTER;
  }, [store, destination, driver]);

  const route: [number, number][] = [];
  if (driver && destination) {
    route.push([driver.latitude, driver.longitude], [destination.latitude, destination.longitude]);
  }

  return (
    <div className={`overflow-hidden rounded-xl border border-stone-200 ${heightClass}`}>
      <MapContainer center={center} zoom={14} className="h-full w-full" scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {store && Number.isFinite(store.latitude) && Number.isFinite(store.longitude) ? (
          <Marker position={[store.latitude, store.longitude]} />
        ) : null}
        {destination &&
        Number.isFinite(destination.latitude) &&
        Number.isFinite(destination.longitude) ? (
          <Marker position={[destination.latitude, destination.longitude]} icon={destIcon} />
        ) : null}
        {driver &&
        !driver.stale &&
        Number.isFinite(driver.latitude) &&
        Number.isFinite(driver.longitude) ? (
          <Marker position={[driver.latitude, driver.longitude]} icon={driverIcon} />
        ) : null}
        {route.length === 2 ? <Polyline positions={route} color="#0d9488" weight={4} opacity={0.7} /> : null}
      </MapContainer>
    </div>
  );
}
