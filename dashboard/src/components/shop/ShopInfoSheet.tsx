import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polygon, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bike, Clock, ExternalLink, Mail, MapPin, Phone, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { summarizeStoreHours } from '@/lib/shop-hours-display';

type Zone = {
  id: string;
  name: string;
  polygon: [number, number][]; // lng,lat
  minOrderAmount: string | number;
  deliveryFee: string | number;
  color?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  merchant: any;
  zones: Zone[];
};

type InfoTab = 'contact' | 'hours' | 'delivery';

const pinIcon = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#b91c1c;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

/**
 * Store info sheet: contact, hours, and delivery zones.
 */
export default function ShopInfoSheet({ open, onClose, merchant, zones }: Props) {
  const { t, locale } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<InfoTab>('contact');

  useEffect(() => {
    if (open) {
      setMounted(true);
      setTab('contact');
    }
  }, [open]);

  const center = useMemo((): [number, number] => {
    const lat = Number(merchant?.latitude);
    const lng = Number(merchant?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && !(Math.abs(lat) < 1e-5 && Math.abs(lng) < 1e-5)) {
      return [lat, lng];
    }
    return [46.8182, 8.2275];
  }, [merchant?.latitude, merchant?.longitude]);

  const hoursRows = useMemo(
    () => summarizeStoreHours(merchant?.storeHours, merchant?.channels, locale),
    [merchant?.storeHours, merchant?.channels, locale]
  );

  const addressLine = [merchant?.address, merchant?.city].filter(Boolean).join(', ');

  const mapsUrl =
    merchant?.latitude && merchant?.longitude
      ? `https://www.google.com/maps/dir/?api=1&destination=${merchant.latitude},${merchant.longitude}`
      : merchant?.address
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
            `${merchant.address} ${merchant.city || ''}`
          )}`
        : null;

  if (!open && !mounted) return null;

  const tabs: Array<{ id: InfoTab; label: string; icon: typeof MapPin }> = [
    { id: 'contact', label: t('shopContact'), icon: MapPin },
    { id: 'hours', label: t('shopHours'), icon: Clock },
    { id: 'delivery', label: t('shopDelivery'), icon: Bike },
  ];

  return (
    <div className={`fixed inset-0 z-[70] ${open ? '' : 'pointer-events-none'}`}>
      <button
        type="button"
        className={`absolute inset-0 bg-stone-900/40 transition ${open ? 'opacity-100' : 'opacity-0'}`}
        aria-label={t('shopClose')}
        onClick={onClose}
      />
      <div
        className={`absolute inset-x-4 top-[12%] mx-auto flex max-h-[80dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl transition sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-h-[90dvh] ${
          open ? 'opacity-100' : 'translate-y-4 opacity-0'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={t('shopStoreInfo')}
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2 shrink-0">
          <div className="flex min-w-0 items-center gap-2.5">
            {merchant?.shopLogoUrl ? (
              <img
                src={merchant.shopLogoUrl}
                alt=""
                className="h-9 w-9 rounded-full object-contain"
              />
            ) : null}
            <p className="truncate text-base font-bold tracking-tight">{merchant?.name}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-stone-100"
            onClick={onClose}
            aria-label={t('shopClose')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mx-4 mb-3 flex shrink-0 rounded-full bg-stone-100 p-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            const on = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold ${
                  on ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {tab === 'contact' ? (
            <div className="space-y-3">
              {addressLine ? (
                <p className="flex items-start gap-2 text-sm text-stone-700">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" strokeWidth={2} />
                  <span>{addressLine}</span>
                </p>
              ) : null}
              {mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:underline"
                >
                  {t('shopOpenInMaps')}
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                </a>
              ) : null}
              <div className="h-44 w-full overflow-hidden rounded-xl bg-stone-100">
                {mounted ? (
                  <MapContainer center={center} zoom={14} className="h-full w-full" scrollWheelZoom={false}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={center} icon={pinIcon} />
                    {zones.map((z, i) => {
                      const ring = (z.polygon || [])
                        .map((p) => [Number(p[1]), Number(p[0])] as [number, number])
                        .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
                      if (ring.length < 3) return null;
                      const color = z.color || ['#7c3aed', '#2563eb', '#ea580c', '#0d9488'][i % 4];
                      return (
                        <Polygon
                          key={z.id}
                          positions={ring}
                          pathOptions={{ color, fillColor: color, fillOpacity: 0.2, weight: 2 }}
                        />
                      );
                    })}
                  </MapContainer>
                ) : null}
              </div>
              {merchant?.phone ? (
                <a
                  href={`tel:${String(merchant.phone).replace(/\s+/g, '')}`}
                  className="flex items-center gap-2 text-sm text-stone-800"
                >
                  <Phone className="h-4 w-4 text-stone-400" strokeWidth={2} />
                  {merchant.phone}
                </a>
              ) : null}
              {merchant?.email ? (
                <a
                  href={`mailto:${merchant.email}`}
                  className="flex items-center gap-2 text-sm text-stone-800"
                >
                  <Mail className="h-4 w-4 text-stone-400" strokeWidth={2} />
                  {merchant.email}
                </a>
              ) : null}
            </div>
          ) : null}

          {tab === 'hours' ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">{t('shopOpeningHours')}</p>
              <div className="space-y-1 text-sm">
                {hoursRows.map((row) => (
                  <div key={row.label} className="flex justify-between gap-3">
                    <span className="text-stone-600">{row.label}</span>
                    <span className="text-right font-medium tabular-nums">{row.hours}</span>
                  </div>
                ))}
                {hoursRows.length === 0 ? (
                  <p className="text-stone-500 text-xs">{t('shopHoursNotSet')}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === 'delivery' ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">{t('shopDeliveryCosts')}</p>
              {zones.length > 0 ? (
                <ul className="space-y-1.5">
                  {zones.map((z, i) => {
                    const color = z.color || ['#7c3aed', '#2563eb', '#ea580c', '#0d9488'][i % 4];
                    return (
                      <li key={z.id} className="flex items-start gap-2 text-sm">
                        <span
                          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: color }}
                        />
                        <span className="min-w-0">
                          <span className="font-medium">{z.name}</span>
                          <span className="block text-xs text-stone-500">
                            {t('shopZoneMinFee')
                              .replace('{min}', Number(z.minOrderAmount || 0).toFixed(2))
                              .replace('{fee}', Number(z.deliveryFee || 0).toFixed(2))}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-stone-500">{t('shopNoDeliveryZones')}</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
