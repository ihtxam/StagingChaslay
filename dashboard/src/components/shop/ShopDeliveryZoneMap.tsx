import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polygon, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const ZONE_COLORS = ['#7c3aed', '#2563eb', '#ea580c', '#0d9488'];

const pinIcon = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#b91c1c;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

type ZoneLike = {
  id: string;
  polygon?: [number, number][];
  color?: string | null;
};

type Props = {
  center: [number, number];
  zones?: ZoneLike[];
  /** When true, zoom out to include all zone polygons (plus store pin). */
  fitToZones?: boolean;
  className?: string;
};

function FitMapBounds({
  center,
  points,
  fitToZones,
}: {
  center: [number, number];
  points: [number, number][];
  fitToZones: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (fitToZones && points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 13 });
      return;
    }
    map.setView(center, 14);
  }, [center, points, fitToZones, map]);
  return null;
}

/** Leaflet map with store pin and optional delivery zone polygons. */
export default function ShopDeliveryZoneMap({
  center,
  zones = [],
  fitToZones = false,
  className = 'h-44 w-full',
}: Props) {
  const zoneRings = useMemo(
    () =>
      zones
        .map((z) => {
          const ring = (z.polygon || [])
            .map((p) => [Number(p[1]), Number(p[0])] as [number, number])
            .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
          return { id: z.id, ring, color: z.color };
        })
        .filter((z) => z.ring.length >= 3),
    [zones]
  );

  const boundsPoints = useMemo(() => {
    const pts: [number, number][] = [center];
    for (const { ring } of zoneRings) pts.push(...ring);
    return pts;
  }, [center, zoneRings]);

  const shouldFit = fitToZones && zoneRings.length > 0;

  return (
    <div className={`overflow-hidden rounded-xl bg-stone-100 ${className}`}>
      <MapContainer center={center} zoom={14} className="h-full w-full" scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitMapBounds center={center} points={boundsPoints} fitToZones={shouldFit} />
        <Marker position={center} icon={pinIcon} />
        {zoneRings.map((z, i) => {
          const color = z.color || ZONE_COLORS[i % ZONE_COLORS.length];
          return (
            <Polygon
              key={z.id}
              positions={z.ring}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.2, weight: 2 }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
