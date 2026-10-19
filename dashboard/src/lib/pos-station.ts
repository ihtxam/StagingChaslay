import api from '@/lib/api';
import { asArray } from '@/lib/safe-iterables';

export type PosStation = {
  id: string;
  locationId: string;
  name: string;
  sortOrder: number;
  isDefault: boolean;
  settings?: {
    kitchenPrinterName?: string | null;
    receiptPrinterName?: string | null;
  };
};

const DEVICE_STATION_KEY = 'manupos_device_station_v1';

function readDeviceMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DEVICE_STATION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeDeviceMap(map: Record<string, string>) {
  try {
    localStorage.setItem(DEVICE_STATION_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Default register for this physical tablet at a location (set once in POS settings). */
export function getDeviceDefaultStationId(locationId: string | null | undefined): string | null {
  if (!locationId) return null;
  const id = readDeviceMap()[locationId];
  return id && id.trim() ? id.trim() : null;
}

export function setDeviceDefaultStationId(
  locationId: string | null | undefined,
  stationId: string | null
) {
  if (!locationId) return;
  const map = readDeviceMap();
  if (!stationId) delete map[locationId];
  else map[locationId] = stationId;
  writeDeviceMap(map);
}

export function pickStationForLogin(
  stations: PosStation[],
  deviceDefaultId: string | null
): PosStation | null {
  if (!stations.length) return null;
  if (deviceDefaultId) {
    const hit = stations.find((s) => s.id === deviceDefaultId);
    if (hit) return hit;
  }
  const def = stations.find((s) => s.isDefault);
  return def || stations[0] || null;
}

export async function fetchPosStations(locationId: string): Promise<PosStation[]> {
  const res = await api.get(`/merchant/locations/${locationId}/stations`);
  return asArray<PosStation>(res.data?.stations);
}

export function needsStationPicker(stations: PosStation[]): boolean {
  return stations.length > 1;
}
